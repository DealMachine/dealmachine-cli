import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const [mode, ...args] = process.argv.slice(2);
assert(['pack', 'dry-run', 'publish'].includes(mode), 'Use pack, dry-run or publish.');
assert(args.length === 0 || (args.length === 2 && args[0] === '--tag' && ['next', 'latest'].includes(args[1])), 'Use --tag next or --tag latest.');
const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const alias = JSON.parse(readFileSync(resolve(root, 'npm-alias/package.json'), 'utf8'));
const lock = JSON.parse(readFileSync(resolve(root, 'package-lock.json'), 'utf8'));
assert.equal(alias.version, manifest.version);
assert.equal(alias.dependencies[manifest.name], manifest.version);
assert.equal(lock.packages[''].version, manifest.version);
const tag = args[1] ?? (manifest.version.includes('-') ? 'next' : 'latest');
if (mode === 'publish') assert(args.length === 2, 'Publishing requires an explicit --tag next or --tag latest.');
assert(tag !== 'latest' || !manifest.version.includes('-'), 'Prereleases must use the next channel.');
const run = (command, args, cwd = root) => execFileSync(command, args, { cwd, stdio: 'inherit' });
if (mode === 'publish') {
  const status = execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' });
  assert.equal(status.trim(), '', 'Commit the reviewed release before publishing.');
}
run('npm', ['run', 'check']);
run('npm', ['run', 'test:package']);
const output = resolve(root, 'artifacts', manifest.version);
mkdirSync(output, { recursive: true });
const artifacts = [];
for (const directory of [root, resolve(root, 'npm-alias')]) {
  const [artifact] = JSON.parse(execFileSync('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', output], { cwd: directory, encoding: 'utf8' }));
  artifacts.push(artifact);
}
writeFileSync(resolve(output, 'release.json'), JSON.stringify({ version: manifest.version, tag, artifacts }, null, 2) + '\n');
if (mode === 'pack') {
  console.log(`Packed both packages in ${output}`);
} else {
  // Publish the implementation before the alias that pins it. npm versions are immutable.
  for (const artifact of artifacts) {
    run('npm', ['publish', resolve(output, artifact.filename), '--ignore-scripts', '--access', 'public', '--registry', 'https://registry.npmjs.org', '--tag', tag, ...(mode === 'dry-run' ? ['--dry-run'] : [])]);
  }
}
