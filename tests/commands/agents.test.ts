import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { agentsGuide, agentsInstallClaudeCode, agentsPermissions, agentsPlaybook } from '../../src/commands/agents';

const temporaryDirectories: string[] = [];

describe('agent commands', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    process.exitCode = undefined;
    delete process.env.CLAUDE_CONFIG_DIR;
    for (const directory of temporaryDirectories.splice(0)) {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  it('prints concise agent guidance', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    await agentsGuide({});

    expect(log).toHaveBeenCalledWith(expect.stringContaining('dm agents playbook'));
    expect(log).toHaveBeenCalledWith(expect.stringContaining('Credit-Safe Workflow'));
    expect(log).toHaveBeenCalledWith(expect.stringContaining('A specific person by name uses `dm enrich name`'));
    expect(log).toHaveBeenCalledWith(expect.stringContaining('People Search does not have a name filter'));
  });

  it('prints agent guidance as JSON', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    await agentsGuide({ json: true });

    const payload = JSON.parse(log.mock.calls[0][0] as string);
    expect(payload).toMatchObject({
      type: 'agent_guide',
      recommended_first_command: 'dm agents playbook',
    });
    expect(payload.content).toContain('DealMachine CLI Agent Guide');
    expect(payload.content).toContain('A specific person by name uses `dm enrich name`');
  });

  it('prints the DealMachine Playbook as JSON', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    await agentsPlaybook({ json: true });

    const payload = JSON.parse(log.mock.calls[0][0] as string);
    expect(payload).toMatchObject({
      name: 'DealMachine Playbook',
      type: 'playbook',
    });
    expect(payload.content).toContain('DealMachine Playbook: Natural Language Property Intelligence');
    expect(payload.content).toContain('A specific name always uses person enrichment, not People Search.');
    expect(payload.content).toContain('allowed-tools:');
    expect(payload.content).not.toContain('Bash(dm *)');
  });

  it('installs the Playbook as a personal Claude Code skill', async () => {
    const claudeConfig = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-claude-skill-'));
    temporaryDirectories.push(claudeConfig);
    process.env.CLAUDE_CONFIG_DIR = claudeConfig;
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    await agentsInstallClaudeCode({ json: true });

    const payload = JSON.parse(log.mock.calls[0][0] as string);
    const target = path.join(claudeConfig, 'skills', 'dealmachine', 'SKILL.md');
    expect(payload).toMatchObject({
      status: 'installed',
      agent: 'claude-code',
      scope: 'personal',
      path: target,
    });
    expect(fs.readFileSync(target, 'utf-8')).toContain('name: dealmachine');

    log.mockClear();
    await agentsInstallClaudeCode({ json: true });
    expect(JSON.parse(log.mock.calls[0][0] as string)).toMatchObject({
      status: 'already_installed',
    });
  });

  it('prints only free DealMachine commands in the Claude Code allowlist', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    await agentsPermissions({ json: true });

    const payload = JSON.parse(log.mock.calls[0][0] as string);
    expect(payload.permissions.allow).toContain('Bash(dm properties count *)');
    expect(payload.permissions.allow).not.toContain('Bash(dm properties search *)');
    expect(payload.permissions.allow).not.toContain('Bash(dm agents install *)');
    expect(payload.permissions.allow).not.toContain('Bash(dm agents *)');
    expect(payload.permissions.allow).not.toContain('Bash(dm *)');
  });
});
