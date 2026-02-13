/**
 * Usage command — Show credit usage for current billing cycle
 */

import chalk from 'chalk';
import { apiRequest } from '../lib/client.js';
import { printHeader, printJson } from '../lib/output.js';

interface UsageResponse {
  plan: {
    name: string;
    is_paid: boolean;
  };
  billing_cycle: {
    start: string;
    end: string;
  };
  credits: {
    included: number;
    used: number;
    remaining: number;
    overage: number;
    breakdown: {
      properties: number;
      people: number;
      companies: number;
    };
  };
}

export async function usage(options: { json?: boolean }): Promise<void> {
  const data = await apiRequest<UsageResponse>('/usage');

  if (options.json) {
    printJson(data);
    return;
  }

  printHeader('Credit Usage');

  const pct = data.credits.included > 0
    ? Math.round((data.credits.used / data.credits.included) * 100)
    : 0;

  console.log(`  ${chalk.cyan('Plan:')}         ${data.plan.name}${data.plan.is_paid ? '' : chalk.dim(' (free)')}`);
  console.log(`  ${chalk.cyan('Cycle:')}        ${fmtDate(data.billing_cycle.start)} — ${fmtDate(data.billing_cycle.end)}`);
  console.log();
  console.log(`  ${chalk.cyan('Credits:')}      ${data.credits.used.toLocaleString()} / ${data.credits.included.toLocaleString()} (${pct}%)`);
  console.log(`  ${chalk.cyan('Remaining:')}    ${data.credits.remaining.toLocaleString()}`);
  if (data.credits.overage > 0) {
    console.log(`  ${chalk.yellow('Overage:')}      ${data.credits.overage.toLocaleString()}`);
  }
  console.log();
  console.log(chalk.dim('  Breakdown:'));
  console.log(`    Properties: ${data.credits.breakdown.properties.toLocaleString()}`);
  console.log(`    People:     ${data.credits.breakdown.people.toLocaleString()}`);
  if (data.credits.breakdown.companies > 0) {
    console.log(`    Companies:  ${data.credits.breakdown.companies.toLocaleString()}`);
  }
  console.log();
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
