import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const execute = promisify(execFile);
const syntheticKey = 'dm_sk_synthetic_smoke_integration_only';
const pagination = { page: 1, per_page: 5, total_results: 1, total_pages: 1 };
const requests: Array<{ method: string; path: string; source?: string; authorization?: string; agent?: string; body: unknown }> = [];
const server = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString();
  const path = new URL(request.url!, 'http://localhost').pathname;
  requests.push({ method: request.method!, path, source: request.headers['x-dealmachine-source'] as string,
    authorization: request.headers.authorization, agent: request.headers['user-agent'], body: raw ? JSON.parse(raw) : undefined });
  const data = path === '/v1/account' ? { data: { organization: { id: 1, name: 'Synthetic QA' }, user: { authType: 'api_key' }, plan: { name: 'QA' } } }
    : path === '/v1/fields' ? { data: [{ field_id: 'property_id', name: 'Property ID' }], pagination }
    : path === '/v1/filters' ? { data: [{ filter_id: 'property_id', name: 'Property ID', allowed_operators: ['eq'] }], pagination }
    : path === '/v1/properties/search' ? { totals: { properties: 1 }, estimated_credits: { this_page: 1, total_all_pages: 1 }, pagination }
    : { error: 'Unexpected request' };
  response.writeHead(path.startsWith('/v1/') ? 200 : 404, { 'content-type': 'application/json' });
  response.end(JSON.stringify(data));
});
let target: string;
let callerHome: string;
let callerSentinel: string;

beforeAll(async () => {
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as { port: number };
  target = `http://127.0.0.1:${address.port}/v1`;
  callerHome = await mkdtemp(join(tmpdir(), 'dm-smoke-caller-'));
  callerSentinel = join(callerHome, 'settings-sentinel');
  await writeFile(callerSentinel, 'leave caller settings unchanged');
});
afterAll(async () => {
  await new Promise<void>(resolve => server.close(() => resolve()));
  await rm(callerHome, { recursive: true, force: true });
});

async function smoke(apiUrl?: string, apiKey?: string) {
  try {
    const result = await execute(process.execPath, ['scripts/smoke-live-coverage.mjs'], {
      env: { PATH: process.env.PATH, HOME: callerHome, USERPROFILE: callerHome, ...(process.env.SystemRoot && { SystemRoot: process.env.SystemRoot }),
        ...(apiUrl !== undefined && { DM_API_URL: apiUrl }), ...(apiKey !== undefined && { DM_API_KEY: apiKey }) },
      timeout: 15_000,
    });
    return { ...result, code: 0 };
  } catch (error) {
    return error as { stdout: string; stderr: string; code: number };
  }
}

describe('built CLI live smoke', () => {
  it('exercises all read-only Commands through the relay and leaves caller settings unchanged', async () => {
    requests.length = 0;
    const result = await smoke(target, syntheticKey);
    expect(result.code, result.stderr + result.stdout).toBe(0);
    expect(result.stdout).toContain('5 of 5 Commands');
    expect(result.stdout + result.stderr).not.toContain(syntheticKey);
    expect(requests.map(request => `${request.method} ${request.path}`)).toEqual([
      'GET /v1/account', 'GET /v1/filters', 'GET /v1/fields', 'POST /v1/properties/search',
    ]);
    for (const request of requests) {
      expect(request.source).toBe('cli');
      expect(request.agent).toMatch(/^dm-cli\//);
      expect(request.authorization).toBe(`Bearer ${syntheticKey}`);
    }
    expect(requests.at(-1)?.body).toMatchObject({ estimate_cost: true });
    expect(await readFile(callerSentinel, 'utf8')).toBe('leave caller settings unchanged');
  });

  it.each([['DM_API_URL', undefined, syntheticKey], ['DM_API_KEY', 'http://127.0.0.1/v1', undefined]])(
    'names missing %s without using saved credentials', async (name, apiUrl, apiKey) => {
      requests.length = 0;
      const result = await smoke(apiUrl, apiKey);
      expect(result.code).toBe(1);
      expect(result.stderr).toContain(name);
      expect(result.stdout + result.stderr).not.toContain(syntheticKey);
      expect(requests).toHaveLength(0);
    },
  );

  it('rejects credentials, query strings, fragments and incorrect API paths before starting Commands', async () => {
    for (const invalid of [target.replace('http://', 'http://user:password@'), `${target}?unsafe=1`, `${target}#fragment`, target.replace('/v1', '/other')]) {
      requests.length = 0;
      const result = await smoke(invalid, syntheticKey);
      expect(result.code).toBe(1);
      expect(result.stderr).toContain('DM_API_URL must be a plain HTTPS /v1 base URL');
      expect(requests).toHaveLength(0);
      expect(result.stdout + result.stderr).not.toContain('user:password');
    }
  });
});
