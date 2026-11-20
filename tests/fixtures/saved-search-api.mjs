// A local stand-in for the saved search endpoints of the Public API (APP-21731).
//
// The Commands in src/commands/savedSearches.ts and the --saved-search option were built before
// those endpoints existed, so this file is the contract they were built to: the paths, the
// query and body fields, the response envelopes and the refusals written in the plan for the
// API. The tests run the real Commands against it over HTTP. It proves the CLI sends and reads
// that contract. It does not prove the deployed API follows it.
//
// Three keys reach it. `person-key` belongs to a person (user 7). `admin-key` belongs to a
// workspace admin (user 9), who may stop a teammate's sharing and nothing else of theirs.
// `workspace-key` belongs to the workspace and to nobody in it: it reads the searches shared
// with the team and changes none.
//
// Two options make it a different API, for the CLI's own protection:
//   createSavedSearchApi({ savedSearches: false })  an API released before saved searches. It
//     has no /saved-searches routes and drops `saved_search_id` from a request without a word,
//     as today's API does: a count, search, export or list build then has no criteria, and a
//     list create makes an empty list.
//   createSavedSearchApi({ acknowledge: false })    an API that runs a saved search and does
//     not say so in its answer.

import { createServer } from 'node:http';
import { once } from 'node:events';

export const PERSON_KEY = 'person-key';
export const WORKSPACE_KEY = 'workspace-key';
export const ADMIN_KEY = 'admin-key';
const ME = 7;
const TEAMMATE = 8;
const ADMIN = 9;

const TEXAS = { type: 'state', code: 'TX' };
const AUSTIN = { type: 'city', code: '4805000', state: 'TX' };

/** The searches workspace 42 holds when the stand-in starts. Newest change first. */
function seed() {
  return [
    {
      saved_search_id: 'ss_absentee',
      owner: ME,
      name: 'Absentee owners in Austin',
      kind: 'properties',
      pinned: true,
      shared: false,
      result_count: 1840,
      created_at: '2026-10-02T15:00:00.000Z',
      updated_at: '2026-11-18T12:00:00.000Z',
      criteria: {
        filters: [
          { filter_id: 'is_absentee_owner', operator: 'is_boolean', value: true },
          { filter_id: 'estimated_value', operator: 'greater_than_or_equal', value: 250000 },
        ],
        locations: [AUSTIN],
        exclude_lists: { property_list_ids: ['list_already_mailed'] },
      },
    },
    {
      saved_search_id: 'ss_landlords',
      owner: ME,
      name: 'Tired landlords Dallas',
      kind: 'people',
      pinned: false,
      shared: true,
      result_count: 312,
      created_at: '2026-10-05T15:00:00.000Z',
      updated_at: '2026-11-17T12:00:00.000Z',
      criteria: {
        filters: [{ filter_id: 'person_age', operator: 'range', value: { min: 55, max: 80 } }],
        locations: [TEXAS],
      },
    },
    {
      saved_search_id: 'ss_probate',
      owner: TEAMMATE,
      ownerName: 'Sam Ortiz',
      name: 'Probate leads Austin',
      kind: 'properties',
      pinned: false,
      shared: true,
      result_count: null,
      created_at: '2026-10-09T15:00:00.000Z',
      updated_at: '2026-11-16T12:00:00.000Z',
      criteria: {
        filters: [],
        filter_groups: [
          {
            operator: 'or',
            filters: [
              { filter_id: 'is_probate', operator: 'is_boolean', value: true },
              { filter_id: 'is_inherited', operator: 'is_boolean', value: true },
            ],
          },
        ],
        locations: [AUSTIN],
      },
    },
    {
      saved_search_id: 'ss_city_limits',
      owner: ME,
      name: 'Inside Marshall city limits',
      kind: 'properties',
      pinned: false,
      shared: false,
      result_count: 14784,
      created_at: '2026-10-11T15:00:00.000Z',
      updated_at: '2026-11-15T12:00:00.000Z',
      criteria: { filters: [], locations: [] },
      unsupported: [
        {
          kind: 'location',
          label: 'Marshall',
          reason: 'This city is kept to its city limits, which the Public API cannot ask for.',
        },
      ],
    },
    {
      // The API can call a search incomplete without listing a part. Seen only by the admin.
      saved_search_id: 'ss_incomplete',
      owner: ADMIN,
      name: 'Admin search the API cannot run',
      kind: 'properties',
      pinned: false,
      shared: false,
      result_count: 3,
      created_at: '2026-10-12T15:00:00.000Z',
      updated_at: '2026-11-13T12:00:00.000Z',
      criteria: { filters: [], locations: [TEXAS] },
      incomplete: true,
    },
    {
      saved_search_id: 'ss_mate_private',
      owner: TEAMMATE,
      ownerName: 'Sam Ortiz',
      name: 'Teammate private search',
      kind: 'properties',
      pinned: false,
      shared: false,
      result_count: 9,
      created_at: '2026-10-12T15:00:00.000Z',
      updated_at: '2026-11-14T12:00:00.000Z',
      criteria: { filters: [], locations: [TEXAS] },
    },
  ];
}

