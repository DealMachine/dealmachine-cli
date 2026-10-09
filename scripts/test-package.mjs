import assert from 'node:assert/strict';
import { execFile, execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { promisify } from 'node:util';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const temporary = mkdtempSync(join(tmpdir(), 'dm-package-'));
const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
const run = (command, args, cwd = temporary) => execFileSync(command, args, { cwd, encoding: 'utf8', timeout: 120000 });
try {
  run('npm', ['run', 'build'], root);
  run(process.execPath, ['scripts/check-public-artifact.mjs'], root);
  const archives = [root, join(root, 'npm-alias')].map(cwd => {
    const [artifact] = JSON.parse(run('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', temporary], cwd));
    return join(temporary, artifact.filename);
  });
  writeFileSync(join(temporary, 'package.json'), JSON.stringify({ name: 'dm-install-check', private: true }));
  run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', ...archives]);
  const binary = join(temporary, 'node_modules/.bin/dm');
  assert.equal(run(binary, ['--version']).trim(), version);
  for (const entry of ['@dealmachine/cli/dist/index.js', 'dealmachine/bin/dm.js']) {
    assert.equal(run(process.execPath, [join(temporary, 'node_modules', entry), '--version']).trim(), version);
  }
  assert.match(run(binary, ['--help']), /properties/);
  assert.match(run(binary, ['prospects', '--help']), /add/);
  assert.match(run(binary, ['webhooks', '--help']), /events/);
  const playbook = JSON.parse(run(binary, ['agents', 'playbook', '--json']));
  assert.match(playbook.content, /name: dealmachine/);
  assert.match(playbook.content, /specific name always uses person enrichment/);
  run(binary, ['agents', 'install', 'claude-code', '--project', '--json']);
  assert.equal(readFileSync(join(temporary, '.claude/skills/dealmachine/SKILL.md'), 'utf8'), playbook.content);
  const program = run(process.execPath, ['--input-type=module', '--eval', "const { program } = await import('@dealmachine/cli/dist/index.js'); console.log(program.name());"]);
  assert.equal(program.trim(), 'dm');
  // Use the normal encrypted-file credential fallback inside a temporary home.
  // Never call the developer's OS keychain or read their personal CLI login.
  const fixtureHome = join(temporary, 'home');
  mkdirSync(fixtureHome);
  const credentialIsolation = join(temporary, 'credential-isolation.mjs');
  writeFileSync(credentialIsolation, [
    "import os from 'node:os';",
    "import childProcess from 'node:child_process';",
    "import { syncBuiltinESMExports } from 'node:module';",
    `os.homedir = () => ${JSON.stringify(fixtureHome)};`,
    "childProcess.execFileSync = () => { throw new Error('OS credential store disabled in package fixture'); };",
    'syncBuiltinESMExports();',
  ].join('\n'));
  run(process.execPath, ['--import', credentialIsolation, '--input-type=module', '--eval',
    "const { writeConfig } = await import('@dealmachine/cli/dist/lib/config.js'); writeConfig({ apiKey: 'dm-package-test', keyId: 'fixture', organizationId: 1, organizationName: 'Package fixture', organizationSlug: 'fixture' });",
  ]);
  const fixtureConfig = JSON.parse(readFileSync(join(fixtureHome, '.dealmachine/config.json'), 'utf8'));
  assert.equal(fixtureConfig.credentialStore, 'encrypted-file');
  assert.equal(fixtureConfig.apiKey, undefined);
  const requests = [];
  const server = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const body = Buffer.concat(chunks).toString();
    requests.push({ method: request.method, path: request.url, body: body ? JSON.parse(body) : null, headers: request.headers });
    const estimate = { totals: { properties: 12, people: 0 }, estimated_credits: { this_page: 1, total_all_pages: 12 } };
    const account = { data: { organization: { id: 123, name: 'Package fixture' }, user: { id: null, authType: 'api_key' } } };
    const fields = { data: [{ field_id: 'property_address', name: 'Address' }] };
    const result = request.url === '/v1/account' ? account : request.url.startsWith('/v1/fields') ? fields : request.url === '/v1/properties/search' ? estimate : { data: {} };
    response.writeHead(request.headers.authorization === 'Bearer rejected-fixture' ? 401 : 200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify(result));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const execute = promisify(execFile);
    for (const [args, path] of [
      [['lists', 'create', '--name', 'Package check'], '/lists'],
      [['lists', 'add', '123', '--ids', '456'], '/lists/123/items'],
      [['lists', 'build', '123', '--body', '{}'], '/lists/123/build'],
      [['lists', 'import', '123', '--ids', '456'], '/lists/123/import'],
    ]) {
      for (const optOut of [false, true]) {
        await execute(process.execPath, ['--import', credentialIsolation, binary, ...args, '--json', ...(optOut ? ['--no-prospects'] : [])], {
          cwd: temporary,
          timeout: 10000,
          env: { ...process.env, DM_API_URL: `http://127.0.0.1:${server.address().port}/v1`, DM_API_KEY: 'unrelated-environment-key' },
        });
        const request = requests.pop();
        assert.equal(request.headers.authorization, 'Bearer dm-package-test');
        assert.equal(request.method, 'POST');
        assert.equal(request.path, `/v1${path}`);
        assert.equal(request.body.add_as_prospects, optOut ? false : undefined);
        assert.equal(request.headers['user-agent'], `dm-cli/${version}`);
        assert.equal(request.headers['x-dealmachine-source'], 'cli');
      }
    }
    // Exercise the same live-smoke entry point with the packed consumer's
    // protocol fixture. This proves command wiring, not deployed API behavior.
    const liveEnvironment = { ...process.env, DM_API_URL: `http://127.0.0.1:${server.address().port}/v1`, DM_API_KEY: 'dm-package-test' };
    const smoke = await execute(process.execPath, [join(root, 'scripts/smoke-live.mjs')], { cwd: temporary, env: liveEnvironment, timeout: 60000 });
    assert.match(smoke.stdout, /PASS: CLI account/);
    assert.deepEqual(requests.map(request => [request.method, request.path]), [
      ['GET', '/v1/account'], ['GET', '/v1/fields?source_type=properties&per_page=1'], ['POST', '/v1/properties/search'],
    ]);
    assert.equal(requests.at(-1).body.estimate_cost, true, 'The live smoke must never purchase search results');
    assert.equal(requests.at(-1).body.pagination.per_page, 1);
    for (const request of requests) assert.equal(request.headers.authorization, 'Bearer dm-package-test');
    requests.length = 0;
    await assert.rejects(execute(process.execPath, [join(root, 'scripts/smoke-live.mjs')], {
      cwd: temporary, env: { ...liveEnvironment, DM_API_KEY: 'rejected-fixture' }, timeout: 60000,
    }), error => error.code === 1 && /account authentication/.test(error.stderr) && !error.stderr.includes('rejected-fixture'));
    assert.equal(requests.length, 1, 'Authentication rejection must stop before further API requests');
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
  console.log(`Installed both ${version} archives in a clean consumer; dm, module import and Playbook installation passed.`);
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
