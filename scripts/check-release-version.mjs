#!/usr/bin/env node
// Refuses a change headed for staging or master unless the committed CLI version is stable and
// every place that names it agrees. Staging is promoted to master whole, and every master merge
// publishes to npm latest, so a test version on staging becomes a failed production release
// (CLI release #59, November 3, 2026; WORK-13683). Test versions stay usable on other branches.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isStableVersion } from './release-plan.mjs';

export const releaseBranches = ['staging', 'master'];

/** The branch a check run is headed for, from the GitHub Actions environment. */
export function targetBranch(env = process.env) {
  const ref = env.GITHUB_BASE_REF || env.MERGE_GROUP_BASE_REF || env.GITHUB_REF_NAME || '';
  // A merge queue run's own ref is gh-readonly-queue/<base>/pr-<n>-<sha>.
  return ref.replace(/^refs\/heads\//, '').replace(/^gh-readonly-queue\/([^/]+)\/.*$/, '$1');
}

/** Every place the CLI version is committed, by file. */
export function readVersions(root) {
  const json = name => JSON.parse(readFileSync(resolve(root, name), 'utf8'));
  const cli = json('package.json');
  const alias = json('npm-alias/package.json');
  const lock = json('package-lock.json');
  const source = readFileSync(resolve(root, 'src/version.ts'), 'utf8').match(/CLI_VERSION = '([^']*)'/)?.[1];
  return {
    'package.json': cli.version,
    'npm-alias/package.json': alias.version,
    'npm-alias/package.json dependency on @dealmachine/cli': alias.dependencies?.['@dealmachine/cli'],
    'package-lock.json': lock.version,
    'package-lock.json root package': lock.packages?.['']?.version,
    'src/version.ts': source,
  };
}

/** Plain-English problems with these versions for a run headed for this branch; empty when it may merge. */
export function versionProblems(versions, branch) {
  const problems = [];
  const version = versions['package.json'];
  const disagreeing = Object.entries(versions).filter(([, value]) => value !== version);
  if (disagreeing.length) {
    problems.push(
      `The CLI version is ${version} in package.json but differs in ${disagreeing
        .map(([place, value]) => `${place} (${value ?? 'missing'})`)
        .join(', ')}. Set it everywhere at once with npm run release:version -- <version>.`
    );
  }
  if (releaseBranches.includes(branch) && !isStableVersion(version)) {
    problems.push(
      `${version} is a test version, and this change is headed for ${branch}. Staging is released to master, and master publishes to npm only a stable version such as 0.5.5. Before merging, set one with npm run release:version -- <version>. Keep test versions on a branch that is not headed for staging or master.`
    );
  }
  return problems;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const branch = targetBranch();
  const problems = versionProblems(readVersions(root), branch);
  for (const problem of problems) console.error(process.env.GITHUB_ACTIONS ? `::error::${problem}` : problem);
  if (problems.length) process.exit(1);
  console.log(`CLI version ${readVersions(root)['package.json']} may merge into ${branch || 'this branch'}.`);
}
