import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageDir = path.resolve(scriptDir, '..');
const playbookCandidates = [
  path.resolve(packageDir, 'playbook/PLAYBOOK.md'),
  path.resolve(packageDir, '../playbooks/playbook/SKILL.md'),
];
const outputDir = path.resolve(packageDir, 'dist/agents');
const outputPath = path.join(outputDir, 'dealmachine-playbook.md');

const playbookPath = playbookCandidates.find((candidate) => fs.existsSync(candidate));

if (!playbookPath) {
  throw new Error(`Missing DealMachine Playbook. Checked: ${playbookCandidates.join(', ')}`);
}

fs.mkdirSync(outputDir, { recursive: true });
fs.copyFileSync(playbookPath, outputPath);
