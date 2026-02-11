#!/usr/bin/env node

import { Command } from 'commander';
import { login } from './commands/login.js';
import { logout } from './commands/logout.js';
import { whoami } from './commands/whoami.js';
import { configGet, configSet, configPath } from './commands/config.js';
import { account } from './commands/account.js';

const program = new Command();

program
  .name('atlas')
  .description('Atlas CLI - DealMachine developer tools')
  .version('0.1.0');

// Auth commands
program
  .command('login')
  .description('Authenticate with your DealMachine account')
  .option('--no-browser', 'Do not automatically open the browser')
  .action(async (options) => {
    await login({ noBrowser: options.browser === false });
  });

program
  .command('logout')
  .description('Remove stored credentials')
  .action(async () => {
    await logout();
  });

program
  .command('whoami')
  .description('Show current authentication status')
  .option('--verify', 'Verify credentials with the API')
  .action(async (options) => {
    await whoami(options);
  });

// Config commands
const configCmd = program
  .command('config')
  .description('View and modify configuration');

configCmd
  .command('get [key]')
  .description('Get a configuration value (or all values)')
  .action(async (key?: string) => {
    await configGet(key);
  });

configCmd
  .command('set <key> <value>')
  .description('Set a configuration value')
  .action(async (key: string, value: string) => {
    await configSet(key, value);
  });

configCmd
  .command('path')
  .description('Show config file path')
  .action(async () => {
    await configPath();
  });

// Account command
program
  .command('account')
  .description('Show account information')
  .action(async () => {
    await account();
  });

program.parse();
