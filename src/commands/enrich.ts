/**
 * Enrichment commands — address, latlng, apn, email, phone, name
 */

import chalk from 'chalk';
import ora from 'ora';
import { apiRequest } from '../lib/client.js';
import {
  parseRequestBody,
  printJson,
  printHeader,
  printTable,
  printTotals,
  printCredits,
  printWarning,
  printPagination,
  truncate,
} from '../lib/output.js';

// ============================================================================
// Types
// ============================================================================

interface PropertyEnrichResponse {
  data: Record<string, unknown>[];
  totals: { submitted: number; matched: number; unmatched: number };
  credits: { used: number; properties: number; people: number; deduplicated: number };
  warning?: string;
}

interface PersonEnrichResponse {
  data: Record<string, unknown>[];
  totals: { submitted: number; matched: number; unmatched: number };
  credits: { used: number; properties: number; people: number; deduplicated: number };
  warning?: string;
}

interface NameEnrichResponse {
  data: Record<string, unknown>[];
  pagination: { page: number; per_page: number; total: number; total_pages: number };
  credits: { used: number; properties: number; people: number; deduplicated: number };
}

// ============================================================================
// Address
// ============================================================================

export async function enrichAddress(
  address: string | undefined,
  options: {
    body?: string;
    file?: string;
    contactAudience?: string;
    json?: boolean;
  }
): Promise<void> {
  let requestBody: Record<string, unknown>;

  if (address) {
    // Quick mode: single address from positional arg
    requestBody = {
      addresses: [{ full_address: address }],
    };
    if (options.contactAudience) requestBody.contact_audience = options.contactAudience;
  } else {
    requestBody = await parseRequestBody(options);
  }

  const spinner = ora('Enriching by address...').start();
  const data = await apiRequest<PropertyEnrichResponse>('/enrichment/address', {
    method: 'POST',
    body: requestBody,
  });
  spinner.stop();

  if (options.json) {
    printJson(data);
    return;
  }

  printPropertyEnrichResult('Address Enrichment', data);
}

// ============================================================================
// LatLng
// ============================================================================

export async function enrichLatLng(
  coords: string | undefined,
  options: {
    body?: string;
    file?: string;
    contactAudience?: string;
    json?: boolean;
  }
): Promise<void> {
  let requestBody: Record<string, unknown>;

  if (coords) {
    // Quick mode: "lat,lng"
    const [lat, lng] = coords.split(',').map((s) => parseFloat(s.trim()));
    if (isNaN(lat) || isNaN(lng)) {
      console.error(chalk.red('Error: Invalid coordinates. Use format: lat,lng (e.g., 30.25,-97.75)'));
      process.exit(1);
    }
    requestBody = {
      data: [{ latitude: lat, longitude: lng }],
    };
    if (options.contactAudience) requestBody.contact_audience = options.contactAudience;
  } else {
    requestBody = await parseRequestBody(options);
  }

  const spinner = ora('Enriching by coordinates...').start();
  const data = await apiRequest<PropertyEnrichResponse>('/enrichment/latlng', {
    method: 'POST',
    body: requestBody,
  });
  spinner.stop();

  if (options.json) {
    printJson(data);
    return;
  }

  printPropertyEnrichResult('Coordinate Enrichment', data);
}

// ============================================================================
// APN
// ============================================================================

export async function enrichApn(
  apn: string | undefined,
  options: {
    body?: string;
    file?: string;
    contactAudience?: string;
    json?: boolean;
  }
): Promise<void> {
  let requestBody: Record<string, unknown>;

  if (apn) {
    requestBody = {
      apns: [{ apn }],
    };
    if (options.contactAudience) requestBody.contact_audience = options.contactAudience;
  } else {
    requestBody = await parseRequestBody(options);
  }

  const spinner = ora('Enriching by APN...').start();
  const data = await apiRequest<PropertyEnrichResponse>('/enrichment/apn', {
    method: 'POST',
    body: requestBody,
  });
  spinner.stop();

  if (options.json) {
    printJson(data);
    return;
  }

  printPropertyEnrichResult('APN Enrichment', data);
}

// ============================================================================
// Email
// ============================================================================

export async function enrichEmail(
  email: string | undefined,
  options: {
    body?: string;
    file?: string;
    includeProperties?: boolean;
    json?: boolean;
  }
): Promise<void> {
  let requestBody: Record<string, unknown>;

  if (email) {
    requestBody = {
      emails: [{ email }],
    };
    if (options.includeProperties) requestBody.include_properties = true;
  } else {
    requestBody = await parseRequestBody(options);
  }

  const spinner = ora('Enriching by email...').start();
  const data = await apiRequest<PersonEnrichResponse>('/enrichment/email', {
    method: 'POST',
    body: requestBody,
  });
  spinner.stop();

  if (options.json) {
    printJson(data);
    return;
  }

  printPersonEnrichResult('Email Enrichment', data);
}

// ============================================================================
// Phone
// ============================================================================

export async function enrichPhone(
  phone: string | undefined,
  options: {
    body?: string;
    file?: string;
    includeProperties?: boolean;
    json?: boolean;
  }
): Promise<void> {
  let requestBody: Record<string, unknown>;

  if (phone) {
    requestBody = {
      phones: [{ phone }],
    };
    if (options.includeProperties) requestBody.include_properties = true;
  } else {
    requestBody = await parseRequestBody(options);
  }

  const spinner = ora('Enriching by phone...').start();
  const data = await apiRequest<PersonEnrichResponse>('/enrichment/phone', {
    method: 'POST',
    body: requestBody,
  });
  spinner.stop();

  if (options.json) {
    printJson(data);
    return;
  }

  printPersonEnrichResult('Phone Enrichment', data);
}

