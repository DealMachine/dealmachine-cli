import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// An explicit target and QA key are required. Never fall back to a saved login.
const apiKey = process.env.DM_API_KEY;
const target = process.env.DM_API_URL;
if (!apiKey || !target) {
  console.error('BLOCKED: set DM_API_URL and DM_API_KEY for an approved QA workspace.');
  process.exit(2);
}
const url = new URL(target);
assert.equal(url.pathname.replace(/\/$/, ''), '/v1', 'DM_API_URL must end in /v1');
assert.ok(!url.username && !url.password && !url.search && !url.hash, 'Use a plain API base URL');
assert.ok(url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)), 'Remote targets require HTTPS');
const temporary = await mkdtemp(join(tmpdir(), 'dm-live-smoke-'));
const root = fileURLToPath(new URL('..', import.meta.url));
const execute = promisify(execFile);
const environment = { ...process.env, DM_API_URL: target, DM_API_KEY: apiKey, CI: 'true', NO_COLOR: '1' };
let step = 'isolated credential setup';
try {
  const isolatedHome = join(temporary, 'home');
  await mkdir(isolatedHome, { mode: 0o700 });
  const isolation = join(temporary, 'isolation.mjs');
  await writeFile(isolation, [
    "import os from 'node:os';",
    "import childProcess from 'node:child_process';",
    "import { syncBuiltinESMExports } from 'node:module';",
    `os.homedir = () => ${JSON.stringify(isolatedHome)};`,
    "childProcess.execFileSync = () => { throw new Error('Personal credential store disabled during smoke'); };",
    'syncBuiltinESMExports();',
  ].join('\n'), { mode: 0o600 });
  await execute(process.execPath, ['--import', isolation, '--input-type=module', '--eval',
    `const { writeConfig } = await import(${JSON.stringify(new URL('../dist/lib/config.js', import.meta.url).href)}); writeConfig({apiKey: process.env.DM_API_KEY, keyId:'qa-smoke', organizationId:0, organizationName:'QA smoke', organizationSlug:'qa-smoke'});`,
  ], { cwd: temporary, env: environment, timeout: 10000 });
  const command = async args => {
    const { stdout } = await execute(process.execPath, ['--import', isolation, join(root, 'dist/index.js'), ...args, '--json', '--quiet'], {
      cwd: temporary, env: environment, timeout: 45000, maxBuffer: 2 * 1024 * 1024,
    });
    return JSON.parse(stdout);
  };
  step = 'account authentication';
  const account = await command(['account']);
  assert.ok(account.data?.organization?.id, 'Account must identify a QA organization');
  assert.ok(['api_key', 'oauth'].includes(account.data?.user?.authType), 'Account must identify authentication type');
  step = 'field discovery';
  const fields = await command(['fields', '--source-type', 'properties', '--per-page', '1']);
  assert.ok(Array.isArray(fields.data) && fields.data.length > 0, 'Fields must contain a discoverable field');
  assert.equal(typeof fields.data[0].field_id, 'string', 'Fields must expose a field ID');
  step = 'credit-free search estimate';
  const estimate = await command(['properties', 'search', '--estimate-cost', '--body', JSON.stringify({
    locations: [{ type: 'zip_code', code: '46203' }], pagination: { page: 1, per_page: 1 },
  })]);
  assert.ok(Number.isFinite(estimate.totals?.properties) && estimate.totals.properties >= 0, 'Estimate must include property count');
  assert.ok(Number.isFinite(estimate.estimated_credits?.this_page) && estimate.estimated_credits.this_page >= 0, 'Estimate must include credit cost');
  console.log('PASS: CLI account, field discovery and credit-free search estimate. No records written or purchased.');
} catch {
  // Child process errors can contain API data or credentials. Emit only the step.
  console.error(`FAIL: CLI live smoke at ${step}. Inspect the private API request logs for the selected QA target.`);
  process.exitCode = 1;
} finally {
  await rm(temporary, { recursive: true, force: true });
}
