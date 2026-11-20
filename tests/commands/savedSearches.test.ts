/**
 * The saved search Commands and the --saved-search option (APP-21731), run for real: the public
 * program parses each command line, the Command builds its request, and the request goes over
 * HTTP to a local stand-in for the API (tests/fixtures/saved-search-api.mjs). Only the stored
 * login is replaced, so no local credential is read and no live service is called.
 *
 * The stand-in is the contract the Commands were built to before the API's endpoints existed.
 * These tests prove the CLI sends and reads that contract, not that the deployed API follows it.
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
// @ts-expect-error the stand-in is plain JavaScript shared with the transcript script
import { createSavedSearchApi, PERSON_KEY, WORKSPACE_KEY } from '../fixtures/saved-search-api.mjs';

const login = vi.hoisted(() => ({ apiKey: 'person-key' }));
vi.mock('../../src/lib/config.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/lib/config.js')>()),
  readConfig: () => ({ apiKey: login.apiKey, apiEnvironment: 'staging' }),
}));

class ExitSignal extends Error {
  constructor(public code: number) {
    super(`exit ${code}`);
  }
}

const api = createSavedSearchApi();
let out: string[];
let err: string[];

beforeAll(async () => {
  vi.stubEnv('DM_API_URL', await api.listen());
});
afterAll(async () => {
  vi.unstubAllEnvs();
  await api.close();
});

beforeEach(() => {
  api.reset();
  login.apiKey = PERSON_KEY;
  out = [];
  err = [];
  vi.spyOn(console, 'log').mockImplementation((...parts) => void out.push(parts.join(' ')));
  vi.spyOn(console, 'error').mockImplementation((...parts) => void err.push(parts.join(' ')));
  vi.spyOn(process, 'exit').mockImplementation((code) => {
    throw new ExitSignal(Number(code ?? 0));
  });
});
afterEach(() => {
  vi.restoreAllMocks();
});

/** Run one command line through a fresh copy of the public program. */
async function dm(...args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  vi.resetModules();
  const { program } = await import('../../src/index.js');
  let code = 0;
  try {
    await program.parseAsync(['node', 'dm', ...args]);
  } catch (error) {
    if (!(error instanceof ExitSignal)) throw error;
    code = error.code;
  }
  return { code, stdout: out.join('\n'), stderr: err.join('\n') };
}

const json = (result: { stdout: string }) => JSON.parse(result.stdout);
const lastRequest = () => api.requests.at(-1);

