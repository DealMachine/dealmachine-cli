/**
 * Subscription commands — status and end-trial
 */

import chalk from 'chalk';

import { apiRequest, formatDate } from '../lib/client.js';
import {
  printJson,
  printHeader,
  printKeyValue,
  createSpinner,
} from '../lib/output.js';

// ============================================================================
// Types
// ============================================================================

interface SubscriptionStatus {
  status: string;
  plan: {
    name: string;
    is_paid: boolean;
  };
  trial: {
    is_trialing: boolean;
    trial_end: string | null;
    enrichment_credits: number;
  };
  billing_cycle: {
    start: string;
    end: string;
  };
  credits: {
    enrichment_cap: number;
    ai_cap: number;
  };
}

interface EndTrialResponse {
  success: boolean;
  subscription_id: string;
  status: string;
  message: string;
}

// ============================================================================
// Status
// ============================================================================

export async function subscriptionStatus(options: { json?: boolean }): Promise<void> {
  const spinner = createSpinner('Fetching subscription...').start();
  const data = await apiRequest<SubscriptionStatus>('/subscription');
  spinner.stop();

  if (options.json) {
    printJson(data);
    return;
  }

  printHeader('Subscription');

  const statusColor = data.status === 'active'
    ? chalk.green
    : data.status === 'trialing'
      ? chalk.yellow
      : chalk.red;

  printKeyValue({
    'Status': statusColor(data.status),
    'Plan': `${data.plan.name}${data.plan.is_paid ? '' : chalk.dim(' (free)')}`,
    'Trialing': data.trial.is_trialing ? `Yes — ends ${formatDate(data.trial.trial_end!)}` : 'No',
    'Billing Cycle': `${formatDate(data.billing_cycle.start)} → ${formatDate(data.billing_cycle.end)}`,
    'Enrichment Cap': data.credits.enrichment_cap.toLocaleString(),
    'AI Cap': data.credits.ai_cap.toLocaleString(),
  });

  if (data.trial.is_trialing) {
    console.log();
    console.log(chalk.dim(`  Trial enrichment credits: ${data.trial.enrichment_credits}`));
    console.log(chalk.dim(`  End trial early: dm subscription end-trial`));
  }

  console.log();
}

// ============================================================================
// End Trial
// ============================================================================

export async function subscriptionEndTrial(options: { json?: boolean }): Promise<void> {
  const spinner = createSpinner('Ending trial...').start();
  const data = await apiRequest<EndTrialResponse>('/subscription/end-trial', {
    method: 'POST',
    body: {},
  });
  spinner.stop();

  if (options.json) {
    printJson(data);
    return;
  }

  printHeader('Trial Ended');
  printKeyValue({
    'Status': chalk.green(data.status),
    'Subscription ID': data.subscription_id,
    'Message': data.message,
  });
  console.log();
}
