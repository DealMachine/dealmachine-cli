/**
 * Configuration file management for DealMachine CLI
 * Stores account metadata in ~/.dealmachine/config.json and API keys in the
 * strongest local credential store available on the current platform.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execFileSync } from 'node:child_process';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

export type ApiEnvironment = 'local' | 'staging' | 'production';
type CredentialStore = 'macos-keychain' | 'windows-dpapi' | 'encrypted-file';

export interface DealMachineConfig {
  apiKey: string;
  keyId: string;
  organizationId: number;
  organizationName: string;
  organizationSlug: string;
  /** API environment to target (local, staging, production). Defaults to production. */
  apiEnvironment?: ApiEnvironment;
}

interface StoredCredentialRef {
  credentialStore: CredentialStore;
  credentialService?: string;
  credentialAccount?: string;
  credentialFile?: string;
}

/** One environment's saved sign-in. The key itself lives in the credential store it names. */
interface StoredProfile extends Partial<StoredCredentialRef> {
  apiKey?: string;
  keyId: string;
  organizationId: number;
  organizationName: string;
  organizationSlug: string;
}

/**
 * The config file. Since APP-22684 it keeps one sign-in per environment in `profiles`, and still
 * writes the current environment's sign-in at the top level in the version 2 layout, so an older
 * CLI or dm-app copy keeps working with whichever environment is current.
 */
interface PersistedConfig extends Partial<StoredProfile> {
  configVersion?: number;
  apiEnvironment?: ApiEnvironment;
  currentEnvironment?: ApiEnvironment;
  profiles?: Partial<Record<ApiEnvironment, StoredProfile>>;
}

interface ConfigStore {
  current?: ApiEnvironment;
  profiles: Partial<Record<ApiEnvironment, StoredProfile>>;
}

export const API_ENVIRONMENTS: readonly ApiEnvironment[] = ['local', 'staging', 'production'];

export function isApiEnvironment(value: unknown): value is ApiEnvironment {
  return typeof value === 'string' && (API_ENVIRONMENTS as readonly string[]).includes(value);
}

const CONFIG_DIR = path.join(os.homedir(), '.dealmachine');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const ENCRYPTED_CREDENTIAL_FILE = path.join(CONFIG_DIR, 'api-key.enc');
const MACOS_KEYCHAIN_SERVICE = 'com.dealmachine.cli.apiKey';
const MACOS_KEYCHAIN_ACCOUNT = 'dealmachine-cli';
const FALLBACK_ENCRYPTION_CONTEXT = 'dealmachine-cli-api-key-v1';
const AES_ALGORITHM = 'aes-256-gcm';
const AES_IV_BYTES = 12;
const AES_AUTH_TAG_BYTES = 16;

function ensureConfigDir(): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { mode: 0o700 });
  }
}

function readPersistedConfig(): PersistedConfig | null {
  try {
    if (!fs.existsSync(CONFIG_FILE)) {
      return null;
    }
    const content = fs.readFileSync(CONFIG_FILE, 'utf-8');
    return JSON.parse(content) as PersistedConfig;
  } catch {
    return null;
  }
}

function run(command: string, args: string[], input?: string): string {
  return execFileSync(command, args, {
    input,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'ignore'],
  }).trim();
}

function tryStoreInMacosKeychain(apiKey: string, account: string): StoredCredentialRef | null {
  if (process.platform !== 'darwin' || !fs.existsSync('/usr/bin/security')) {
    return null;
  }

  try {
    run('/usr/bin/security', [
      'add-generic-password',
      '-a',
      account,
      '-s',
      MACOS_KEYCHAIN_SERVICE,
      '-w',
      apiKey,
      '-U',
    ]);
    return {
      credentialStore: 'macos-keychain',
      credentialService: MACOS_KEYCHAIN_SERVICE,
      credentialAccount: account,
    };
  } catch {
    return null;
  }
}

