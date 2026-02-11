/**
 * Logout command - Remove stored credentials
 */

import chalk from 'chalk';
import { deleteConfig, readConfig, getConfigPath } from '../lib/config.js';

export async function logout(): Promise<void> {
  const config = readConfig();

  if (!config) {
    console.log(chalk.yellow('You are not currently logged in.'));
    return;
  }

  const orgName = config.organizationName;
  const deleted = deleteConfig();

  if (deleted) {
    console.log(chalk.green(`Logged out from ${chalk.cyan(orgName)}.`));
    console.log(chalk.dim(`Removed credentials from ${getConfigPath()}`));
  } else {
    console.log(chalk.red('Failed to remove credentials.'));
    console.log(`Try manually deleting: ${getConfigPath()}`);
    process.exit(1);
  }
}
