import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

// A real config directory in a throwaway home, so these tests read and write the same files the
// CLI does. The OS keychain is replaced by an in-memory one, so no test touches a real sign-in.
const home = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'dm-cli-env-'));
const keychain = new Map<string, string>();

vi.mock('node:os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:os')>();
  return { ...actual, homedir: () => home };
});
vi.mock('node:child_process', () => ({
  execFileSync: vi.fn((command: string, args: string[]) => {
    if (command !== '/usr/bin/security') throw new Error('credential store unavailable');
    const flag = (name: string) => args[args.indexOf(name) + 1];
    const id = `${flag('-s')}|${flag('-a')}`;
    if (args[0] === 'add-generic-password') {
      keychain.set(id, flag('-w'));
      return '';
    }
    if (args[0] === 'find-generic-password') {
      const value = keychain.get(id);
      if (value === undefined) throw new Error('not found');
      return value;
    }
    if (args[0] === 'delete-generic-password') {
      keychain.delete(id);
      return '';
    }
    throw new Error('unexpected security call');
  }),
}));

const {
  activeEnvironment,
  deleteEnvironmentConfig,
  selectEnvironment,
  readConfig,
  savedEnvironments,
  writeConfig,
} = await import('../../src/lib/config');
const { getApiKey } = await import('../../src/lib/client');
const { login } = await import('../../src/commands/login');
const { logout } = await import('../../src/commands/logout');

const CONFIG_DIR = path.join(home, '.dealmachine');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

const account = (name: string, apiKey: string, apiEnvironment?: 'staging' | 'production') => ({
  apiKey,
  keyId: `key_${name}`,
  organizationId: 145,
  organizationName: `${name} workspace`,
  organizationSlug: name,
  ...(apiEnvironment && { apiEnvironment }),
});

/** Signs in through `dm login --key`, answering the key check the way the API does. */
async function signIn(env: 'staging' | 'production', apiKey: string) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      new Response(JSON.stringify({ data: { organization: { id: 145, name: `${env} workspace`, slug: env } } }), {
        status: 200,
      })
    )
  );
  process.env.DM_ENV = env;
  await login({ key: apiKey, env });
  delete process.env.DM_ENV;
}

function withEnv<T>(env: string | undefined, run: () => T): T {
  if (env === undefined) delete process.env.DM_ENV;
  else process.env.DM_ENV = env;
  try {
    return run();
  } finally {
    delete process.env.DM_ENV;
  }
}

// File level, so every describe block below still has the throwaway home.
afterAll(() => fs.rmSync(home, { recursive: true, force: true }));

