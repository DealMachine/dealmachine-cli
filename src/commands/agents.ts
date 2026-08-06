/**
 * Agent bootstrap commands for using the DealMachine CLI from coding agents.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { printJson } from '../lib/output.js';

interface AgentOptions {
  json?: boolean;
}

interface AgentInstallOptions extends AgentOptions {
  project?: boolean;
  force?: boolean;
}

const PLAYBOOK_FILE_NAME = 'dealmachine-playbook.md';

export const CLAUDE_CODE_PERMISSION_ALLOWLIST = [
  'Bash(dm agents)',
  'Bash(dm agents guide *)',
  'Bash(dm agents playbook *)',
  'Bash(dm agents skill *)',
  'Bash(dm agents permissions *)',
  'Bash(dm whoami *)',
  'Bash(dm account *)',
  'Bash(dm usage *)',
  'Bash(dm filters *)',
  'Bash(dm fields *)',
  'Bash(dm locations *)',
  'Bash(dm properties count *)',
  'Bash(dm people count *)',
  'WebFetch(domain:api.docs.dealmachine.com)',
] as const;

const AGENT_GUIDE = `# DealMachine CLI Agent Guide

Load the full Playbook first when the task involves property intelligence:

\`\`\`bash
dm agents playbook
\`\`\`

Install it once as a native Claude Code skill:

\`\`\`bash
dm agents install claude-code
\`\`\`

## Agent Defaults

- Prefer \`--json\` for machine-readable output.
- Prefer \`--quiet\` or \`DM_QUIET=1\` for non-interactive runs.
- Check auth with \`dm whoami --verify --json\`. If auth fails, ask the user to run \`dm login\`.
- Use request files or stdin for structured bodies instead of hand-editing long shell strings.

## People Lookup Routing

- A specific person by name uses \`dm enrich name\`. People Search does not have a name filter.
- A specific person by email or phone uses the matching \`dm enrich\` command.
- \`dm people search\` is only for audiences defined by demographic, property, contact, or location filters.
- A known DealMachine person ID uses \`dm people get\`.
- Name enrichment supports an optional state, ZIP code, county, or city place ID. Resolve a city with \`dm locations search\`, then pass its \`code\` to \`dm enrich name --city\`.

## Credit-Safe Workflow

1. Discover live filters and fields before searches:

\`\`\`bash
dm filters --source-type properties --json
dm fields --source-type properties --json
\`\`\`

2. Count before any credit-consuming search:

\`\`\`bash
dm properties count -f query.json --json
dm people count -f query.json --json
\`\`\`

3. Preview supported paid searches with \`--estimate-cost\`. Non-interactive property search, people search, and name enrichment estimate automatically unless \`--yes\` is supplied.
4. Confirm the requested output shape and expected credit cost with the user, then rerun the approved command with \`--yes\`.
5. Use \`dm usage --json\` when the user mentions credits, limits, or billing-cycle usage.
6. Default property/list exports to owner contact rows unless the user explicitly asks for property-only rows.

## Useful Commands

\`\`\`bash
dm agents guide --json
dm agents playbook
dm agents install claude-code
dm agents permissions --json
dm filters --source-type properties --json
dm fields --source-type properties --json
dm properties count -f query.json --json
dm properties search -f query.json --json --quiet
dm lists export <list_id> --json --quiet
\`\`\`
`;

function getPlaybookCandidates(): string[] {
  const currentFile = fileURLToPath(import.meta.url);
  const currentDir = path.dirname(currentFile);

  return Array.from(
    new Set([
      path.resolve(currentDir, '../agents', PLAYBOOK_FILE_NAME),
      path.resolve(currentDir, '../../dist/agents', PLAYBOOK_FILE_NAME),
      path.resolve(currentDir, '../../playbook/PLAYBOOK.md'),
      path.resolve(currentDir, '../../../playbooks/playbook/SKILL.md'),
      path.resolve(process.cwd(), 'packages/playbooks/playbook/SKILL.md'),
      path.resolve(process.cwd(), '../playbooks/playbook/SKILL.md'),
    ])
  );
}

function loadPlaybook(): { content: string; path: string } {
  for (const candidate of getPlaybookCandidates()) {
    if (fs.existsSync(candidate)) {
      return {
        content: fs.readFileSync(candidate, 'utf-8'),
        path: candidate,
      };
    }
  }

  throw new Error(
    `Could not find the DealMachine Playbook. Rebuild the CLI with "npm run build" from packages/cli and try again.`
  );
}

function validatePlaybook(content: string): void {
  if (!content.startsWith('---\n') || !/^name:\s*dealmachine\s*$/m.test(content)) {
    throw new Error('The bundled DealMachine Playbook has invalid skill metadata.');
  }
  if (!/^description:\s*\S+/m.test(content)) {
    throw new Error('The bundled DealMachine Playbook is missing a skill description.');
  }
}

function getClaudeSkillsRoot(): string {
  const configuredRoot = process.env.CLAUDE_CONFIG_DIR?.trim();
  return configuredRoot ? path.resolve(configuredRoot) : path.join(os.homedir(), '.claude');
}

function getClaudeSkillTarget(project: boolean): string {
  const root = project ? path.resolve(process.cwd(), '.claude') : getClaudeSkillsRoot();
  return path.join(root, 'skills', 'dealmachine', 'SKILL.md');
}

export async function agentsGuide(options: AgentOptions): Promise<void> {
  if (options.json) {
    printJson({
      name: 'DealMachine CLI Agent Guide',
      type: 'agent_guide',
      recommended_first_command: 'dm agents playbook',
      content: AGENT_GUIDE,
    });
    return;
  }

  console.log(AGENT_GUIDE);
}

export async function agentsPlaybook(options: AgentOptions): Promise<void> {
  try {
    const playbook = loadPlaybook();

    if (options.json) {
      printJson({
        name: 'DealMachine Playbook',
        type: 'playbook',
        path: playbook.path,
        content: playbook.content,
      });
      return;
    }

    console.log(playbook.content);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not load the DealMachine Playbook.';
    if (options.json) {
      printJson({ error: message });
      process.exitCode = 1;
      return;
    }

    console.error(message);
    process.exitCode = 1;
  }
}

export async function agentsInstallClaudeCode(options: AgentInstallOptions): Promise<void> {
  try {
    const playbook = loadPlaybook();
    validatePlaybook(playbook.content);

    const target = getClaudeSkillTarget(Boolean(options.project));
    const scope = options.project ? 'project' : 'personal';
    const current = fs.existsSync(target) ? fs.readFileSync(target, 'utf-8') : undefined;

    if (current === playbook.content) {
      const result = {
        status: 'already_installed',
        agent: 'claude-code',
        scope,
        path: target,
      };
      if (options.json) printJson(result);
      else console.log(`DealMachine Playbook is already installed at ${target}`);
      return;
    }

    if (current !== undefined && !options.force) {
      throw new Error(
        `A different DealMachine skill already exists at ${target}. Review it, then rerun with --force to replace it.`
      );
    }

    fs.mkdirSync(path.dirname(target), {
      recursive: true,
      mode: options.project ? 0o755 : 0o700,
    });
    const temporary = path.join(path.dirname(target), `.SKILL.md.${process.pid}.tmp`);
    try {
      fs.writeFileSync(temporary, playbook.content, {
        encoding: 'utf-8',
        mode: options.project ? 0o644 : 0o600,
      });
      fs.renameSync(temporary, target);
    } finally {
      if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    }

    const result = {
      status: current === undefined ? 'installed' : 'replaced',
      agent: 'claude-code',
      scope,
      path: target,
    };
    if (options.json) printJson(result);
    else {
      console.log(`Installed the DealMachine Playbook for Claude Code at ${target}`);
      console.log('Restart Claude Code or start a new session so it discovers the skill.');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not install the DealMachine Playbook.';
    if (options.json) printJson({ error: message });
    else console.error(message);
    process.exitCode = 1;
  }
}

export async function agentsPermissions(options: AgentOptions): Promise<void> {
  const payload = {
    agent: 'claude-code',
    permissions: { allow: CLAUDE_CODE_PERMISSION_ALLOWLIST },
    policy:
      'Only free discovery and count commands are allowlisted. Paid and mutating DealMachine commands still require approval.',
  };

  if (options.json) {
    printJson(payload);
    return;
  }

  console.log('# Claude Code DealMachine permission allowlist');
  console.log();
  console.log(JSON.stringify({ permissions: payload.permissions }, null, 2));
  console.log();
  console.log(payload.policy);
}
