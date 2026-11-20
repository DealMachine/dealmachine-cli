import { runNpm } from './run-npm.mjs';
import assert from 'node:assert/strict';
import { execFile, execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { promisify } from 'node:util';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const temporary = mkdtempSync(join(tmpdir(), 'dm-package-'));
const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
const run = (command, args, cwd = temporary) => (command === 'npm' ? runNpm(args, { cwd, encoding: 'utf8', timeout: 120000 }) : execFileSync(command, args, { cwd, encoding: 'utf8', timeout: 120000 }));
const dm = args => run('npm', ['exec', '--offline', '--', 'dm', ...args]);
try {
  run('npm', ['run', 'build'], root);
  run(process.execPath, ['scripts/check-public-artifact.mjs'], root);
  const archives = [root, join(root, 'npm-alias')].map(cwd => {
    const [artifact] = JSON.parse(run('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', temporary], cwd));
    return join(temporary, artifact.filename);
  });
  writeFileSync(join(temporary, 'package.json'), JSON.stringify({ name: 'dm-install-check', private: true }));
  run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', ...archives]);
  const binary = join(temporary, 'node_modules/dealmachine/bin/dm.js');
  assert.equal(dm(['--version']).trim(), version);
  for (const entry of ['@dealmachine/cli/dist/index.js', 'dealmachine/bin/dm.js']) {
    assert.equal(run(process.execPath, [join(temporary, 'node_modules', entry), '--version']).trim(), version);
  }
  assert.match(dm(['--help']), /properties/);
  assert.match(dm(['prospects', '--help']), /add/);
  assert.match(dm(['webhooks', '--help']), /events/);
  assert.match(dm(['saved-searches', '--help']), /duplicate/);
  assert.match(dm(['properties', 'count', '--help']), /--saved-search <id>/);
  const playbook = JSON.parse(dm(['agents', 'playbook', '--json']));
  assert.match(playbook.content, /name: dealmachine/);
  assert.match(playbook.content, /specific name always uses person enrichment/);
  dm(['agents', 'install', 'claude-code', '--project', '--json']);
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
  run(process.execPath, ['--import', pathToFileURL(credentialIsolation).href, '--input-type=module', '--eval',
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
    const sent = body ? JSON.parse(body) : null;
    requests.push({ method: request.method, path: request.url, body: sent, headers: request.headers });
    // An API that knows saved searches says which one it used. `ss_unacknowledged` stands for
    // an API that dropped the field, as one released before saved searches does.
    const savedSearch = sent?.saved_search_id && sent.saved_search_id !== 'ss_unacknowledged' ? sent.saved_search_id : null;
    const estimate = { totals: { properties: 12, people: 0 }, estimated_credits: { this_page: 1, total_all_pages: 12 } };
    const account = { data: { organization: { id: 123, name: 'Package fixture' }, user: { id: null, authType: 'api_key' } } };
    const fields = { data: [{ field_id: 'property_address', name: 'Address' }] };
    const result = request.url === '/v1/account' ? account : request.url.startsWith('/v1/fields') ? fields : request.url === '/v1/properties/search' ? estimate
      : savedSearch ? { saved_search_id: savedSearch, data: { saved_search_id: savedSearch } }
      : { data: { list_id: 'list_fixture', name: sent?.name } };
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
        await execute(process.execPath, ['--import', pathToFileURL(credentialIsolation).href, binary, ...args, '--json', ...(optOut ? ['--no-prospects'] : [])], {
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
    // Saved searches (APP-21731): the installed binary sends each Command's own method and
    // path, and --saved-search stands in for a request body.
    for (const [args, method, path, body] of [
      [['saved-searches', 'list', '--search', 'austin', '--no-pinned'], 'GET', '/saved-searches?search=austin&pinned=false', null],
      [['saved-searches', 'get', 'ss_1'], 'GET', '/saved-searches/ss_1', null],
      [['saved-searches', 'rename', 'ss_1', 'Renamed'], 'PATCH', '/saved-searches/ss_1', { name: 'Renamed' }],
      [['saved-searches', 'share', 'ss_1'], 'POST', '/saved-searches/ss_1/share', null],
      [['saved-searches', 'remove', 'ss_1'], 'DELETE', '/saved-searches/ss_1', null],
      [['properties', 'count', '--saved-search', 'ss_1'], 'POST', '/properties/search/count', { saved_search_id: 'ss_1' }],
      [['lists', 'build', '123', '--saved-search', 'ss_1'], 'POST', '/lists/123/build', { saved_search_id: 'ss_1' }],
    ]) {
      await execute(process.execPath, ['--import', pathToFileURL(credentialIsolation).href, binary, ...args, '--json'], {
        cwd: temporary,
        timeout: 10000,
        env: { ...process.env, DM_API_URL: `http://127.0.0.1:${server.address().port}/v1`, DM_API_KEY: 'unrelated-environment-key' },
      });
      const request = requests.pop();
      assert.equal(request.method, method);
      assert.equal(request.path, `/v1${path}`);
      assert.deepEqual(request.body, body);
      assert.equal(request.headers.authorization, 'Bearer dm-package-test');
      assert.equal(request.headers['x-dealmachine-source'], 'cli');
    }
    // An API that drops saved_search_id answers a list create with a new, empty list. The
    // installed binary must fail and say how to delete it, not report a list created.
    await assert.rejects(
      execute(process.execPath, ['--import', pathToFileURL(credentialIsolation).href, binary, 'lists', 'create', '--name', 'Package check', '--saved-search', 'ss_unacknowledged'], {
        cwd: temporary,
        timeout: 10000,
        env: { ...process.env, DM_API_URL: `http://127.0.0.1:${server.address().port}/v1`, DM_API_KEY: 'unrelated-environment-key' },
      }),
      error => error.code === 1 && /does not support saved searches yet/.test(error.stderr)
        && /A list named "Package check" was created empty \(list_fixture\)/.test(error.stderr)
        && /dm lists delete list_fixture/.test(error.stderr) && !/List Created/.test(error.stdout)
    );
    requests.pop();
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