function readFromMacosKeychain(config: Partial<StoredCredentialRef>): string | null {
  if (process.platform !== 'darwin' || !fs.existsSync('/usr/bin/security')) {
    return null;
  }

  try {
    return run('/usr/bin/security', [
      'find-generic-password',
      '-a',
      config.credentialAccount || MACOS_KEYCHAIN_ACCOUNT,
      '-s',
      config.credentialService || MACOS_KEYCHAIN_SERVICE,
      '-w',
    ]);
  } catch {
    return null;
  }
}

function deleteFromMacosKeychain(config: Partial<StoredCredentialRef>): void {
  if (process.platform !== 'darwin' || !fs.existsSync('/usr/bin/security')) {
    return;
  }

  try {
    run('/usr/bin/security', [
      'delete-generic-password',
      '-a',
      config.credentialAccount || MACOS_KEYCHAIN_ACCOUNT,
      '-s',
      config.credentialService || MACOS_KEYCHAIN_SERVICE,
    ]);
  } catch {
    // Missing keychain entries are fine during logout and migration cleanup.
  }
}

function getPowerShellCommand(): string | null {
  if (process.platform !== 'win32') return null;
  return process.env.SystemRoot
    ? path.join(
        process.env.SystemRoot,
        'System32',
        'WindowsPowerShell',
        'v1.0',
        'powershell.exe'
      )
    : 'powershell.exe';
}

function tryStoreWithWindowsDpapi(apiKey: string, file: string): StoredCredentialRef | null {
  const powershell = getPowerShellCommand();
  if (!powershell) return null;

  try {
    const encrypted = run(
      powershell,
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        [
          '$plain = [Console]::In.ReadToEnd()',
          '$secure = ConvertTo-SecureString $plain -AsPlainText -Force',
          'ConvertFrom-SecureString $secure',
        ].join('; '),
      ],
      apiKey
    );
    fs.writeFileSync(file, encrypted, { mode: 0o600, encoding: 'utf-8' });
    return { credentialStore: 'windows-dpapi', credentialFile: file };
  } catch {
    return null;
  }
}

function readWithWindowsDpapi(config: Partial<StoredCredentialRef>): string | null {
  const powershell = getPowerShellCommand();
  if (!powershell || !config.credentialFile || !fs.existsSync(config.credentialFile)) return null;

  try {
    const encrypted = fs.readFileSync(config.credentialFile, 'utf-8');
    return run(
      powershell,
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        [
          '$encrypted = [Console]::In.ReadToEnd()',
          '$secure = ConvertTo-SecureString $encrypted',
          '$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)',
          'try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }',
        ].join('; '),
      ],
      encrypted
    );
  } catch {
    return null;
  }
}

function fallbackEncryptionKey(): Buffer {
  const username = (() => {
    try {
      return os.userInfo().username;
    } catch {
      return 'unknown-user';
    }
  })();

  return createHash('sha256')
    .update([FALLBACK_ENCRYPTION_CONTEXT, username, os.hostname(), CONFIG_DIR].join('\0'))
    .digest();
}

