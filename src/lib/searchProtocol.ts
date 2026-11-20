import chalk from 'chalk';

import { parseRequestBody } from './output.js';

export interface SearchProtocolCliOptions {
  includeLists?: string;
  excludeLists?: string;
  excludePreviouslyExported?: boolean;
  bigqueryDataEnvironment?: string;
}

type SourceType = 'properties' | 'people';

function listFieldForSourceType(sourceType: SourceType): 'property_list_ids' | 'people_list_ids' {
  return sourceType === 'people' ? 'people_list_ids' : 'property_list_ids';
}

function parseListRefs(value?: string): Array<number | string> {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const numericValue = Number(item);
      return Number.isSafeInteger(numericValue) && String(numericValue) === item
        ? numericValue
        : item;
    });
}

function normalizeBigQueryDataEnvironment(value?: string): 1 | 2 | 3 | undefined {
  const numericValue = value ? Number(value) : undefined;
  return numericValue === 1 || numericValue === 2 || numericValue === 3
    ? (numericValue as 1 | 2 | 3)
    : undefined;
}

export function applySearchProtocolOptions(
  requestBody: Record<string, unknown>,
  options: SearchProtocolCliOptions,
  sourceType: SourceType
): void {
  const includeListIds = parseListRefs(options.includeLists);
  const excludeListIds = parseListRefs(options.excludeLists);
  const listField = listFieldForSourceType(sourceType);

  if (includeListIds.length > 0) {
    requestBody.include_lists = {
      ...(requestBody.include_lists as object | undefined),
      [listField]: includeListIds,
    };
  }
  if (excludeListIds.length > 0) {
    requestBody.exclude_lists = {
      ...(requestBody.exclude_lists as object | undefined),
      [listField]: excludeListIds,
    };
  }
  if (options.excludePreviouslyExported) {
    requestBody.exclude_previously_exported = true;
  }

  const bigqueryDataEnvironment = normalizeBigQueryDataEnvironment(options.bigqueryDataEnvironment);
  if (bigqueryDataEnvironment) {
    requestBody.bigquery_data_environment = bigqueryDataEnvironment;
  }
}

// ============================================================================
// A saved search as the source (--saved-search <id>)
// ============================================================================

export interface SavedSearchSourceCliOptions {
  /** The ID of a saved search to run in place of filters and locations. */
  savedSearch?: string;
}

export const SAVED_SEARCH_OPTION_HELP =
  'Use a saved search as the source, in place of filters and locations (see dm saved-searches list)';

const NOT_BOTH = 'Use --saved-search or your own filters and locations, not both.';
const READ_IT_YOURSELF =
  'To change what a saved search finds, read it with dm saved-searches get <id> --json and send its filters and locations yourself.';

/**
 * What a request sends as criteria of its own. A request names a saved search or sends these,
 * never both: the API refuses the mix, and refusing it here saves the round trip.
 * `prospect_search_id` is the older name for a saved search on the two list Commands, so
 * sending it beside --saved-search would name two sources.
 */
const OWN_CRITERIA = [
  'filters',
  'filter_groups',
  'locations',
  'property_ids',
  'people_ids',
  'record_ids',
  'include_lists',
  'exclude_lists',
  'exclude_previously_exported',
  'prospect_search_id',
] as const;

function isSent(value: unknown): boolean {
  if (value === undefined || value === null || value === false) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).some(isSent);
  }
  return true;
}

/** The trimmed ID from --saved-search, or an exit when the option was given with nothing in it. */
function savedSearchId(options: SavedSearchSourceCliOptions): string | undefined {
  if (options.savedSearch === undefined) return undefined;
  const id = String(options.savedSearch).trim();
  if (!id) {
    console.error(chalk.red('Error: --saved-search needs a saved search ID'));
    console.error(chalk.dim('  Find one with: dm saved-searches list'));
    process.exit(1);
  }
  return id;
}

/** How long to wait for piped input before deciding there is none. */
const PIPED_INPUT_WAIT_MS = 150;

/**
 * Whatever was piped to this process, without waiting for the pipe to close. A script or an
 * agent often leaves standard input open and never writes to it, and reading that to the end
 * would wait forever. So this waits a moment for the first data: something piped by a shell
 * (`cat query.json | dm ...`) is there at once, a closed or empty input ends at once, and an
 * open input nobody writes to is taken as no input when the moment has passed.
 */
