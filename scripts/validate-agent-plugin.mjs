import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

async function readJson(relativePath) {
  return JSON.parse(await readFile(resolve(packageRoot, relativePath), 'utf8'));
}

const manifest = await readJson('plugin.json');
const mcp = await readJson('mcp.json');
const codexManifest = await readJson('.codex-plugin/plugin.json');
const skill = await readFile(resolve(packageRoot, 'skills/dealmachine/SKILL.md'), 'utf8');

assert.equal(
  manifest.$schema,
  'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json',
  'plugin.json must declare the Agent Plugins 1.0.0 schema'
);
assert.match(
  manifest.name,
  /^(?!.*(?:--|\.\.))[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/,
  'plugin name must satisfy the portable manifest naming rules'
);
assert.equal(manifest.name, codexManifest.name, 'portable and Codex plugin names must match');
assert.equal(manifest.version, codexManifest.version, 'portable and Codex plugin versions must match');

const portableManifestFields = new Set([
  '$schema',
  'name',
  'version',
  'description',
  'author',
  'homepage',
  'repository',
  'license',
  'keywords',
  'extensions',
]);
for (const field of Object.keys(manifest)) {
  assert(portableManifestFields.has(field), `plugin.json contains unsupported field: ${field}`);
}

assert.equal(
  mcp.$schema,
  'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json',
  'mcp.json must declare the Agent Plugins 1.0.0 MCP schema'
);
assert.deepEqual(Object.keys(mcp).sort(), ['$schema', 'mcpServers'].sort());
assert.deepEqual(Object.keys(mcp.mcpServers), ['dealmachine']);
assert.deepEqual(mcp.mcpServers.dealmachine, {
  type: 'streamable-http',
  url: 'https://mcp.dealmachine.com',
});

assert.match(skill, /^---\nname: dealmachine\n/, 'DealMachine skill front matter is missing');
assert.match(skill, /\ndescription: .+\n/, 'DealMachine skill description is missing');

console.log('Agent Plugin package is valid.');
