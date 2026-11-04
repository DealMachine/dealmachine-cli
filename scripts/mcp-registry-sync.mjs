// Decides whether the official MCP Registry needs this repository's server.json, and confirms a publish landed.
// The registry holds only the listing (name, title, description, version, repository, address), never tool
// descriptions, so only a new listing version is ever published. See docs/releases.md#mcp-registry-listing.
import assert from 'node:assert/strict';
import { appendFile, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REGISTRY = 'https://registry.modelcontextprotocol.io';
const LISTING_FIELDS = ['name', 'title', 'description', 'version', 'repository', 'remotes'];
const STABLE_VERSION = /^(\d+)\.(\d+)\.(\d+)$/;
const pause = milliseconds => new Promise(done => setTimeout(done, milliseconds));

function parseVersion(version, where) {
  const match = STABLE_VERSION.exec(version ?? '');
  assert(match, `${where} has version "${version}", which is not a stable x.y.z version.`);
  return match.slice(1).map(Number);
}

export function compareVersions(left, right) {
  const a = parseVersion(left, 'A listing');
  const b = parseVersion(right, 'A listing');
  for (let index = 0; index < 3; index++) if (a[index] !== b[index]) return a[index] - b[index];
  return 0;
}

// Fields that differ between two listings, ignoring the schema address and registry bookkeeping.
export function listingDifferences(left, right) {
  return LISTING_FIELDS.filter(field => JSON.stringify(left?.[field] ?? null) !== JSON.stringify(right?.[field] ?? null));
}

/**
 * listing: this repository's server.json. live: what mcp.dealmachine.com serves at /.well-known/mcp.json.
 * published: every version the registry already has, as server objects.
 * Returns { action: 'publish' | 'skip' | 'wait', message }, or throws when the copies disagree in a way only a
 * person can settle. Registry versions cannot be changed once published, so nothing is published on a doubt.
 */
export function planRegistryPublish({ listing, live, published }) {
  parseVersion(listing?.version, 'server.json');
  parseVersion(live?.version, 'The listing mcp.dealmachine.com serves');
  assert.equal(live.name, listing.name, `mcp.dealmachine.com serves the listing for ${live.name}, but server.json is ${listing.name}.`);

  const order = compareVersions(live.version, listing.version);
  if (order > 0) {
    throw new Error(
      `mcp.dealmachine.com serves listing version ${live.version}, newer than ${listing.version} in server.json. ` +
      'Copy the MCP server\'s listing into server.json with that version, then release this repository. Nothing was published.'
    );
  }
  if (order === 0) {
    const differences = listingDifferences(listing, live);
    if (differences.length) {
      throw new Error(
        `server.json and mcp.dealmachine.com both say version ${listing.version} but differ in ${differences.join(', ')}. ` +
        'Make both copies match, with a new version if the wording changed. Nothing was published.'
      );
    }
  }

  const existing = published.find(server => server.version === listing.version);
  if (existing) {
    const differences = listingDifferences(listing, existing);
    if (differences.length) {
      throw new Error(
        `The registry already has version ${listing.version} with a different ${differences.join(', ')}. ` +
        'Published versions cannot change, so give the new wording a new version in server.json and in the MCP server. Nothing was published.'
      );
    }
    return { action: 'skip', message: `The registry already lists version ${listing.version}. Nothing to publish.` };
  }

  if (order < 0) {
    return {
      action: 'wait',
      message: `server.json has version ${listing.version}, but mcp.dealmachine.com still serves ${live.version}. ` +
        'Waiting for the MCP server release; a later scheduled check publishes once the server serves it.',
    };
  }
  return { action: 'publish', message: `Publishing listing version ${listing.version}, which mcp.dealmachine.com already serves.` };
}

async function readJson(url, { allowMissing = false } = {}) {
  let failure;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, {
        headers: { accept: 'application/json', 'cache-control': 'no-cache' },
        redirect: 'error',
        signal: AbortSignal.timeout(20_000),
      });
      if (allowMissing && response.status === 404) return null;
      assert(response.ok, `Cannot read ${url} (${response.status}). Nothing was published.`);
      return await response.json();
    } catch (error) {
      if (!(error instanceof TypeError || error?.name === 'TimeoutError') || attempt === 2) throw error;
      failure = error;
      await pause(1_000 * (attempt + 1));
    }
  }
  throw failure;
}

export async function readPublished(name) {
  const body = await readJson(`${REGISTRY}/v0/servers/${encodeURIComponent(name)}/versions`, { allowMissing: true });
  return (body?.servers ?? []).map(entry => ({
    ...entry.server,
    isLatest: entry._meta?.['io.modelcontextprotocol.registry/official']?.isLatest === true,
  }));
}

async function readListing() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  return JSON.parse(await readFile(resolve(root, 'server.json'), 'utf8'));
}

async function liveListing(listing) {
  const remote = listing.remotes?.[0]?.url;
  assert(remote, 'server.json has no remote address to compare with.');
  return readJson(new URL('/.well-known/mcp.json', remote).href);
}

async function plan() {
  const listing = await readListing();
  const decision = planRegistryPublish({
    listing,
    live: await liveListing(listing),
    published: await readPublished(listing.name),
  });
  console.log(decision.message);
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `action=${decision.action}\nversion=${listing.version}\n`);
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `${decision.message}\n`);
}

async function verify() {
  const listing = await readListing();
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    const entry = (await readPublished(listing.name)).find(server => server.version === listing.version);
    if (entry) {
      const differences = listingDifferences(listing, entry);
      assert.equal(differences.length, 0, `The registry shows version ${listing.version} with a different ${differences.join(', ')}.`);
      if (entry.isLatest) {
        console.log(`The registry lists version ${listing.version} as the latest.`);
        return;
      }
    }
    await pause(10_000);
  }
  throw new Error(`The registry did not list version ${listing.version} as the latest within three minutes.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const command = process.argv[2];
  const run = { plan, verify }[command];
  if (!run) {
    console.error('Usage: node scripts/mcp-registry-sync.mjs <plan|verify>');
    process.exit(2);
  }
  run().catch(error => {
    console.error(error.message);
    process.exit(1);
  });
}