// ============================================================================
// Name
// ============================================================================

export async function enrichName(
  name: string | undefined,
  options: {
    body?: string;
    file?: string;
    state?: string;
    zip?: string;
    includeProperties?: boolean;
    page?: string;
    perPage?: string;
    json?: boolean;
  }
): Promise<void> {
  let requestBody: Record<string, unknown>;

  if (name) {
    // Parse "First Last" or just "Last"
    const parts = name.trim().split(/\s+/);
    const nameObj: Record<string, string> = {};
    if (parts.length >= 2) {
      nameObj.first_name = parts[0];
      nameObj.last_name = parts.slice(1).join(' ');
    } else {
      nameObj.last_name = parts[0];
    }

    requestBody = {
      names: [nameObj],
    };

    // Add location if provided
    if (options.state) {
      requestBody.location = { type: 'state', code: options.state };
    } else if (options.zip) {
      requestBody.location = { type: 'zip_code', code: options.zip };
    }

    if (options.includeProperties) requestBody.include_properties = true;
    if (options.page) requestBody.page = parseInt(options.page, 10);
    if (options.perPage) requestBody.per_page = parseInt(options.perPage, 10);
  } else {
    requestBody = await parseRequestBody(options);
  }

  const spinner = ora('Enriching by name...').start();
  const data = await apiRequest<NameEnrichResponse>('/enrichment/name', {
    method: 'POST',
    body: requestBody,
  });
  spinner.stop();

  if (options.json) {
    printJson(data);
    return;
  }

  printHeader('Name Enrichment');
  console.log();

  if (data.data.length > 0) {
    const rows = data.data.map((p) => ({
      id: p.dm_person_id || '',
      name: truncate(String(p.full_name || ''), 25),
      phones: Array.isArray(p.phones) ? String(p.phones.length) : '—',
      emails: Array.isArray(p.emails) ? String(p.emails.length) : '—',
      properties: Array.isArray(p.properties) ? String(p.properties.length) : '—',
    }));
    printTable(rows, ['id', 'name', 'phones', 'emails', 'properties']);
  } else {
    console.log(chalk.dim('  No results found.'));
  }

  printPagination({
    page: data.pagination.page,
    per_page: data.pagination.per_page,
    total_results: data.pagination.total,
    total_pages: data.pagination.total_pages,
  });
  printCredits(data.credits);
  console.log();
}

// ============================================================================
// Shared Output Helpers
// ============================================================================

function printPropertyEnrichResult(title: string, data: PropertyEnrichResponse): void {
  printHeader(title);
  printTotals({
    submitted: data.totals.submitted,
    matched: data.totals.matched,
    unmatched: data.totals.unmatched,
  });
  if (data.warning) printWarning(data.warning);
  console.log();

  if (data.data.length > 0) {
    const rows = data.data.map((item) => ({
      matched: (item as any).matched ? chalk.green('yes') : chalk.dim('no'),
      id: item.dm_property_id || '—',
      address: truncate(String(item.full_address || item.address || ''), 35),
      value: item.estimated_value != null ? `$${Number(item.estimated_value).toLocaleString()}` : '—',
      contacts: Array.isArray(item.contacts) ? String(item.contacts.length) : '—',
    }));
    printTable(rows, ['matched', 'id', 'address', 'value', 'contacts']);
  }

  printCredits(data.credits);
  console.log();
}

function printPersonEnrichResult(title: string, data: PersonEnrichResponse): void {
  printHeader(title);
  printTotals({
    submitted: data.totals.submitted,
    matched: data.totals.matched,
    unmatched: data.totals.unmatched,
  });
  if (data.warning) printWarning(data.warning);
  console.log();

  for (const item of data.data) {
    if (!(item as any).matched) {
      const input = item.input as Record<string, unknown>;
      const inputStr = Object.values(input).filter(Boolean).join(', ');
      console.log(`  ${chalk.dim('✗')} ${inputStr} — ${chalk.dim('no match')}`);
      continue;
    }

    const contacts = item.contacts as Record<string, unknown>[];
    if (!contacts || contacts.length === 0) continue;

    const input = item.input as Record<string, unknown>;
    const inputStr = Object.values(input).filter(Boolean).join(', ');
    console.log(`  ${chalk.green('✓')} ${inputStr} — ${contacts.length} contact(s)`);

    for (const ct of contacts) {
      const name = ct.full_name || [ct.first_name, ct.last_name].filter(Boolean).join(' ') || '—';
      console.log(`    ${chalk.cyan(String(ct.dm_person_id || '').padEnd(18))} ${name}`);

      const phones = ct.phones as Record<string, unknown>[] | undefined;
      if (phones && phones.length > 0) {
        for (const ph of phones) {
          console.log(`      ${chalk.dim('phone:')} ${ph.number || ph.phone || '—'}`);
        }
      }

      const emails = ct.emails as Record<string, unknown>[] | undefined;
      if (emails && emails.length > 0) {
        for (const em of emails) {
          console.log(`      ${chalk.dim('email:')} ${em.address || em.email || '—'}`);
        }
      }
    }
  }

  console.log();
  printCredits(data.credits);
  console.log();
}
