#!/usr/bin/env node
/**
 * Live CLI smoke: runs the built `dm` binary against a real API with a short
 * sequence of read-only, credit-free Commands.
 *
 *   DM_API_URL=https://api-staging.v2.dealmachine.com/v1 DM_API_KEY=... npm run smoke:live:coverage
 *
 * The CLI runs in a child process with a temporary HOME, so it never reads or
 * writes a developer's credentials. Its requests go through a local relay that
 * records headers and refuses anything outside a read-only allowlist before it
 * reaches the API. The key is never printed.
 */

import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as http from 'node:http';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  assertAccountShape,
  assertEstimateShape,
  assertFieldsShape,
  assertFiltersShape,
  checkAllowedRequest,
  parseJsonOutput,
  redact,
  seedIsolatedConfig,
} from './smoke-live-lib.mjs';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const entrypoint = path.join(repoRoot, 'dist', 'index.js');
const packageVersion = JSON.parse(
  fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf-8')
).version;
const COMMAND_TIMEOUT_MS = 60_000;
const UPSTREAM_TIMEOUT_MS = 45_000;

const apiUrl = process.env.DM_API_URL?.trim();
const apiKey = process.env.DM_API_KEY?.trim();
const missing = [!apiUrl && 'DM_API_URL', !apiKey && 'DM_API_KEY'].filter(Boolean);
if (missing.length > 0) {
  console.error(`smoke:live:coverage needs ${missing.join(' and ')}.`);
  console.error(
    'Example: DM_API_URL=https://api-staging.v2.dealmachine.com/v1 DM_API_KEY=<key> npm run smoke:live:coverage'
  );
  process.exit(1);
}

let target;
try {
  target = new URL(apiUrl);
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(target.hostname);
  if (target.pathname.replace(/\/$/, '') !== '/v1'
    || target.username || target.password || target.search || target.hash
    || !(target.protocol === 'https:' || (target.protocol === 'http:' && loopback))) {
    throw new Error('unsafe API base URL');
  }
} catch {
  console.error('DM_API_URL must be a plain HTTPS /v1 base URL (HTTP is allowed only for loopback).');
  process.exit(1);
}
const targetBase = target.toString().replace(/\/+$/, '');

if (!fs.existsSync(entrypoint)) {
  console.error('dist/index.js is missing. Run `npm run build` first or use `npm run smoke:live:coverage`.');
  process.exit(1);
}

const secrets = [apiKey, apiKey.slice(0, 20)];
const say = (line) => console.log(redact(line, secrets));

// ---------------------------------------------------------------------------
// Local relay: records each CLI request and forwards only allowlisted ones.
// ---------------------------------------------------------------------------

const requests = [];

const relay = http.createServer(async (req, res) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const rawBody = Buffer.concat(chunks);
  let body;
  if (rawBody.length > 0) {
    try {
      body = JSON.parse(rawBody.toString('utf-8'));
    } catch {
      body = undefined;
    }
  }

  const record = {
    method: req.method,
    path: req.url,
    source: req.headers['x-dealmachine-source'],
    userAgent: req.headers['user-agent'],
    hasAuthorization: typeof req.headers.authorization === 'string',
    refused: undefined,
    status: undefined,
  };
  requests.push(record);

  const verdict = checkAllowedRequest(req.method, req.url, body);
  if (!verdict.allowed) {
    record.refused = verdict.reason;
    record.status = 403;
    res.writeHead(403, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: { code: 'smoke_refused', message: `Live smoke refused ${verdict.reason}` } }));
    return;
  }

  const headers = {};
  for (const name of ['authorization', 'content-type', 'user-agent', 'x-dealmachine-source', 'accept']) {
    if (req.headers[name]) headers[name] = req.headers[name];
  }

  try {
    const upstream = await fetch(`${targetBase}${req.url}`, {
      method: req.method,
      headers,
      body: rawBody.length > 0 ? rawBody : undefined,
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      redirect: 'error',
    });
    const responseBody = Buffer.from(await upstream.arrayBuffer());
    record.status = upstream.status;
    res.writeHead(upstream.status, {
      'content-type': upstream.headers.get('content-type') || 'application/json',
    });
    res.end(responseBody);
  } catch (error) {
    record.status = 502;
    record.refused = `upstream unreachable (${error instanceof Error ? error.name : 'error'})`;
    res.writeHead(502, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: { code: 'smoke_upstream', message: 'Live smoke could not reach the API' } }));
  }
});

await new Promise((resolve) => relay.listen(0, '127.0.0.1', resolve));
const relayUrl = `http://127.0.0.1:${relay.address().port}`;

// ---------------------------------------------------------------------------
// Isolated CLI environment
// ---------------------------------------------------------------------------

const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-live-smoke-'));
seedIsolatedConfig(tempHome, apiKey);
// Preserve the existing smoke's explicit OS credential-store isolation. HOME
// alone does not determine os.homedir on every supported platform.
const isolation = path.join(tempHome, 'isolation.mjs');
fs.writeFileSync(isolation, [
  "import os from 'node:os';",
  "import childProcess from 'node:child_process';",
  "import { syncBuiltinESMExports } from 'node:module';",
  `os.homedir = () => ${JSON.stringify(tempHome)};`,
  "childProcess.execFileSync = () => { throw new Error('Personal credential store disabled during smoke'); };",
  'syncBuiltinESMExports();',
].join('\n'), { mode: 0o600 });

