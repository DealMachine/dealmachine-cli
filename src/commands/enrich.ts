/**
 * Enrichment commands — address, latlng, apn, email, phone, name
 */

import fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';

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
  formatCurrency,
  truncate,
  createSpinner,
} from '../lib/output.js';

// ============================================================================
// Types
// ============================================================================

interface EnrichResponse {
  data: Record<string, unknown>[];
  totals: { submitted: number; matched: number; unmatched: number };
  credits: { used: number; properties: number; people: number; deduplicated: number };
  warning?: string;
}

// Alias for clarity in print functions
type PropertyEnrichResponse = EnrichResponse;
type PersonEnrichResponse = EnrichResponse;

interface NameEnrichResponse {
  data: Record<string, unknown>[];
  pagination: { page: number; per_page: number; total: number; total_pages: number };
  credits: { used: number; properties: number; people: number; deduplicated: number };
}

interface NameEstimateResponse {
  totals: { people: number; properties: number };
  pagination: {
    page: number;
    per_page: number;
    total_results: number;
    total_pages: number;
    has_next_page: boolean;
    has_previous_page: boolean;
  };
  estimated_credits: {
    this_page: number;
    total_all_pages: number;
    breakdown: {
      people: number;
      properties: number;
      already_accessed: number;
      note: string;
    };
  };
}

type NameEnrichApiResponse = NameEnrichResponse | NameEstimateResponse;

function parseFieldsCsv(value: string): string[] {
  return value
    .split(',')
    .map((field) => field.trim())
    .filter(Boolean);
}

// ============================================================================
// CSV + Batch Helpers
// ============================================================================

const API_BATCH_LIMIT = 250;

type LocationCliOptions = {
  state?: string;
  zip?: string;
  county?: string;
  city?: string;
};

function applyLocationOption(body: Record<string, unknown>, options: LocationCliOptions): void {
  if (options.city) {
    body.location = { type: 'city', code: options.city };
  } else if (options.county) {
    body.location = { type: 'county', code: options.county };
  } else if (options.zip) {
    body.location = { type: 'zip_code', code: options.zip };
  } else if (options.state) {
    body.location = { type: 'state', code: options.state };
  }
}

/** Parse a CSV file into an array of objects keyed by lowercase column headers. */
function parseCsv(filePath: string): Record<string, string>[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const values = line.split(',').map((v) => v.trim());
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = values[i] || '';
    });
    return obj;
  });
}

function isCsvFile(filePath: string): boolean {
  return path.extname(filePath).toLowerCase() === '.csv';
}

/** Find first matching column name from a list of candidates. */
function findColumn(row: Record<string, string>, ...candidates: string[]): string | null {
  for (const c of candidates) {
    if (c in row) return c;
  }
  return null;
}

/** Merge multiple batch responses into one. */
function mergeResponses(responses: EnrichResponse[]): EnrichResponse {
  const merged: EnrichResponse = {
    data: [],
    totals: { submitted: 0, matched: 0, unmatched: 0 },
    credits: { used: 0, properties: 0, people: 0, deduplicated: 0 },
  };
  for (const r of responses) {
    merged.data.push(...r.data);
    merged.totals.submitted += r.totals.submitted;
    merged.totals.matched += r.totals.matched;
    merged.totals.unmatched += r.totals.unmatched;
    merged.credits.used += r.credits.used;
    merged.credits.properties += r.credits.properties;
    merged.credits.people += r.credits.people;
    merged.credits.deduplicated += r.credits.deduplicated;
    if (r.warning) merged.warning = r.warning;
  }
  return merged;
}

/**
 * Generic batch enrichment runner.
 * Splits items into chunks of 250, calls the API endpoint for each, and merges results.
 */
