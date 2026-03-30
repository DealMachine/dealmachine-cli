/**
 * Activity commands — search and get
 */

import chalk from 'chalk';

import { apiRequest, formatDate } from '../lib/client.js';
import {
  parseRequestBody,
  printJson,
  printHeader,
  printTable,
  printPagination,
  truncate,
  createSpinner,
} from '../lib/output.js';

// ============================================================================
// Types
// ============================================================================

interface ActivityItem {
  activity_id: string;
  type: string;
  created_at: string;
  matched_on?: string[];
  request_summary: Record<string, unknown>;
  result_summary: Record<string, unknown>;
}

interface SearchResponse {
  data: ActivityItem[];
  pagination: {
    page: number;
    per_page: number;
    total_results: number;
    total_pages: number;
    has_next_page: boolean;
    has_previous_page: boolean;
  };
}

interface GetResponse {
  data: {
    activity_id: string;
    type: string;
    created_at: string;
    request: Record<string, unknown>;
    result_summary: Record<string, unknown>;
    entity_ids: {
      people: string[];
      properties: string[];
      pagination: {
        page: number;
        per_page: number;
        total_people: number;
        total_properties: number;
        has_next_page: boolean;
      };
    };
  };
}

// ============================================================================
// Search
// ============================================================================

export async function activitySearch(options: {
  body?: string;
  file?: string;
  types?: string[];
  query?: string;
  page?: string;
  perPage?: string;
  json?: boolean;
}): Promise<void> {
  let requestBody: Record<string, unknown>;

  // Build body from flags or parse from --body/-f/stdin
  if (options.types || options.query) {
    requestBody = {};
    if (options.types) requestBody.types = options.types;
    if (options.query) requestBody.query = options.query;
    if (options.page) requestBody.page = parseInt(options.page, 10);
    if (options.perPage) requestBody.per_page = parseInt(options.perPage, 10);
  } else {
    requestBody = await parseRequestBody(options);
  }

  const spinner = createSpinner('Searching activity...').start();
  const data = await apiRequest<SearchResponse>('/activity/search', {
    method: 'POST',
    body: requestBody,
  });
  spinner.stop();

  if (options.json) {
    printJson(data);
    return;
  }

  printHeader('Activity History');
  console.log();

  if (data.data.length > 0) {
    const rows = data.data.map((a) => ({
      id: truncate(a.activity_id, 16),
      type: a.type,
      date: formatDate(a.created_at),
      results: (a.result_summary as any).total_results ?? '—',
      credits: (a.result_summary as any).credits_used ?? '—',
    }));
    printTable(rows, ['id', 'type', 'date', 'results', 'credits']);
  } else {
    console.log(chalk.dim('  No activity found.'));
  }

  printPagination(data.pagination);
  console.log();
}

// ============================================================================
// Get by ID
// ============================================================================

export async function activityGet(
  activityId: string,
  options: { json?: boolean }
): Promise<void> {
  const spinner = createSpinner('Fetching activity...').start();
  const data = await apiRequest<GetResponse>(`/activity/${activityId}`);
  spinner.stop();

  if (options.json) {
    printJson(data);
    return;
  }

  const a = data.data;
  printHeader(`Activity ${a.activity_id}`);

  console.log(`  ${chalk.cyan('Type:')}       ${a.type}`);
  console.log(`  ${chalk.cyan('Created:')}    ${formatDate(a.created_at)}`);
  console.log();

  // Request summary
  console.log(chalk.bold('  Request'));
  console.log(chalk.dim('  ' + '─'.repeat(48)));
  const reqStr = JSON.stringify(a.request, null, 2)
    .split('\n')
    .map((line) => '  ' + line)
    .join('\n');
  console.log(chalk.dim(reqStr));
  console.log();

  // Result summary
  console.log(chalk.bold('  Result Summary'));
  console.log(chalk.dim('  ' + '─'.repeat(48)));
  for (const [key, val] of Object.entries(a.result_summary)) {
    if (key === 'entity_ids' || key === 'entity_count') continue;
    console.log(`  ${chalk.cyan(key.padEnd(20))} ${String(val)}`);
  }

  // Entity IDs
  const ent = a.entity_ids;
  console.log();
  console.log(
    chalk.bold(`  Entity IDs (${ent.pagination.total_people} people, ${ent.pagination.total_properties} properties)`)
  );
  if (ent.people.length > 0) {
    console.log(chalk.dim('  People:'));
    for (const id of ent.people.slice(0, 20)) {
      console.log(`    ${id}`);
    }
    if (ent.people.length > 20) console.log(chalk.dim(`    ... and ${ent.people.length - 20} more`));
  }
  if (ent.properties.length > 0) {
    console.log(chalk.dim('  Properties:'));
    for (const id of ent.properties.slice(0, 20)) {
      console.log(`    ${id}`);
    }
    if (ent.properties.length > 20) console.log(chalk.dim(`    ... and ${ent.properties.length - 20} more`));
  }

  console.log();
}
