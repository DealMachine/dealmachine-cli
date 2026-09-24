/**
 * Tags commands: the prospect tag catalog. Built-in tags are shared and
 * read-only; workspace tags can be created, changed, reordered, and deleted.
 */

import chalk from 'chalk';

import { apiRequest, formatDate } from '../lib/client.js';
import {
  createSpinner,
  printHeader,
  printJson,
  printKeyValue,
  printTable,
  truncate,
} from '../lib/output.js';

type Tag = {
  id: string;
  name: string;
  description: string | null;
  badge_variant: string;
  is_system: boolean;
  is_active: boolean;
  sort_order: number;
  usage_count?: number;
  created_at: string | null;
};

function printTagRows(tags: Tag[]) {
  printTable(
    tags.map((tag) => ({
      id: tag.id,
      name: truncate(tag.name, 30),
      color: tag.badge_variant,
      prospects: String(tag.usage_count ?? 0),
      builtin: tag.is_system ? 'yes' : '',
      active: tag.is_active ? 'yes' : 'no',
    })),
    ['id', 'name', 'color', 'prospects', 'builtin', 'active']
  );
}

export async function tagsList(options: {
  includeInactive?: boolean;
  json?: boolean;
}): Promise<void> {
  const spinner = createSpinner('Fetching tags...').start();
  const data = await apiRequest<{ data: Tag[] }>('/tags', {
    query: { include_inactive: options.includeInactive ? 'true' : undefined },
  });
  spinner.stop();
  if (options.json) {
    printJson(data);
    return;
  }
  printHeader('Tags');
  console.log();
  printTagRows(data.data);
  console.log();
}

export async function tagsGet(id: string, options: { json?: boolean }): Promise<void> {
  const spinner = createSpinner('Fetching tag...').start();
  const data = await apiRequest<{ data: Tag }>(`/tags/${id}`);
  spinner.stop();
  if (options.json) {
    printJson(data);
    return;
  }
  const tag = data.data;
  printHeader(`Tag ${tag.id}`);
  printKeyValue({
    Name: tag.name,
    Description: tag.description ?? '—',
    Color: tag.badge_variant,
    'On prospects': String(tag.usage_count ?? 0),
    'Built in': tag.is_system ? 'Yes' : 'No',
    Active: tag.is_active ? 'Yes' : 'No',
    Order: String(tag.sort_order),
    Created: tag.created_at ? formatDate(tag.created_at) : '—',
  });
  console.log();
}

export async function tagsCreate(options: {
  name: string;
  description?: string;
  color?: string;
  order?: string;
  json?: boolean;
}): Promise<void> {
  const spinner = createSpinner('Creating tag...').start();
  const data = await apiRequest<{ data: Tag }>('/tags', {
    method: 'POST',
    body: {
      name: options.name,
      ...(options.description && { description: options.description }),
      ...(options.color && { badge_variant: options.color }),
      ...(options.order && { sort_order: parseInt(options.order, 10) }),
    },
  });
  spinner.stop();
  if (options.json) {
    printJson(data);
    return;
  }
  console.log(chalk.green(`✓ Created "${data.data.name}" (${data.data.id})`));
  console.log();
}

export async function tagsUpdate(
  id: string,
  options: {
    name?: string;
    description?: string;
    color?: string;
    order?: string;
    archive?: boolean;
    restore?: boolean;
    json?: boolean;
  }
): Promise<void> {
  const body: Record<string, unknown> = {
    ...(options.name && { name: options.name }),
    ...(options.description !== undefined && { description: options.description }),
    ...(options.color && { badge_variant: options.color }),
    ...(options.order && { sort_order: parseInt(options.order, 10) }),
    ...(options.archive && { is_active: false }),
    ...(options.restore && { is_active: true }),
  };
  if (Object.keys(body).length === 0) {
    console.error(
      chalk.red(
        'Error: nothing to change. Pass --name, --description, --color, --order, --archive, or --restore.'
      )
    );
    process.exit(1);
  }
  const spinner = createSpinner('Updating tag...').start();
  const data = await apiRequest<{ data: Tag }>(`/tags/${id}`, { method: 'PATCH', body });
  spinner.stop();
  if (options.json) {
    printJson(data);
    return;
  }
  console.log(chalk.green(`✓ Updated "${data.data.name}" (${data.data.id})`));
  console.log();
}

export async function tagsDelete(
  id: string,
  options: { force?: boolean; json?: boolean }
): Promise<void> {
  const spinner = createSpinner('Deleting tag...').start();
  const data = await apiRequest<{ data: { deleted: boolean; id: string; unassigned: number } }>(
    `/tags/${id}`,
    {
      method: 'DELETE',
      query: { force: options.force ? 'true' : undefined },
    }
  );
  spinner.stop();
  if (options.json) {
    printJson(data);
    return;
  }
  console.log(
    chalk.green(
      `✓ Deleted ${data.data.id}${data.data.unassigned ? ` and removed it from ${data.data.unassigned} prospects` : ''}`
    )
  );
  console.log();
}

export async function tagsReorder(options: { ids: string; json?: boolean }): Promise<void> {
  const spinner = createSpinner('Reordering tags...').start();
  const data = await apiRequest<{ data: Tag[] }>('/tags/reorder', {
    method: 'POST',
    body: {
      tag_ids: options.ids
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean),
    },
  });
  spinner.stop();
  if (options.json) {
    printJson(data);
    return;
  }
  printHeader('Tags');
  console.log();
  printTagRows(data.data);
  console.log();
}
