/**
 * Subscribe command — subscribe to a DealMachine plan.
 * Fetches plans (public), then creates a checkout session (authenticated).
 */

import chalk from 'chalk';
import ora from 'ora';
import open from 'open';
import { apiRequest, getApiBaseUrl } from '../lib/client.js';

interface SubscribeOptions {
  plan: string;
  quantity?: string;
  interval?: 'monthly' | 'annual';
}

// Friendly name → plan name mapping
const PLAN_ALIASES: Record<string, string> = {
  solo: 'Solo',
  'solo-pro': 'Solo Pro',
  solopro: 'Solo Pro',
  scale: 'Scale',
  'scale-pro': 'Scale Pro',
  scalepro: 'Scale Pro',
};

interface PlanResponse {
  id: string;
  name: string;
  type: 'solo' | 'scale';
  pricing: { is_per_user: boolean };
  stripe_price_ids: { monthly: string; annual: string };
  seats?: { min?: number; max?: number };
}

interface PlansListResponse {
  plans: PlanResponse[];
}

export async function subscribe(options: SubscribeOptions): Promise<void> {
  const baseUrl = getApiBaseUrl();
  const interval = options.interval || 'monthly';
  const quantity = options.quantity ? parseInt(options.quantity, 10) : 1;

  // 1. Fetch plans (public — raw fetch, no auth)
  const spinner = ora('Fetching plans...').start();

  let plansData: PlansListResponse;
  try {
    const response = await fetch(`${baseUrl}/plans`, {
      headers: { 'User-Agent': 'dm-cli/0.1.0' },
    });
    if (!response.ok) {
      spinner.fail('Failed to fetch plans');
      process.exit(1);
    }
    plansData = (await response.json()) as PlansListResponse;
  } catch (error) {
    spinner.fail('Failed to connect to API');
    const message = error instanceof Error ? error.message : 'Network error';
    console.error(chalk.red(`Error: ${message}`));
    process.exit(1);
  }

  // 2. Resolve plan by friendly name
  const planName = PLAN_ALIASES[options.plan.toLowerCase()] || options.plan;
  const plan = plansData.plans.find(
    (p) => p.name.toLowerCase() === planName.toLowerCase(),
  );

  if (!plan) {
    spinner.fail(`Plan "${options.plan}" not found`);
    console.log('');
    console.log('Available plans:');
    for (const p of plansData.plans) {
      console.log(`  ${chalk.cyan(p.name.toLowerCase().replace(/\s+/g, '-'))}  →  ${p.name}`);
    }
    process.exit(1);
  }

  const priceId =
    interval === 'annual'
      ? plan.stripe_price_ids.annual
      : plan.stripe_price_ids.monthly;

  spinner.text = 'Creating checkout session...';

  // 3. Create checkout session (authenticated)
  const checkoutData = await apiRequest<{
    checkout_url: string;
    session_id: string;
    expires_at: string;
  }>('/checkout', {
    method: 'POST',
    body: { price_id: priceId, quantity },
  });

  spinner.succeed('Checkout session created');

  console.log('');
  console.log(`Plan: ${chalk.cyan(plan.name)} (${interval})`);
  if (plan.pricing.is_per_user) {
    console.log(`Seats: ${chalk.cyan(String(quantity))}`);
  }
  console.log('');

  // 4. Open checkout URL in browser
  console.log(chalk.bold('Opening checkout in your browser...'));
  console.log('');
  console.log(`  ${chalk.dim(checkoutData.checkout_url)}`);
  console.log('');

  try {
    await open(checkoutData.checkout_url);
  } catch {
    console.log(chalk.yellow('Could not open browser automatically.'));
    console.log('Copy the URL above and open it in your browser.');
  }
}
