/**
 * Public API onboarding commands.
 */

import chalk from 'chalk';
import { apiRequest, getApiBaseUrl, type ApiError } from '../lib/client.js';
import { readConfig, writeConfig, type ApiEnvironment } from '../lib/config.js';
import { createSpinner, printHeader, printJson, printTable } from '../lib/output.js';
import { CLI_USER_AGENT } from '../version.js';

interface SignupResponse {
  api_key: string;
  key_id: string;
  organization: {
    id: number;
    name: string;
    slug: string;
  };
  message: string;
}

interface PublicPlan {
  id: string;
  name: string;
  description: string;
  type: 'solo';
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
  stripe_price_ids: {
    monthly: string;
    annual: string;
  };
  features: string[];
  seats: {
    min: number | null;
    max: number | null;
  };
}

interface PlansResponse {
  plans: PublicPlan[];
  free_tier: {
    enrichment_credit_cap: number;
    ai_credit_cap: number;
    api_access?: boolean;
    counts_and_estimates_cost_credits?: boolean;
    enrichment_requires_subscription?: boolean;
    available_operations?: string[];
  };
}

interface CheckoutResponse {
  checkout_url: string;
  session_id: string;
  expires_at: string;
  payment_status?: 'pending';
  next_step?: string;
}

async function publicApiRequest<T>(
  path: string,
  options: {
    method?: 'GET' | 'POST';
    body?: Record<string, unknown>;
    query?: Record<string, string | number | boolean | undefined>;
  } = {}
): Promise<T> {
  const { method = 'GET', body, query } = options;
  const url = new URL(`${getApiBaseUrl()}${path}`);

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': CLI_USER_AGENT,
    },
    ...(body && { body: JSON.stringify(body) }),
  });

  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as ApiError;
    const message = error.error?.message || `Request failed with status ${response.status}`;
    const code = error.error?.code ? ` [${error.error.code}]` : '';
    console.error(chalk.red(`Error: ${message}${code}`));
    console.error(chalk.dim(`  ${method} ${path} -> ${response.status}`));
    process.exit(1);
  }

  return response.json() as Promise<T>;
}

