/**
 * Plans command — list available DealMachine subscription plans.
 * Uses raw fetch (no auth) since GET /v1/plans is public.
 */

import chalk from 'chalk';
import { getApiBaseUrl } from '../lib/client.js';

interface PlanResponse {
  id: string;
  name: string;
  description: string;
  type: 'solo' | 'scale';
  pricing: {
    currency: string;
    monthly_price_cents: number;
    annual_price_cents: number;
    is_per_user: boolean;
  };
  credits: {
    enrichment_per_month: number;
    enrichment_per_year: number;
    ai_per_month: number;
  };
  features: string[];
  stripe_price_ids: {
    monthly: string;
    annual: string;
  };
  seats?: {
    min?: number;
    max?: number;
  };
}

interface PlansListResponse {
  plans: PlanResponse[];
  free_tier: {
    enrichment_credit_cap: number;
    ai_credit_cap: number;
  };
}

interface PlansOptions {
  type?: 'solo' | 'scale';
  json?: boolean;
}

export async function plans(options: PlansOptions): Promise<void> {
  const baseUrl = getApiBaseUrl();
  let url = `${baseUrl}/plans`;
  if (options.type) {
    url += `?type=${options.type}`;
  }

  const response = await fetch(url, {
    headers: { 'User-Agent': 'dm-cli/0.1.0' },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    console.error(chalk.red(`Error: ${(error as any).error?.message || `Request failed (${response.status})`}`));
    process.exit(1);
  }

  const data = (await response.json()) as PlansListResponse;

  if (options.json) {
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  // Header
  console.log('');
  console.log(chalk.bold('Available Plans'));
  console.log(chalk.dim(`Free tier: ${data.free_tier.enrichment_credit_cap} enrichment credits (lifetime)`));
  console.log('');

  // Table
  const header = [
    'Name'.padEnd(12),
    'Type'.padEnd(6),
    'Monthly'.padEnd(10),
    'Annual'.padEnd(10),
    'Credits/mo'.padEnd(12),
    'Features',
  ].join('  ');

  console.log(chalk.dim(header));
  console.log(chalk.dim('─'.repeat(80)));

  for (const plan of data.plans) {
    const monthly = `$${(plan.pricing.monthly_price_cents / 100).toFixed(0)}${plan.pricing.is_per_user ? '/user' : ''}`;
    const annual = `$${(plan.pricing.annual_price_cents / 100).toFixed(0)}${plan.pricing.is_per_user ? '/user' : ''}`;
    const credits = plan.credits.enrichment_per_month.toLocaleString();
    const seats = plan.seats ? ` (${plan.seats.min}–${plan.seats.max} seats)` : '';

    const row = [
      chalk.cyan(plan.name.padEnd(12)),
      plan.type.padEnd(6),
      monthly.padEnd(10),
      annual.padEnd(10),
      credits.padEnd(12),
      `${plan.features.length} features${seats}`,
    ].join('  ');

    console.log(row);
  }

  console.log('');
  console.log(chalk.dim('Use dm subscribe --plan <name> to subscribe.'));
}
