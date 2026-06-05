import { afterEach, describe, expect, it, vi } from 'vitest';
import { agentsGuide, agentsPlaybook } from '../../src/commands/agents';

describe('agent commands', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    process.exitCode = undefined;
  });

  it('prints concise agent guidance', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    await agentsGuide({});

    expect(log).toHaveBeenCalledWith(expect.stringContaining('dm agents playbook'));
    expect(log).toHaveBeenCalledWith(expect.stringContaining('Credit-Safe Workflow'));
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
  });
});