function pipedInput(): Promise<string> {
  const stdin = process.stdin;
  if (stdin.isTTY) return Promise.resolve('');
  return new Promise((resolve) => {
    let text = '';
    const finish = () => {
      clearTimeout(timer);
      stdin.off('data', onData);
      stdin.off('end', finish);
      stdin.off('error', finish);
      stdin.pause();
      // An input left open must not keep the process alive after the Command is done.
      (stdin as unknown as { unref?: () => void }).unref?.();
      resolve(text.trim());
    };
    const onData = (chunk: Buffer | string) => {
      text += chunk.toString();
      // Anything but blank space is enough to know input was piped.
      if (text.trim()) finish();
    };
    const timer = setTimeout(finish, PIPED_INPUT_WAIT_MS);
    stdin.on('data', onData);
    stdin.once('end', finish);
    stdin.once('error', finish);
    stdin.resume();
  });
}

/**
 * The request body for a Command that takes criteria. Without --saved-search this is the body
 * as it always was: --body, -f or piped JSON, and an error when there is none. With
 * --saved-search the saved search stands in for the criteria, so no body is needed; --body or
 * -f may still carry output options such as fields or pagination.
 *
 * Piped input is refused with --saved-search. Without the option it is where criteria come
 * from, so reading none of it would run the whole saved search for someone who piped filters.
 */
export async function readCriteriaBody(
  options: { body?: string; file?: string } & SavedSearchSourceCliOptions
): Promise<Record<string, unknown>> {
  if (savedSearchId(options) === undefined) return parseRequestBody(options);
  if (options.body || options.file) return parseRequestBody(options);
  if (await pipedInput()) {
    console.error(chalk.red(`Error: ${NOT_BOTH}`));
    console.error(chalk.dim('  Also sent: input piped to this Command (stdin)'));
    console.error(
      chalk.dim('  With --saved-search, pass output options such as fields in --body or -f.')
    );
    console.error(chalk.dim(`  ${READ_IT_YOURSELF}`));
    process.exit(1);
  }
  return {};
}

/**
 * Put --saved-search on the request as `saved_search_id`. Call it after every other option has
 * been applied, so criteria that came from a flag are caught as well as criteria in the body.
 */
export function applySavedSearchSource(
  requestBody: Record<string, unknown>,
  options: SavedSearchSourceCliOptions
): void {
  const id = savedSearchId(options);
  if (id === undefined) return;

  const alsoSent: string[] = OWN_CRITERIA.filter((field) => isSent(requestBody[field]));
  const inBody = requestBody.saved_search_id;
  if (inBody !== undefined && inBody !== id) alsoSent.push('saved_search_id');
  if (alsoSent.length > 0) {
    console.error(chalk.red(`Error: ${NOT_BOTH}`));
    console.error(chalk.dim(`  Also sent: ${alsoSent.join(', ')}`));
    console.error(chalk.dim(`  ${READ_IT_YOURSELF}`));
    process.exit(1);
  }
  requestBody.saved_search_id = id;
}

/**
 * Stop when the API did not say it used the saved search. An API that knows `saved_search_id`
 * returns it in its answer: at the top for a count, a search or an export, and on the list for
 * a list create or build. One that does not know the field drops it without a word and answers
 * as if it had never been sent, which for `dm lists create` is a new, empty list. `whatHappened`
 * says what that answer did, so the person can undo it.
 */
export function requireSavedSearchUsed(
  requestBody: Record<string, unknown>,
  response: unknown,
  whatHappened: string[] = []
): void {
  const sent = requestBody.saved_search_id;
  if (typeof sent !== 'string') return;
  const answer = (response && typeof response === 'object' ? response : {}) as Record<string, unknown>;
  const inner = (
    answer.data && typeof answer.data === 'object' && !Array.isArray(answer.data) ? answer.data : {}
  ) as Record<string, unknown>;
  if (answer.saved_search_id === sent || inner.saved_search_id === sent) return;

  console.error(
    chalk.red('Error: This API does not support saved searches yet, so it did not use --saved-search.')
  );
  for (const line of whatHappened) console.error(chalk.dim(`  ${line}`));
  console.error(
    chalk.dim(
      '  Its answer is not the saved search\'s. Try again once the API is updated, or send filters and locations yourself.'
    )
  );
  process.exit(1);
}
