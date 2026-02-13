/**
 * Whoami command - Show current authentication status
 */

import chalk from 'chalk';
import ora from 'ora';
import { readConfig, getConfigPath } from '../lib/config.js';
import { verifyCredentials } from '../lib/api.js';

interface WhoamiOptions {
  verify?: boolean;
}

export async function whoami(options: WhoamiOptions): Promise<void> {
  const config = readConfig();

  if (!config) {
    console.log(chalk.yellow('Not logged in.'));
    console.log('');
    console.log(`Run ${chalk.cyan('dm login')} to authenticate.`);
    process.exit(1);
  }

  console.log(chalk.bold('Current authentication:'));
  console.log('');
  console.log(`  Organization: ${chalk.cyan(config.organizationName)} (${config.organizationSlug})`);
  console.log(`  Org ID:       ${chalk.dim(String(config.organizationId))}`);
  console.log(`  API Key:      ${chalk.dim(config.apiKey.slice(0, 20) + '...')}`);
  console.log(`  Key ID:       ${chalk.dim(config.keyId)}`);
  console.log('');
  console.log(chalk.dim(`Config file: ${getConfigPath()}`));

  if (options.verify) {
    console.log('');
    const spinner = ora('Verifying credentials...').start();

    const result = await verifyCredentials(config.apiKey);

    if (result.valid) {
      spinner.succeed('Credentials are valid');
    } else {
      spinner.fail('Credentials are invalid or expired');
      console.log('');
      console.log(chalk.red('Your API key may have been revoked.'));
      console.log(`Run ${chalk.cyan('dm logout && dm login')} to re-authenticate.`);
      process.exit(1);
    }
  }
}
