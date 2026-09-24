/**
 * Locations commands: search and get locations (states, counties, cities, zip codes)
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

interface AutocompleteSuggestion {
  suggestion_id: string;
  kind: 'address';
  label: string;
  property_id: string;
  address: {
    address: string;
    city?: string;
    county?: string;
    state?: string;
    zip?: string;
    full_address: string;
    latitude?: number;
    longitude?: number;
  };
  location?: LocationItem | null;
}

interface AutocompleteResponse {
  data: AutocompleteSuggestion[];
  meta: {
    query: string;
    limit: number;
    returned: number;
    partial_results: boolean;
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
      state: l.state || '-',
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
// Autocomplete
// ============================================================================

export async function addressesAutocomplete(options: {
  query: string;
  state?: string;
  limit?: string;
  latitude?: string;
  longitude?: string;
  json?: boolean;
}): Promise<void> {
  const query: Record<string, string> = { q: options.query };
  if (options.state) query.state = options.state;
  if (options.limit) query.limit = options.limit;
  if (options.latitude) query.latitude = options.latitude;
  if (options.longitude) query.longitude = options.longitude;

  const spinner = createSpinner('Finding property addresses...').start();
  const data = await apiRequest<AutocompleteResponse>('/addresses/autocomplete', { query });
  spinner.stop();

  if (options.json) {
    printJson(data);
    return;
  }

  printHeader('Address Suggestions');
  console.log();

  if (data.data.length > 0) {
    const rows = data.data.map((suggestion) => ({
      property_id: suggestion.property_id,
      label: truncate(suggestion.label, 56),
      city: suggestion.address.city || '-',
      state: suggestion.address.state || '-',
      zip: suggestion.address.zip || '-',
    }));
    printTable(rows, ['property_id', 'label', 'city', 'state', 'zip']);
  } else {
    console.log(chalk.dim('  No suggestions found.'));
  }

  if (data.meta.partial_results) {
    console.log(chalk.yellow('  Fuzzy address matching is temporarily unavailable.'));
  }
  console.log();
}

/** @deprecated Use addressesAutocomplete. */
export const locationsAutocomplete = addressesAutocomplete;

// ============================================================================
// Get by ID
// ============================================================================

export async function locationsGet(locationId: string, options: { json?: boolean }): Promise<void> {
  const spinner = createSpinner('Fetching location...').start();
  const data = await apiRequest<LocationItem>(`/locations/${locationId}`);
  spinner.stop();

  if (options.json) {
    printJson(data);
    return;
  }

  printHeader(`Location ${data.location_id}`);
  printKeyValue({
    Type: data.type,
    Name: data.name,
    Code: data.code,
    State: data.state || '-',
    'State Name': data.state_name || '-',
    Properties: data.property_count.toLocaleString(),
  });
  console.log();
}
