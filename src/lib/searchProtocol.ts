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

/**
 * What a request sends as criteria of its own. A request names a saved search or sends these,
 * never both: the API refuses the mix, and refusing it here saves the round trip.
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
] as const;

function isSent(value: unknown): boolean {
  if (value === undefined || value === null || value === false) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).some(isSent);
  }
  return true;
}

/**
 * The request body for a Command that takes criteria. Without --saved-search this is the body
 * as it always was: --body, -f or piped JSON, and an error when there is none. With
 * --saved-search the saved search stands in for the criteria, so no body is needed; --body or
 * -f may still carry output options such as fields or pagination. Piped input is not read then.
 */
export async function readCriteriaBody(
  options: { body?: string; file?: string } & SavedSearchSourceCliOptions
): Promise<Record<string, unknown>> {
  if (!options.savedSearch) return parseRequestBody(options);
  return options.body || options.file ? parseRequestBody(options) : {};
}

/**
 * Put --saved-search on the request as `saved_search_id`. Call it after every other option has
 * been applied, so criteria that came from a flag are caught as well as criteria in the body.
 */
export function applySavedSearchSource(
  requestBody: Record<string, unknown>,
  options: SavedSearchSourceCliOptions
): void {
  const savedSearchId = options.savedSearch?.trim();
  if (options.savedSearch === undefined) return;
  if (!savedSearchId) {
    console.error(chalk.red('Error: --saved-search needs a saved search ID'));
    process.exit(1);
  }

  const alsoSent: string[] = OWN_CRITERIA.filter((field) => isSent(requestBody[field]));
  const inBody = requestBody.saved_search_id;
  if (inBody !== undefined && inBody !== savedSearchId) alsoSent.push('saved_search_id');
  if (alsoSent.length > 0) {
    console.error(
      chalk.red('Error: Use --saved-search or your own filters and locations, not both.')
    );
    console.error(chalk.dim(`  Also sent: ${alsoSent.join(', ')}`));
    console.error(
      chalk.dim(
        '  To change what a saved search finds, read it with dm saved-searches get <id> --json and send its filters and locations yourself.'
      )
    );
    process.exit(1);
  }
  requestBody.saved_search_id = savedSearchId;
}