describe('dm saved-searches list', () => {
  it('lists my searches and the ones shared with my team, newest change first', async () => {
    const result = await dm('saved-searches', 'list');

    expect(result.code).toBe(0);
    expect(lastRequest()).toEqual({
      method: 'GET',
      path: '/v1/saved-searches',
      query: {},
      body: undefined,
      source: 'cli',
    });
    for (const shown of ['ss_absentee', 'ss_landlords', 'ss_probate', 'ss_city_limits']) {
      expect(result.stdout).toContain(shown);
    }
    // A teammate's private search is never returned.
    expect(result.stdout).not.toContain('ss_mate_private');
    expect(result.stdout).toMatch(/ss_probate\s+Probate leads Austin\s+properties\s+no\s+yes\s+Sam Ortiz\s+not run/);
    expect(result.stdout).toMatch(/ss_absentee\s+Absentee owners in Austin\s+properties\s+yes\s+no\s+you\s+1,840/);
    expect(result.stdout).toContain('Page 1: 4 total saved searches');
  });

  it('sends every filter and the page as the API names them', async () => {
    await dm(
      'saved-searches', 'ls', '--search', 'austin', '--kind', 'properties', '--pinned', '--shared',
      '--include-filters', '-p', '2', '--per-page', '1', '--json'
    );

    expect(lastRequest()?.query).toEqual({
      search: 'austin',
      kind: 'properties',
      pinned: 'true',
      shared: 'true',
      include: 'filters',
      page: '2',
      per_page: '1',
    });
  });

  it('asks for the ones not pinned and not shared, and for neither when no flag is given', async () => {
    const notPinned = json(await dm('saved-searches', 'list', '--no-pinned', '--no-shared', '--json'));
    expect(lastRequest()?.query).toEqual({ pinned: 'false', shared: 'false' });
    expect(notPinned.data.map((search: { saved_search_id: string }) => search.saved_search_id)).toEqual([
      'ss_city_limits',
    ]);

    out = [];
    await dm('saved-searches', 'list', '--json');
    expect(lastRequest()?.query).toEqual({});
  });

  it('prints the API envelope untouched with --json, and criteria only when asked', async () => {
    const plain = json(await dm('saved-searches', 'list', '--search', 'absentee', '--json'));
    expect(plain.pagination).toEqual({ page: 1, per_page: 25, total: 1, has_more: false });
    expect(plain.data[0]).toEqual({
      saved_search_id: 'ss_absentee',
      name: 'Absentee owners in Austin',
      kind: 'properties',
      pinned: true,
      shared: false,
      is_owner: true,
      shared_by: null,
      result_count: 1840,
      created_at: '2026-10-02T15:00:00.000Z',
      updated_at: '2026-11-18T12:00:00.000Z',
      app_path: '/find-properties/ss_absentee',
    });

    out = [];
    const withFilters = json(
      await dm('saved-searches', 'list', '--search', 'absentee', '--include-filters', '--json')
    );
    expect(withFilters.data[0]).toMatchObject({
      filters: expect.any(Array),
      locations: [{ type: 'city', code: '4805000', state: 'TX' }],
      complete: true,
    });
  });

  it('says so when nothing matches', async () => {
    const result = await dm('saved-searches', 'list', '--search', 'nothing like this');

    expect(result.stdout).toContain('No saved searches found.');
    expect(result.stdout).toContain('Page 1: 0 total saved searches');
  });
});

describe('dm saved-searches get', () => {
  it('shows one search, what it holds, and how to run it', async () => {
    const result = await dm('saved-searches', 'get', 'ss_absentee');

    expect(lastRequest()).toMatchObject({ method: 'GET', path: '/v1/saved-searches/ss_absentee' });
    expect(result.stdout).toContain('Saved Search ss_absentee');
    expect(result.stdout).toMatch(/Name\s+Absentee owners in Austin/);
    expect(result.stdout).toMatch(/Filters\s+2/);
    expect(result.stdout).toMatch(/Locations\s+1/);
    expect(result.stdout).toMatch(/Excluded lists\s+1/);
    expect(result.stdout).toContain('Run it with: dm properties count --saved-search ss_absentee');
  });

  it('returns the filters and locations in the shape a search takes, with --json', async () => {
    const { data } = json(await dm('saved-searches', 'get', 'ss_probate', '--json'));

    expect(data).toMatchObject({
      saved_search_id: 'ss_probate',
      is_owner: false,
      shared_by: 'Sam Ortiz',
      filter_groups: [{ operator: 'or', filters: expect.any(Array) }],
      locations: [{ type: 'city', code: '4805000', state: 'TX' }],
      unsupported: [],
      complete: true,
    });
  });

  it('names the parts the API cannot run, and offers no run hint for that search', async () => {
    const result = await dm('saved-searches', 'get', 'ss_city_limits');

    expect(result.stdout).toContain('cannot be used with --saved-search');
    expect(result.stdout).toContain('Marshall: This city is kept to its city limits');
    expect(result.stdout).not.toContain('Run it with');
  });

  it.each(['ss_mate_private', 'ss_does_not_exist'])(
    'reports %s as not found, in the API’s words, and exits 1',
    async (id) => {
      const result = await dm('saved-searches', 'get', id);

      expect(result.code).toBe(1);
      expect(result.stderr).toContain(`No saved search found with ID ${id} [not_found]`);
      expect(result.stderr).toContain(`GET /saved-searches/${id} -> 404`);
    }
  );
});

