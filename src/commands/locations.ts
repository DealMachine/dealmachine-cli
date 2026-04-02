/**
 * Locations commands — search and get locations (states, counties, zip codes)
 */

import chalk from 'chalk';

import { apiRequest } from '../lib/client.js';
import {
  printJson,
  printHeader,
  printTable,
  printPagination,
  printKeyValue,
  truncate,
  createSpinner,
} from '../lib/output.js';

// ============================================================================
// Types
// ============================================================================

interface LocationItem {
  location_id: string;
  type: string;
  code: string;
  name: string;
  property_count: number;
  state?: string;
  state_name?: string;
}

interface LocationsResponse {
  data: LocationItem[];
  pagination: {
    page: number;
    per_page: number;
    total_results: number;
    total_pages: number;
    has_next_page: boolean;
    has_previous_page: boolean;
  };
}

// ============================================================================
// Search
// ============================================================================

export async function locationsSearch(options: {
  query: string;
  type?: string;
  state?: string;
  page?: string;
  perPage?: string;
  json?: boolean;
}): Promise<void> {
  const query: Record<string, string> = { q: options.query };
  if (options.type) query.type = options.type;
  if (options.state) query.state = options.state;
  if (options.page) query.page = options.page;
  if (options.perPage) query.per_page = options.perPage;

  const spinner = createSpinner('Searching locations...').start();
  const data = await apiRequest<LocationsResponse>('/locations', { query });
  spinner.stop();

  if (options.json) {
    printJson(data);
    return;
  }

  printHeader('Locations');
  console.log();

  if (data.data.length > 0) {
    const rows = data.data.map((l) => ({
      location_id: l.location_id,
      type: l.type,
      name: truncate(l.name, 30),
      code: l.code,
      state: l.state || '—',
      properties: l.property_count.toLocaleString(),
    }));
    printTable(rows, ['location_id', 'type', 'name', 'code', 'state', 'properties']);
  } else {
    console.log(chalk.dim('  No locations found.'));
  }

  printPagination(data.pagination);
  console.log();
}

// ============================================================================
// Get by ID
// ============================================================================

export async function locationsGet(
  locationId: string,
  options: { json?: boolean }
): Promise<void> {
  const spinner = createSpinner('Fetching location...').start();
  const data = await apiRequest<LocationItem>(`/locations/${locationId}`);
  spinner.stop();

  if (options.json) {
    printJson(data);
    return;
  }

  printHeader(`Location ${data.location_id}`);
  printKeyValue({
    'Type': data.type,
    'Name': data.name,
    'Code': data.code,
    'State': data.state || '—',
    'State Name': data.state_name || '—',
    'Properties': data.property_count.toLocaleString(),
  });
  console.log();
}
