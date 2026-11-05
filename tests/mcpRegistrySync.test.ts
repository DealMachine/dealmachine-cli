import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
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

  it('names server.json when its wording changed under a version the registry already has', () => {
    const published = listing({ description: 'Wording already in the registry.' });
    expect(() => planRegistryPublish({ listing: listing(), live: published, published: [published] }))
      .toThrow(/server\.json changed its description but kept version 0\.4\.0/);
  });

  it('names the MCP server when its wording changed under a version the registry already has', () => {
    expect(() => planRegistryPublish({ listing: listing(), live: listing({ description: 'Reworded on the server.' }), published: [listing()] }))
      .toThrow(/mcp\.dealmachine\.com changed its description but kept version 0\.4\.0/);
  });

  it('refuses when the live server serves a newer listing than server.json', () => {
    expect(() => planRegistryPublish({ listing: older, live: listing(), published: [older] }))
      .toThrow(/newer than 0\.3\.9 in server\.json/);
  });

  it('refuses when both copies share a version but not their wording', () => {
    expect(() => planRegistryPublish({ listing: listing(), live: listing({ description: 'Other wording.' }), published: [older] }))
      .toThrow(/differ in description/);
  });

  it('refuses a version below one the registry already has', () => {
    expect(() => planRegistryPublish({ listing: listing(), live: listing(), published: [listing({ version: '0.5.0' })] }))
      .toThrow(/already has version 0\.5\.0, newer than 0\.4\.0/);
  });

  it('treats the same listing written in another key order as unchanged', () => {
    const reordered = { ...listing(), repository: { source: 'github', url: serverJson.repository.url } };
    expect(planRegistryPublish({ listing: listing(), live: reordered, published: [reordered] }).action).toBe('skip');
  });

  it('matches the copy this repository ships today', () => {
    expect(planRegistryPublish({ listing: serverJson, live: serverJson, published: [serverJson] }).action).toBe('skip');
  });
});

describe('MCP registry script entry', () => {
  it('still runs when started through a linked folder, so a check can never pass without doing anything', () => {
    const linked = mkdtempSync(join(tmpdir(), 'mcp-registry-'));
    try {
      symlinkSync(resolve(__dirname, '../scripts'), join(linked, 'scripts'), 'dir');
      const result = spawnSync(process.execPath, [join(linked, 'scripts/mcp-registry-sync.mjs'), 'unknown'], { encoding: 'utf8' });
      expect(result.status).toBe(2);
      expect(result.stderr).toMatch(/Usage: node scripts\/mcp-registry-sync\.mjs <plan\|verify>/);
    } finally {
      rmSync(linked, { recursive: true, force: true });
    }
  });
});
