import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { readVersions, targetBranch, versionProblems } from '../scripts/check-release-version.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const everywhere = (version: string) => ({
  'package.json': version,
  'npm-alias/package.json': version,
  'npm-alias/package.json dependency on @dealmachine/cli': version,
  'package-lock.json': version,
  'package-lock.json root package': version,
  'src/version.ts': version,
});

// CLI release #59 failed after merge because a test version reached master (WORK-13683).
describe('version check before staging and master', () => {
  it.each(['staging', 'master'])('refuses a test version headed for %s', branch => {
    const problems = versionProblems(everywhere('0.5.1-archive-mail.1'), branch);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain(`0.5.1-archive-mail.1 is a test version, and this change is headed for ${branch}`);
    expect(problems[0]).toContain('npm run release:version');
  });

  it('names every place whose version disagrees', () => {
    const versions = { ...everywhere('0.5.5'), 'src/version.ts': '0.5.1-archive-mail.1', 'package-lock.json root package': undefined };
    const [problem] = versionProblems(versions, 'staging');
    expect(problem).toContain('src/version.ts (0.5.1-archive-mail.1)');
    expect(problem).toContain('package-lock.json root package (missing)');
    expect(problem).not.toContain('npm-alias/package.json (');
  });

  it('passes a stable version that matches everywhere, and a test version on another branch', () => {
    expect(versionProblems(everywhere('0.5.5'), 'staging')).toEqual([]);
    expect(versionProblems(everywhere('0.5.5'), 'master')).toEqual([]);
    expect(versionProblems(everywhere('0.5.1-archive-mail.1'), 'codex/feat/archive-mail')).toEqual([]);
    expect(versionProblems(everywhere('0.5.1-archive-mail.1'), '')).toEqual([]);
  });

  it('reads the branch from pull request, merge queue and push runs', () => {
    expect(targetBranch({ GITHUB_BASE_REF: 'staging', GITHUB_REF_NAME: '61/merge' })).toBe('staging');
    expect(targetBranch({ MERGE_GROUP_BASE_REF: 'refs/heads/master', GITHUB_REF_NAME: 'gh-readonly-queue/master/pr-59-7c12c9e' })).toBe('master');
    expect(targetBranch({ GITHUB_REF_NAME: 'gh-readonly-queue/staging/pr-61-1f3b69a' })).toBe('staging');
    expect(targetBranch({ GITHUB_REF_NAME: 'master' })).toBe('master');
  });

  it('reads all six places from this checkout, and they agree', () => {
    const versions = readVersions(root);
    expect(Object.keys(versions)).toHaveLength(6);
    expect(new Set(Object.values(versions)).size).toBe(1);
  });

  // The script decides whether to run by its own path, so run it the way CI does, through a symlink too.
  it.each([
    ['0.5.1-archive-mail.1', 1],
    ['0.5.5', 0],
  ])('runs as a script through a symlinked path: %s exits %i', (version, status) => {
    const temp = mkdtempSync(join(tmpdir(), 'cli-version-check-'));
    const checkout = join(temp, 'checkout');
    mkdirSync(join(checkout, 'npm-alias'), { recursive: true });
    mkdirSync(join(checkout, 'src'));
    writeFileSync(join(checkout, 'package.json'), JSON.stringify({ version }));
    writeFileSync(join(checkout, 'npm-alias/package.json'), JSON.stringify({ version, dependencies: { '@dealmachine/cli': version } }));
    writeFileSync(join(checkout, 'package-lock.json'), JSON.stringify({ version, packages: { '': { version } } }));
    writeFileSync(join(checkout, 'src/version.ts'), `export const CLI_VERSION = '${version}';\n`);
    symlinkSync(join(root, 'scripts'), join(temp, 'linked-scripts'), process.platform === 'win32' ? 'junction' : 'dir');
    const run = spawnSync(process.execPath, [join(temp, 'linked-scripts', 'check-release-version.mjs'), checkout], {
      encoding: 'utf8',
      env: { PATH: process.env.PATH, GITHUB_BASE_REF: 'staging' },
    });
    expect(run.status).toBe(status);
    if (status) expect(run.stderr).toContain(`${version} is a test version, and this change is headed for staging`);
    else expect(run.stdout).toContain(`CLI version ${version} may merge into staging`);
  });
});
