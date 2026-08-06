#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const packageDirectory = path.resolve(scriptDirectory, '..');
const repositoryDirectory = packageDirectory;
const mode = process.argv[2] || 'local';
const supportedModes = new Set(['local', 'published', 'deployed', 'all']);

if (!supportedModes.has(mode)) {
  console.error('Usage: node scripts/eval-cold-start.mjs [local|published|deployed|all]');
  process.exit(2);
}

const checks = [];

function check(name, condition, detail) {
  checks.push({ name, passed: Boolean(condition), detail });
}

function includesAll(value, required) {
  return required.every((item) => value.includes(item));
}

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: repositoryDirectory,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  });
}

function tryRun(command, args, options = {}) {
  try {
    return { ok: true, stdout: run(command, args, options), error: '' };
  } catch (error) {
    const stderr = error && typeof error === 'object' && 'stderr' in error ? error.stderr : '';
    const message = stderr || (error instanceof Error ? error.message : String(error));
    return {
      ok: false,
      stdout: '',
      error: String(message).trim().slice(0, 1200),
    };
  }
}

function assertPlaybookContract(prefix, playbook) {
  check(
    `${prefix}: native skill metadata`,
    includesAll(playbook, ['name: dealmachine', 'allowed-tools:']),
    'Playbook must be discoverable as a skill.'
  );
  check(
    `${prefix}: name lookup routing`,
    includesAll(playbook, ['dm enrich name', 'not People Search']),
    'A specific name must route to name enrichment.'
  );
  check(
    `${prefix}: explicit spend approval`,
    includesAll(playbook, ['--estimate-cost', '--yes']),
    'The Playbook must define estimate then approval.'
  );
  check(
    `${prefix}: broad Bash permission absent`,
    !playbook.includes('Bash(dm *)'),
    'The Playbook must not pre-approve every dm command.'
  );
  check(
    `${prefix}: installer requires approval`,
    !playbook.includes('Bash(dm agents *)') && !playbook.includes('Bash(dm agents install *)'),
    'The skill installer must not be pre-approved.'
  );
}

function evaluateCases() {
  const fixturePath = path.join(packageDirectory, 'evals', 'claude-code-name-lookup.json');
  const suite = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));
  check('scenario catalog: four clean-start variants', suite.cases.length >= 4, `${suite.cases.length} cases found.`);
  for (const testCase of suite.cases) {
    check(`${testCase.id}: route contract`, testCase.expectedRoute === 'dm enrich name', testCase.expectedRoute);
    check(
      `${testCase.id}: free first action`,
      testCase.firstPaidAction === '--estimate-cost',
      testCase.firstPaidAction
    );
    check(`${testCase.id}: approved action`, testCase.approvedAction === '--yes', testCase.approvedAction);
  }
}

function evaluateLocal() {
  const entry = path.join(packageDirectory, 'dist', 'index.js');
  if (!fs.existsSync(entry)) {
    throw new Error('Local CLI is not built. Run npm run build first.');
  }

  const rootHelp = run(process.execPath, [entry, '--help']);
  const peopleHelp = run(process.execPath, [entry, 'people', '--help']);
  const nameHelp = run(process.execPath, [entry, 'enrich', 'name', '--help']);
  const playbook = run(process.execPath, [entry, 'agents', 'playbook']);
  check(
    'local: installer discoverable',
    rootHelp.includes('dm agents install claude-code'),
    'Root help advertises installation.'
  );
  check(
    'local: people routing hint',
    includesAll(peopleHelp, ['dm enrich name', 'does not have a name filter']),
    'People help redirects named lookups.'
  );
  check(
    'local: credit flags discoverable',
    includesAll(nameHelp, ['--estimate-cost', '--yes']),
    'Name enrichment exposes both safety flags.'
  );
  assertPlaybookContract('local', playbook);

  const claudeConfig = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-cold-start-'));
  try {
    const result = JSON.parse(
      run(process.execPath, [entry, 'agents', 'install', 'claude-code', '--json'], {
        env: { ...process.env, CLAUDE_CONFIG_DIR: claudeConfig },
      })
    );
    const installed = fs.readFileSync(result.path, 'utf-8');
    check('local: clean config install', result.status === 'installed', result.path);
    assertPlaybookContract('local installed skill', installed);
  } finally {
    fs.rmSync(claudeConfig, { recursive: true, force: true });
  }
}

function evaluatePublished() {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const npmArgs = ['--registry=https://registry.npmjs.org', 'exec', '--yes', '--package=dealmachine@latest', '--'];
  const cleanDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-published-eval-'));
  const userConfig = path.join(cleanDirectory, 'empty-npmrc');
  fs.writeFileSync(userConfig, '', 'utf-8');
  const options = {
    cwd: cleanDirectory,
    env: {
      ...process.env,
      npm_config_registry: 'https://registry.npmjs.org',
      npm_config_userconfig: userConfig,
    },
  };

  try {
    const rootHelpResult = tryRun(npm, [...npmArgs, 'dm', '--help'], options);
    check(
      'published: clean npm execution',
      rootHelpResult.ok,
      rootHelpResult.ok ? 'dealmachine@latest executed from an empty directory.' : rootHelpResult.error
    );
    if (!rootHelpResult.ok) return;

    const peopleHelpResult = tryRun(npm, [...npmArgs, 'dm', 'people', '--help'], options);
    const playbookResult = tryRun(npm, [...npmArgs, 'dm', 'agents', 'playbook'], options);
    check(
      'published: installer discoverable',
      rootHelpResult.stdout.includes('dm agents install claude-code'),
      'Published root help advertises installation.'
    );
    check(
      'published: people routing hint',
      peopleHelpResult.ok && peopleHelpResult.stdout.includes('dm enrich name'),
      peopleHelpResult.ok ? 'Published people help redirects named lookups.' : peopleHelpResult.error
    );
    check(
      'published: Playbook command executes',
      playbookResult.ok,
      playbookResult.ok ? 'Published Playbook loaded.' : playbookResult.error
    );
    if (playbookResult.ok) assertPlaybookContract('published', playbookResult.stdout);
  } finally {
    fs.rmSync(cleanDirectory, { recursive: true, force: true });
  }
}

async function evaluateDeployed() {
  const base = (process.env.DM_DOCS_BASE || 'https://api.docs.dealmachine.com').replace(/\/$/, '');
  const urls = [`${base}/skill.md`, `${base}/ai-assistants/claude-code.md`, `${base}/cli/commands.md`];
  const pages = await Promise.all(
    urls.map(async (url) => {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Could not fetch ${url}: HTTP ${response.status}`);
      return { url, content: await response.text() };
    })
  );
  const combined = pages.map((page) => page.content).join('\n');
  check('deployed docs: installer', combined.includes('dm agents install claude-code'), urls.join(', '));
  check(
    'deployed docs: named-person routing',
    includesAll(combined, ['dm enrich name', 'People Search']),
    urls.join(', ')
  );
  check('deployed docs: approval boundary', includesAll(combined, ['--estimate-cost', '--yes']), urls.join(', '));
  assertPlaybookContract('deployed skill', pages[0].content);
}

evaluateCases();
if (mode === 'local' || mode === 'all') evaluateLocal();
if (mode === 'published' || mode === 'all') evaluatePublished();
if (mode === 'deployed' || mode === 'all') await evaluateDeployed();

const failures = checks.filter((item) => !item.passed);
console.log(JSON.stringify({ mode, passed: failures.length === 0, checks }, null, 2));
if (failures.length > 0) process.exitCode = 1;