async function runBatchEnrichment(opts: {
  items: Record<string, unknown>[];
  arrayKey: string; // e.g. 'emails', 'phones', 'addresses', 'data', 'apns'
  endpoint: string; // e.g. '/enrichment/email'
  label: string; // e.g. 'emails', 'addresses'
  extraBody?: Record<string, unknown>;
}): Promise<EnrichResponse> {
  const { items, arrayKey, endpoint, label, extraBody } = opts;
  const responses: EnrichResponse[] = [];
  const totalBatches = Math.ceil(items.length / API_BATCH_LIMIT);
  const spinner = createSpinner(
    `Enriching ${items.length} ${label} (batch 1/${totalBatches})...`
  ).start();

  for (let i = 0; i < items.length; i += API_BATCH_LIMIT) {
    const batch = items.slice(i, i + API_BATCH_LIMIT);
    const batchNum = Math.floor(i / API_BATCH_LIMIT) + 1;
    spinner.text = `Enriching ${items.length} ${label} (batch ${batchNum}/${totalBatches})...`;

    const body: Record<string, unknown> = { [arrayKey]: batch, ...extraBody };
    const data = await apiRequest<EnrichResponse>(endpoint, {
      method: 'POST',
      body,
    });
    responses.push(data);

    if (data.warning && data.warning.includes('credit limit reached')) {
      spinner.warn(`Data credit limit reached at batch ${batchNum}/${totalBatches}`);
      break;
    }
  }

  if (!spinner.isSpinning) {
    // spinner.warn already stopped it
  } else {
    spinner.succeed(`Enriched ${items.length} ${label} in ${totalBatches} batch(es)`);
  }

  return mergeResponses(responses);
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
    fields?: string;
    json?: boolean;
  }
): Promise<void> {
  // CSV file support
  if (!address && options.file && isCsvFile(options.file)) {
    const rows = parseCsv(options.file);
    if (rows.length === 0) {
      console.error(chalk.red('Error: CSV file is empty.'));
      process.exit(1);
    }

    // Support: full_address, or street+city+state+zip columns
    const fullAddrCol = findColumn(rows[0], 'full_address', 'address');
    let items: Record<string, unknown>[];

    if (fullAddrCol) {
      items = rows.map((r) => ({ full_address: r[fullAddrCol] })).filter((a) => a.full_address);
    } else {
      const streetCol = findColumn(rows[0], 'street', 'street_address', 'address_line_1');
      const cityCol = findColumn(rows[0], 'city');
      const stateCol = findColumn(rows[0], 'state');
      const zipCol = findColumn(rows[0], 'zip', 'zip_code', 'zipcode', 'postal_code');
      if (!streetCol) {
        console.error(chalk.red('Error: CSV must have "full_address" or "street" column.'));
        process.exit(1);
      }
      items = rows
        .map((r) => ({
          street: r[streetCol!],
          ...(cityCol && { city: r[cityCol] }),
          ...(stateCol && { state: r[stateCol] }),
          ...(zipCol && { zip: r[zipCol] }),
        }))
        .filter((a) => a.street);
    }

    const extraBody: Record<string, unknown> = {};
    if (options.contactAudience) extraBody.contact_audience = options.contactAudience;
    if (options.fields) extraBody.fields = parseFieldsCsv(options.fields);

    const merged = await runBatchEnrichment({
      items,
      arrayKey: 'data',
      endpoint: '/enrichment/address',
      label: 'addresses',
      extraBody,
    });

    if (options.json) {
      printJson(merged);
      return;
    }
    printPropertyEnrichResult('Address Enrichment', merged);
    return;
  }

  let requestBody: Record<string, unknown>;
  if (address) {
    requestBody = { data: [{ full_address: address }] };
    if (options.contactAudience) requestBody.contact_audience = options.contactAudience;
    if (options.fields) requestBody.fields = parseFieldsCsv(options.fields);
  } else {
    requestBody = await parseRequestBody(options);
    if (options.fields) requestBody.fields = parseFieldsCsv(options.fields);
  }

  // Auto-batch large JSON input
  const addrItems = (requestBody as any).data;
  if (addrItems && addrItems.length > API_BATCH_LIMIT) {
    const extraBody = { ...requestBody };
    delete extraBody.data;
    const merged = await runBatchEnrichment({
      items: addrItems,
      arrayKey: 'data',
      endpoint: '/enrichment/address',
      label: 'addresses',
      extraBody,
    });
    if (options.json) {
      printJson(merged);
      return;
    }
    printPropertyEnrichResult('Address Enrichment', merged);
    return;
  }

  const spinner = createSpinner('Enriching by address...').start();
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
    fields?: string;
    json?: boolean;
  }
): Promise<void> {
  // CSV file support
  if (!coords && options.file && isCsvFile(options.file)) {
    const rows = parseCsv(options.file);
    if (rows.length === 0) {
      console.error(chalk.red('Error: CSV file is empty.'));
      process.exit(1);
    }

    const latCol = findColumn(rows[0], 'latitude', 'lat');
    const lngCol = findColumn(rows[0], 'longitude', 'lng', 'lon', 'long');
    if (!latCol || !lngCol) {
      console.error(chalk.red('Error: CSV must have "latitude" and "longitude" columns.'));
      process.exit(1);
    }

    const items = rows
      .map((r) => ({
        latitude: parseFloat(r[latCol]),
        longitude: parseFloat(r[lngCol]),
      }))
      .filter((c) => !isNaN(c.latitude) && !isNaN(c.longitude));

    const extraBody: Record<string, unknown> = {};
    if (options.contactAudience) extraBody.contact_audience = options.contactAudience;
    if (options.fields) extraBody.fields = parseFieldsCsv(options.fields);

    const merged = await runBatchEnrichment({
      items,
      arrayKey: 'data',
      endpoint: '/enrichment/reverse-geocode',
      label: 'coordinates',
      extraBody,
    });

    if (options.json) {
      printJson(merged);
      return;
    }
    printPropertyEnrichResult('Coordinate Enrichment', merged);
    return;
  }

  let requestBody: Record<string, unknown>;
  if (coords) {
    const [lat, lng] = coords.split(',').map((s) => parseFloat(s.trim()));
    if (isNaN(lat) || isNaN(lng)) {
      console.error(
        chalk.red('Error: Invalid coordinates. Use format: lat,lng (e.g., 30.25,-97.75)')
      );
      process.exit(1);
    }
    requestBody = { data: [{ latitude: lat, longitude: lng }] };
    if (options.contactAudience) requestBody.contact_audience = options.contactAudience;
    if (options.fields) requestBody.fields = parseFieldsCsv(options.fields);
  } else {
    requestBody = await parseRequestBody(options);
    if (options.fields) requestBody.fields = parseFieldsCsv(options.fields);
  }

  // Auto-batch large JSON input
  const latlngItems = (requestBody as any).data;
  if (latlngItems && latlngItems.length > API_BATCH_LIMIT) {
    const extraBody = { ...requestBody };
    delete extraBody.data;
    const merged = await runBatchEnrichment({
      items: latlngItems,
      arrayKey: 'data',
      endpoint: '/enrichment/reverse-geocode',
      label: 'coordinates',
      extraBody,
    });
    if (options.json) {
      printJson(merged);
      return;
    }
    printPropertyEnrichResult('Coordinate Enrichment', merged);
    return;
  }

  const spinner = createSpinner('Enriching by coordinates...').start();
  const data = await apiRequest<PropertyEnrichResponse>('/enrichment/reverse-geocode', {
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
    state?: string;
    zip?: string;
    contactAudience?: string;
    fields?: string;
    json?: boolean;
  }
): Promise<void> {
  // CSV file support
  if (!apn && options.file && isCsvFile(options.file)) {
    const rows = parseCsv(options.file);
    if (rows.length === 0) {
      console.error(chalk.red('Error: CSV file is empty.'));
      process.exit(1);
    }

    const apnCol = findColumn(rows[0], 'apn', 'parcel_id', 'parcel_number');
    if (!apnCol) {
      console.error(chalk.red('Error: CSV must have an "apn" column.'));
      process.exit(1);
    }

    const items = rows.map((r) => ({ apn: r[apnCol] })).filter((a) => a.apn);

    const extraBody: Record<string, unknown> = {};
    if (options.contactAudience) extraBody.contact_audience = options.contactAudience;
    if (options.fields) extraBody.fields = parseFieldsCsv(options.fields);
    if (options.state) extraBody.location = { type: 'state', code: options.state };
    else if (options.zip) extraBody.location = { type: 'zip_code', code: options.zip };

    const merged = await runBatchEnrichment({
      items,
      arrayKey: 'data',
      endpoint: '/enrichment/apn',
      label: 'APNs',
      extraBody,
    });

    if (options.json) {
      printJson(merged);
      return;
    }
    printPropertyEnrichResult('APN Enrichment', merged);
    return;
  }

  let requestBody: Record<string, unknown>;
  if (apn) {
    requestBody = { data: [{ apn }] };
    if (options.state) requestBody.location = { type: 'state', code: options.state };
    else if (options.zip) requestBody.location = { type: 'zip_code', code: options.zip };
    if (options.contactAudience) requestBody.contact_audience = options.contactAudience;
    if (options.fields) requestBody.fields = parseFieldsCsv(options.fields);
  } else {
    requestBody = await parseRequestBody(options);
    if (options.fields) requestBody.fields = parseFieldsCsv(options.fields);
  }

  // Auto-batch large JSON input
  const apnItems = (requestBody as any).data;
  if (apnItems && apnItems.length > API_BATCH_LIMIT) {
    const extraBody = { ...requestBody };
    delete extraBody.data;
    const merged = await runBatchEnrichment({
      items: apnItems,
      arrayKey: 'data',
      endpoint: '/enrichment/apn',
      label: 'APNs',
      extraBody,
    });
    if (options.json) {
      printJson(merged);
      return;
    }
    printPropertyEnrichResult('APN Enrichment', merged);
    return;
  }

  const spinner = createSpinner('Enriching by APN...').start();
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
    state?: string;
    zip?: string;
    county?: string;
    city?: string;
    fields?: string;
    json?: boolean;
  }
): Promise<void> {
  // CSV file support
  if (!email && options.file && isCsvFile(options.file)) {
    const rows = parseCsv(options.file);
    if (rows.length === 0) {
      console.error(chalk.red('Error: CSV file is empty.'));
      process.exit(1);
    }

    const emailCol = findColumn(rows[0], 'email', 'email_address');
    if (!emailCol) {
      console.error(chalk.red('Error: CSV must have an "email" column.'));
      process.exit(1);
    }

    const items = rows.map((r) => ({ email: r[emailCol] })).filter((e) => e.email);

    const extraBody: Record<string, unknown> = {};
    if (options.includeProperties) extraBody.include_properties = true;
    if (options.fields) extraBody.fields = parseFieldsCsv(options.fields);
    applyLocationOption(extraBody, options);

    const merged = await runBatchEnrichment({
      items,
      arrayKey: 'data',
      endpoint: '/enrichment/email',
      label: 'emails',
      extraBody,
    });

    if (options.json) {
      printJson(merged);
      return;
    }
    printPersonEnrichResult('Email Enrichment', merged);
    return;
  }

  let requestBody: Record<string, unknown>;
  if (email) {
    requestBody = { data: [{ email }] };
    if (options.includeProperties) requestBody.include_properties = true;
    if (options.fields) requestBody.fields = parseFieldsCsv(options.fields);
  } else {
    requestBody = await parseRequestBody(options);
    if (options.fields) requestBody.fields = parseFieldsCsv(options.fields);
  }
  applyLocationOption(requestBody, options);

  // Auto-batch large JSON input
  const emailItems = (requestBody as any).data;
  if (emailItems && emailItems.length > API_BATCH_LIMIT) {
    const extraBody = { ...requestBody };
    delete extraBody.data;
    const merged = await runBatchEnrichment({
      items: emailItems,
      arrayKey: 'data',
      endpoint: '/enrichment/email',
      label: 'emails',
      extraBody,
    });
    if (options.json) {
      printJson(merged);
      return;
    }
    printPersonEnrichResult('Email Enrichment', merged);
    return;
  }

  const spinner = createSpinner('Enriching by email...').start();
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
    state?: string;
    zip?: string;
    county?: string;
    city?: string;
    fields?: string;
    json?: boolean;
  }
): Promise<void> {
  // CSV file support
  if (!phone && options.file && isCsvFile(options.file)) {
    const rows = parseCsv(options.file);
    if (rows.length === 0) {
      console.error(chalk.red('Error: CSV file is empty.'));
      process.exit(1);
    }

    const phoneCol = findColumn(rows[0], 'phone', 'phone_number');
    if (!phoneCol) {
      console.error(chalk.red('Error: CSV must have a "phone" column.'));
      process.exit(1);
    }

    const items = rows.map((r) => ({ phone: r[phoneCol] })).filter((p) => p.phone);

    const extraBody: Record<string, unknown> = {};
    if (options.includeProperties) extraBody.include_properties = true;
    if (options.fields) extraBody.fields = parseFieldsCsv(options.fields);
    applyLocationOption(extraBody, options);

    const merged = await runBatchEnrichment({
      items,
      arrayKey: 'data',
      endpoint: '/enrichment/phone',
      label: 'phones',
      extraBody,
    });

    if (options.json) {
      printJson(merged);
      return;
    }
    printPersonEnrichResult('Phone Enrichment', merged);
    return;
  }

  let requestBody: Record<string, unknown>;
  if (phone) {
    requestBody = { data: [{ phone }] };
    if (options.includeProperties) requestBody.include_properties = true;
    if (options.fields) requestBody.fields = parseFieldsCsv(options.fields);
  } else {
    requestBody = await parseRequestBody(options);
    if (options.fields) requestBody.fields = parseFieldsCsv(options.fields);
  }
  applyLocationOption(requestBody, options);

  // Auto-batch large JSON input
  const phoneItems = (requestBody as any).data;
  if (phoneItems && phoneItems.length > API_BATCH_LIMIT) {
    const extraBody = { ...requestBody };
    delete extraBody.data;
    const merged = await runBatchEnrichment({
      items: phoneItems,
      arrayKey: 'data',
      endpoint: '/enrichment/phone',
      label: 'phones',
      extraBody,
    });
    if (options.json) {
      printJson(merged);
      return;
    }
    printPersonEnrichResult('Phone Enrichment', merged);
    return;
  }

  const spinner = createSpinner('Enriching by phone...').start();
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
    county?: string;
    city?: string;
    includeProperties?: boolean;
    estimateCost?: boolean;
    page?: string;
    perPage?: string;
    fields?: string;
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
      data: [nameObj],
    };

    // Add location if provided
    if (options.includeProperties) requestBody.include_properties = true;
    if (options.estimateCost) requestBody.estimate_cost = true;
    if (options.page) requestBody.page = parseInt(options.page, 10);
    if (options.perPage) requestBody.per_page = parseInt(options.perPage, 10);
    if (options.fields) requestBody.fields = parseFieldsCsv(options.fields);
  } else {
    requestBody = await parseRequestBody(options);
    if (options.estimateCost) requestBody.estimate_cost = true;
    if (options.fields) requestBody.fields = parseFieldsCsv(options.fields);
  }
  applyLocationOption(requestBody, options);

  const isEstimate = requestBody.estimate_cost === true;
  const spinner = createSpinner(
    isEstimate ? 'Estimating name enrichment...' : 'Enriching by name...'
  ).start();
  const data = await apiRequest<NameEnrichApiResponse>('/enrichment/name', {
    method: 'POST',
    body: requestBody,
  });
  spinner.stop();

  if (options.json) {
    printJson(data);
    return;
  }

  if (isNameEstimateResponse(data)) {
    printNameEstimateResult(data);
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
      properties:
        p.property_count != null
          ? String(p.property_count)
          : Array.isArray(p.properties)
            ? String(p.properties.length)
            : '—',
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

function isNameEstimateResponse(data: NameEnrichApiResponse): data is NameEstimateResponse {
  return 'estimated_credits' in data;
}

function printNameEstimateResult(data: NameEstimateResponse): void {
  printHeader('Name Enrichment Estimate');
  printTotals(data.totals);
  printPagination(data.pagination);
  console.log();
  console.log(
    chalk.dim(
      `  ${chalk.cyan('estimated credits')}: ${data.estimated_credits.this_page.toLocaleString()} this page | ${data.estimated_credits.total_all_pages.toLocaleString()} all pages`
    )
  );
  console.log(
    chalk.dim(
      `  ${chalk.cyan('people')}: ${data.estimated_credits.breakdown.people.toLocaleString()} | ${chalk.cyan('properties')}: ${data.estimated_credits.breakdown.properties.toLocaleString()}`
    )
  );
  console.log(chalk.dim(`  ${data.estimated_credits.breakdown.note}`));
  console.log();
}

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
      value: formatCurrency(item.estimated_value),
      contacts: Array.isArray(item.contacts) ? String(item.contacts.length) : '—',
    }));
    printTable(rows, ['matched', 'id', 'address', 'value', 'contacts']);
    printMatchWarnings(data.data);
  }

  printCredits(data.credits);
  console.log();
}

function printMatchWarnings(items: Record<string, unknown>[]): void {
  const warned = items
    .map((item, i) => ({
      i,
      w: (item as any).match_warning as
        | { code?: string; message?: string; hint?: Record<string, unknown> }
        | undefined,
    }))
    .filter((entry) => entry.w);
  if (warned.length === 0) return;
  console.log();
  console.log(chalk.yellow(`! ${warned.length} item(s) had input rewritten before matching:`));
  for (const { i, w } of warned) {
    const parsed = w?.hint?.parsed_street;
    const detail = parsed ? `parsed as "${String(parsed)}"` : (w?.message ?? '');
    console.log(chalk.dim(`    [${i}] ${w?.code ?? 'match_warning'}: ${detail}`));
  }
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

      if (ct.property_count != null) {
        console.log(`      ${chalk.dim('properties:')} ${String(ct.property_count)}`);
      }
    }
  }

  console.log();
  printCredits(data.credits);
  console.log();
}
