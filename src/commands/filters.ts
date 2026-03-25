/**
 * Filters command — List available filters
 */

import chalk from 'chalk';

import { apiRequest } from '../lib/client.js';
import { printJson, printHeader, printTable, printPagination, truncate, createSpinner } from '../lib/output.js';

interface FilterItem {
  filter_id: string;
  name: string;
  description: string | null;
  type: string;
  source_type: string | null;
  group_id: string | null;
  options: { option_id: string | number; label: string }[] | null;
  allowed_operators: string[];
}

interface FiltersResponse {
  data: FilterItem[];
  pagination: {
    page: number;
    per_page: number;
    total_results: number;
    total_pages: number;
    has_next_page: boolean;
    has_previous_page: boolean;
  };
}

export async function filters(options: {
  sourceType?: string;
  groupId?: string;
  search?: string;
  page?: string;
  perPage?: string;
  json?: boolean;
}): Promise<void> {
  const query: Record<string, string> = {};
  if (options.sourceType) query.source_type = options.sourceType;
  if (options.groupId) query.group_id = options.groupId;
  if (options.search) query.search = options.search;
  if (options.page) query.page = options.page;
  if (options.perPage) query.per_page = options.perPage;

  const spinner = createSpinner('Fetching filters...').start();
  const data = await apiRequest<FiltersResponse>('/filters', { query });
  spinner.stop();

  if (options.json) {
    printJson(data);
    return;
  }

  printHeader('Available Filters');
  console.log();

  if (data.data.length > 0) {
    const rows = data.data.map((f) => ({
      filter_id: f.filter_id,
      name: truncate(f.name, 25),
      type: f.type,
      source: f.source_type || '—',
      group: f.group_id || '—',
      operators: truncate(f.allowed_operators.join(', '), 30),
    }));
    printTable(rows, ['filter_id', 'name', 'type', 'source', 'group', 'operators']);
  }

  printPagination(data.pagination);
  console.log();
}
