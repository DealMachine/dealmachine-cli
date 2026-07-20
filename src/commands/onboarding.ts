/**
 * Public API onboarding commands.
 */

import chalk from 'chalk';
import { apiRequest, getApiBaseUrl, type ApiError } from '../lib/client.js';
import { writeConfig, type ApiEnvironment } from '../lib/config.js';
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
  };
}

interface CheckoutResponse {
  checkout_url: string;
  session_id: string;
  expires_at: string;
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
    printJson(data);
    return;
  }

  printHeader('Account Created');
  console.log(`  ${chalk.cyan('Organization:')}  ${data.organization.name}`);
  console.log(`  ${chalk.cyan('Org ID:')}        ${data.organization.id}`);
  console.log(`  ${chalk.cyan('Key ID:')}        ${data.key_id}`);
  console.log(`  ${chalk.cyan('API Key:')}       ${data.api_key}`);
  console.log();
  console.log(chalk.yellow('Store this API key securely. It is shown once.'));
  if (options.login) {
    console.log(chalk.green('Saved this API key for the CLI.'));
  } else {
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

  const data = await publicApiRequest<PlansResponse>('/plans', {
    query: {
      type: options.type,
    },
  });

  if (options.json) {
    printJson(data);
    return;
  }

  printHeader('Self-Serve Plans');
  printTable(
    data.plans.map((plan) => ({
      Plan: plan.name,
      Monthly: centsToDollars(plan.pricing.monthly_price_cents),
      Annual: centsToDollars(plan.pricing.annual_price_cents),
      Credits: plan.credits.enrichment_per_month.toLocaleString(),
      Seats: plan.seats.max ? `${plan.seats.min ?? 1}-${plan.seats.max}` : `${plan.seats.min ?? 1}+`,
      'Monthly Price ID': plan.stripe_price_ids.monthly,
    }))
  );
  console.log();
  console.log(chalk.dim('Use the monthly or annual price ID with dm checkout.'));
  console.log(chalk.dim('Scale and private offer plans are not available through self-serve checkout.'));
  console.log();
}

export async function checkout(options: {
  priceId: string;
  quantity?: string;
  json?: boolean;
}): Promise<void> {
  const quantity = Number.parseInt(options.quantity || '1', 10);
  if (!Number.isInteger(quantity) || quantity < 1) {
    console.error(chalk.red('Error: --quantity must be a positive integer'));
    process.exit(1);
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

  printHeader('Checkout Session');
  console.log(`  ${chalk.cyan('URL:')}        ${data.checkout_url}`);
  console.log(`  ${chalk.cyan('Session ID:')} ${data.session_id}`);
  console.log(`  ${chalk.cyan('Expires:')}    ${new Date(data.expires_at).toLocaleString()}`);
  console.log();
}
