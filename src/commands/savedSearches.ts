/**
 * Saved search commands: list, get, rename, pin, unpin, share, unshare, duplicate, remove.
 *
 * A saved search is a search someone saved in the app: its filters, places and lists under a
 * name. You see your own and the ones shared with your team. Only the person who saved a search
 * can rename, pin, share, duplicate or remove it; that person or a workspace admin can stop
 * sharing it. An API key that is not tied to a person reads the shared ones and changes none.
 *
 * To run one, pass its ID to a Command that takes criteria: `--saved-search <id>` on
 * `dm properties search|count|export`, `dm people search|count|export`, `dm lists create` and
 * `dm lists build` (see lib/searchProtocol.ts).
 */

import chalk from 'chalk';

import {
  apiRequest,
  formatDate,
  type ApiError,
  type ApiErrorDescription,
} from '../lib/client.js';
import {
  createSpinner,
  printHeader,
  printJson,
  printKeyValue,
  printTable,
  truncate,
} from '../lib/output.js';

// ============================================================================
// Types
// ============================================================================

/** One part of a saved search the Public API cannot express, and why. */
interface UnsupportedCriterion {
  kind: string;
  label: string;
  reason: string;
}

interface SavedSearch {
  saved_search_id: string;
  name: string;
  kind: 'properties' | 'people' | 'companies' | string;
  pinned: boolean;
  shared: boolean;
  is_owner: boolean;
  shared_by?: string | null;
  result_count: number | null;
  created_at: string | null;
  updated_at: string | null;
  app_path?: string | null;
  // The criteria, on a read of one search and on a list asked for with --include-filters.
  filters?: unknown[];
  filter_groups?: unknown[];
  locations?: unknown[];
  include_lists?: Record<string, unknown[]>;
  exclude_lists?: Record<string, unknown[]>;
  exclude_previously_exported?: unknown;
  unsupported?: UnsupportedCriterion[];
  complete?: boolean;
}

interface SavedSearchListResponse {
  data: SavedSearch[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
    has_more: boolean;
  };
}

interface SavedSearchResponse {
  data: SavedSearch;
}

/**
 * A 404 for the route itself, not for a saved search. The API names a saved search it cannot
 * find ("No saved search found with ID ..."); an API released before saved searches answers
 * "No route found for ..." instead, and the usual hint to check the ID would send the person
 * looking for a mistake they did not make.
 */
function describeMissingRoute(status: number, error: ApiError): ApiErrorDescription | undefined {
  if (status !== 404) return undefined;
  const message = error.error?.message;
  if (message && !/^No route found/i.test(message)) return undefined;
  return {
    message: 'This API does not have saved searches yet.',
    hints: [
      'The saved search Commands need a newer API than the one this CLI is talking to.',
      'Nothing was changed. Try again once the API is updated.',
    ],
  };
}

/** Every saved search request, with that one refusal put in plain words. */
const request = <T>(path: string, options: Parameters<typeof apiRequest>[1] = {}) =>
  apiRequest<T>(path, { ...options, describeError: describeMissingRoute });

const yesNo = (value: boolean) => (value ? 'yes' : 'no');
const owner = (search: SavedSearch) => (search.is_owner ? 'you' : search.shared_by || 'teammate');
const count = (value: unknown[] | undefined) => (Array.isArray(value) ? value.length : 0);
const listCount = (scope: Record<string, unknown[]> | undefined) =>
  Object.values(scope ?? {}).reduce((total, ids) => total + count(ids), 0);
const when = (value: string | null) => (value ? formatDate(value) : 'never');

/** The Command that runs a saved search of this kind, for the hint under a result. */
function runHint(search: SavedSearch): string | null {
  if (search.kind === 'properties') return `dm properties count --saved-search ${search.saved_search_id}`;
  if (search.kind === 'people') return `dm people count --saved-search ${search.saved_search_id}`;
  return null;
}