describe('one saved sign-in per environment (APP-22684)', () => {
  beforeEach(() => {
    fs.rmSync(CONFIG_DIR, { recursive: true, force: true });
    keychain.clear();
    delete process.env.DM_ENV;
    delete process.env.DEALMACHINE_ENVIRONMENT;
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('AC-1: signing in to production keeps the staging sign-in', async () => {
    await signIn('staging', 'dm_sk_test_staging');
    await signIn('production', 'dm_sk_live_production');

    expect(savedEnvironments()).toEqual(['staging', 'production']);
    expect(withEnv('staging', () => readConfig()?.apiKey)).toBe('dm_sk_test_staging');
  });

  it('AC-2: each command uses the sign-in for the environment it asks for', async () => {
    await signIn('staging', 'dm_sk_test_staging');
    await signIn('production', 'dm_sk_live_production');

    expect(withEnv('production', () => getApiKey())).toBe('dm_sk_live_production');
    expect(withEnv('staging', () => getApiKey())).toBe('dm_sk_test_staging');
    // Without a choice, commands use the environment signed in to most recently.
    expect(withEnv(undefined, () => readConfig()?.apiEnvironment)).toBe('production');
  });

  it('AC-3: a command for an environment with no sign-in stops and says how to sign in', async () => {
    await signIn('staging', 'dm_sk_test_staging');
    vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`exit ${code}`);
    }) as never);

    expect(() => withEnv('production', () => getApiKey())).toThrow('exit 1');
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Not signed in to production. Run `dm login --env production` first.')
    );
  });

  it('AC-3: login for an environment that has no sign-in starts a new sign-in instead of switching', async () => {
    await signIn('staging', 'dm_sk_test_staging');
    // Before APP-22684 this only switched the environment and kept the staging key.
    await signIn('production', 'dm_sk_live_production');

    expect(withEnv('production', () => readConfig()?.apiKey)).toBe('dm_sk_live_production');
  });

  it('AC-4: a sign-in saved before this update keeps working without signing in again', () => {
    // The version 2 layout an earlier CLI wrote, with its key in the shared credential slot.
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
    keychain.set('com.dealmachine.cli.apiKey|dealmachine-cli', 'dm_sk_test_old_staging');
    const legacy = {
      configVersion: 2,
      keyId: 'key_old',
      organizationId: 145,
      organizationName: 'Old workspace',
      organizationSlug: 'old',
      apiEnvironment: 'staging',
      ...(process.platform === 'darwin'
        ? { credentialStore: 'macos-keychain', credentialService: 'com.dealmachine.cli.apiKey', credentialAccount: 'dealmachine-cli' }
        : { credentialStore: 'encrypted-file', credentialFile: path.join(CONFIG_DIR, 'api-key.enc') }),
    };
    if (process.platform !== 'darwin') {
      // Write the legacy key with the CLI's own encrypted-file format.
      writeConfig(account('old', 'dm_sk_test_old_staging', 'staging'));
      const saved = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      Object.assign(legacy, { credentialFile: saved.credentialFile });
    }
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(legacy));

    expect(readConfig()).toMatchObject({ apiKey: 'dm_sk_test_old_staging', apiEnvironment: 'staging' });
    expect(activeEnvironment()).toBe('staging');
  });

  it('AC-4: signing in to production after an old staging sign-in keeps both keys', async () => {
    if (process.platform !== 'darwin') return;
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
    keychain.set('com.dealmachine.cli.apiKey|dealmachine-cli', 'dm_sk_test_old_staging');
    fs.writeFileSync(
      CONFIG_FILE,
      JSON.stringify({
        configVersion: 2,
        keyId: 'key_old',
        organizationId: 145,
        organizationName: 'Old workspace',
        organizationSlug: 'old',
        apiEnvironment: 'staging',
        credentialStore: 'macos-keychain',
        credentialService: 'com.dealmachine.cli.apiKey',
        credentialAccount: 'dealmachine-cli',
      })
    );

    await signIn('production', 'dm_sk_live_production');

    expect(withEnv('staging', () => readConfig()?.apiKey)).toBe('dm_sk_test_old_staging');
    expect(withEnv('production', () => readConfig()?.apiKey)).toBe('dm_sk_live_production');
  });

  it('AC-4: an older CLI reading the new file still finds the current sign-in at the top level', async () => {
    await signIn('staging', 'dm_sk_test_staging');
    await signIn('production', 'dm_sk_live_production');

    const saved = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    expect(saved.apiEnvironment).toBe('production');
    expect(saved.keyId).toBe(saved.profiles.production.keyId);
    expect(saved.credentialStore).toBe(saved.profiles.production.credentialStore);
    expect(saved.apiKey).toBeUndefined();
  });

  it('AC-5: signing out of staging keeps the production sign-in', async () => {
    await signIn('staging', 'dm_sk_test_staging');
    await signIn('production', 'dm_sk_live_production');

    process.env.DM_ENV = 'staging';
    await logout();
    delete process.env.DM_ENV;

    expect(savedEnvironments()).toEqual(['production']);
    expect(withEnv('production', () => readConfig()?.apiKey)).toBe('dm_sk_live_production');
    expect(withEnv('staging', () => readConfig())).toBeNull();
  });

  it('logout --all signs out of every environment', async () => {
    await signIn('staging', 'dm_sk_test_staging');
    await signIn('production', 'dm_sk_live_production');

    await logout({ all: true });

    expect(savedEnvironments()).toEqual([]);
    expect(fs.existsSync(CONFIG_FILE)).toBe(false);
    expect([...keychain.keys()]).toEqual([]);
  });

  it('plain login signs in against the same environment it saves the key under', async () => {
    // Sign-ins to production and local, with staging chosen and not signed in to yet.
    await signIn('production', 'dm_sk_live_production');
    writeConfig(account('local', 'dm_sk_test_local', 'local' as 'staging'));
    selectEnvironment('staging');
    const fetch = vi.fn(async (_url: string) =>
      new Response(JSON.stringify({ data: { organization: { id: 145, name: 'staging workspace' } } }), { status: 200 })
    );
    vi.stubGlobal('fetch', fetch);

    await login({ key: 'dm_sk_test_new_staging' });
    delete process.env.DM_ENV;

    expect(String(fetch.mock.calls[0][0])).toContain('api-staging');
    expect(withEnv('staging', () => readConfig()?.apiKey)).toBe('dm_sk_test_new_staging');
    expect(withEnv('production', () => readConfig()?.apiKey)).toBe('dm_sk_live_production');
  });

  it('AC-6: with one sign-in, commands use it without choosing an environment', async () => {
    await signIn('staging', 'dm_sk_test_staging');

    expect(withEnv(undefined, () => getApiKey())).toBe('dm_sk_test_staging');
  });

  it('AC-6: after signing out of the current environment, the one left is used', async () => {
    await signIn('staging', 'dm_sk_test_staging');
    await signIn('production', 'dm_sk_live_production');

    expect(deleteEnvironmentConfig('production')).toBe(true);

    expect(withEnv(undefined, () => readConfig()?.apiKey)).toBe('dm_sk_test_staging');
  });
});

