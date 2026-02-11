/**
 * Login command - Device auth flow
 */

import chalk from 'chalk';
import ora from 'ora';
import open from 'open';
import { writeConfig, readConfig } from '../lib/config.js';
import { requestDeviceCode, pollForToken } from '../lib/api.js';

const CLIENT_ID = 'atlas-cli';

interface LoginOptions {
  noBrowser?: boolean;
}

export async function login(options: LoginOptions): Promise<void> {
  const existingConfig = readConfig();
  if (existingConfig) {
    console.log(chalk.yellow('You are already logged in as:'));
    console.log(`  Organization: ${chalk.cyan(existingConfig.organizationName)}`);
    console.log('');
    console.log(`Run ${chalk.cyan('atlas logout')} first to switch accounts.`);
    return;
  }

  const hostname = process.env.HOSTNAME || process.env.COMPUTERNAME || 'CLI';

  const spinner = ora('Requesting device code...').start();

  let deviceCode: Awaited<ReturnType<typeof requestDeviceCode>>;
  try {
    deviceCode = await requestDeviceCode(CLIENT_ID, hostname);
    spinner.stop();
  } catch (error) {
    spinner.fail('Failed to request device code');
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(chalk.red(`Error: ${message}`));
    process.exit(1);
  }

  console.log('');
  console.log(chalk.bold('To complete authentication:'));
  console.log('');
  console.log(`  1. Visit: ${chalk.cyan(deviceCode.verification_uri)}`);
  console.log(`  2. Enter code: ${chalk.bold.yellow(deviceCode.user_code)}`);
  console.log('');

  if (!options.noBrowser) {
    console.log(chalk.dim('Opening browser...'));
    try {
      await open(deviceCode.verification_uri_complete);
    } catch {
      console.log(chalk.dim('(Could not open browser automatically)'));
    }
  }

  const pollSpinner = ora('Waiting for authorization...').start();

  let interval = deviceCode.interval * 1000;
  const maxTime = deviceCode.expires_in * 1000;
  const startTime = Date.now();

  while (Date.now() - startTime < maxTime) {
    const result = await pollForToken(deviceCode.device_code, CLIENT_ID);

    switch (result.status) {
      case 'success':
        pollSpinner.stop();

        writeConfig({
          apiKey: result.data.api_key,
          keyId: result.data.key_id,
          organizationId: result.data.organization.id,
          organizationName: result.data.organization.name,
          organizationSlug: result.data.organization.slug,
        });

        console.log('');
        console.log(chalk.green('Successfully authenticated!'));
        console.log('');
        console.log(`  Organization: ${chalk.cyan(result.data.organization.name)}`);
        console.log('');
        console.log(`Run ${chalk.cyan('atlas whoami')} to verify your credentials.`);
        return;

      case 'pending':
        break;

      case 'slow_down':
        interval += 5000;
        break;

      case 'denied':
        pollSpinner.fail('Authorization denied');
        console.log(chalk.red(`\nThe authorization request was denied.`));
        process.exit(1);
        break;

      case 'expired':
        pollSpinner.fail('Code expired');
        console.log(chalk.red(`\nThe device code has expired. Please try again.`));
        process.exit(1);
        break;

      case 'error':
        pollSpinner.fail('Error');
        console.log(chalk.red(`\nError: ${result.message}`));
        process.exit(1);
        break;
    }

    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  pollSpinner.fail('Timed out');
  console.log(chalk.red('\nAuthentication timed out. Please try again.'));
  process.exit(1);
}
