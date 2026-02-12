/**
 * Configuration file management for DealMachine CLI
 * Stores credentials in ~/.dealmachine/config.json
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

export type ApiEnvironment = 'local' | 'production';

export interface DealMachineConfig {
  apiKey: string;
  keyId: string;
  organizationId: number;
  organizationName: string;
  organizationSlug: string;
  /** API environment to target (local, production). Defaults to production. */
  apiEnvironment?: ApiEnvironment;
}

const CONFIG_DIR = path.join(os.homedir(), '.dealmachine');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

function ensureConfigDir(): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { mode: 0o700 });
  }
}

export function readConfig(): DealMachineConfig | null {
  try {
    if (!fs.existsSync(CONFIG_FILE)) {
      return null;
    }
    const content = fs.readFileSync(CONFIG_FILE, 'utf-8');
    return JSON.parse(content) as DealMachineConfig;
  } catch {
    return null;
  }
}

export function writeConfig(config: DealMachineConfig): void {
  ensureConfigDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), {
    mode: 0o600,
    encoding: 'utf-8',
  });
}

export function deleteConfig(): boolean {
  try {
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
