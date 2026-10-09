import { describe, it, expect, vi, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as nodeOs from 'node:os';
import * as path from 'node:path';

const { tempHome } = vi.hoisted(() => {
  const { mkdtempSync } = require('node:fs') as typeof import('node:fs');
  const { tmpdir } = require('node:os') as typeof import('node:os');
  const { join } = require('node:path') as typeof import('node:path');
  return { tempHome: mkdtempSync(join(tmpdir(), 'dm-smoke-test-')) };
});

vi.mock('node:os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:os')>();
  return { ...actual, homedir: () => tempHome };
});

// The smoke must never reach the macOS Keychain or Windows DPAPI.
vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(() => {
    throw new Error('credential store must not be used');
  }),
}));

import {
  assertAccountShape,
  assertEstimateShape,
  assertFieldsShape,
  assertFiltersShape,
  checkAllowedRequest,
  redact,
  seedIsolatedConfig,
} from '../../scripts/smoke-live-lib.mjs';
import { readConfig } from '../../src/lib/config';

const pagination = { page: 1, per_page: 5, total_results: 10, total_pages: 2 };

afterAll(() => {
  fs.rmSync(tempHome, { recursive: true, force: true });
});

describe('live smoke helpers', () => {
  it('seeds a config the real CLI reads without a system credential store', async () => {
    expect(nodeOs.homedir()).toBe(tempHome);
    seedIsolatedConfig(tempHome, 'dm_sk_test_example_key');

    const config = readConfig();
    expect(config?.apiKey).toBe('dm_sk_test_example_key');
    const persisted = JSON.parse(
      fs.readFileSync(path.join(tempHome, '.dealmachine', 'config.json'), 'utf-8')
    );
    expect(persisted.credentialStore).toBe('encrypted-file');
    expect(persisted.apiKey).toBeUndefined();
    const { execFileSync } = await import('node:child_process');
    expect(execFileSync).not.toHaveBeenCalled();
  });

  it('redacts every occurrence of each secret', () => {
    expect(redact('key abc12345 and abc12345 again', ['abc12345'])).toBe(
      'key [redacted] and [redacted] again'
    );
    expect(redact('unchanged', ['', undefined as unknown as string])).toBe('unchanged');
  });

  it('allows only read-only requests', () => {
    expect(checkAllowedRequest('GET', '/account', undefined).allowed).toBe(true);
    expect(checkAllowedRequest('GET', '/filters?source_type=properties', undefined).allowed).toBe(true);
    expect(checkAllowedRequest('GET', '/fields?per_page=5', undefined).allowed).toBe(true);
    expect(
      checkAllowedRequest('POST', '/properties/search', { estimate_cost: true }).allowed
    ).toBe(true);
    expect(checkAllowedRequest('POST', '/properties/search', {}).allowed).toBe(false);
    expect(
      checkAllowedRequest('POST', '/properties/search', { estimate_cost: 'true' }).allowed
    ).toBe(false);
    expect(checkAllowedRequest('DELETE', '/account', undefined).allowed).toBe(false);
    expect(checkAllowedRequest('POST', '/lists', { name: 'x' }).allowed).toBe(false);
  });

  it('checks account, catalog and estimate shapes', () => {
    expect(
      assertAccountShape({
        data: {
          organization: { id: 1, name: 'Org' },
          user: { id: null, authType: 'api_key' },
          plan: { name: 'Plan' },
        },
      })
    ).toContain('organization 1');
    expect(() => assertAccountShape({ data: { organization: { id: '1' } } })).toThrow(
      'data.organization.id'
    );

    expect(
      assertFiltersShape({
        data: [{ filter_id: 'f1', name: 'Filter', allowed_operators: ['eq'] }],
        pagination,
      })
    ).toBe('1 of 10 returned');
    expect(() =>
      assertFiltersShape({ data: [{ filter_id: 'f1', name: 'Filter' }], pagination })
    ).toThrow('allowed_operators');
    expect(() => assertFieldsShape({ data: [], pagination })).toThrow('empty');

    const estimate = {
      totals: { properties: 12, people: 20 },
      pagination,
      estimated_credits: { this_page: 3, total_all_pages: 40 },
    };
    expect(assertEstimateShape(estimate)).toContain('12 properties');
    expect(() => assertEstimateShape({ ...estimate, data: [], credits: { used: 1 } })).toThrow(
      'charged credits'
    );
  });
});