function storeEncryptedFile(apiKey: string, file: string): StoredCredentialRef {
  const iv = randomBytes(AES_IV_BYTES);
  const cipher = createCipheriv(AES_ALGORITHM, fallbackEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(apiKey, 'utf-8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const payload = Buffer.concat([iv, encrypted, authTag]).toString('base64');

  fs.writeFileSync(file, payload, { mode: 0o600, encoding: 'utf-8' });
  return { credentialStore: 'encrypted-file', credentialFile: file };
}

function readEncryptedFile(config: Partial<StoredCredentialRef>): string | null {
  const credentialFile = config.credentialFile || ENCRYPTED_CREDENTIAL_FILE;
  try {
    if (!fs.existsSync(credentialFile)) return null;
    const payload = Buffer.from(fs.readFileSync(credentialFile, 'utf-8'), 'base64');
    const iv = payload.subarray(0, AES_IV_BYTES);
    const authTag = payload.subarray(payload.length - AES_AUTH_TAG_BYTES);
    const encrypted = payload.subarray(AES_IV_BYTES, payload.length - AES_AUTH_TAG_BYTES);
    const decipher = createDecipheriv(AES_ALGORITHM, fallbackEncryptionKey(), iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf-8');
  } catch {
    return null;
  }
}

/**
 * Production keeps the original credential names, so a sign-in saved before APP-22684 stays where
 * every CLI version looks for it. Other environments get their own names, so signing in to one
 * never replaces another's key. If an older sign-in to another environment still holds the
 * original names, production uses its own names too.
 */
function credentialLocation(env: ApiEnvironment, store: ConfigStore): { account: string; file: string } {
  const own = {
    account: `${MACOS_KEYCHAIN_ACCOUNT}:${env}`,
    file: path.join(CONFIG_DIR, `api-key-${env}.enc`),
  };
  if (env !== 'production') return own;
  const heldByOther = API_ENVIRONMENTS.some((other) => {
    const profile = other === env ? undefined : store.profiles[other];
    if (!profile) return false;
    return profile.credentialStore === 'macos-keychain'
      ? (profile.credentialAccount || MACOS_KEYCHAIN_ACCOUNT) === MACOS_KEYCHAIN_ACCOUNT
      : (profile.credentialFile || ENCRYPTED_CREDENTIAL_FILE) === ENCRYPTED_CREDENTIAL_FILE;
  });
  return heldByOther ? own : { account: MACOS_KEYCHAIN_ACCOUNT, file: ENCRYPTED_CREDENTIAL_FILE };
}

function storeApiKey(apiKey: string, env: ApiEnvironment, store: ConfigStore): StoredCredentialRef {
  const { account, file } = credentialLocation(env, store);
  return (
    tryStoreInMacosKeychain(apiKey, account) ||
    tryStoreWithWindowsDpapi(apiKey, file) ||
    storeEncryptedFile(apiKey, file)
  );
}

function readStoredApiKey(config: Partial<StoredProfile>): string | null {
  switch (config.credentialStore) {
    case 'macos-keychain':
      return readFromMacosKeychain(config);
    case 'windows-dpapi':
      return readWithWindowsDpapi(config);
    case 'encrypted-file':
      return readEncryptedFile(config);
    default:
      return config.apiKey || null;
  }
}

function deleteStoredApiKey(config: Partial<StoredCredentialRef> | null | undefined): void {
  if (!config) return;

  if (config.credentialStore === 'macos-keychain') {
    deleteFromMacosKeychain(config);
  }

  const credentialFile =
    config.credentialStore === 'windows-dpapi' || config.credentialStore === 'encrypted-file'
      ? config.credentialFile
      : undefined;
  if (credentialFile && fs.existsSync(credentialFile)) {
    try {
      fs.unlinkSync(credentialFile);
    } catch {
      // Leave logout best-effort. The main config file still gets removed below.
    }
  }
}

function profileFromFlat(config: Partial<StoredProfile>): StoredProfile | null {
  if (!config.keyId && !config.apiKey && !config.credentialStore) return null;
  return {
    ...(config.apiKey && { apiKey: config.apiKey }),
    keyId: config.keyId || '',
    organizationId: config.organizationId ?? 0,
    organizationName: config.organizationName || '',
    organizationSlug: config.organizationSlug || '',
    ...(config.credentialStore && { credentialStore: config.credentialStore }),
    ...(config.credentialService && { credentialService: config.credentialService }),
    ...(config.credentialAccount && { credentialAccount: config.credentialAccount }),
    ...(config.credentialFile && { credentialFile: config.credentialFile }),
  };
}

/** Reads the saved sign-ins. A file from before APP-22684 is one sign-in for its saved environment. */
function readStore(): ConfigStore {
  const persisted = readPersistedConfig();
  if (!persisted) return { profiles: {} };
  if (persisted.profiles) {
    const profiles: ConfigStore['profiles'] = {};
    for (const env of API_ENVIRONMENTS) {
      const profile = persisted.profiles[env];
      if (profile) profiles[env] = profile;
    }
    return {
      current: isApiEnvironment(persisted.currentEnvironment) ? persisted.currentEnvironment : undefined,
      profiles,
    };
  }
  const env = isApiEnvironment(persisted.apiEnvironment) ? persisted.apiEnvironment : 'production';
  const profile = profileFromFlat(persisted);
  return profile ? { current: env, profiles: { [env]: profile } } : { profiles: {} };
}

function writeStore(store: ConfigStore): void {
  const savedEnvironments = API_ENVIRONMENTS.filter((env) => store.profiles[env]);
  if (!savedEnvironments.length) {
    if (fs.existsSync(CONFIG_FILE)) fs.unlinkSync(CONFIG_FILE);
    return;
  }
  ensureConfigDir();
  const current = store.current && store.profiles[store.current] ? store.current : undefined;
  const top = current ? store.profiles[current] : undefined;
  const persisted: PersistedConfig = {
    configVersion: 3,
    ...(top && { ...top, apiEnvironment: current }),
    ...(store.current && { currentEnvironment: store.current }),
    profiles: store.profiles,
  };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(persisted, null, 2), {
    mode: 0o600,
    encoding: 'utf-8',
  });
}

/** The environment `DM_ENV` or `DEALMACHINE_ENVIRONMENT` asks for, if any. */
export function requestedEnvironment(): ApiEnvironment | undefined {
  const value = process.env.DM_ENV || process.env.DEALMACHINE_ENVIRONMENT;
  return isApiEnvironment(value) ? value : undefined;
}

function resolveEnvironment(store: ConfigStore): ApiEnvironment | undefined {
  const requested = requestedEnvironment();
  if (requested) return requested;
  if (store.current && store.profiles[store.current]) return store.current;
  const saved = savedEnvironmentsIn(store);
  return saved.length === 1 ? saved[0] : store.current;
}

function savedEnvironmentsIn(store: ConfigStore): ApiEnvironment[] {
  return API_ENVIRONMENTS.filter((env) => store.profiles[env]);
}

/**
 * The environment commands use: the one `DM_ENV` asks for, else the one signed in to or chosen
 * most recently, else the only saved sign-in.
 */
export function activeEnvironment(): ApiEnvironment | undefined {
  return resolveEnvironment(readStore());
}

/** Every environment with a saved sign-in. */
export function savedEnvironments(): ApiEnvironment[] {
  return savedEnvironmentsIn(readStore());
}

/** The command that signs in to the environment commands would use now. */
export function loginCommand(program = 'dm'): string {
  const env = requestedEnvironment();
  return env ? `${program} login --env ${env}` : `${program} login`;
}

/** Why there is no sign-in to use, naming the environment when one was asked for. */
export function notSignedInMessage(program = 'dm'): string {
  const env = requestedEnvironment();
  return env
    ? `Not signed in to ${env}. Run \`${loginCommand(program)}\` first.`
    : `Not logged in. Run \`${loginCommand(program)}\` first.`;
}

function toRuntimeConfig(profile: StoredProfile, env: ApiEnvironment, apiKey: string): DealMachineConfig {
  return {
    apiKey,
    keyId: profile.keyId,
    organizationId: profile.organizationId,
    organizationName: profile.organizationName,
    organizationSlug: profile.organizationSlug || '',
    apiEnvironment: env,
  };
}

/** The sign-in for the environment commands use now, or null when it has none. */
export function readConfig(): DealMachineConfig | null {
  const store = readStore();
  const env = resolveEnvironment(store);
  const profile = env ? store.profiles[env] : undefined;
  if (!env || !profile) {
    return null;
  }

  const apiKey = readStoredApiKey(profile);
  if (!apiKey) {
    return null;
  }

  const runtimeConfig = toRuntimeConfig(profile, env, apiKey);

  // Migrate legacy plaintext config files the next time they are read.
  if (profile.apiKey) {
    try {
      saveProfile(store, env, runtimeConfig, false);
    } catch {
      // Keep the current command working even if migration cannot complete.
    }
  }

  return runtimeConfig;
}

function sameCredential(a: Partial<StoredCredentialRef>, b: Partial<StoredCredentialRef>): boolean {
  return (
    a.credentialStore === b.credentialStore &&
    (a.credentialAccount || MACOS_KEYCHAIN_ACCOUNT) === (b.credentialAccount || MACOS_KEYCHAIN_ACCOUNT) &&
    (a.credentialService || MACOS_KEYCHAIN_SERVICE) === (b.credentialService || MACOS_KEYCHAIN_SERVICE) &&
    a.credentialFile === b.credentialFile
  );
}

function saveProfile(
  store: ConfigStore,
  env: ApiEnvironment,
  config: DealMachineConfig,
  makeCurrent: boolean
): void {
  ensureConfigDir();
  const previous = store.profiles[env];
  const credentialRef = storeApiKey(config.apiKey, env, store);
  store.profiles[env] = {
    keyId: config.keyId,
    organizationId: config.organizationId,
    organizationName: config.organizationName,
    organizationSlug: config.organizationSlug || '',
    ...credentialRef,
  };
  if (makeCurrent || !store.current) store.current = env;
  writeStore(store);
  // A sign-in saved before APP-22684 may name the shared credential; drop it once replaced, unless
  // another environment still uses it.
  if (
    previous &&
    !sameCredential(previous, credentialRef) &&
    !API_ENVIRONMENTS.some(
      (other) => other !== env && store.profiles[other] && sameCredential(store.profiles[other]!, previous)
    )
  ) {
    deleteStoredApiKey(previous);
  }
}

/**
 * Saves a sign-in for `config.apiEnvironment` (or the environment commands use now) and makes it
 * the current one. Sign-ins to other environments are kept.
 */
export function writeConfig(config: DealMachineConfig): void {
  const store = readStore();
  const env = config.apiEnvironment ?? requestedEnvironment() ?? resolveEnvironment(store) ?? 'production';
  saveProfile(store, env, config, true);
}

/** Makes `env` the environment commands use when none is asked for. */
export function selectEnvironment(env: ApiEnvironment): void {
  const store = readStore();
  store.current = env;
  writeStore(store);
}

/**
 * Signs out of one environment and keeps the others. When exactly one sign-in is left, commands
 * use it. Returns false when that environment had no sign-in.
 */
export function deleteEnvironmentConfig(env: ApiEnvironment): boolean {
  try {
    const store = readStore();
    const profile = store.profiles[env];
    if (!profile) return false;
    delete store.profiles[env];
    if (
      !API_ENVIRONMENTS.some((other) => store.profiles[other] && sameCredential(store.profiles[other]!, profile))
    ) {
      deleteStoredApiKey(profile);
    }
    if (store.current === env) {
      const left = savedEnvironmentsIn(store);
      store.current = left.length === 1 ? left[0] : undefined;
    }
    writeStore(store);
    return true;
  } catch {
    return false;
  }
}

/** Signs out of every environment. */
export function deleteConfig(): boolean {
  try {
    const persisted = readPersistedConfig();
    const store = readStore();
    for (const env of API_ENVIRONMENTS) deleteStoredApiKey(store.profiles[env]);
    if (persisted) deleteStoredApiKey(persisted);
    if (fs.existsSync(CONFIG_FILE)) {
      fs.unlinkSync(CONFIG_FILE);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function getConfigPath(): string {
  return CONFIG_FILE;
}

export function configExists(): boolean {
  return fs.existsSync(CONFIG_FILE);
}

export function getConfigValue<K extends keyof DealMachineConfig>(key: K): DealMachineConfig[K] | null {
  const config = readConfig();
  return config ? config[key] : null;
}

export function setConfigValue<K extends keyof DealMachineConfig>(
  key: K,
  value: DealMachineConfig[K]
): boolean {
  const config = readConfig();
  if (!config) {
    return false;
  }
  if (key === 'apiEnvironment') {
    // Choosing an environment switches which saved sign-in commands use. It never moves a key
    // from one environment to another.
    if (!isApiEnvironment(value)) return false;
    selectEnvironment(value);
    return true;
  }
  config[key] = value;
  writeConfig(config);
  return true;
}
