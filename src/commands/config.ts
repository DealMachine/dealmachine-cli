/**
 * Config command - View and modify configuration
 */

import chalk from 'chalk';
import { readConfig, getConfigPath, setConfigValue, type DealMachineConfig, type ApiEnvironment } from '../lib/config.js';

type ConfigKey = keyof DealMachineConfig;

const EDITABLE_KEYS: ConfigKey[] = ['apiEnvironment'];
const ALL_KEYS: ConfigKey[] = [
  'organizationName',
  'organizationSlug',
  'organizationId',
  'apiEnvironment',
  'keyId',
  'apiKey',
];

const VALID_API_ENVIRONMENTS: ApiEnvironment[] = ['local', 'production'];

export async function configGet(key?: string): Promise<void> {
  const config = readConfig();

  if (!config) {
    console.log(chalk.yellow('Not logged in. No configuration to show.'));
    console.log(`Run ${chalk.cyan('dm login')} to authenticate.`);
    process.exit(1);
  }

  if (key) {
    if (!ALL_KEYS.includes(key as ConfigKey)) {
      console.log(chalk.red(`Unknown config key: ${key}`));
      console.log(`Available keys: ${ALL_KEYS.join(', ')}`);
      process.exit(1);
    }

    const value = config[key as ConfigKey];

    if (value === undefined) {
      console.log(chalk.dim('(not set)'));
    } else if (key === 'apiKey') {
      console.log(value.toString().slice(0, 20) + '...');
    } else {
      console.log(value);
    }
  } else {
    console.log(chalk.bold('Current configuration:'));
    console.log('');
    console.log(`  ${chalk.dim('organizationName')}: ${config.organizationName}`);
    console.log(`  ${chalk.dim('organizationSlug')}: ${config.organizationSlug}`);
    console.log(`  ${chalk.dim('organizationId')}:   ${config.organizationId}`);
    console.log(`  ${chalk.dim('apiEnvironment')}:   ${config.apiEnvironment || 'production (default)'}`);
    console.log(`  ${chalk.dim('keyId')}:            ${config.keyId}`);
    console.log(`  ${chalk.dim('apiKey')}:           ${config.apiKey.slice(0, 20)}...`);
    console.log('');
    console.log(chalk.dim(`Config file: ${getConfigPath()}`));
  }
}

export async function configSet(key: string, value: string): Promise<void> {
  const config = readConfig();

  if (!config) {
    console.log(chalk.yellow('Not logged in. No configuration to modify.'));
    console.log(`Run ${chalk.cyan('dm login')} to authenticate.`);
    process.exit(1);
  }

  if (!EDITABLE_KEYS.includes(key as ConfigKey)) {
    console.log(chalk.red(`Cannot modify key: ${key}`));
    console.log(`Editable keys: ${EDITABLE_KEYS.join(', ')}`);
    process.exit(1);
  }

  if (key === 'apiEnvironment') {
    if (!VALID_API_ENVIRONMENTS.includes(value as ApiEnvironment)) {
      console.log(chalk.red(`API environment must be one of: ${VALID_API_ENVIRONMENTS.join(', ')}`));
      process.exit(1);
    }
  }

  const success = setConfigValue(key as ConfigKey, value as DealMachineConfig[ConfigKey]);

  if (success) {
    console.log(chalk.green(`Set ${key} = ${value}`));
  } else {
    console.log(chalk.red('Failed to update configuration'));
    process.exit(1);
  }
}

export async function configPath(): Promise<void> {
  console.log(getConfigPath());
}
