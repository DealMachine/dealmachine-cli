/**
 * Fields command — List available fields
 */

import chalk from 'chalk';

import { apiRequest } from '../lib/client.js';
import { printJson, printHeader, printTable, printPagination, truncate, createSpinner } from '../lib/output.js';

interface FieldItem {
  field_id: string;
  name: string;
  description: string | null;
  type: string | null;
  source_type: string | null;
  group_id: string | null;
  is_filterable: boolean;
  is_sortable: boolean;
}

interface FieldsResponse {
  data: FieldItem[];
  pagination: {
    page: number;
    per_page: number;
    total_results: number;
    total_pages: number;
    has_next_page: boolean;
    has_previous_page: boolean;
  };
}

export async function fields(options: {
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

  const spinner = createSpinner('Fetching fields...').start();
  const data = await apiRequest<FieldsResponse>('/fields', { query });
  spinner.stop();

  if (options.json) {
    printJson(data);
    return;
  }

  printHeader('Available Fields');
  console.log();

  if (data.data.length > 0) {
    const rows = data.data.map((f) => ({
      field_id: f.field_id,
      name: truncate(f.name, 25),
      type: f.type || '—',
      source: f.source_type || '—',
      group: f.group_id || '—',
      filterable: f.is_filterable ? chalk.green('yes') : chalk.dim('no'),
      sortable: f.is_sortable ? chalk.green('yes') : chalk.dim('no'),
    }));
    printTable(rows, ['field_id', 'name', 'type', 'source', 'group', 'filterable', 'sortable']);
  }

  printPagination(data.pagination);
  console.log();
}
