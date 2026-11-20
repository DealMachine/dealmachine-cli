/**
 * Piped input and --saved-search (APP-21731), on a real process.
 *
 * Without --saved-search, piped JSON is where a Command's criteria come from. With it the saved
 * search stands in for them, so criteria piped to the Command must be refused, the same as
 * criteria in --body, and never dropped: an export would run on the whole saved search for
 * someone who piped a filter. A run with nothing piped has to work too, including the one a
 * script or an agent makes when it leaves standard input open and never writes to it.
 *
 * Each case starts the CLI's own entry file in a child process with a throwaway login in a
 * temporary home, so standard input is a real pipe, file or nothing, and no local credential or
 * credential store is touched. Requests go to the local stand-in.
 */

import { execFile, spawn } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
// @ts-expect-error the stand-in is plain JavaScript shared with the transcript script
import { createSavedSearchApi, PERSON_KEY } from '../fixtures/saved-search-api.mjs';

const execute = promisify(execFile);
const entry = fileURLToPath(new URL('../../src/index.ts', import.meta.url));
const config = new URL('../../src/lib/config.ts', import.meta.url).href;
const api = createSavedSearchApi();
let apiUrl: string;
let temporary: string;
let isolation: string;

beforeAll(async () => {
  apiUrl = await api.listen();
  temporary = await mkdtemp(join(tmpdir(), 'dm-piped-input-'));
  const home = join(temporary, 'home');
  await mkdir(home);
  // The login lives in a temporary home, and the OS credential store is switched off.
  const preload = join(temporary, 'isolation.mjs');
  await writeFile(
    preload,
    [
      "import os from 'node:os';",
      "import childProcess from 'node:child_process';",
      "import { syncBuiltinESMExports } from 'node:module';",
      `os.homedir = () => ${JSON.stringify(home)};`,
      "childProcess.execFileSync = () => { throw new Error('OS credential store disabled in this test'); };",
      'syncBuiltinESMExports();',
    ].join('\n')
  );
  isolation = pathToFileURL(preload).href;
  await execute(
    process.execPath,
    [
      '--import', isolation, '--import', 'tsx', '--input-type=module', '--eval',
      `const { writeConfig } = await import(${JSON.stringify(config)}); writeConfig({ apiKey: ${JSON.stringify(PERSON_KEY)}, keyId: 'fixture', organizationId: 42, organizationName: 'Fixture', organizationSlug: 'fixture' });`,
    ],
    { timeout: 30_000 }
  );
}, 60_000);
afterAll(async () => {
  await api.close();
  await rm(temporary, { recursive: true, force: true });
});
beforeEach(() => api.reset());

type Stdin =
  | { kind: 'piped'; text: string }
  /** A pipe that is never written to and never closed, as a script or an agent leaves it. */
  | { kind: 'open' }
  /** No standard input at all (/dev/null). */
  | { kind: 'none' };

/** Run one command line in a child process with that standard input. */
function dm(args: string[], stdin: Stdin): Promise<{ code: number | null; stdout: string; stderr: string; ms: number }> {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--import', isolation, '--import', 'tsx', entry, ...args], {
      env: { PATH: process.env.PATH, DM_API_URL: apiUrl, NO_COLOR: '1', FORCE_COLOR: '0' },
      stdio: [stdin.kind === 'none' ? 'ignore' : 'pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout!.on('data', (chunk) => (stdout += chunk));
    child.stderr!.on('data', (chunk) => (stderr += chunk));
    // A run that waits on an input nobody writes to would never end.
    const hung = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`dm ${args.join(' ')} did not exit:\n${stderr}`));
    }, 15_000);
    child.on('error', reject);
    child.on('close', (code) => {
      clearTimeout(hung);
      resolve({ code, stdout, stderr, ms: Date.now() - started });
    });
    if (stdin.kind === 'piped') child.stdin!.end(stdin.text);
    // 'open': the pipe is left as it is, with nothing written and no end.
  });
}

const CRITERIA = '{"locations":[{"type":"state","code":"TX"}],"filters":[{"filter_id":"is_vacant","value":true}]}';
const SOURCE = ['--saved-search', 'ss_absentee', '--json'];

describe('criteria piped to a Command that names a saved search', () => {
  it.each([
    [['properties', 'count']],
    [['properties', 'search']],
    [['properties', 'export']],
    [['people', 'count']],
    [['people', 'search']],
    [['people', 'export']],
    [['lists', 'build', 'list_123']],
  ])('dm %j refuses them before any request', async (command) => {
    const result = await dm([...command, ...SOURCE], { kind: 'piped', text: CRITERIA });

    expect(result.code).toBe(1);
    expect(result.stderr).toContain(
      'Error: Use --saved-search or your own filters and locations, not both.'
    );
    expect(result.stderr).toContain('Also sent: input piped to this Command (stdin)');
    expect(result.stdout).toBe('');
    expect(api.requests).toEqual([]);
  }, 30_000);

  it('refuses piped output options too, and says where they go', async () => {
    const result = await dm(['properties', 'count', ...SOURCE], {
      kind: 'piped',
      text: '{"fields":["estimated_value"]}',
    });

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('pass output options such as fields in --body or -f');
    expect(api.requests).toEqual([]);
  }, 30_000);
});

describe('nothing piped to a Command that names a saved search', () => {
  it.each([
    ['an input that is closed with nothing in it', { kind: 'piped', text: '' }],
    ['an input of blank space only', { kind: 'piped', text: ' \n\n' }],
    ['no input at all', { kind: 'none' }],
    ['an input left open and never written to, as scripts and agents leave it', { kind: 'open' }],
  ] as Array<[string, Stdin]>)('runs with %s', async (_name, stdin) => {
    const result = await dm(['properties', 'count', ...SOURCE], stdin);

    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      saved_search_id: 'ss_absentee',
      total_results: 1840,
    });
    expect(api.requests.at(-1)).toMatchObject({
      method: 'POST',
      path: '/v1/properties/search/count',
      body: { saved_search_id: 'ss_absentee' },
    });
  }, 30_000);

  it('exits by itself when the input is left open, without waiting on it', async () => {
    const result = await dm(['lists', 'build', 'list_123', ...SOURCE], { kind: 'open' });

    expect(result.code).toBe(0);
    expect(api.requests.at(-1)?.body).toEqual({ saved_search_id: 'ss_absentee' });
  }, 30_000);
});

describe('--saved-search with nothing in it', () => {
  it.each([
    ['an input left open', { kind: 'open' }],
    ['criteria piped in', { kind: 'piped', text: CRITERIA }],
    ['no input', { kind: 'none' }],
  ] as Array<[string, Stdin]>)('says it needs an ID, with %s, and does not wait', async (_name, stdin) => {
    const result = await dm(['properties', 'count', '--saved-search', ''], stdin);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('Error: --saved-search needs a saved search ID');
    expect(result.stderr).not.toContain('No request body provided');
    expect(api.requests).toEqual([]);
  }, 30_000);
});

describe('without --saved-search, piped input is the request, as before', () => {
  it('sends the piped criteria', async () => {
    const result = await dm(['properties', 'count', '--json'], { kind: 'piped', text: CRITERIA });

    expect(result.code).toBe(0);
    expect(api.requests.at(-1)?.body).toEqual(JSON.parse(CRITERIA));
  }, 30_000);

  it('still asks for a body when nothing is piped', async () => {
    const result = await dm(['properties', 'count', '--json'], { kind: 'piped', text: '' });

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('Error: No request body provided.');
    expect(api.requests).toEqual([]);
  }, 30_000);
});