// ============================================================================
// List (GET /saved-searches)
// ============================================================================

export async function savedSearchesList(options: {
  search?: string;
  kind?: string;
  /** Commander's `--pinned` / `--no-pinned` pair: undefined means both. */
  pinned?: boolean;
  /** Commander's `--shared` / `--no-shared` pair: undefined means both. */
  shared?: boolean;
  includeFilters?: boolean;
  page?: string;
  perPage?: string;
  json?: boolean;
}): Promise<void> {
  const spinner = createSpinner('Fetching saved searches...').start();
  const data = await request<SavedSearchListResponse>('/saved-searches', {
    query: {
      ...(options.search && { search: options.search }),
      ...(options.kind && { kind: options.kind }),
      ...(options.pinned !== undefined && { pinned: options.pinned }),
      ...(options.shared !== undefined && { shared: options.shared }),
      ...(options.includeFilters && { include: 'filters' }),
      ...(options.page && { page: parseInt(options.page, 10) }),
      ...(options.perPage && { per_page: parseInt(options.perPage, 10) }),
    },
  });
  spinner.stop();

  if (options.json) {
    printJson(data);
    return;
  }

  printHeader('Saved Searches');
  console.log();

  if (data.data.length > 0) {
    const rows = data.data.map((search) => ({
      id: search.saved_search_id,
      name: truncate(search.name, 34),
      kind: search.kind,
      pinned: yesNo(search.pinned),
      shared: yesNo(search.shared),
      owner: truncate(owner(search), 20),
      results: search.result_count === null ? 'not run' : search.result_count.toLocaleString(),
      updated: when(search.updated_at),
    }));
    printTable(rows, ['id', 'name', 'kind', 'pinned', 'shared', 'owner', 'results', 'updated']);
  } else {
    console.log(chalk.dim('  No saved searches found.'));
  }

  const p = data.pagination;
  console.log();
  console.log(
    chalk.dim(`Page ${p.page}: ${p.total} total saved searches${p.has_more ? ' (more available)' : ''}`)
  );
  console.log();
}

// ============================================================================
// Get (GET /saved-searches/:id)
// ============================================================================

export async function savedSearchesGet(id: string, options: { json?: boolean }): Promise<void> {
  const spinner = createSpinner('Fetching saved search...').start();
  const data = await request<SavedSearchResponse>(`/saved-searches/${encodeURIComponent(id)}`);
  spinner.stop();

  if (options.json) {
    printJson(data);
    return;
  }

  const search = data.data;
  printHeader(`Saved Search ${search.saved_search_id}`);
  printKeyValue({
    'Name': search.name,
    'Kind': search.kind,
    'Pinned': search.pinned,
    'Shared': search.shared,
    'Owner': owner(search),
    'Results': search.result_count === null ? 'not run' : search.result_count,
    'Created': when(search.created_at),
    'Updated': when(search.updated_at),
  });
  console.log();
  console.log(chalk.bold('  Criteria'));
  printKeyValue({
    'Filters': count(search.filters),
    'Filter groups': count(search.filter_groups),
    'Locations': count(search.locations),
    'Included lists': listCount(search.include_lists),
    'Excluded lists': listCount(search.exclude_lists),
    'Excludes exported': Boolean(search.exclude_previously_exported),
  });

  const unsupported = search.unsupported ?? [];
  if (search.complete === true && unsupported.length === 0) {
    const hint = runHint(search);
    if (hint) {
      console.log();
      console.log(chalk.dim(`  Run it with: ${hint}`));
    }
  } else {
    // Only a search the API says is complete can run. Anything else gets no hint to run it.
    console.log();
    console.log(
      chalk.yellow(
        unsupported.length > 0
          ? '  This search has parts the API cannot run, so it cannot be used with --saved-search:'
          : '  The API does not say this search is complete, so it cannot be used with --saved-search.'
      )
    );
    for (const part of unsupported) {
      console.log(chalk.yellow(`    ${part.label}: ${part.reason}`));
    }
  }
  console.log(chalk.dim('  Add --json for the full filters and locations.'));
  console.log();
}

