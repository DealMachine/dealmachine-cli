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
