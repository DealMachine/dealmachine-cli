import assert from 'node:assert/strict';
import { verifyPublishedPackage } from './release-plan.mjs';

const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

export async function registry(name, deadline = Date.now() + 90_000) {
  let failure;
  for (let attempt = 0; attempt < 3; attempt++) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    try {
      const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}`, {
        // A synchronous build can outlive an idle registry connection.
        headers: { accept: 'application/json', 'cache-control': 'no-cache', connection: 'close' },
        redirect: 'error', signal: AbortSignal.timeout(Math.min(30_000, remaining)),
      });
      assert(response.ok, `Cannot read ${name} registry metadata (${response.status}). No release decision was made.`);
      const metadata = await response.json();
      assert(metadata?.name === name && metadata.versions && typeof metadata.versions === 'object', `Invalid registry metadata for ${name}.`);
      return metadata;
    } catch (error) {
      if (!(error instanceof TypeError || error?.name === 'TimeoutError') || attempt === 2) throw error;
      failure = error;
      const delay = Math.min(1_000 * (attempt + 1), deadline - Date.now());
      if (delay > 0) await pause(delay);
    }
  }
  throw failure ?? new Error(`Timed out reading ${name} registry metadata. No release decision was made.`);
}

export async function waitForPublishedPackage(artifact, plan) {
  const deadline = Date.now() + 180_000;
  let metadata;
  while (Date.now() < deadline) {
    metadata = await registry(artifact.name, deadline);
    if (metadata.versions?.[plan.version]) {
      verifyPublishedPackage(artifact, metadata, plan);
      if (metadata['dist-tags']?.[plan.tag] === plan.version) return metadata;
    }
    const remaining = deadline - Date.now();
    if (remaining > 0) await pause(Math.min(2_000, remaining));
  }
  verifyPublishedPackage(artifact, metadata ?? {}, plan, { requireTag: true });
  return metadata;
}
