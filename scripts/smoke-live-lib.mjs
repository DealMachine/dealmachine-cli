/**
 * Helpers for the live CLI smoke (scripts/smoke-live-coverage.mjs).
 *
 * Kept separate so the credential seeding, request allowlist, redaction and
 * response shape checks can be unit tested without contacting an API.
 */

import { createCipheriv, createHash, randomBytes } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

// These mirror the encrypted-file credential store in src/lib/config.ts. The
// unit test reads a seeded home through the real readConfig, so a format
// change there fails the test instead of silently breaking the smoke.
const FALLBACK_ENCRYPTION_CONTEXT = 'dealmachine-cli-api-key-v1';
const AES_ALGORITHM = 'aes-256-gcm';
const AES_IV_BYTES = 12;

/**
 * Write a CLI config under `homeDir` that uses the encrypted-file credential
 * store. This never calls the macOS Keychain or Windows DPAPI, so the smoke
 * cannot read or overwrite a developer's stored key.
 */
export function seedIsolatedConfig(homeDir, apiKey, identity = {}) {
  const configDir = path.join(homeDir, '.dealmachine');
  fs.mkdirSync(configDir, { recursive: true, mode: 0o700 });

  const username = identity.username ?? safeUsername();
  const hostname = identity.hostname ?? os.hostname();
  const key = createHash('sha256')
    .update([FALLBACK_ENCRYPTION_CONTEXT, username, hostname, configDir].join('\0'))
    .digest();
  const iv = randomBytes(AES_IV_BYTES);
  const cipher = createCipheriv(AES_ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(apiKey, 'utf-8'), cipher.final()]);
  const payload = Buffer.concat([iv, encrypted, cipher.getAuthTag()]).toString('base64');

  const credentialFile = path.join(configDir, 'api-key.enc');
  fs.writeFileSync(credentialFile, payload, { mode: 0o600, encoding: 'utf-8' });
  fs.writeFileSync(
    path.join(configDir, 'config.json'),
    JSON.stringify(
      {
        configVersion: 2,
        keyId: 'live-smoke',
        organizationId: 0,
        organizationName: 'Live smoke',
        organizationSlug: '',
        credentialStore: 'encrypted-file',
        credentialFile,
      },
      null,
      2
    ),
    { mode: 0o600, encoding: 'utf-8' }
  );
  return configDir;
}

function safeUsername() {
  try {
    return os.userInfo().username;
  } catch {
    return 'unknown-user';
  }
}

/** Replace every occurrence of each secret with a fixed marker. */
export function redact(text, secrets) {
  let output = String(text ?? '');
  for (const secret of secrets) {
    if (secret && secret.length >= 4) output = output.split(secret).join('[redacted]');
  }
  return output;
}

/**
 * Requests the smoke may forward to the live API. Anything else is refused by
 * the local relay before it leaves the machine.
 */
export function checkAllowedRequest(method, pathWithQuery, body) {
  const pathname = new URL(pathWithQuery, 'http://relay.local').pathname;
  if (method === 'GET' && ['/account', '/fields', '/filters'].includes(pathname)) {
    return { allowed: true };
  }
  if (method === 'POST' && pathname === '/properties/search') {
    if (body && typeof body === 'object' && body.estimate_cost === true) {
      return { allowed: true };
    }
    return { allowed: false, reason: 'property search without estimate_cost=true' };
  }
  return { allowed: false, reason: `${method} ${pathname} is not on the read-only allowlist` };
}

/** Parse JSON from CLI stdout. Throws with a short reason. */
export function parseJsonOutput(stdout) {
  try {
    return JSON.parse(stdout);
  } catch {
    throw new Error('stdout was not valid JSON');
  }
}

function fail(reason) {
  throw new Error(reason);
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function checkPagination(pagination) {
  if (!isObject(pagination)) fail('missing pagination object');
  for (const key of ['page', 'per_page', 'total_results', 'total_pages']) {
    if (typeof pagination[key] !== 'number') fail(`pagination.${key} is not a number`);
  }
}

/** Shape checks return a short success reason or throw with the failure. */
export function assertAccountShape(json) {
  const data = isObject(json) ? json.data : undefined;
  if (!isObject(data)) fail('missing data object');
  if (!isObject(data.organization)) fail('missing data.organization');
  if (!Number.isFinite(data.organization.id) || data.organization.id <= 0) fail('data.organization.id is not a positive number');
  if (typeof data.organization.name !== 'string') fail('data.organization.name is not a string');
  if (!isObject(data.user) || !['api_key', 'oauth'].includes(data.user.authType)) {
    fail('missing data.user.authType');
  }
  if (!isObject(data.plan)) fail('missing data.plan');
  return `organization ${data.organization.id}, auth ${data.user.authType}`;
}

function assertCatalogShape(json, idKey, extraCheck) {
  if (!isObject(json) || !Array.isArray(json.data)) fail('missing data array');
  if (json.data.length === 0) fail('data array is empty');
  for (const item of json.data) {
    if (!isObject(item) || typeof item[idKey] !== 'string') fail(`item without string ${idKey}`);
    if (typeof item.name !== 'string') fail(`${item[idKey]} has no name`);
    extraCheck?.(item);
  }
  checkPagination(json.pagination);
  return `${json.data.length} of ${json.pagination.total_results} returned`;
}

export function assertFiltersShape(json) {
  return assertCatalogShape(json, 'filter_id', (item) => {
    if (!Array.isArray(item.allowed_operators)) {
      fail(`${item.filter_id} has no allowed_operators array`);
    }
  });
}

export function assertFieldsShape(json) {
  return assertCatalogShape(json, 'field_id');
}

export function assertEstimateShape(json) {
  if (!isObject(json)) fail('response is not an object');
  if ('data' in json || 'credits' in json) fail('response contains records or charged credits');
  const estimate = json.estimated_credits;
  if (!isObject(estimate)) fail('missing estimated_credits');
  if (!Number.isFinite(estimate.this_page) || estimate.this_page < 0) fail('estimated_credits.this_page is not a nonnegative number');
  if (!Number.isFinite(estimate.total_all_pages) || estimate.total_all_pages < 0) {
    fail('estimated_credits.total_all_pages is not a nonnegative number');
  }
  if (!isObject(json.totals) || !Number.isFinite(json.totals.properties) || json.totals.properties < 0) {
    fail('missing totals.properties');
  }
  checkPagination(json.pagination);
  return `${json.totals.properties} properties, ${estimate.this_page} credits estimated for page 1`;
}