function centsToDollars(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

export async function signup(options: {
  email: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  env?: ApiEnvironment;
  login?: boolean;
  json?: boolean;
}): Promise<void> {
  if (options.env) {
    process.env.DM_ENV = options.env;
  }

  const spinner = createSpinner('Creating account...').start();
  const data = await publicApiRequest<SignupResponse>('/signup', {
    method: 'POST',
    body: {
      email: options.email,
      ...(options.firstName && { first_name: options.firstName }),
      ...(options.lastName && { last_name: options.lastName }),
      ...(options.phoneNumber && { phone_number: options.phoneNumber }),
    },
  });
  spinner.stop();

  if (options.login) {
    writeConfig({
      apiKey: data.api_key,
      keyId: data.key_id,
      organizationId: data.organization.id,
      organizationName: data.organization.name,
      organizationSlug: data.organization.slug,
      ...(options.env && { apiEnvironment: options.env }),
    });
  }

  if (options.json) {
    if (options.login) {
      const { api_key: _credential, ...account } = data;
      printJson({ ...account, api_key_saved: true, message: 'Account created and credential saved locally.' });
    } else printJson(data);
    return;
  }

  printHeader('Account Created');
  console.log(`  ${chalk.cyan('Organization:')}  ${data.organization.name}`);
  console.log(`  ${chalk.cyan('Org ID:')}        ${data.organization.id}`);
  console.log(`  ${chalk.cyan('Key ID:')}        ${data.key_id}`);
  if (!options.login) console.log(`  ${chalk.cyan('API Key:')}       ${data.api_key}`);
  console.log();
  if (options.login) {
    console.log(chalk.green('Saved this API key for the CLI.'));
  } else {
    console.log(chalk.yellow('Store this API key securely. It is shown once.'));
    console.log(chalk.dim(`Run ${chalk.cyan('dm login --key <api-key>')} to store it locally.`));
  }
  console.log();
}

export async function plans(options: {
  type?: 'solo';
  env?: ApiEnvironment;
  json?: boolean;
}): Promise<void> {
  if (options.env) {
    process.env.DM_ENV = options.env;
  }

  const data = readConfig()?.apiKey
    ? await apiRequest<PlansResponse>('/account/plans')
    : await publicApiRequest<PlansResponse>('/plans', { query: { type: options.type } });

  if (options.json) {
    printJson(data);
    return;
  }

  printHeader('Free API Access');
  console.log('  Counts, supported cost estimates, field discovery and account access cost no data credits.');
  console.log(`  Starter data credits: ${data.free_tier.enrichment_credit_cap}. Enrichment requires a paid plan.`);
  console.log();
  printHeader('Self-Serve Plans');
  printTable(
    data.plans.map((plan) => ({
      Plan: plan.name,
      Monthly: centsToDollars(plan.pricing.monthly_price_cents),
      Annual: centsToDollars(plan.pricing.annual_price_cents),
      Credits: plan.credits.enrichment_per_month.toLocaleString(),
      Seats: plan.seats.max ? `${plan.seats.min ?? 1}-${plan.seats.max}` : `${plan.seats.min ?? 1}+`,
      'Monthly Price ID': plan.stripe_price_ids.monthly,
      'Annual Price ID': plan.stripe_price_ids.annual,
    }))
  );
  console.log();
  for (const plan of data.plans) console.log(`  ${plan.name}: ${plan.features.join('; ')}`);
  console.log(chalk.dim('Use a price ID with dm checkout to review the plan. Add --yes only after approval.'));
  console.log(chalk.dim('Scale and private offer plans are not available through self-serve checkout.'));
  console.log();
}

export async function checkout(options: {
  priceId: string;
  yes?: boolean;
  quantity?: string;
  json?: boolean;
}): Promise<void> {
  const quantity = Number(options.quantity ?? '1');
  if (!/^\d+$/.test(options.quantity ?? '1') || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 100) {
    console.error(chalk.red('Error: --quantity must be a positive integer'));
    process.exit(1);
  }

  const catalog = await apiRequest<PlansResponse>('/account/plans');
  const plan = catalog.plans.find(item => Object.values(item.stripe_price_ids).includes(options.priceId));
  if (!plan) {
    console.error(chalk.red('This price is not available for your workspace. Run dm plans again.'));
    process.exit(1);
  }
  const interval = plan.stripe_price_ids.monthly === options.priceId ? 'month' : 'year';
  const unitPrice = interval === 'month' ? plan.pricing.monthly_price_cents : plan.pricing.annual_price_cents;
  const quote = { plan: plan.name, currency: plan.pricing.currency, amount_cents: unitPrice * quantity,
    billing_interval: interval, quantity, features: plan.features, credits: plan.credits };
  if (!options.yes) {
    const preview = { checkout_created: false, confirmation_required: true, quote,
      next_step: 'Review this recurring price with the customer. After explicit approval, rerun with --yes to create a Stripe checkout link. Payment is completed on Stripe.' };
    if (options.json) printJson(preview);
    else {
      printHeader('Review Plan');
      console.log(`  ${plan.name}: ${quote.currency.toUpperCase()} ${(quote.amount_cents / 100).toFixed(2)} per ${interval}, ${quantity} seat(s).`);
      console.log(`  ${preview.next_step}`);
    }
    return;
  }
  const spinner = createSpinner('Creating checkout session...').start();
  const data = await apiRequest<CheckoutResponse>('/checkout', {
    method: 'POST',
    body: {
      price_id: options.priceId,
      quantity,
    },
  });
  spinner.stop();

  if (options.json) {
    printJson(data);
    return;
  }

  printHeader('Checkout Pending Payment');
  console.log(`  ${chalk.cyan('URL:')}        ${data.checkout_url}`);
  console.log(`  ${chalk.cyan('Session ID:')} ${data.session_id}`);
  console.log(`  ${chalk.cyan('Expires:')}    ${new Date(data.expires_at).toLocaleString()}`);
  console.log('  Complete payment on Stripe, then run dm account --json and dm usage before retrying paid work.');
  console.log();
}
