import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
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
const readme = await readFile(resolve(packageRoot, 'README.md'), 'utf8');

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

const supportedDirectoryCategories = new Set([
  'Productivity',
  'Creativity',
  'Developer Tools',
  'Business & Operations',
  'Data & Analytics',
  'Communication',
  'Education & Research',
  'Security',
  'Finance',
  'Healthcare',
  'Travel',
  'Entertainment',
  'Other',
]);
const pluginInterface = codexManifest.interface;
assert(pluginInterface, 'Codex plugin interface metadata is required');
assert(pluginInterface.displayName.length <= 30, 'directory display name must be 30 characters or fewer');
assert(pluginInterface.shortDescription.length <= 30, 'directory short description must be 30 characters or fewer');
assert(pluginInterface.longDescription.length <= 4000, 'directory long description must be 4,000 characters or fewer');
assert(
  supportedDirectoryCategories.has(pluginInterface.category),
  `unsupported directory category: ${pluginInterface.category}`
);
assert(Array.isArray(pluginInterface.defaultPrompt), 'starter prompts must be an array');
assert(pluginInterface.defaultPrompt.length <= 3, 'directory submissions allow at most three starter prompts');
for (const prompt of pluginInterface.defaultPrompt) {
  assert(prompt.length <= 128, 'directory starter prompts must be 128 characters or fewer');
  assert(!prompt.includes('@'), 'directory starter prompts must not contain app mentions');
}
for (const field of ['websiteURL', 'supportURL', 'privacyPolicyURL', 'termsOfServiceURL']) {
  assert.match(pluginInterface[field], /^https:\/\/[^\s/]+(?:\/[^\s]*)?$/, `${field} must be a public HTTPS URL`);
}

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
assert.match(
  skill,
  /People Search builds audiences[\s\S]+it has no name filter/,
  'DealMachine skill must distinguish People Search from person-name enrichment'
);
assert.match(skill, /dealmachine_enrich_name/, 'DealMachine skill must route names to enrichment');

const demoVideoPath = resolve(packageRoot, 'assets/plugin-demo/dealmachine-agent-plugin-demo.mp4');
const demoVideo = await stat(demoVideoPath);
assert(demoVideo.isFile(), 'submission demo must be a regular file');
assert(demoVideo.size > 0 && demoVideo.size <= 100 * 1024 * 1024, 'submission demo must be non-empty and at most 100 MB');
assert.match(
  readme,
  /assets\/plugin-demo\/dealmachine-agent-plugin-demo\.mp4/,
  'README must link to the public submission demo'
);

console.log('Agent Plugin package is valid.');