const refusal = (status, code, message, details) => ({
  status,
  body: { error: { code, message, request_id: 'req_fixture', ...(details ? { details } : {}) } },
});
const NOT_FOUND = (id) => refusal(404, 'not_found', `No saved search found with ID ${id}`);
const OWNER_ONLY = refusal(403, 'forbidden', 'Only the person who saved this search can change it.');
const OWNER_OR_ADMIN = refusal(
  403,
  'forbidden',
  'Only the person who shared this search or a workspace admin can stop sharing it.'
);
const NO_CRITERIA = (ids) =>
  refusal(400, 'validation_error', 'Validation failed', {
    issues: [
      {
        path: 'locations',
        message: `At least one of locations, ${ids}, include_lists, exclude_lists, or exclude_previously_exported must be provided`,
      },
    ],
  });
const PERSON_REQUIRED = refusal(
  403,
  'forbidden',
  'This API key is not tied to a person, so it can read the saved searches shared with the team and cannot change them.'
);
const BOTH = (alsoSent) =>
  refusal(400, 'invalid_request', 'Send saved_search_id or your own filters and locations, not both.', {
    also_sent: alsoSent,
  });

const OWN_CRITERIA = [
  'filters',
  'filter_groups',
  'locations',
  'property_ids',
  'people_ids',
  'include_lists',
  'exclude_lists',
  'exclude_previously_exported',
];
const sent = (value) =>
  Array.isArray(value)
    ? value.length > 0
    : value && typeof value === 'object'
      ? Object.values(value).some(sent)
      : Boolean(value);

