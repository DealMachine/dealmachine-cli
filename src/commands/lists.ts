/**
 * List commands — search, create, get, update, delete, build, import, items, add, remove, export
 */

import chalk from 'chalk';
import ora from 'ora';
import { apiRequest, formatDate } from '../lib/client.js';
import {
  parseRequestBody,
  printJson,
  printHeader,
  printTable,
  printKeyValue,
  truncate,
} from '../lib/output.js';

// ============================================================================
// Types
// ============================================================================

interface ListItem {
  list_id: string;
  name: string | null;
  source_type: string | null;
  build_type: string | null;
  status: string;
  total_count: number;
  progress: number;
  progress_stage: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

interface ListListsResponse {
  data: ListItem[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
    has_more: boolean;
  };
}

interface SingleListResponse {
  data: ListItem;
}

interface ListItemRecord {
  list_item_id: string;
  internal_property_id: number | null;
  internal_person_id: number | null;
  created_at: string;
}

interface ListItemsResponse {
  data: ListItemRecord[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
    has_more: boolean;
  };
}

// ============================================================================
// Search (GET /lists)
// ============================================================================

export async function listsList(options: {
  search?: string;
  sourceType?: string;
  sort?: string;
  page?: string;
  perPage?: string;
  json?: boolean;
}): Promise<void> {
  const spinner = ora('Fetching lists...').start();
  const data = await apiRequest<ListListsResponse>('/lists', {
    query: {
      ...(options.search && { search: options.search }),
      ...(options.sourceType && { source_type: options.sourceType }),
      ...(options.sort && { sort: options.sort }),
      ...(options.page && { page: parseInt(options.page, 10) }),
      ...(options.perPage && { per_page: parseInt(options.perPage, 10) }),
    },
  });
  spinner.stop();

  if (options.json) {
    printJson(data);
    return;
  }

  printHeader('Lists');
  console.log();

  if (data.data.length > 0) {
    const rows = data.data.map((l) => ({
      id: truncate(l.list_id, 20),
      name: truncate(l.name || '(unnamed)', 30),
      type: l.source_type || '—',
      status: l.status,
      count: l.total_count,
      created: formatDate(l.created_at),
    }));
    printTable(rows, ['id', 'name', 'type', 'status', 'count', 'created']);
  } else {
    console.log(chalk.dim('  No lists found.'));
  }

  const p = data.pagination;
  console.log();
  console.log(chalk.dim(`Page ${p.page} — ${p.total} total lists${p.has_more ? ' (more available)' : ''}`));
  console.log();
}

// ============================================================================
// Create (POST /lists)
// ============================================================================

export async function listsCreate(options: {
  name: string;
  sourceType?: string;
  ids?: string;
  body?: string;
  file?: string;
  json?: boolean;
}): Promise<void> {
  let requestBody: Record<string, unknown> = { name: options.name };

  if (options.sourceType) {
    requestBody.source_type = options.sourceType;
  }

  // Parse --ids into record_ids array
  if (options.ids) {
    requestBody.record_ids = options.ids.split(',').map((id) => parseInt(id.trim(), 10));
  }

  // Merge in filters/locations from --body or -f
  if (options.body || options.file) {
    const extra = await parseRequestBody(options);
    requestBody = { ...requestBody, ...extra };
  }

  const spinner = ora('Creating list...').start();
  const data = await apiRequest<SingleListResponse>('/lists', {
    method: 'POST',
    body: requestBody,
  });
  spinner.stop();

  if (options.json) {
    printJson(data);
    return;
  }

  const l = data.data;
  printHeader('List Created');
  printKeyValue({
    'List ID': l.list_id,
    'Name': l.name || '(unnamed)',
    'Source Type': l.source_type || '—',
    'Status': l.status,
    'Total Count': l.total_count,
    'Created': formatDate(l.created_at),
  });
  console.log();
}

// ============================================================================
// Get (GET /lists/:id)
// ============================================================================

export async function listsGet(
  listId: string,
  options: { json?: boolean }
): Promise<void> {
  const spinner = ora('Fetching list...').start();
  const data = await apiRequest<SingleListResponse>(`/lists/${listId}`);
  spinner.stop();

  if (options.json) {
    printJson(data);
    return;
  }

  const l = data.data;
  printHeader(`List ${l.list_id}`);
  printKeyValue({
    'Name': l.name || '(unnamed)',
    'Source Type': l.source_type || '—',
    'Build Type': l.build_type || '—',
    'Status': l.status,
    'Total Count': l.total_count,
    'Progress': `${l.progress}%`,
    'Progress Stage': l.progress_stage || '—',
    'Error': l.error_message || '—',
    'Created': formatDate(l.created_at),
    'Updated': formatDate(l.updated_at),
  });
  console.log();
}

// ============================================================================
// Update (PATCH /lists/:id)
// ============================================================================

export async function listsUpdate(
  listId: string,
  options: { name?: string; json?: boolean }
): Promise<void> {
  if (!options.name) {
    console.error(chalk.red('Error: --name is required for update'));
    process.exit(1);
  }

  const spinner = ora('Updating list...').start();
  const data = await apiRequest<SingleListResponse>(`/lists/${listId}`, {
    method: 'PATCH',
    body: { name: options.name },
  });
  spinner.stop();

  if (options.json) {
    printJson(data);
    return;
  }

  const l = data.data;
  printHeader('List Updated');
  printKeyValue({
    'List ID': l.list_id,
    'Name': l.name || '(unnamed)',
    'Updated': formatDate(l.updated_at),
  });
  console.log();
}

// ============================================================================
// Delete (DELETE /lists/:id)
// ============================================================================

export async function listsDelete(
  listId: string,
  options: { json?: boolean }
): Promise<void> {
  const spinner = ora('Deleting list...').start();
  const data = await apiRequest<{ data: { deleted: boolean } }>(`/lists/${listId}`, {
    method: 'DELETE',
  });
  spinner.stop();

  if (options.json) {
    printJson(data);
    return;
  }

  console.log(chalk.green(`  List ${listId} deleted.`));
  console.log();
}

// ============================================================================
// Build (POST /lists/:id/build)
// ============================================================================

export async function listsBuild(
  listId: string,
  options: { body?: string; file?: string; json?: boolean }
): Promise<void> {
  const requestBody = await parseRequestBody(options);

  const spinner = ora('Starting list build...').start();
  const data = await apiRequest<SingleListResponse>(`/lists/${listId}/build`, {
    method: 'POST',
    body: requestBody,
  });
  spinner.stop();

  if (options.json) {
    printJson(data);
    return;
  }

  const l = data.data;
  printHeader('Build Started');
  printKeyValue({
    'List ID': l.list_id,
    'Status': l.status,
    'Progress': `${l.progress}%`,
  });
  console.log();
  console.log(chalk.dim('  Poll with: dm lists get ' + listId));
  console.log();
}

// ============================================================================
// Import (POST /lists/:id/import)
// ============================================================================

export async function listsImport(
  listId: string,
  options: {
    ids?: string;
    sourceType?: string;
    body?: string;
    file?: string;
    json?: boolean;
  }
): Promise<void> {
  let requestBody: Record<string, unknown>;

  if (options.ids) {
    const ids = options.ids.split(',').map((id) => parseInt(id.trim(), 10));
    requestBody = { ids };
    if (options.sourceType) requestBody.source_type = options.sourceType;
  } else {
    requestBody = await parseRequestBody(options);
  }

  const spinner = ora('Starting import...').start();
  const data = await apiRequest<SingleListResponse>(`/lists/${listId}/import`, {
    method: 'POST',
    body: requestBody,
  });
  spinner.stop();

  if (options.json) {
    printJson(data);
    return;
  }

  const l = data.data;
  printHeader('Import Started');
  printKeyValue({
    'List ID': l.list_id,
    'Status': l.status,
    'Progress': `${l.progress}%`,
  });
  console.log();
  console.log(chalk.dim('  Poll with: dm lists get ' + listId));
  console.log();
}

// ============================================================================
// Items (GET /lists/:id/items)
// ============================================================================

export async function listsItems(
  listId: string,
  options: { page?: string; perPage?: string; json?: boolean }
): Promise<void> {
  const spinner = ora('Fetching list items...').start();
  const data = await apiRequest<ListItemsResponse>(`/lists/${listId}/items`, {
    query: {
      ...(options.page && { page: parseInt(options.page, 10) }),
      ...(options.perPage && { per_page: parseInt(options.perPage, 10) }),
    },
  });
  spinner.stop();

  if (options.json) {
    printJson(data);
    return;
  }

  printHeader(`Items in list ${listId}`);
  console.log();

  if (data.data.length > 0) {
    const rows = data.data.map((item) => ({
      item_id: truncate(item.list_item_id, 16),
      property_id: item.internal_property_id ?? '—',
      person_id: item.internal_person_id ?? '—',
      added: formatDate(item.created_at),
    }));
    printTable(rows, ['item_id', 'property_id', 'person_id', 'added']);
  } else {
    console.log(chalk.dim('  No items found.'));
  }

  const p = data.pagination;
  console.log();
  console.log(chalk.dim(`Page ${p.page} — ${p.total} total items${p.has_more ? ' (more available)' : ''}`));
  console.log();
}

// ============================================================================
// Add items (POST /lists/:id/items)
// ============================================================================

export async function listsAdd(
  listId: string,
  options: { ids: string; idType?: string; json?: boolean }
): Promise<void> {
  if (!options.ids) {
    console.error(chalk.red('Error: --ids is required (comma-separated list of IDs)'));
    process.exit(1);
  }

  const ids = options.ids.split(',').map((id) => parseInt(id.trim(), 10));
  const requestBody: Record<string, unknown> = { ids };
  if (options.idType) requestBody.id_type = options.idType;

  const spinner = ora('Adding items...').start();
  const data = await apiRequest<{ data: { added: number } }>(`/lists/${listId}/items`, {
    method: 'POST',
    body: requestBody,
  });
  spinner.stop();

  if (options.json) {
    printJson(data);
    return;
  }

  console.log(chalk.green(`  ${data.data.added} items added to list ${listId}.`));
  console.log();
}

// ============================================================================
// Remove items (DELETE /lists/:id/items)
// ============================================================================

export async function listsRemove(
  listId: string,
  options: { ids: string; idType?: string; json?: boolean }
): Promise<void> {
  if (!options.ids) {
    console.error(chalk.red('Error: --ids is required (comma-separated list of IDs)'));
    process.exit(1);
  }

  const ids = options.ids.split(',').map((id) => parseInt(id.trim(), 10));
  const requestBody: Record<string, unknown> = { ids };
  if (options.idType) requestBody.id_type = options.idType;

  const spinner = ora('Removing items...').start();
  const data = await apiRequest<{ data: { removed: number } }>(`/lists/${listId}/items`, {
    method: 'DELETE',
    body: requestBody,
  });
  spinner.stop();

  if (options.json) {
    printJson(data);
    return;
  }

  console.log(chalk.green(`  ${data.data.removed} items removed from list ${listId}.`));
  console.log();
}

// ============================================================================
// Export (POST /lists/:id/export)
// ============================================================================

export async function listsExport(
  listId: string,
  options: { fields?: string; anchor?: string; json?: boolean }
): Promise<void> {
  const requestBody: Record<string, unknown> = {};
  if (options.fields) {
    requestBody.fields = options.fields.split(',').map((f) => f.trim());
  }
  if (options.anchor) {
    requestBody.anchor = options.anchor;
  }

  const spinner = ora('Starting export...').start();
  const data = await apiRequest<{ data: { export_id: string; status: string; record_count: number } }>(
    `/lists/${listId}/export`,
    { method: 'POST', body: requestBody }
  );
  spinner.stop();

  if (options.json) {
    printJson(data);
    return;
  }

  const e = data.data;
  printHeader('Export Started');
  printKeyValue({
    'Export ID': e.export_id,
    'Status': e.status,
    'Record Count': e.record_count,
  });
  console.log();
}
