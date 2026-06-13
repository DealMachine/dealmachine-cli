/**
 * Shared output formatting and body parsing helpers for CLI commands
 */

import chalk from 'chalk';
import * as fs from 'node:fs';
import ora, { type Ora } from 'ora';

// ============================================================================
// Quiet Mode — suppress spinners for non-interactive (agent) usage
// ============================================================================

/** Returns true if --quiet was passed or DM_QUIET=1 is set. */
export function isQuiet(): boolean {
  return process.argv.includes('--quiet') || process.env.DM_QUIET === '1';
}

/**
 * Create a spinner that respects quiet mode.
 * In quiet mode, returns a no-op spinner so callers don't need conditionals.
 */
export function createSpinner(text: string): Ora {
  if (isQuiet()) {
    return ora({ text, isSilent: true });
  }
  return ora(text);
}

// ============================================================================
// Body Parsing — supports --body JSON, -f file, or stdin pipe
// ============================================================================

export async function parseRequestBody(options: {
  body?: string;
  file?: string;
}): Promise<Record<string, unknown>> {
  // From --body flag (inline JSON)
  if (options.body) {
    try {
      return JSON.parse(options.body);
    } catch {
      console.error(chalk.red('Error: Invalid JSON in --body'));
      process.exit(1);
    }
  }

  // From -f / --file flag
  if (options.file) {
    try {
      const content = fs.readFileSync(options.file, 'utf-8');
      return JSON.parse(content);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      console.error(chalk.red(`Error reading file: ${msg}`));
      process.exit(1);
    }
  }

  // From stdin (piped input)
  if (!process.stdin.isTTY) {
    try {
      const chunks: Buffer[] = [];
      for await (const chunk of process.stdin) {
        chunks.push(chunk);
      }
      const content = Buffer.concat(chunks).toString('utf-8').trim();
      if (content) {
        return JSON.parse(content);
      }
    } catch {
      console.error(chalk.red('Error: Invalid JSON from stdin'));
      process.exit(1);
    }
  }

  console.error(chalk.red('Error: No request body provided.'));
  console.error(chalk.dim('Provide JSON via one of:'));
  console.error(chalk.dim('  --body \'{"key":"value"}\''));
  console.error(chalk.dim('  -f request.json'));
  console.error(chalk.dim('  echo \'{"key":"value"}\' | dm <command>'));
  process.exit(1);
}

// ============================================================================
// Output Formatting
// ============================================================================

export function printJson(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

export function printTable(
  rows: Record<string, unknown>[],
  columns?: string[]
): void {
  if (rows.length === 0) {
    console.log(chalk.dim('  (no results)'));
    return;
  }

  // Auto-detect columns from first row if not specified
  const cols = columns || Object.keys(rows[0]);

  // Calculate column widths
  const widths = cols.map((col) => {
    const headerLen = col.length;
    const maxDataLen = rows.reduce((max, row) => {
      const val = formatValue(row[col]);
      return Math.max(max, val.length);
    }, 0);
    return Math.min(Math.max(headerLen, maxDataLen), 40);
  });

  // Print header
  const header = cols.map((col, i) => col.padEnd(widths[i])).join('  ');
  console.log(chalk.bold(header));
  console.log(chalk.dim('─'.repeat(header.length)));

  // Print rows
  for (const row of rows) {
    const line = cols
      .map((col, i) => {
        const val = formatValue(row[col]);
        return val.padEnd(widths[i]);
      })
      .join('  ');
    console.log(line);
  }
}

export function printKeyValue(data: Record<string, unknown>, indent = 2): void {
  const pad = ' '.repeat(indent);
  const maxKeyLen = Math.max(...Object.keys(data).map((k) => k.length));

  for (const [key, value] of Object.entries(data)) {
    const label = key.padEnd(maxKeyLen);
    console.log(`${pad}${chalk.cyan(label)}  ${formatValue(value)}`);
  }
}

export function printHeader(title: string): void {
  console.log();
  console.log(chalk.bold(title));
  console.log(chalk.dim('─'.repeat(50)));
}

export function printPagination(pagination: {
  page: number;
  per_page: number;
  total_results: number;
  total_pages: number;
}): void {
  console.log();
  console.log(
    chalk.dim(
      `Page ${pagination.page} of ${pagination.total_pages} (${pagination.total_results} total results)`
    )
  );
}

export function printTotals(totals: Record<string, number>): void {
  const parts = Object.entries(totals).map(
    ([key, val]) => `${chalk.cyan(key)}: ${val}`
  );
  console.log(chalk.dim('  ' + parts.join('  |  ')));
}

export function printCredits(credits: {
  used: number;
  properties?: number;
  people?: number;
  deduplicated?: number;
}): void {
  const parts = [`${chalk.cyan('credits used')}: ${credits.used}`];
  if (credits.deduplicated && credits.deduplicated > 0) {
    parts.push(`${chalk.cyan('deduplicated')}: ${credits.deduplicated}`);
  }
  console.log(chalk.dim('  ' + parts.join('  |  ')));
}

export function printWarning(warning: string): void {
  console.log(chalk.yellow(`  Warning: ${warning}`));
}

export function formatCurrency(value: unknown, fallback = '-'): string {
  const amount = parseFormattedNumber(value);
  return amount == null ? fallback : `$${amount.toLocaleString()}`;
}

// ============================================================================
// Helpers
// ============================================================================

function parseFormattedNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (!trimmed || trimmed === '-' || (trimmed.length === 1 && trimmed.charCodeAt(0) === 0x2014)) {
    return null;
  }

  const isNegative = /^\(.*\)$/.test(trimmed);
  const normalized = trimmed.replace(/^\((.*)\)$/, '$1').replace(/[$,%\s,]/g, '');
  if (!normalized) return null;

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  return isNegative ? -parsed : parsed;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return chalk.dim('—');
  if (typeof value === 'boolean') return value ? chalk.green('yes') : chalk.dim('no');
  if (typeof value === 'number') return value.toLocaleString();
  if (Array.isArray(value)) return `[${value.length} items]`;
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/** Truncate a string to maxLen with ellipsis */
export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + '…';
}