/**
 * A stand-in for the API's sign-in Endpoints. The saved key's check answers with `accountStatus`;
 * the browser sign-in hands back `newKey` on its first poll.
 */
function fakeSignInApi(accountStatus: number | 'offline', newKey = 'dm_sk_test_device_staging') {
  const fetch = vi.fn(async (url: string) => {
    if (url.endsWith('/account')) {
      if (accountStatus === 'offline') throw new TypeError('fetch failed');
      if (accountStatus !== 200) {
        return new Response(JSON.stringify({ error: { code: 'invalid_api_key', message: 'API key has expired' } }), {
          status: accountStatus,
        });
      }
      return new Response(JSON.stringify({ data: { organization: { id: 145, name: 'staging workspace', slug: 'staging' } } }), {
        status: 200,
      });
    }
    if (url.endsWith('/auth/device/code')) {
      return new Response(
        JSON.stringify({
          device_code: 'device-code',
          user_code: 'ABCD-1234',
          verification_uri: 'https://example.test/device',
          verification_uri_complete: 'https://example.test/device?code=ABCD-1234',
          expires_in: 60,
          interval: 0,
        }),
        { status: 200 }
      );
    }
    if (url.endsWith('/auth/device/token')) {
      return new Response(
        JSON.stringify({ api_key: newKey, key_id: 'key_device', organization: { id: 145, name: 'staging workspace', slug: 'staging' } }),
        { status: 200 }
      );
    }
    throw new Error(`unexpected request ${url}`);
  });
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

const requested = (fetch: ReturnType<typeof fakeSignInApi>, suffix: string) =>
  fetch.mock.calls.some(([url]) => String(url).endsWith(suffix));

describe('login replaces a sign-in that no longer works', () => {
  beforeEach(() => {
    fs.rmSync(CONFIG_DIR, { recursive: true, force: true });
    keychain.clear();
    delete process.env.DM_ENV;
    delete process.env.DEALMACHINE_ENVIRONMENT;
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    delete process.env.DM_ENV;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('login --key saves the new key even when the environment already has a sign-in', async () => {
    // Before this fix, an existing staging sign-in made `login --env staging --key` only switch
    // environments, so an expired key could never be replaced without `dm logout` first.
    await signIn('staging', 'dm_sk_test_expired');
    fakeSignInApi(200);

    await login({ key: 'dm_sk_test_replacement', env: 'staging' });

    expect(withEnv('staging', () => readConfig()?.apiKey)).toBe('dm_sk_test_replacement');
  });

  it('login starts a new sign-in when the API rejects the saved key', async () => {
    await signIn('staging', 'dm_sk_test_expired');
    const fetch = fakeSignInApi(401);

    await login({ env: 'staging', noBrowser: true });

    expect(requested(fetch, '/auth/device/code')).toBe(true);
    expect(withEnv('staging', () => readConfig()?.apiKey)).toBe('dm_sk_test_device_staging');
  });

  it('login with a working saved key only switches to it', async () => {
    await signIn('staging', 'dm_sk_test_staging');
    await signIn('production', 'dm_sk_live_production');
    const fetch = fakeSignInApi(200);

    await login({ env: 'staging', noBrowser: true });

    expect(requested(fetch, '/auth/device/code')).toBe(false);
    expect(withEnv(undefined, () => readConfig()?.apiEnvironment)).toBe('staging');
    expect(withEnv('staging', () => readConfig()?.apiKey)).toBe('dm_sk_test_staging');
  });

  it('login keeps the saved key when the API cannot be reached to check it', async () => {
    await signIn('staging', 'dm_sk_test_staging');
    const fetch = fakeSignInApi('offline');

    await login({ env: 'staging', noBrowser: true });

    expect(requested(fetch, '/auth/device/code')).toBe(false);
    expect(withEnv('staging', () => readConfig()?.apiKey)).toBe('dm_sk_test_staging');
  });
});
