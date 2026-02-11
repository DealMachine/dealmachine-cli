/**
 * Account command - Show account details
 */

import chalk from 'chalk';
import { apiRequest, formatDate } from '../lib/client.js';

interface AccountResponse {
  organization: {
    id: number;
    name: string;
    createdAt: string;
  };
  user: {
    id: number | null;
    authType: 'api_key' | 'oauth';
  };
}

export async function account(): Promise<void> {
  const data = await apiRequest<AccountResponse>('/account');

  console.log();
  console.log(chalk.bold('Account'));
  console.log(chalk.dim('─'.repeat(40)));
  console.log(`${chalk.cyan('Organization:')}  ${data.organization.name}`);
  console.log(`${chalk.cyan('Org ID:')}        ${data.organization.id}`);
  console.log(`${chalk.cyan('Created:')}       ${formatDate(data.organization.createdAt)}`);
  console.log(`${chalk.cyan('Auth Type:')}     ${data.user.authType}`);
  console.log();
}
