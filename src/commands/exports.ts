/**
 * Exports commands — list and get past exports
 */

import chalk from 'chalk';

import { apiRequest, formatDate } from '../lib/client.js';
import {
  printJson,
  printHeader,
  printTable,
  printKeyValue,
  truncate,
  createSpinner,
} from '../lib/output.js';

// ============================================================================
// Types
// ============================================================================

interface ExportRecord {
  export_id: string;
  status: string;
  name: string | null;
  progress: number | null;
  progress_stage: string | null;
  record_count: number | null;
  file_size: number | null;
  download_urls: { filename: string; url: string; size: number }[] | null;
  created_at: string;
  updated_at: string;
  expires_at: string;
}

interface ExportsListResponse {
  data: ExportRecord[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
    has_more: boolean;
  };
}

interface ExportGetResponse {
  data: ExportRecord;
}

// ============================================================================
// List
// ============================================================================

export async function exportsList(options: {
  limit?: string;
  offset?: string;
  status?: string;
  json?: boolean;
}): Promise<void> {
  const query: Record<string, string> = {};
  if (options.limit) query.limit = options.limit;
  if (options.offset) query.offset = options.offset;
  if (options.status) query.status = options.status;

  const spinner = createSpinner('Fetching exports...').start();
  const data = await apiRequest<ExportsListResponse>('/exports', { query });
  spinner.stop();

  if (options.json) {
    printJson(data);
    return;
  }

  printHeader('Exports');
  console.log();

  if (data.data.length > 0) {
    const rows = data.data.map((e) => ({
      export_id: truncate(e.export_id, 20),
      status: e.status,
      name: truncate(e.name || '—', 25),
      records: e.record_count?.toLocaleString() ?? '—',
      size: e.file_size ? formatBytes(e.file_size) : '—',
      created: formatDate(e.created_at),
    }));
    printTable(rows, ['export_id', 'status', 'name', 'records', 'size', 'created']);
  } else {
    console.log(chalk.dim('  No exports found.'));
  }

  const p = data.pagination;
  console.log();
  console.log(chalk.dim(`  Showing ${p.offset + 1}–${p.offset + data.data.length} of ${p.total}${p.has_more ? ' (more available)' : ''}`));
  console.log();
}

// ============================================================================
// Get by ID
// ============================================================================

export async function exportsGet(
  exportId: string,
  options: { json?: boolean }
): Promise<void> {
  const spinner = createSpinner('Fetching export...').start();
  const data = await apiRequest<ExportGetResponse>(`/exports/${exportId}`);
  spinner.stop();

  if (options.json) {
    printJson(data);
    return;
  }

  const e = data.data;
  printHeader(`Export ${e.export_id}`);
  printKeyValue({
    'Status': e.status,
    'Name': e.name || '—',
    'Progress': e.progress != null ? `${e.progress}%` : '—',
    'Stage': e.progress_stage || '—',
    'Records': e.record_count?.toLocaleString() ?? '—',
    'File Size': e.file_size ? formatBytes(e.file_size) : '—',
    'Created': formatDate(e.created_at),
    'Updated': formatDate(e.updated_at),
    'Expires': formatDate(e.expires_at),
  });

  if (e.download_urls && e.download_urls.length > 0) {
    console.log();
    console.log(chalk.bold('  Download URLs'));
    console.log(chalk.dim('  ' + '─'.repeat(48)));
    for (const dl of e.download_urls) {
      console.log(`  ${chalk.cyan(dl.filename)} (${formatBytes(dl.size)})`);
      console.log(chalk.dim(`    ${dl.url}`));
    }
  }

  console.log();
}

// ============================================================================
// Helpers
// ============================================================================

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
