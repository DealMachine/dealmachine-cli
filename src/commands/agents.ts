/**
 * Agent bootstrap commands for using the DealMachine CLI from coding agents.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { printJson } from '../lib/output.js';

interface AgentOptions {
  json?: boolean;
}

const PLAYBOOK_FILE_NAME = 'dealmachine-playbook.md';

const AGENT_GUIDE = `# DealMachine CLI Agent Guide

Load the full Playbook first when the task involves property intelligence:

\`\`\`bash
dm agents playbook
\`\`\`

## Agent Defaults

- Prefer \`--json\` for machine-readable output.
- Prefer \`--quiet\` or \`DM_QUIET=1\` for non-interactive runs.
- Check auth with \`dm whoami --verify --json\`. If auth fails, ask the user to run \`dm login\`.
- Use request files or stdin for structured bodies instead of hand-editing long shell strings.

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

3. Confirm the count, requested output shape, and expected credit cost with the user before fetching records or exporting.
4. Use \`dm usage --json\` when the user mentions credits, limits, or billing-cycle usage.
5. Default property/list exports to owner contact rows unless the user explicitly asks for property-only rows.

## Useful Commands

\`\`\`bash
dm agents guide --json
dm agents playbook
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