export function createSavedSearchApi({ savedSearches = true, acknowledge = true } = {}) {
  let searches = seed();
  let copies = 0;
  let lists = 0;
  const requests = [];

  const person = (key) => (key === PERSON_KEY ? ME : key === ADMIN_KEY ? ADMIN : null);
  /** What an answer carries to say the saved search was used. */
  const used = (search) => (search && acknowledge ? { saved_search_id: search.saved_search_id } : {});
  const visible = (search, userId) => search.shared || (userId !== null && search.owner === userId);
  const summary = (search, userId) => ({
    saved_search_id: search.saved_search_id,
    name: search.name,
    kind: search.kind,
    pinned: search.owner === userId && search.pinned,
    shared: search.shared,
    is_owner: search.owner === userId,
    shared_by: search.shared && search.owner !== userId ? (search.ownerName ?? 'Dana Reyes') : null,
    result_count: search.result_count,
    created_at: search.created_at,
    updated_at: search.updated_at,
    app_path: `/${search.kind === 'people' ? 'find-people' : 'find-properties'}/${search.saved_search_id}`,
  });
  const withCriteria = (search, userId) => {
    const unsupported = search.unsupported ?? [];
    return {
      ...summary(search, userId),
      ...search.criteria,
      unsupported,
      complete: unsupported.length === 0 && !search.incomplete,
    };
  };

  /** The saved search a request names as its source, or the refusal the API gives. */
  function source(body, userId, kind) {
    const id = body.saved_search_id;
    if (id === undefined) return { search: null };
    const alsoSent = OWN_CRITERIA.filter((field) => sent(body[field]));
    if (alsoSent.length > 0) return { refused: BOTH(alsoSent) };
    const search = searches.find((entry) => entry.saved_search_id === id);
    if (!search || !visible(search, userId)) return { refused: NOT_FOUND(id) };
    if (kind && search.kind !== kind) {
      return {
        refused: refusal(
          400,
          'invalid_request',
          `This saved search finds ${search.kind}, and this request is for ${kind}.`
        ),
      };
    }
    if (search.unsupported?.length) {
      const parts = search.unsupported.map((part) => `${part.label} (${part.reason})`).join('; ');
      return {
        refused: refusal(
          400,
          'saved_search_not_supported',
          `This saved search cannot be used through the Public API as it is saved: ${parts}`,
          { saved_search_id: id, unsupported: search.unsupported }
        ),
      };
    }
    return { search };
  }

  function handle({ method, path, query, body, key }) {
    const userId = person(key);
    const pagination = { page: 1, per_page: 25, total_results: 0, total_pages: 1, has_next_page: false, has_previous_page: false };

    // ---- a saved search as the source of a count, search, export or list build
    const run = path.match(/^\/v1\/(properties|people)\/(search\/count|search|export)$/);
    if (run && method === 'POST') {
      const [, kind, operation] = run;
      const { search, refused } = source(body, userId, kind);
      if (refused) return refused;
      if (!search && !OWN_CRITERIA.some((field) => sent(body[field]))) {
        return NO_CRITERIA(kind === 'people' ? 'people_ids' : 'property_ids');
      }
      const total = search?.result_count ?? 25;
      if (operation === 'search/count') {
        return {
          status: 200,
          body: {
            ...used(search),
            total_properties: kind === 'properties' ? total : 0,
            total_people: kind === 'people' ? total : 0,
            total_results: total,
          },
        };
      }
      if (operation === 'search') {
        const totals = { properties: kind === 'properties' ? total : 0, people: kind === 'people' ? total : 0 };
        return {
          status: 200,
          body: {
            ...used(search),
            totals,
            pagination: { ...pagination, total_results: total, total_pages: Math.ceil(total / 25) },
            estimated_credits: {
              this_page: Math.min(total, 25),
              total_all_pages: total,
              breakdown: { ...totals, already_accessed: 0, note: 'Estimate only. No credits were spent.' },
            },
          },
        };
      }
      return {
        status: 200,
        body: {
          ...used(search),
          export_id: 'export_fixture',
          record_count: total,
          file_count: 1,
          total_file_size: 20480,
          execution_time: 1.2,
          download_urls: [{ filename: `${kind}.csv.gz`, url: 'https://example.test/export.csv.gz', size: 20480 }],
          credits: { used: total, properties: 0, people: total },
        },
      };
    }
    const listBuild = path.match(/^\/v1\/lists(?:\/([^/]+)\/build)?$/);
    if (listBuild && method === 'POST') {
      const building = Boolean(listBuild[1]);
      // A list made from a saved search takes the search's kind. A source_type that is sent
      // has to agree with it.
      const { search, refused } = source(body, userId, body.source_type);
      if (refused) return refused;
      const criteria = Boolean(search) || sent(body.filters) || sent(body.locations);
      if (building && !criteria) {
        return refusal(400, 'invalid_request', 'Provide filters or locations to build a list.');
      }
      lists += 1;
      return {
        // An async build answers 202; an empty list or one filled from record IDs answers 200.
        status: criteria ? 202 : 200,
        body: {
          data: {
            list_id: listBuild[1] ?? `list_fixture_${lists}`,
            name: body.name ?? 'Fixture list',
            source_type: search?.kind ?? body.source_type ?? 'properties',
            build_type: criteria ? 'search' : 'prospect',
            status: criteria ? 'building' : 'completed',
            total_count: 0,
            progress: 0,
            progress_stage: null,
            error_message: null,
            created_at: '2026-11-19T12:00:00.000Z',
            updated_at: '2026-11-19T12:00:00.000Z',
            ...used(search),
          },
        },
      };
    }

    // ---- the saved search endpoints
    if (!savedSearches && path.startsWith('/v1/saved-searches')) {
      return refusal(404, 'not_found', `No route found for ${method} ${path}`);
    }
    if (path === '/v1/saved-searches' && method === 'GET') {
      const page = Number(query.get('page') ?? 1);
      const perPage = Math.min(100, Number(query.get('per_page') ?? 25));
      const term = (query.get('search') ?? '').toLowerCase();
      const kind = query.get('kind');
      if (kind && !['properties', 'people', 'companies'].includes(kind)) {
        return refusal(400, 'validation_error', 'kind must be properties, people or companies.');
      }
      const flag = (name) => (query.has(name) ? query.get(name) === 'true' : undefined);
      const [pinned, shared] = [flag('pinned'), flag('shared')];
      const found = searches
        .filter((search) => visible(search, userId))
        .filter((search) => search.shared || !search.cleared)
        .filter((search) => !term || search.name.toLowerCase().includes(term))
        .filter((search) => !kind || search.kind === kind)
        .filter((search) => pinned === undefined || (search.owner === userId && search.pinned) === pinned)
        .filter((search) => shared === undefined || search.shared === shared)
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
      const start = (page - 1) * perPage;
      const shape = query.get('include') === 'filters' ? withCriteria : summary;
      return {
        status: 200,
        body: {
          data: found.slice(start, start + perPage).map((search) => shape(search, userId)),
          pagination: { page, per_page: perPage, total: found.length, has_more: start + perPage < found.length },
        },
      };
    }

    const one = path.match(/^\/v1\/saved-searches\/([^/]+)(?:\/(pin|unpin|share|unshare|duplicate))?$/);
    if (!one) return refusal(404, 'not_found', 'Not found');
    const [, id, action] = one;
    const search = searches.find((entry) => entry.saved_search_id === decodeURIComponent(id));
    const isRead = method === 'GET' && !action;
    if (!isRead && userId === null) return PERSON_REQUIRED;
    if (!search || !visible(search, userId)) return NOT_FOUND(decodeURIComponent(id));
    if (isRead) return { status: 200, body: { data: withCriteria(search, userId) } };
    // The owner changes a search. A workspace admin may stop a teammate's sharing, no more.
    if (search.owner !== userId) {
      if (action !== 'unshare') return OWNER_ONLY;
      if (userId !== ADMIN) return OWNER_OR_ADMIN;
    }
    const changed = () => {
      search.updated_at = '2026-11-19T12:00:00.000Z';
      return { status: 200, body: { data: summary(search, userId) } };
    };

    if (method === 'PATCH' && !action) {
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      if (!name || name.length > 255) {
        return refusal(400, 'validation_error', 'Search name must be between 1 and 255 characters.');
      }
      search.name = name;
      return changed();
    }
    if (method === 'DELETE' && !action) {
      // Out of the owner's history. Nothing is deleted, and a shared search stays shared.
      search.cleared = true;
      return { status: 200, body: { data: { removed: true, still_shared: search.shared } } };
    }
    if (method !== 'POST' || !action) return refusal(404, 'not_found', 'Not found');
    if (action === 'pin' || action === 'unpin') {
      search.pinned = action === 'pin';
      return { status: 200, body: { data: summary(search, userId) } };
    }
    if (action === 'share' || action === 'unshare') {
      search.shared = action === 'share';
      return { status: 200, body: { data: summary(search, userId) } };
    }
    copies += 1;
    const copy = {
      ...search,
      criteria: structuredClone(search.criteria),
      saved_search_id: `ss_copy_${copies}`,
      name: `${search.name} (copy)`,
      pinned: false,
      shared: false,
      updated_at: '2026-11-19T12:00:00.000Z',
    };
    searches.push(copy);
    return { status: 201, body: { data: summary(copy, userId) } };
  }

  const server = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const raw = Buffer.concat(chunks).toString();
    const url = new URL(request.url, 'http://localhost');
    const sentBody = raw ? JSON.parse(raw) : {};
    // An API that does not know the field drops it, as request validation does today.
    if (!savedSearches) delete sentBody.saved_search_id;
    const call = {
      method: request.method,
      path: url.pathname,
      query: url.searchParams,
      body: sentBody,
      key: String(request.headers.authorization ?? '').replace(/^Bearer /, ''),
    };
    requests.push({
      method: call.method,
      path: call.path,
      query: Object.fromEntries(url.searchParams),
      body: raw ? JSON.parse(raw) : undefined,
      source: request.headers['x-dealmachine-source'],
    });
    const known = [PERSON_KEY, WORKSPACE_KEY, ADMIN_KEY].includes(call.key);
    const result = known
      ? handle(call)
      : refusal(401, 'invalid_api_key', 'Invalid API key.');
    response.writeHead(result.status, { 'content-type': 'application/json' });
    response.end(JSON.stringify(result.body));
  });

  return {
    requests,
    /** Put the searches back as they started. */
    reset() {
      searches = seed();
      copies = 0;
      lists = 0;
      requests.length = 0;
    },
    /** Start listening on a free local port. Resolves to the base URL, ending in /v1. */
    async listen() {
      server.listen(0, '127.0.0.1');
      await once(server, 'listening');
      return `http://127.0.0.1:${server.address().port}/v1`;
    },
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}
