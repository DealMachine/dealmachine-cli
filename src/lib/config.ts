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

interface PersistedConfig extends Omit<DealMachineConfig, 'apiKey'> {
  apiKey?: string;
  configVersion?: number;
  credentialStore?: CredentialStore;
  credentialService?: string;
  credentialAccount?: string;
  credentialFile?: string;
}

interface StoredCredentialRef {
  credentialStore: CredentialStore;
  credentialService?: string;
  credentialAccount?: string;
  credentialFile?: string;
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

function tryStoreInMacosKeychain(apiKey: string): StoredCredentialRef | null {
  if (process.platform !== 'darwin' || !fs.existsSync('/usr/bin/security')) {
    return null;
  }

  try {
    run('/usr/bin/security', [
      'add-generic-password',
      '-a',
      MACOS_KEYCHAIN_ACCOUNT,
      '-s',
      MACOS_KEYCHAIN_SERVICE,
      '-w',
      apiKey,
      '-U',
    ]);
    return {
      credentialStore: 'macos-keychain',
      credentialService: MACOS_KEYCHAIN_SERVICE,
      credentialAccount: MACOS_KEYCHAIN_ACCOUNT,
    };
  } catch {
    return null;
  }
}

function readFromMacosKeychain(config: PersistedConfig): string | null {
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

function deleteFromMacosKeychain(config: PersistedConfig): void {
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

function tryStoreWithWindowsDpapi(apiKey: string): StoredCredentialRef | null {
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
    fs.writeFileSync(ENCRYPTED_CREDENTIAL_FILE, encrypted, { mode: 0o600, encoding: 'utf-8' });
    return { credentialStore: 'windows-dpapi', credentialFile: ENCRYPTED_CREDENTIAL_FILE };
  } catch {
    return null;
  }
}

function readWithWindowsDpapi(config: PersistedConfig): string | null {
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

function storeEncryptedFile(apiKey: string): StoredCredentialRef {
  const iv = randomBytes(AES_IV_BYTES);
  const cipher = createCipheriv(AES_ALGORITHM, fallbackEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(apiKey, 'utf-8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const payload = Buffer.concat([iv, encrypted, authTag]).toString('base64');

  fs.writeFileSync(ENCRYPTED_CREDENTIAL_FILE, payload, { mode: 0o600, encoding: 'utf-8' });
  return { credentialStore: 'encrypted-file', credentialFile: ENCRYPTED_CREDENTIAL_FILE };
}

function readEncryptedFile(config: PersistedConfig): string | null {
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

function storeApiKey(apiKey: string): StoredCredentialRef {
  return (
    tryStoreInMacosKeychain(apiKey) ||
    tryStoreWithWindowsDpapi(apiKey) ||
    storeEncryptedFile(apiKey)
  );
}

function readStoredApiKey(config: PersistedConfig): string | null {
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

function deleteStoredApiKey(config: PersistedConfig | null): void {
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

function toRuntimeConfig(config: PersistedConfig, apiKey: string): DealMachineConfig {
  return {
    apiKey,
    keyId: config.keyId,
    organizationId: config.organizationId,
    organizationName: config.organizationName,
    organizationSlug: config.organizationSlug || '',
    ...(config.apiEnvironment && { apiEnvironment: config.apiEnvironment }),
  };
}

export function readConfig(): DealMachineConfig | null {
  const persisted = readPersistedConfig();
  if (!persisted) {
    return null;
  }

  const apiKey = readStoredApiKey(persisted);
  if (!apiKey) {
    return null;
  }

  const runtimeConfig = toRuntimeConfig(persisted, apiKey);

  // Migrate legacy plaintext config files the next time they are read.
  if (persisted.apiKey) {
    try {
      writeConfig(runtimeConfig);
    } catch {
      // Keep the current command working even if migration cannot complete.
    }
  }

  return runtimeConfig;
}

export function writeConfig(config: DealMachineConfig): void {
  ensureConfigDir();
  const credentialRef = storeApiKey(config.apiKey);
  const persisted: PersistedConfig = {
    configVersion: 2,
    keyId: config.keyId,
    organizationId: config.organizationId,
    organizationName: config.organizationName,
    organizationSlug: config.organizationSlug || '',
    ...(config.apiEnvironment && { apiEnvironment: config.apiEnvironment }),
    ...credentialRef,
  };

  fs.writeFileSync(CONFIG_FILE, JSON.stringify(persisted, null, 2), {
    mode: 0o600,
    encoding: 'utf-8',
  });
}

export function deleteConfig(): boolean {
  try {
    const persisted = readPersistedConfig();
    deleteStoredApiKey(persisted);
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
  config[key] = value;
  writeConfig(config);
  return true;
}
