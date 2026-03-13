/**
 * Signup command — create a DealMachine account from the CLI.
 * Uses raw fetch (no auth) since POST /v1/signup is public.
 */

import chalk from 'chalk';
import ora from 'ora';
import { writeConfig } from '../lib/config.js';
import { getApiBaseUrl } from '../lib/client.js';

interface SignupOptions {
  email: string;
  firstName?: string;
  lastName?: string;
  env?: 'local' | 'production';
}

export async function signup(options: SignupOptions): Promise<void> {
  const baseUrl = getApiBaseUrl();

  const spinner = ora('Creating account...').start();

  const body: Record<string, string> = { email: options.email };
  if (options.firstName) body.first_name = options.firstName;
  if (options.lastName) body.last_name = options.lastName;

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'dm-cli/0.1.0',
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    spinner.fail('Failed to connect to API');
    const message = error instanceof Error ? error.message : 'Network error';
    console.error(chalk.red(`Error: ${message}`));
    process.exit(1);
  }

  if (!response.ok) {
    spinner.fail('Signup failed');
    const error = await response.json().catch(() => ({})) as any;
    console.error(chalk.red(`Error: ${error.error?.message || `Request failed (${response.status})`}`));
    process.exit(1);
  }

  const data = await response.json() as {
    api_key: string;
    key_id: string;
    organization: { id: number; name: string; slug: string };
    message: string;
  };

  spinner.succeed('Account created');

  // Save credentials (same pattern as login.ts)
  writeConfig({
    apiKey: data.api_key,
    keyId: data.key_id,
    organizationId: data.organization.id,
    organizationName: data.organization.name,
    organizationSlug: data.organization.slug,
    ...(options.env && { apiEnvironment: options.env }),
  });

  console.log('');
  console.log(chalk.green('Successfully signed up and logged in!'));
  console.log('');
  console.log(`  Organization: ${chalk.cyan(data.organization.name)}`);
  console.log(`  API Key:      ${chalk.yellow(data.api_key)}`);
  console.log('');
  console.log(chalk.bold.yellow('  Save this API key — it will not be shown again.'));
  console.log('');
  console.log(chalk.dim(data.message));
  console.log('');
  console.log(`Run ${chalk.cyan('dm plans')} to see available subscription plans.`);
}
