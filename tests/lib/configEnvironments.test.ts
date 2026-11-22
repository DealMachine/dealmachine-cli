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
  afterAll(() => fs.rmSync(home, { recursive: true, force: true }));

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
