/**
 * People commands — search, get, ids, count
 */

import chalk from 'chalk';
import ora from 'ora';
import { apiRequest } from '../lib/client.js';
import {
  parseRequestBody,
  printJson,
  printHeader,
  printTable,
  printPagination,
  printTotals,
  printCredits,
  printWarning,
  truncate,
} from '../lib/output.js';

// ============================================================================
// Types
// ============================================================================

interface SearchResponse {
  totals: { people: number; properties: number };
  credits: { used: number; properties: number; people: number; deduplicated: number };
  data: Record<string, unknown>[];
  pagination: {
    page: number;
    per_page: number;
    total_results: number;
    total_pages: number;
    has_next_page: boolean;
    has_previous_page: boolean;
  };
  warning?: string;
}

interface CountResponse {
  total_people: number;
  total_properties: number;
  total_results: number;
}

interface GetPersonResponse {
  data: Record<string, unknown>;
  credits: { used: number; properties: number; people: number; deduplicated: number };
}

interface BatchResponse {
  data: Record<string, unknown>[];
  totals: { submitted: number; found: number; not_found: number };
  credits: { used: number; properties: number; people: number; deduplicated: number };
  warning?: string;
}

// ============================================================================
// Search
// ============================================================================

export async function peopleSearch(options: {
  body?: string;
  file?: string;
  json?: boolean;
}): Promise<void> {
  const requestBody = await parseRequestBody(options);

  const spinner = ora('Searching people...').start();
  const data = await apiRequest<SearchResponse>('/people/search', {
    method: 'POST',
    body: requestBody,
  });
  spinner.stop();

  if (options.json) {
    printJson(data);
    return;
  }

  printHeader('People Search Results');
  printTotals({ people: data.totals.people, properties: data.totals.properties });
  if (data.warning) printWarning(data.warning);
  console.log();

  if (data.data.length > 0) {
    const rows = data.data.map((p) => ({
      id: p.dm_person_id || '',
      name: truncate(String(p.full_name || ''), 25),
      phones: Array.isArray(p.phones) ? String(p.phones.length) : '—',
      emails: Array.isArray(p.emails) ? String(p.emails.length) : '—',
    }));
    printTable(rows, ['id', 'name', 'phones', 'emails']);
  }

  printPagination(data.pagination);
  printCredits(data.credits);
  console.log();
}

// ============================================================================
// Count
// ============================================================================

export async function peopleCount(options: {
  body?: string;
  file?: string;
  json?: boolean;
}): Promise<void> {
  const requestBody = await parseRequestBody(options);

  const spinner = ora('Counting people...').start();
  const data = await apiRequest<CountResponse>('/people/search/count', {
    method: 'POST',
    body: requestBody,
  });
  spinner.stop();

  if (options.json) {
    printJson(data);
    return;
  }

  printHeader('People Count');
  console.log(`  ${chalk.cyan('People:')}      ${data.total_people.toLocaleString()}`);
  console.log(`  ${chalk.cyan('Properties:')}  ${data.total_properties.toLocaleString()}`);
  console.log(`  ${chalk.cyan('Total:')}       ${data.total_results.toLocaleString()}`);
  console.log();
}

// ============================================================================
// Get by ID
// ============================================================================

export async function peopleGet(
  id: string,
  options: { includeProperties?: boolean; json?: boolean }
): Promise<void> {
  const query: Record<string, string> = {};
  if (options.includeProperties) query.include_properties = 'true';

  const spinner = ora('Fetching person...').start();
  const data = await apiRequest<GetPersonResponse>(`/people/${id}`, { query });
  spinner.stop();

  if (options.json) {
    printJson(data);
    return;
  }

  printHeader(`Person ${id}`);
  const p = data.data;

  for (const [key, val] of Object.entries(p)) {
    if (key === 'properties' || key === 'phones' || key === 'emails') continue;
    console.log(`  ${chalk.cyan(key.padEnd(25))} ${formatVal(val)}`);
  }

  // Show phones
  const phones = p.phones as Record<string, unknown>[] | undefined;
  if (phones && phones.length > 0) {
    console.log();
    console.log(chalk.bold(`  Phones (${phones.length})`));
    for (const ph of phones) {
      console.log(`    ${ph.number || ph.phone || '—'}${ph.type ? chalk.dim(` (${ph.type})`) : ''}`);
    }
  }

  // Show emails
  const emails = p.emails as Record<string, unknown>[] | undefined;
  if (emails && emails.length > 0) {
    console.log();
    console.log(chalk.bold(`  Emails (${emails.length})`));
    for (const em of emails) {
      console.log(`    ${em.address || em.email || '—'}`);
    }
  }

  // Show properties
  const properties = p.properties as Record<string, unknown>[] | undefined;
  if (properties && properties.length > 0) {
    console.log();
    console.log(chalk.bold(`  Properties (${properties.length})`));
    console.log(chalk.dim('  ' + '─'.repeat(48)));
    for (const prop of properties) {
      const addr = prop.full_address || prop.address || '—';
      console.log(`  ${chalk.cyan(String(prop.dm_property_id || '').padEnd(18))} ${addr}`);
    }
  }

  printCredits(data.credits);
  console.log();
}

// ============================================================================
// Batch IDs
// ============================================================================

export async function peopleIds(options: {
  ids?: string[];
  body?: string;
  file?: string;
  includeProperties?: boolean;
  json?: boolean;
}): Promise<void> {
  let requestBody: Record<string, unknown>;

  if (options.ids && options.ids.length > 0) {
    requestBody = { ids: options.ids };
    if (options.includeProperties) requestBody.include_properties = true;
  } else {
    requestBody = await parseRequestBody(options);
  }

  const spinner = ora('Fetching people...').start();
  const data = await apiRequest<BatchResponse>('/people/ids', {
    method: 'POST',
    body: requestBody,
  });
  spinner.stop();

  if (options.json) {
    printJson(data);
    return;
  }

  printHeader('Batch People Lookup');
  printTotals({
    submitted: data.totals.submitted,
    found: data.totals.found,
    not_found: data.totals.not_found,
  });
  if (data.warning) printWarning(data.warning);
  console.log();

  const rows = data.data.map((p) => ({
    id: p.dm_person_id || '',
    found: (p as any).found ? chalk.green('yes') : chalk.dim('no'),
    name: truncate(String(p.full_name || ''), 25),
  }));
  printTable(rows, ['id', 'found', 'name']);

  printCredits(data.credits);
  console.log();
}

// ============================================================================
// Helpers
// ============================================================================

function formatVal(val: unknown): string {
  if (val === null || val === undefined) return chalk.dim('—');
  if (typeof val === 'boolean') return val ? 'yes' : 'no';
  if (typeof val === 'number') return val.toLocaleString();
  if (Array.isArray(val)) return `[${val.length} items]`;
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}
