import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout } from 'node:timers/promises';
import { planRelease, releasePackages, verifyPublishedPackage } from './release-plan.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const [mode, ...extra] = process.argv.slice(2);
assert(['dry-run', 'publish'].includes(mode) && !extra.length, 'Use release:auto:dry-run or release:auto:publish.');
const execute = (command, args, options = {}) => execFileSync(command, args, { cwd: root, stdio: 'inherit', ...options });
const git = (...args) => execute('git', args, { encoding: 'utf8', stdio: 'pipe' }).trim();
const sourceSha = git('rev-parse', 'HEAD');
const assertCurrentMaster = () => {
  assert.equal(git('ls-remote', 'origin', 'refs/heads/master').split(/\s/)[0], sourceSha, 'Source is no longer current master. Let the newest master run publish.');
};
if (mode === 'publish') {
  assert.equal(process.env.GITHUB_ACTIONS, 'true', 'Automatic publishing runs only in GitHub Actions; use release:publish for an authorized local release.');
  assert.equal(process.env.GITHUB_REPOSITORY, 'DealMachine/dealmachine-cli');
  assert.equal(process.env.GITHUB_REF, 'refs/heads/master');
  assert.equal(process.env.GITHUB_SHA, sourceSha);
  assert(['push', 'workflow_dispatch'].includes(process.env.GITHUB_EVENT_NAME), 'Only master push and recovery dispatch may publish.');
  assert.equal(git('status', '--porcelain'), '', 'Start from the clean committed release source.');
  assertCurrentMaster();
}

async function registry(name) {
  const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}`, {
    headers: { accept: 'application/json', 'cache-control': 'no-cache' },
    redirect: 'error', signal: AbortSignal.timeout(30_000),
  });
  assert(response.ok, `Cannot read ${name} registry metadata (${response.status}). No release decision was made.`);
  const metadata = await response.json();
  assert(metadata.name === name && metadata.versions && typeof metadata.versions === 'object', `Invalid registry metadata for ${name}.`);
  return metadata;
}
const registries = Object.fromEntries(await Promise.all(releasePackages.map(async name => [name, await registry(name)])));
const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const plan = planRelease(manifest.version, sourceSha, registries);
const changedFiles = ['package.json', 'package-lock.json', 'npm-alias/package.json', 'src/version.ts'];
const originals = new Map(changedFiles.map(name => [name, readFileSync(resolve(root, name))]));
console.log(`${mode === 'dry-run' ? 'Would publish' : 'Publishing'} both CLI packages as ${plan.version} from ${sourceSha}.`);
try {
  execute(process.execPath, ['scripts/release-version.mjs', plan.version]);
  for (const name of ['package.json', 'npm-alias/package.json']) {
    const path = resolve(root, name);
    const data = JSON.parse(readFileSync(path, 'utf8'));
    data.dealmachineRelease = { sourceSha };
    writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
  }
  // This runs the owner's complete checks and clean consumer install before either upload.
  execute(process.execPath, ['scripts/release.mjs', 'pack', '--tag', plan.tag]);
  const output = resolve(root, 'artifacts', plan.version);
  const record = JSON.parse(readFileSync(resolve(output, 'release.json'), 'utf8'));
  Object.assign(record, plan, { repository: 'DealMachine/dealmachine-cli', workflowRunId: process.env.GITHUB_RUN_ID ?? null, verified: false });
  writeFileSync(resolve(output, 'release.json'), JSON.stringify(record, null, 2) + '\n');
  // Check both existing packages before writing either one; a mixed pair must stop here.
  for (const artifact of record.artifacts) {
    if (registries[artifact.name].versions?.[plan.version]) verifyPublishedPackage(artifact, registries[artifact.name], plan, { requireTag: true });
  }
  if (mode === 'publish') assertCurrentMaster();
  for (const artifact of record.artifacts) {
    if (registries[artifact.name].versions?.[plan.version]) {
      console.log(`Verified existing ${artifact.name}@${plan.version}; resuming without republishing it.`);
    } else {
      execute('npm', ['publish', resolve(output, artifact.filename), '--ignore-scripts', '--access', 'public', '--registry', 'https://registry.npmjs.org', '--tag', plan.tag, ...(mode === 'dry-run' ? ['--dry-run'] : [])]);
    }
    if (mode === 'publish') {
      // Public registry replicas may briefly lag the successful publish response.
      let metadata;
      for (let attempt = 0; attempt < 6; attempt++) {
        metadata = await registry(artifact.name);
        if (metadata.versions?.[plan.version] && metadata['dist-tags']?.[plan.tag] === plan.version) break;
        if (attempt < 5) await setTimeout(2_000);
      }
      verifyPublishedPackage(artifact, metadata, plan, { requireTag: true });
    }
  }
  if (mode === 'publish') {
    for (const artifact of record.artifacts) verifyPublishedPackage(artifact, await registry(artifact.name), plan, { requireTag: true });
    record.verified = true;
    record.verifiedAt = new Date().toISOString();
    writeFileSync(resolve(output, 'release.json'), JSON.stringify(record, null, 2) + '\n');
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `version=${plan.version}\n`);
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `Published and verified both CLI packages at **${plan.version}** (latest).\n\nSource: \`${sourceSha}\`\n\n- [@dealmachine/cli](https://www.npmjs.com/package/@dealmachine/cli/v/${plan.version})\n- [dealmachine](https://www.npmjs.com/package/dealmachine/v/${plan.version})\n\nThe release artifact includes both package integrity digests.\n`);
  }
} finally {
  for (const [name, contents] of originals) writeFileSync(resolve(root, name), contents);
}