const childEnv = {
  PATH: process.env.PATH ?? '',
  HOME: tempHome,
  USERPROFILE: tempHome,
  TMPDIR: process.env.TMPDIR ?? os.tmpdir(),
  ...(process.env.SystemRoot && { SystemRoot: process.env.SystemRoot }),
  ...(process.env.TEMP && { TEMP: process.env.TEMP }),
  ...(process.env.TMP && { TMP: process.env.TMP }),
  DM_API_URL: relayUrl,
  DM_QUIET: '1',
  CI: 'true',
  NO_COLOR: '1',
  FORCE_COLOR: '0',
};

function runCli(args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['--import', pathToFileURL(isolation).href, entrypoint, ...args], {
      cwd: tempHome,
      env: childEnv,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.stderr.on('data', (chunk) => (stderr += chunk));
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, COMMAND_TIMEOUT_MS);
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr, timedOut });
    });
  });
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

const estimateBody = JSON.stringify({
  locations: [{ type: 'zip_code', code: '78704' }],
  pagination: { page: 1, per_page: 1 },
});

const steps = [
  {
    name: 'dm --version',
    args: ['--version'],
    expectRequests: [],
    check: ({ stdout }) => {
      const version = stdout.trim();
      if (version !== packageVersion) throw new Error(`printed "${version}", expected ${packageVersion}`);
      return `version ${version}, no network request`;
    },
  },
  {
    name: 'dm account --json',
    args: ['account', '--json'],
    expectRequests: [['GET', '/account']],
    check: ({ stdout }) => assertAccountShape(parseJsonOutput(stdout)),
  },
  {
    name: 'dm filters --source-type properties --per-page 5 --json',
    args: ['filters', '--source-type', 'properties', '--per-page', '5', '--json'],
    expectRequests: [['GET', '/filters']],
    check: ({ stdout }) => assertFiltersShape(parseJsonOutput(stdout)),
  },
  {
    name: 'dm fields --source-type properties --per-page 5 --json',
    args: ['fields', '--source-type', 'properties', '--per-page', '5', '--json'],
    expectRequests: [['GET', '/fields']],
    check: ({ stdout }) => assertFieldsShape(parseJsonOutput(stdout)),
  },
  {
    name: 'dm properties search --estimate-cost --json (ZIP 78704)',
    args: ['properties', 'search', '--body', estimateBody, '--estimate-cost', '--json'],
    expectRequests: [['POST', '/properties/search']],
    check: ({ stdout }) => assertEstimateShape(parseJsonOutput(stdout)),
  },
];

function checkRequests(seen, expected) {
  const refused = seen.find((request) => request.refused);
  if (refused) throw new Error(`relay ${refused.status}: ${refused.refused}`);
  const summary = seen.map((r) => `${r.method} ${new URL(r.path, relayUrl).pathname}`);
  const wanted = expected.map(([method, pathname]) => `${method} ${pathname}`);
  if (summary.join(',') !== wanted.join(',')) {
    throw new Error(`requests were [${summary.join(', ')}], expected [${wanted.join(', ')}]`);
  }
  for (const request of seen) {
    if (request.source !== 'cli') {
      throw new Error(`x-dealmachine-source was ${JSON.stringify(request.source ?? null)}, expected "cli"`);
    }
    if (!String(request.userAgent ?? '').startsWith(`dm-cli/${packageVersion}`)) {
      throw new Error(`user-agent was ${JSON.stringify(request.userAgent ?? null)}`);
    }
    if (!request.hasAuthorization) throw new Error('request had no Authorization header');
    if (request.status !== 200) throw new Error(`API returned ${request.status}`);
  }
}

function firstLine(text) {
  return String(text).trim().split('\n').find(Boolean)?.slice(0, 200) ?? '';
}

say(`Live CLI smoke: dm ${packageVersion} against ${targetBase}`);
let failures = 0;

try {
  for (const step of steps) {
    const before = requests.length;
    const result = await runCli(step.args);
    const seen = requests.slice(before);
    let reason;
    let passed = false;
    try {
      if (result.timedOut) throw new Error(`timed out after ${COMMAND_TIMEOUT_MS / 1000}s`);
      checkRequests(seen, step.expectRequests);
      if (result.code !== 0) {
        throw new Error(`exit ${result.code}: ${firstLine(result.stderr) || firstLine(result.stdout)}`);
      }
      reason = step.check(result);
      passed = true;
    } catch (error) {
      reason = error instanceof Error ? error.message : String(error);
    }
    if (!passed) failures += 1;
    say(`${passed ? 'PASS' : 'FAIL'} ${step.name}: ${reason}`);
  }
} finally {
  relay.close();
  fs.rmSync(tempHome, { recursive: true, force: true });
}

const headerNote = requests.length > 0 && requests.every((r) => r.source === 'cli')
  ? `; all ${requests.length} API requests carried x-dealmachine-source: cli`
  : '';
say(
  failures === 0
    ? `Live smoke passed: ${steps.length} of ${steps.length} Commands${headerNote}.`
    : `Live smoke failed: ${failures} of ${steps.length} Commands failed.`
);
process.exit(failures === 0 ? 0 : 1);
