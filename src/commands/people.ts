/**
 * People commands — search, get, ids, count, export
 */

import chalk from 'chalk';

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
  createSpinner,
} from '../lib/output.js';
import {
  applySearchProtocolOptions,
  type SearchProtocolCliOptions,
} from '../lib/searchProtocol.js';

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

interface ExportResponse {
  export_id: string;
  record_count: number;
  file_count: number;
  total_file_size: number;
  execution_time: number;
  download_urls: { filename: string; url: string; size: number }[];
  credits: { used: number; people: number };
  usage?: {
    credits_used: number;
    credits_remaining: number;
    enrichment_credit_cap: number;
    billing_cycle_end: string;
  };
}

// ============================================================================
// Search
// ============================================================================

export async function peopleSearch(
  options: {
    body?: string;
    file?: string;
    json?: boolean;
  } & SearchProtocolCliOptions
): Promise<void> {
  const requestBody = await parseRequestBody(options);
  applySearchProtocolOptions(requestBody, options, 'people');

  const spinner = createSpinner('Searching people...').start();
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

export async function peopleCount(
  options: {
    body?: string;
    file?: string;
    json?: boolean;
  } & SearchProtocolCliOptions
): Promise<void> {
  const requestBody = await parseRequestBody(options);
  applySearchProtocolOptions(requestBody, options, 'people');

  const spinner = createSpinner('Counting people...').start();
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

  const spinner = createSpinner('Fetching person...').start();
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
      console.log(
        `    ${ph.number || ph.phone || '—'}${ph.type ? chalk.dim(` (${ph.type})`) : ''}`
      );
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

  const spinner = createSpinner('Fetching people...').start();
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
// Export
// ============================================================================

export async function peopleExport(
  options: {
    body?: string;
    file?: string;
    json?: boolean;
    requirePhone?: boolean;
    requireEmail?: boolean;
    mobileOnly?: boolean;
    landlineOnly?: boolean;
    scrubDnc?: boolean;
  } & SearchProtocolCliOptions
): Promise<void> {
  const requestBody = await parseRequestBody(options);
  applySearchProtocolOptions(requestBody, options, 'people');

  // Merge CLI contact filter flags into the request body
  if (options.requirePhone) requestBody.require_phone = true;
  if (options.requireEmail) requestBody.require_email = true;
  if (options.mobileOnly) requestBody.mobile_only = true;
  if (options.landlineOnly) requestBody.landline_only = true;
  if (options.scrubDnc) requestBody.scrub_dnc = true;

  const spinner = createSpinner('Exporting people (this may take 30-60 seconds)...').start();
  const data = await apiRequest<ExportResponse>('/people/export', {
    method: 'POST',
    body: requestBody,
  });
  spinner.stop();

  if (options.json) {
    printJson(data);
    return;
  }

  printHeader('People Export');
  console.log(`  ${chalk.cyan('Export ID:')}       ${data.export_id}`);
  console.log(`  ${chalk.cyan('Records:')}         ${data.record_count.toLocaleString()}`);
  console.log(`  ${chalk.cyan('Files:')}           ${data.file_count}`);
  console.log(`  ${chalk.cyan('Total size:')}      ${formatBytes(data.total_file_size)}`);
  console.log(`  ${chalk.cyan('Execution time:')}  ${data.execution_time.toFixed(1)}s`);
  console.log();

  console.log(chalk.bold('  Download URLs:'));
  console.log(chalk.dim('  ' + '─'.repeat(60)));
  for (const file of data.download_urls) {
    console.log(`  ${chalk.cyan(file.filename)} ${chalk.dim(`(${formatBytes(file.size)})`)}`);
    console.log(`    ${file.url}`);
  }
  console.log();

  printCredits(data.credits);
  console.log();
}

// ============================================================================
// Helpers
// ============================================================================

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatVal(val: unknown): string {
  if (val === null || val === undefined) return chalk.dim('—');
  if (typeof val === 'boolean') return val ? 'yes' : 'no';
  if (typeof val === 'number') return val.toLocaleString();
  if (Array.isArray(val)) return `[${val.length} items]`;
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}
