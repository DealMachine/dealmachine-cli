import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('..', import.meta.url));
const run = (command, args, cwd = cli) => execFileSync(command, args, { cwd, encoding: 'utf8' });
const [artifact] = JSON.parse(run('npm', ['pack', '--dry-run', '--ignore-scripts', '--json'], cli));
for (const file of artifact.files) {
  assert.doesNotMatch(
    file.path,
    /(^|\/)(private|v2|dialer|opportunities|opportunity-fields|opportunityActivities|suppression|contactExclusions)(\/|\.)/,
    `Private file in npm package: ${file.path}`
  );
  if (!/\.(js|md|map|ts)$/.test(file.path)) continue;
  const content = readFileSync(resolve(cli, file.path), 'utf8');
  assert.doesNotMatch(
    content,
    /registerDialerCommands|DM_ENABLE_DIALER|\/dialer(?:\/|['"`])|registerV2Commands|registerBetaCommands|registerOpportunitiesCommands|include_companies|company_limit|V2 Query Workflows|dm query schema|\/query\/schema|\/opportunities(?:\/|['"`])|\/suppression-list|exclude[-_](?:exported|prospect|listed|suppressed)[-_]contacts|include[-_]properties[-_]without[-_]contacts/,
    `Private content in npm package: ${file.path}`
  );
}
for (const args of [
  ['--help'],
  ['properties', 'get', '--help'],
  ['people', 'get', '--help'],
  ['properties', 'export', '--help'],
  ['people', 'export', '--help'],
  ['agents', 'guide'],
  ['agents', 'playbook'],
]) {
  const output = run(process.execPath, [resolve(cli, 'dist/index.js'), ...args]);
  assert.doesNotMatch(output, /V2 Query|include-companies|dm query|rental-comps|Query related V2|exclude-\w+-contacts|include-properties-without-contacts/);
  if (args[1] === 'export') assert.doesNotMatch(output, /--estimate-cost/);
}
const blockedCommands = ['query', 'companies', 'opportunities', 'opp', 'suppression', 'dialer'];
for (const [command, dialerFlag] of [...blockedCommands.map(command => [command, 'true']), ['dialer', '1']]) {
  const result = spawnSync(process.execPath, [resolve(cli, 'dist/index.js'), command], {
    cwd: cli,
    encoding: 'utf8',
    env: { ...process.env, DM_ENABLE_OPPORTUNITIES: 'true', DM_ENABLE_DIALER: dialerFlag },
  });
  assert.equal(result.status, 1, `${command} must not exist in the public binary, even with a local beta switch`);
  assert.match(result.stderr, /unknown command/);
}
console.log(
  `Public CLI artifact checked: ${artifact.files.length} files, no private V2 commands or docs.`
);
