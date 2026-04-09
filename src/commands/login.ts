/**
 * Login command - Device auth flow or direct API key
 */

import chalk from 'chalk';
import { createSpinner } from '../lib/output.js';
import open from 'open';
import os from 'os';
import { writeConfig, readConfig, setConfigValue } from '../lib/config.js';
import { requestDeviceCode, pollForToken, verifyCredentials } from '../lib/api.js';
import { getApiBaseUrl } from '../lib/client.js';

const CLIENT_ID = 'dealmachine-next-cli';

interface LoginOptions {
  noBrowser?: boolean;
  key?: string;
  env?: 'local' | 'production';
}

export async function login(options: LoginOptions): Promise<void> {
  const existingConfig = readConfig();
  if (existingConfig) {
    // If --env was passed, just update the environment without requiring logout
    if (options.env) {
      setConfigValue('apiEnvironment', options.env);
      console.log(chalk.green(`Switched to ${chalk.bold(options.env)} environment`));
      console.log(`  API: ${chalk.dim(getApiBaseUrl())}`);
      return;
    }
    console.log(chalk.yellow('You are already logged in as:'));
    console.log(`  Organization: ${chalk.cyan(existingConfig.organizationName)}`);
    console.log('');
    console.log(`Run ${chalk.cyan('dm logout')} first to switch accounts.`);
    return;
  }

  // Direct API key login (for local dev / CI)
  if (options.key) {
    await loginWithKey(options.key, options.env);
    return;
  }

  // Device auth flow (browser-based)
  const hostname = os.hostname().replace(/\.(lan|local|home|localdomain)$/i, '') || 'CLI';

  const spinner = createSpinner('Requesting device code...').start();

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

  // Override verification URLs — API may return localhost in non-prod environments
  const verifyBase = 'https://next.dealmachine.com';
  const verificationUri = `${verifyBase}/device/authorize`;
  const verificationUriComplete = `${verifyBase}/device/authorize?code=${deviceCode.user_code}`;

  console.log('');
  console.log(chalk.bold('To complete authentication:'));
  console.log('');
  console.log(`  1. Visit: ${chalk.cyan(verificationUri)}`);
  console.log(`  2. Enter code: ${chalk.bold.yellow(deviceCode.user_code)}`);
  console.log('');

  if (!options.noBrowser) {
    console.log(chalk.dim('Opening browser...'));
    try {
      await open(verificationUriComplete);
    } catch {
      console.log(chalk.dim('(Could not open browser automatically)'));
    }
  }

  const pollSpinner = createSpinner('Waiting for authorization...').start();

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
          ...(options.env && { apiEnvironment: options.env }),
        });

        console.log('');
        console.log(chalk.green('Successfully authenticated!'));
        console.log('');
        console.log(`  Organization: ${chalk.cyan(result.data.organization.name)}`);
        console.log('');
        console.log(`Run ${chalk.cyan('dm whoami')} to verify your credentials.`);
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

/**
 * Login with a raw API key (skips browser flow).
 * Verifies the key against the API, then stores it.
 */
async function loginWithKey(apiKey: string, env?: 'local' | 'production'): Promise<void> {
  const baseUrl = getApiBaseUrl();
  console.log(chalk.dim(`Verifying key against ${baseUrl}...`));

  const spinner = createSpinner('Verifying API key...').start();
  const result = await verifyCredentials(apiKey);

  if (!result.valid || !result.organization) {
    spinner.fail('Invalid API key');
    console.error(chalk.red('\nThe API key could not be verified.'));
    console.log(chalk.dim(`Checked: ${baseUrl}`));
    process.exit(1);
  }

  spinner.succeed('API key verified');

  writeConfig({
    apiKey,
    keyId: 'manual',
    organizationId: result.organization.id,
    organizationName: result.organization.name,
    organizationSlug: '',
    ...(env && { apiEnvironment: env }),
  });

  console.log('');
  console.log(chalk.green('Successfully authenticated!'));
  console.log('');
  console.log(`  Organization: ${chalk.cyan(result.organization.name)}`);
  console.log(`  API:          ${chalk.dim(baseUrl)}`);
  console.log('');
}
