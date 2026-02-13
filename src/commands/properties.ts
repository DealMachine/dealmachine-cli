/**
 * Properties commands — search, get, ids, count
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
  totals: { properties: number; people: number };
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
  total_properties: number;
  total_people: number;
  total_results: number;
}

interface GetPropertyResponse {
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

export async function propertiesSearch(options: {
  body?: string;
  file?: string;
  json?: boolean;
}): Promise<void> {
  const requestBody = await parseRequestBody(options);

  const spinner = ora('Searching properties...').start();
  const data = await apiRequest<SearchResponse>('/properties/search', {
    method: 'POST',
    body: requestBody,
  });
  spinner.stop();

  if (options.json) {
    printJson(data);
    return;
  }

  printHeader('Property Search Results');
  printTotals({ properties: data.totals.properties, people: data.totals.people });
  if (data.warning) printWarning(data.warning);
  console.log();

  if (data.data.length > 0) {
    // Show compact property rows
    const rows = data.data.map((p) => ({
      id: p.dm_property_id || '',
      address: truncate(String(p.full_address || p.address || ''), 35),
      city: p.city || '',
      state: p.state || '',
      value: p.estimated_value != null ? `$${Number(p.estimated_value).toLocaleString()}` : '—',
      contacts: Array.isArray(p.contacts) ? String(p.contacts.length) : '—',
    }));
    printTable(rows, ['id', 'address', 'city', 'state', 'value', 'contacts']);
  }

  printPagination(data.pagination);
  printCredits(data.credits);
  console.log();
}

// ============================================================================
// Count
// ============================================================================

export async function propertiesCount(options: {
  body?: string;
  file?: string;
  json?: boolean;
}): Promise<void> {
  const requestBody = await parseRequestBody(options);

  const spinner = ora('Counting properties...').start();
  const data = await apiRequest<CountResponse>('/properties/search/count', {
    method: 'POST',
    body: requestBody,
  });
  spinner.stop();

  if (options.json) {
    printJson(data);
    return;
  }

  printHeader('Property Count');
  console.log(`  ${chalk.cyan('Properties:')}  ${data.total_properties.toLocaleString()}`);
  console.log(`  ${chalk.cyan('People:')}      ${data.total_people.toLocaleString()}`);
  console.log(`  ${chalk.cyan('Total:')}       ${data.total_results.toLocaleString()}`);
  console.log();
}

// ============================================================================
// Get by ID
// ============================================================================

export async function propertiesGet(
  id: string,
  options: { contactAudience?: string; json?: boolean }
): Promise<void> {
  const query: Record<string, string> = {};
  if (options.contactAudience) query.contact_audience = options.contactAudience;

  const spinner = ora('Fetching property...').start();
  const data = await apiRequest<GetPropertyResponse>(`/properties/${id}`, { query });
  spinner.stop();

  if (options.json) {
    printJson(data);
    return;
  }

  printHeader(`Property ${id}`);
  const p = data.data;

  const fields: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(p)) {
    if (key === 'contacts') continue;
    fields[key] = val;
  }
  for (const [key, val] of Object.entries(fields)) {
    console.log(`  ${chalk.cyan(key.padEnd(30))} ${formatVal(val)}`);
  }

  // Show contacts if present
  const contacts = p.contacts as Record<string, unknown>[] | undefined;
  if (contacts && contacts.length > 0) {
    console.log();
    console.log(chalk.bold(`  Contacts (${contacts.length})`));
    console.log(chalk.dim('  ' + '─'.repeat(48)));
    for (const ct of contacts) {
      const name = ct.full_name || [ct.first_name, ct.last_name].filter(Boolean).join(' ') || '—';
      console.log(`  ${chalk.cyan(String(ct.dm_person_id || '').padEnd(18))} ${name}`);
    }
  }

  printCredits(data.credits);
  console.log();
}

// ============================================================================
// Batch IDs
// ============================================================================

export async function propertiesIds(options: {
  ids?: string[];
  body?: string;
  file?: string;
  contactAudience?: string;
  json?: boolean;
}): Promise<void> {
  let requestBody: Record<string, unknown>;

  if (options.ids && options.ids.length > 0) {
    requestBody = { ids: options.ids };
    if (options.contactAudience) requestBody.contact_audience = options.contactAudience;
  } else {
    requestBody = await parseRequestBody(options);
  }

  const spinner = ora('Fetching properties...').start();
  const data = await apiRequest<BatchResponse>('/properties/ids', {
    method: 'POST',
    body: requestBody,
  });
  spinner.stop();

  if (options.json) {
    printJson(data);
    return;
  }

  printHeader('Batch Property Lookup');
  printTotals({
    submitted: data.totals.submitted,
    found: data.totals.found,
    not_found: data.totals.not_found,
  });
  if (data.warning) printWarning(data.warning);
  console.log();

  const rows = data.data.map((p) => ({
    id: p.dm_property_id || '',
    found: (p as any).found ? chalk.green('yes') : chalk.dim('no'),
    address: truncate(String(p.full_address || p.address || ''), 35),
    value: p.estimated_value != null ? `$${Number(p.estimated_value).toLocaleString()}` : '—',
  }));
  printTable(rows, ['id', 'found', 'address', 'value']);

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