describe('changing a saved search', () => {
  it('renames with the trimmed name', async () => {
    const result = await dm('saved-searches', 'rename', 'ss_absentee', '  Austin absentee owners  ');

    expect(lastRequest()).toMatchObject({
      method: 'PATCH',
      path: '/v1/saved-searches/ss_absentee',
      body: { name: 'Austin absentee owners' },
    });
    expect(result.stdout).toContain('Saved search ss_absentee renamed to "Austin absentee owners".');
  });

  it('refuses an empty name before any request', async () => {
    const result = await dm('saved-searches', 'rename', 'ss_absentee', '   ');

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('a new name is required');
    expect(api.requests).toEqual([]);
  });

  it.each([
    ['pin', 'ss_landlords', 'Saved search "Tired landlords Dallas" is pinned.', { pinned: true }],
    ['unpin', 'ss_absentee', 'Saved search "Absentee owners in Austin" is unpinned.', { pinned: false }],
    ['share', 'ss_absentee', 'Saved search "Absentee owners in Austin" is shared with your team.', { shared: true }],
    ['unshare', 'ss_landlords', 'Saved search "Tired landlords Dallas" is no longer shared with your team.', { shared: false }],
  ] as const)('%s posts to its own path and says what happened', async (action, id, line, change) => {
    const result = await dm('saved-searches', action, id);

    expect(lastRequest()).toEqual({
      method: 'POST',
      path: `/v1/saved-searches/${id}/${action}`,
      query: {},
      body: undefined,
      source: 'cli',
    });
    expect(result.stdout).toContain(line);

    out = [];
    expect(json(await dm('saved-searches', 'get', id, '--json')).data).toMatchObject(change);
  });

  it('duplicates into a new private search and prints the copy', async () => {
    const result = await dm('saved-searches', 'duplicate', 'ss_absentee');

    expect(lastRequest()).toMatchObject({
      method: 'POST',
      path: '/v1/saved-searches/ss_absentee/duplicate',
    });
    expect(result.stdout).toContain('Saved Search Duplicated');
    expect(result.stdout).toMatch(/Saved Search ID\s+ss_copy_1/);
    expect(result.stdout).toMatch(/Name\s+Absentee owners in Austin \(copy\)/);
  });

  it('removes from history, and says when the search is still shared', async () => {
    const mine = await dm('saved-searches', 'remove', 'ss_absentee');
    expect(lastRequest()).toMatchObject({ method: 'DELETE', path: '/v1/saved-searches/ss_absentee' });
    expect(mine.stdout).toContain('Saved search ss_absentee removed from your history.');
    expect(mine.stdout).not.toContain('still shared');

    out = [];
    const shared = await dm('saved-searches', 'remove', 'ss_landlords');
    expect(shared.stdout).toContain('It is still shared with your team.');
    expect(shared.stdout).toContain('dm saved-searches unshare ss_landlords');

    out = [];
    expect(json(await dm('saved-searches', 'remove', 'ss_city_limits', '--json'))).toEqual({
      data: { removed: true, still_shared: false },
    });
  });

  it('previews a removal with --dry-run and sends nothing', async () => {
    const result = await dm('saved-searches', 'remove', 'ss_absentee', '--dry-run');

    expect(result.stdout).toContain('Would remove saved search ss_absentee from your history.');
    expect(result.stdout).toContain('No changes made (--dry-run).');
    expect(api.requests).toEqual([]);
  });

  it.each([
    ['rename', ['ss_probate', 'Mine now']],
    ['pin', ['ss_probate']],
    ['share', ['ss_probate']],
    ['duplicate', ['ss_probate']],
    ['remove', ['ss_probate']],
  ])('%s of a teammate’s shared search is refused in the API’s words', async (action, args) => {
    const result = await dm('saved-searches', action, ...args);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('Only the person who saved this search can change it. [forbidden]');
  });
});

