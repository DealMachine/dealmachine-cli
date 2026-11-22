/**
 * Logout command - Remove stored credentials
 */

import chalk from 'chalk';
import {
  activeEnvironment,
  deleteConfig,
  deleteEnvironmentConfig,
  getConfigPath,
  readConfig,
  savedEnvironments,
} from '../lib/config.js';

interface LogoutOptions {
  /** Sign out of every environment instead of only the current one. */
  all?: boolean;
}

export async function logout(options: LogoutOptions = {}): Promise<void> {
  if (options.all) {
    const saved = savedEnvironments();
    if (!saved.length) {
      console.log(chalk.yellow('You are not currently logged in.'));
      return;
    }
    if (!deleteConfig()) {
      console.log(chalk.red('Failed to remove credentials.'));
      console.log(`Try manually deleting: ${getConfigPath()}`);
      process.exit(1);
    }
    console.log(chalk.green(`Logged out of ${saved.join(', ')}.`));
    console.log(chalk.dim(`Removed credentials from ${getConfigPath()}`));
    return;
  }

  const config = readConfig();
  const env = activeEnvironment();

  if (!config || !env) {
    console.log(chalk.yellow(env ? `You are not logged in to ${env}.` : 'You are not currently logged in.'));
    return;
  }

  if (!deleteEnvironmentConfig(env)) {
    console.log(chalk.red('Failed to remove credentials.'));
    console.log(`Try manually deleting: ${getConfigPath()}`);
    process.exit(1);
  }

  console.log(chalk.green(`Logged out of ${env} from ${chalk.cyan(config.organizationName)}.`));
  const left = savedEnvironments();
  if (left.length) {
    console.log(chalk.dim(`Still logged in to ${left.join(', ')}. Run dm logout --all to sign out everywhere.`));
  } else {
    console.log(chalk.dim(`Removed credentials from ${getConfigPath()}`));
  }
}
