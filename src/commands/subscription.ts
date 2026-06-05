/**
 * Subscription commands — status
 */

import chalk from 'chalk';

import { apiRequest, formatDate } from '../lib/client.js';
import { printJson, printHeader, printKeyValue, createSpinner } from '../lib/output.js';

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

  const statusColor =
    data.status === 'active' ? chalk.green : data.status === 'trialing' ? chalk.yellow : chalk.red;

  printKeyValue({
    Status: statusColor(data.status),
    Plan: `${data.plan.name}${data.plan.is_paid ? '' : chalk.dim(' (free)')}`,
    Trialing: data.trial.is_trialing
      ? `Yes — ends ${data.trial.trial_end ? formatDate(data.trial.trial_end) : 'Unknown'}`
      : 'No',
    'Billing Cycle': `${formatDate(data.billing_cycle.start)} → ${formatDate(data.billing_cycle.end)}`,
    'Data Credit Cap': data.credits.enrichment_cap.toLocaleString(),
    'AI Cap': data.credits.ai_cap.toLocaleString(),
  });

  if (data.trial.is_trialing) {
    console.log();
    console.log(chalk.dim(`  Trial data credits: ${data.trial.enrichment_credits}`));
  }

  console.log();
}
