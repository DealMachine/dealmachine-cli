import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { planRegistryPublish } from '../scripts/mcp-registry-sync.mjs';

const serverJson = JSON.parse(readFileSync(resolve(__dirname, '../server.json'), 'utf8'));
const listing = (changes: Record<string, unknown> = {}) => ({ ...serverJson, version: '0.4.0', description: 'New wording.', ...changes });
const older = listing({ version: '0.3.9', description: 'Old wording.' });

describe('MCP registry publish decision', () => {
  it('publishes a new version once mcp.dealmachine.com serves the same listing', () => {
    expect(planRegistryPublish({ listing: listing(), live: listing(), published: [older] }).action).toBe('publish');
  });

  it('publishes nothing when the registry already has this exact version', () => {
    expect(planRegistryPublish({ listing: listing(), live: listing(), published: [older, listing()] }).action).toBe('skip');
  });

  it('waits for the MCP server release when server.json is ahead of the live listing', () => {
    const decision = planRegistryPublish({ listing: listing(), live: older, published: [older] });
    expect(decision.action).toBe('wait');
    expect(decision.message).toMatch(/still serves 0\.3\.9/);
  });

  it('refuses changed wording that kept an already published version number', () => {
    const published = [listing({ description: 'Wording already in the registry.' })];
    expect(() => planRegistryPublish({ listing: listing(), live: listing(), published }))
      .toThrow(/already has version 0\.4\.0 with a different description/);
  });

  it('refuses when the live server serves a newer listing than server.json', () => {
    expect(() => planRegistryPublish({ listing: older, live: listing(), published: [older] }))
      .toThrow(/newer than 0\.3\.9 in server\.json/);
  });

  it('refuses when both copies share a version but not their wording', () => {
    expect(() => planRegistryPublish({ listing: listing(), live: listing({ description: 'Other wording.' }), published: [older] }))
      .toThrow(/differ in description/);
  });

  it('matches the copy this repository ships today', () => {
    expect(planRegistryPublish({ listing: serverJson, live: serverJson, published: [serverJson] }).action).toBe('skip');
  });
});
