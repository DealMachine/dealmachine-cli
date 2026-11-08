import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { filters } from '../../src/commands/filters.js';
import { propertiesCount, propertiesSearch } from '../../src/commands/properties.js';

vi.mock('../../src/lib/config.js', () => ({
  readConfig: () => ({ apiKey: 'fixture-only', apiEnvironment: 'local' }),
}));

const filterId = 'ppm_num_properties_owned_by_owner';
const locations = [{ type: 'zip_code', code: '46220' }];
let fetchMock: ReturnType<typeof vi.fn>;
let log: ReturnType<typeof vi.spyOn>;
let error: ReturnType<typeof vi.spyOn>;

class ExitSignal extends Error {}

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  vi.stubEnv('DM_API_URL', 'https://api.test/v1');
  fetchMock = vi.fn().mockImplementation(async () => response({ data: [] }));
  vi.stubGlobal('fetch', fetchMock);
  log = vi.spyOn(console, 'log').mockImplementation(() => {});
  error = vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(process, 'exit').mockImplementation(() => { throw new ExitSignal(); });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('owned-property count filter over the API connection', () => {
  it('prints the API-provided filter ID and full operators from property discovery', async () => {
    const catalogEntry = {
      filter_id: filterId, name: 'Number of owned properties', type: 'NUMBER',
      source_type: 'properties',
      allowed_operators: ['range', 'greater_than_or_equal', 'less_than_or_equal', 'equals'],
    };
    fetchMock.mockResolvedValueOnce(response({ data: [catalogEntry] }));

    await filters({ sourceType: 'properties', search: filterId, json: true });

    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.pathname).toBe('/v1/filters');
    expect(url.searchParams.get('source_type')).toBe('properties');
    expect(url.searchParams.get('search')).toBe(filterId);
    expect(JSON.parse(String(log.mock.calls.at(-1)![0]))).toEqual({ data: [catalogEntry] });
  });

  it.each([
    ['range', { min: 5, max: 20 }],
    ['greater_than_or_equal', { value: 10 }],
    ['less_than_or_equal', { value: 3 }],
    ['equals', { value: 5 }],
  ])('preserves %s for free count, estimate and paid search', async (operator, value) => {
    const body = { locations, filters: [{ filter_id: filterId, operator, value }] };
    for (const [command, path, options, extra] of [
      [propertiesCount, '/properties/search/count', {}, {}],
      [propertiesSearch, '/properties/search', { estimateCost: true }, { estimate_cost: true }],
      [propertiesSearch, '/properties/search', { yes: true }, {}],
    ] as const) {
      await command({ body: JSON.stringify(body), json: true, ...options });
      const [url, request] = fetchMock.mock.calls.at(-1)!;
      expect(url).toBe(`https://api.test/v1${path}`);
      expect(request.method).toBe('POST');
      expect(JSON.parse(request.body)).toEqual({ ...body, ...extra });
    }
  });

  it('prints the API filter rejection and exits without retrying an unfiltered query', async () => {
    fetchMock.mockResolvedValueOnce(response({ error: {
      code: 'invalid_request', message: `Filter "${filterId}" requires a value of at least 1`,
    } }, 400));

    await expect(propertiesCount({
      body: JSON.stringify({ locations, filters: [{ filter_id: filterId, operator: 'equals', value: 0 }] }),
      json: true,
    })).rejects.toThrow(ExitSignal);

    const printedError = error.mock.calls.flat().join('\n');
    expect(printedError).toContain(filterId);
    expect(printedError).toContain('at least 1');
    expect(printedError).toContain('400');
    expect(log).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
