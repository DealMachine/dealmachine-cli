import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { prospectsArchive, prospectsReactivate } from '../../src/commands/prospects.js';

vi.mock('../../src/lib/config.js', () => ({
  readConfig: () => ({ apiKey: 'fixture-only', apiEnvironment: 'staging' }),
}));

class ExitSignal extends Error {
  constructor(public code: number) {
    super(`exit ${code}`);
  }
}

let fetchMock: ReturnType<typeof vi.fn>;
let log: ReturnType<typeof vi.spyOn>;
let error: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  // Config and transport are isolated from local credentials and live services.
  vi.stubEnv('DM_API_URL', 'https://api.test/v1');
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  log = vi.spyOn(console, 'log').mockImplementation(() => {});
  error = vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(process, 'exit').mockImplementation((code) => {
    throw new ExitSignal(Number(code ?? 0));
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function lastRequest() {
  const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
  return { url, method: init.method, body: JSON.parse(String(init.body)) };
}

const bulkResult = {
  data: {
    lifecycle: 'archived',
    changed: 2,
    already_in_lifecycle: 1,
    not_prospects: 1,
    changed_record_ids: ['prop_1', 'prop_2'],
  },
};

describe('dm prospects archive', () => {
  it('archives one prospect by id through the single update', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, { data: { id: 'prospect_8812', lifecycle: 'archived' } })
    );

    await prospectsArchive('prospect_8812', { noCascade: true });

    const request = lastRequest();
    expect(request.url).toMatch(/\/prospects\/prospect_8812$/);
    expect(request.method).toBe('PATCH');
    expect(request.body).toEqual({ lifecycle: 'archived', cascade: false });
  });

  it('archives many records with --ids through the bulk move and itemizes the result', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, bulkResult));

    await prospectsArchive(undefined, { ids: 'prop_1, prop_2,prop_3,prop_4', recordType: 'property' });

    const request = lastRequest();
    expect(request.url).toMatch(/\/prospects$/);
    expect(request.method).toBe('PATCH');
    expect(request.body).toEqual({
      record_ids: ['prop_1', 'prop_2', 'prop_3', 'prop_4'],
      lifecycle: 'archived',
      record_type: 'property',
    });
    const printed = log.mock.calls.flat().join('\n');
    expect(printed).toContain('Prospects Archived');
    expect(printed).toMatch(/Archived\s+2/);
    expect(printed).toMatch(/Already archived\s+1/);
    expect(printed).toMatch(/Not prospects\s+1/);
  });

  it('prints the raw response with --json and passes --no-cascade through', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, bulkResult));

    await prospectsArchive(undefined, { ids: 'prop_1', json: true, noCascade: true });

    expect(lastRequest().body).toEqual({
      record_ids: ['prop_1'],
      lifecycle: 'archived',
      cascade: false,
    });
    expect(log.mock.calls.flat().join('\n')).toContain('"changed_record_ids"');
  });

  it('needs an id or --ids', async () => {
    await expect(prospectsArchive(undefined, {})).rejects.toThrow(ExitSignal);
    expect(error).toHaveBeenCalledWith(expect.stringContaining('pass a prospect ID, or --ids'));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('dm prospects reactivate', () => {
  it('restores many records with --ids', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        data: {
          lifecycle: 'active',
          changed: 1,
          already_in_lifecycle: 0,
          not_prospects: 0,
          changed_record_ids: ['person_9'],
        },
      })
    );

    await prospectsReactivate(undefined, { ids: 'person_9', recordType: 'person' });

    expect(lastRequest().body).toEqual({
      record_ids: ['person_9'],
      lifecycle: 'active',
      record_type: 'person',
    });
    expect(log.mock.calls.flat().join('\n')).toContain('Prospects Restored');
  });
});
