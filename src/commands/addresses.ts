/**
 * Addresses command — Validate addresses
 */

import chalk from 'chalk';

import { apiRequest } from '../lib/client.js';
import {
  parseRequestBody,
  printJson,
  printHeader,
  printTotals,
  printCredits,
  printWarning,
  createSpinner,
} from '../lib/output.js';

interface ValidateResponse {
  data: Record<string, unknown>[];
  totals: {
    submitted: number;
    valid: number;
    corrected: number;
    invalid: number;
  };
  credits: { used: number; properties: number; people: number; deduplicated: number };
  warning?: string;
}

export async function addressesValidate(
  address: string | undefined,
  options: {
    body?: string;
    file?: string;
    json?: boolean;
  }
): Promise<void> {
  let requestBody: Record<string, unknown>;

  if (address) {
    // Quick mode: single address from positional arg
    requestBody = {
      data: [{ full_address: address }],
    };
  } else {
    requestBody = await parseRequestBody(options);
  }

  const spinner = createSpinner('Validating addresses...').start();
  const data = await apiRequest<ValidateResponse>('/addresses/validate', {
    method: 'POST',
    body: requestBody,
  });
  spinner.stop();

  if (options.json) {
    printJson(data);
    return;
  }

  printHeader('Address Validation');
  printTotals({
    submitted: data.totals.submitted,
    valid: data.totals.valid,
    corrected: data.totals.corrected,
    invalid: data.totals.invalid,
  });
  if (data.warning) printWarning(data.warning);
  console.log();

  for (const item of data.data) {
    const status = item.status as string;
    const input = item.input as Record<string, unknown>;
    const inputStr = input.full_address || [input.street, input.city, input.state, input.zip].filter(Boolean).join(', ');

    if (status === 'valid') {
      console.log(`  ${chalk.green('✓ valid')}     ${item.standardized_address}`);
    } else if (status === 'corrected') {
      console.log(`  ${chalk.yellow('~ corrected')} ${item.standardized_address}`);
      const corrections = item.corrections as string[];
      if (corrections && corrections.length > 0) {
        console.log(chalk.dim(`               corrections: ${corrections.join(', ')}`));
      }
      console.log(chalk.dim(`               from: ${inputStr}`));
    } else {
      const error = item.error as { code: string; reason: string };
      console.log(`  ${chalk.red('✗ invalid')}   ${inputStr}`);
      console.log(chalk.dim(`               ${error?.reason || 'Unknown error'}`));
    }
  }

  console.log();
  printCredits(data.credits);
  console.log();
}