describe('an API key that is not tied to a person', () => {
  beforeEach(() => {
    login.apiKey = WORKSPACE_KEY;
  });

  it('lists and reads the searches shared with the team', async () => {
    const list = json(await dm('saved-searches', 'list', '--json'));
    expect(list.data.map((search: { saved_search_id: string }) => search.saved_search_id)).toEqual([
      'ss_landlords',
      'ss_probate',
    ]);
    expect(list.data.every((search: { is_owner: boolean }) => !search.is_owner)).toBe(true);

    out = [];
    expect(json(await dm('saved-searches', 'get', 'ss_probate', '--json')).data.name).toBe(
      'Probate leads Austin'
    );
    expect((await dm('saved-searches', 'get', 'ss_absentee')).code).toBe(1);
  });

  it.each([
    ['rename', ['ss_landlords', 'New name']],
    ['pin', ['ss_landlords']],
    ['unshare', ['ss_landlords']],
    ['duplicate', ['ss_landlords']],
    ['remove', ['ss_landlords']],
  ])('%s is refused with the reason the API gives', async (action, args) => {
    const result = await dm('saved-searches', action, ...args);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('This API key is not tied to a person');
    expect(result.stderr).toContain('[forbidden]');
  });
});

describe('--saved-search: a saved search as the source', () => {
  it.each([
    [['properties', 'count'], 'ss_absentee', '/v1/properties/search/count', {}],
    [['properties', 'search'], 'ss_absentee', '/v1/properties/search', { estimate_cost: true }],
    [
      ['properties', 'export'],
      'ss_absentee',
      '/v1/properties/export',
      { contact_audience: 'owners', anchor: 'person' },
    ],
    [['people', 'count'], 'ss_landlords', '/v1/people/search/count', {}],
    [['people', 'search'], 'ss_landlords', '/v1/people/search', { estimate_cost: true }],
    [['people', 'export'], 'ss_landlords', '/v1/people/export', {}],
    [['lists', 'build', 'list_123'], 'ss_absentee', '/v1/lists/list_123/build', {}],
    [
      ['lists', 'create', '--name', 'From my search'],
      'ss_absentee',
      '/v1/lists',
      { name: 'From my search' },
    ],
  ] as const)(
    'dm %j sends saved_search_id and no criteria, and needs no --body',
    async (command, id, path, rest) => {
      const result = await dm(...command, '--saved-search', id, '--json');

      expect(result.code).toBe(0);
      expect(lastRequest()).toMatchObject({ method: 'POST', path });
      expect(lastRequest()?.body).toEqual({ saved_search_id: id, ...rest });
    }
  );

  it('counts what the saved search finds', async () => {
    expect(json(await dm('properties', 'count', '--saved-search', 'ss_absentee', '--json'))).toEqual({
      total_properties: 1840,
      total_people: 0,
      total_results: 1840,
    });
  });

  it('keeps output options from --body beside the saved search', async () => {
    await dm(
      'properties', 'search', '--saved-search', 'ss_absentee', '--estimate-cost', '--json',
      '--body', '{"fields":["estimated_value"],"pagination":{"per_page":5}}'
    );

    expect(lastRequest()?.body).toEqual({
      saved_search_id: 'ss_absentee',
      fields: ['estimated_value'],
      pagination: { per_page: 5 },
      estimate_cost: true,
    });
  });

  it('keeps the other export options beside the saved search', async () => {
    await dm(
      'properties', 'export', '--saved-search', 'ss_absentee', '--require-phone', '--scrub-dnc',
      '--anchor', 'property', '--contact-audience', 'none', '--json'
    );

    expect(lastRequest()?.body).toEqual({
      saved_search_id: 'ss_absentee',
      contact_audience: 'none',
      anchor: 'property',
      require_phone: true,
      scrub_dnc: true,
    });
  });

  it('builds a list without adding prospects when asked', async () => {
    await dm('lists', 'build', 'list_123', '--saved-search', 'ss_absentee', '--no-prospects', '--json');

    expect(lastRequest()?.body).toEqual({ saved_search_id: 'ss_absentee', add_as_prospects: false });
  });

  it.each([
    [
      'locations in --body',
      ['properties', 'count', '--body', '{"locations":[{"type":"state","code":"TX"}]}'],
      'locations',
    ],
    [
      'filters and filter groups in --body',
      [
        'properties', 'search',
        '--body', '{"filters":[{"filter_id":"is_vacant","value":true}],"filter_groups":[{"operator":"or","filters":[{"filter_id":"is_vacant","value":true}]}]}',
      ],
      'filters, filter_groups',
    ],
    ['record IDs in --body', ['people', 'export', '--body', '{"people_ids":["per_1"]}'], 'people_ids'],
    ['--include-lists', ['properties', 'count', '--include-lists', '12'], 'include_lists'],
    ['--exclude-lists', ['people', 'count', '--exclude-lists', 'list_a'], 'exclude_lists'],
    [
      '--exclude-previously-exported',
      ['properties', 'export', '--exclude-previously-exported'],
      'exclude_previously_exported',
    ],
    ['--ids on a new list', ['lists', 'create', '--name', 'Mixed', '--ids', '1,2'], 'record_ids'],
    [
      'another saved search in --body',
      ['properties', 'count', '--body', '{"saved_search_id":"ss_other"}'],
      'saved_search_id',
    ],
  ])('refuses --saved-search with %s, before any request', async (_name, command, alsoSent) => {
    const result = await dm(...command, '--saved-search', 'ss_absentee', '--json');

    expect(result.code).toBe(1);
    expect(result.stderr).toContain(
      'Use --saved-search or your own filters and locations, not both.'
    );
    expect(result.stderr).toContain(`Also sent: ${alsoSent}`);
    expect(api.requests).toEqual([]);
  });

  it('does not count empty criteria in --body as criteria', async () => {
    const result = await dm(
      'properties', 'count', '--saved-search', 'ss_absentee', '--json',
      '--body', '{"filters":[],"locations":[],"include_lists":{}}'
    );

    expect(result.code).toBe(0);
    expect(lastRequest()?.body).toMatchObject({ saved_search_id: 'ss_absentee' });
  });

  it('refuses an empty ID', async () => {
    const result = await dm('properties', 'count', '--saved-search', '  ');

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('--saved-search needs a saved search ID');
    expect(api.requests).toEqual([]);
  });

  it.each([
    ['one I cannot see', 'properties', 'ss_mate_private', 'No saved search found with ID ss_mate_private [not_found]'],
    ['one that does not exist', 'properties', 'ss_nope', 'No saved search found with ID ss_nope [not_found]'],
    [
      'a people search on a property Command',
      'properties',
      'ss_landlords',
      'This saved search finds people, and this request is for properties. [invalid_request]',
    ],
    [
      'a property search on a people Command',
      'people',
      'ss_absentee',
      'This saved search finds properties, and this request is for people. [invalid_request]',
    ],
    [
      'one with a part the API cannot run',
      'properties',
      'ss_city_limits',
      'Marshall (This city is kept to its city limits, which the Public API cannot ask for.) [saved_search_not_supported]',
    ],
  ])('shows the API’s refusal for %s', async (_name, group, id, message) => {
    const result = await dm(group, 'count', '--saved-search', id, '--json');

    expect(result.code).toBe(1);
    expect(result.stderr).toContain(message);
  });

  it('leaves a request without --saved-search exactly as it was', async () => {
    const body = { locations: [{ type: 'zip_code', code: '78704' }], filters: [] };

    await dm('properties', 'count', '--body', JSON.stringify(body), '--include-lists', '12', '--json');

    expect(lastRequest()?.body).toEqual({ ...body, include_lists: { property_list_ids: [12] } });
    expect(lastRequest()?.body).not.toHaveProperty('saved_search_id');
  });
});
