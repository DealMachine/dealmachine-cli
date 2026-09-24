import assert from 'node:assert/strict';
import { execFile, execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { promisify } from 'node:util';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
  const requests = [];
  const server = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    requests.push({ method: request.method, path: request.url, body: JSON.parse(Buffer.concat(chunks).toString()), headers: request.headers });
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ data: {} }));
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
        await execute(binary, [...args, '--json', ...(optOut ? ['--no-prospects'] : [])], {
          cwd: temporary,
          timeout: 10000,
          env: { ...process.env, DM_API_URL: `http://127.0.0.1:${server.address().port}/v1`, DM_API_KEY: 'dm-package-test' },
        });
        const request = requests.pop();
        assert.equal(request.method, 'POST');
        assert.equal(request.path, `/v1${path}`);
        assert.equal(request.body.add_as_prospects, optOut ? false : undefined);
        assert.equal(request.headers['user-agent'], `dm-cli/${version}`);
        assert.equal(request.headers['x-dealmachine-source'], 'cli');
      }
    }
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
  console.log(`Installed both ${version} archives in a clean consumer; dm, module import and Playbook installation passed.`);
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
