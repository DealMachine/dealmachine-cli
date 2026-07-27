/**
 * Phones commands — DNC (Do Not Call) check
 */

import chalk from 'chalk';

import { apiRequest } from '../lib/client.js';
import {
  parseRequestBody,
  printJson,
  printHeader,
  printTotals,
  printCredits,
  createSpinner,
} from '../lib/output.js';

// ============================================================================
// Types
// ============================================================================

interface DncResult {
  input: { number: string };
  matched: boolean;
  do_not_call?: boolean;
  phone_type?: string;
  match_failure?: { code: string; reason: string };
}

interface DncResponse {
  data: DncResult[];
  totals: {
    submitted: number;
    matched: number;
    unmatched: number;
  };
  credits: { used: number; people: number; deduplicated: number };
}

// ============================================================================
// DNC Check
// ============================================================================

export async function phonesDnc(
  phoneNumber: string | undefined,
  options: {
    body?: string;
    file?: string;
    json?: boolean;
  }
): Promise<void> {
  let requestBody: Record<string, unknown>;

  if (phoneNumber) {
    requestBody = {
      phones: [{ number: phoneNumber }],
    };
  } else {
    requestBody = await parseRequestBody(options);
  }

  const spinner = createSpinner('Checking DNC status...').start();
  const data = await apiRequest<DncResponse>('/phones/dnc', {
    method: 'POST',
    body: requestBody,
  });
  spinner.stop();

  if (options.json) {
    printJson(data);
    return;
  }

  printHeader('DNC Check Results');
  printTotals({
    submitted: data.totals.submitted,
    matched: data.totals.matched,
    unmatched: data.totals.unmatched,
  });
  console.log();

  for (const item of data.data) {
    if (item.matched) {
      const dnc =
        item.do_not_call === true
          ? chalk.red('DNC')
          : item.do_not_call === false
            ? chalk.green('OK')
            : chalk.yellow('UNKNOWN');
      const type = item.phone_type ? chalk.dim(` (${item.phone_type})`) : '';
      console.log(`  ${chalk.green('✓ matched')}   ${item.input.number}  ${dnc}${type}`);
    } else {
      const reason = item.match_failure?.reason || 'No match';
      console.log(`  ${chalk.red('✗ no match')}  ${item.input.number}`);
      console.log(chalk.dim(`               ${reason}`));
    }
  }

  console.log();
  printCredits(data.credits);
  console.log();
}