// ============================================================================
// Rename (PATCH /saved-searches/:id)
// ============================================================================

export async function savedSearchesRename(
  id: string,
  name: string,
  options: { json?: boolean }
): Promise<void> {
  const trimmed = (name ?? '').trim();
  if (!trimmed) {
    console.error(chalk.red('Error: a new name is required'));
    process.exit(1);
  }

  const spinner = createSpinner('Renaming saved search...').start();
  const data = await request<SavedSearchResponse>(`/saved-searches/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: { name: trimmed },
  });
  spinner.stop();

  if (options.json) {
    printJson(data);
    return;
  }

  console.log(chalk.green(`  Saved search ${data.data.saved_search_id} renamed to "${data.data.name}".`));
  console.log();
}

// ============================================================================
// Pin, unpin, share, unshare (POST /saved-searches/:id/<change>)
// ============================================================================

const CHANGES = {
  pin: { doing: 'Pinning saved search...', done: 'pinned' },
  unpin: { doing: 'Unpinning saved search...', done: 'unpinned' },
  share: { doing: 'Sharing saved search...', done: 'shared with your team' },
  unshare: { doing: 'Stopping sharing...', done: 'no longer shared with your team' },
} as const;

async function change(
  id: string,
  action: keyof typeof CHANGES,
  options: { json?: boolean }
): Promise<void> {
  const spinner = createSpinner(CHANGES[action].doing).start();
  const data = await request<SavedSearchResponse>(
    `/saved-searches/${encodeURIComponent(id)}/${action}`,
    { method: 'POST' }
  );
  spinner.stop();

  if (options.json) {
    printJson(data);
    return;
  }

  console.log(chalk.green(`  Saved search "${data.data.name}" is ${CHANGES[action].done}.`));
  console.log();
}

export const savedSearchesPin = (id: string, options: { json?: boolean }) =>
  change(id, 'pin', options);
export const savedSearchesUnpin = (id: string, options: { json?: boolean }) =>
  change(id, 'unpin', options);
export const savedSearchesShare = (id: string, options: { json?: boolean }) =>
  change(id, 'share', options);
export const savedSearchesUnshare = (id: string, options: { json?: boolean }) =>
  change(id, 'unshare', options);

// ============================================================================
// Duplicate (POST /saved-searches/:id/duplicate)
// ============================================================================

export async function savedSearchesDuplicate(id: string, options: { json?: boolean }): Promise<void> {
  const spinner = createSpinner('Duplicating saved search...').start();
  const data = await request<SavedSearchResponse>(
    `/saved-searches/${encodeURIComponent(id)}/duplicate`,
    { method: 'POST' }
  );
  spinner.stop();

  if (options.json) {
    printJson(data);
    return;
  }

  const copy = data.data;
  printHeader('Saved Search Duplicated');
  printKeyValue({
    'Saved Search ID': copy.saved_search_id,
    'Name': copy.name,
    'Kind': copy.kind,
  });
  console.log();
}

// ============================================================================
// Remove (DELETE /saved-searches/:id)
// ============================================================================

export async function savedSearchesRemove(id: string, options: { json?: boolean }): Promise<void> {
  const spinner = createSpinner('Removing saved search...').start();
  const data = await request<{ data: { removed: boolean; still_shared?: boolean } }>(
    `/saved-searches/${encodeURIComponent(id)}`,
    { method: 'DELETE' }
  );
  spinner.stop();

  if (options.json) {
    printJson(data);
    return;
  }

  console.log(chalk.green(`  Saved search ${id} removed from your history.`));
  if (data.data.still_shared) {
    console.log(chalk.dim('  It is still shared with your team. Stop that with: dm saved-searches unshare ' + id));
  }
  console.log();
}
