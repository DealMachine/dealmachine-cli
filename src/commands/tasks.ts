/**
 * Tasks commands — top-level task management (not CRM-specific)
 */

import chalk from 'chalk';
import ora from 'ora';
import { apiRequest, formatDate } from '../lib/client.js';
import {
  parseRequestBody,
  printJson,
  printHeader,
  printTable,
  printKeyValue,
  truncate,
} from '../lib/output.js';

// ============================================================================
// List Tasks
// ============================================================================

export async function tasksList(options: {
  status?: string;
  search?: string;
  assignedToUserId?: string;
  page?: string;
  perPage?: string;
  json?: boolean;
}): Promise<void> {
  const spinner = ora('Fetching tasks...').start();
  const data = await apiRequest<{ data: any[]; pagination: any }>('/tasks', {
    query: {
      ...(options.status && { status: options.status }),
      ...(options.search && { search: options.search }),
      ...(options.assignedToUserId && { assigned_to_user_id: options.assignedToUserId }),
      ...(options.page && { page: parseInt(options.page, 10) }),
      ...(options.perPage && { per_page: parseInt(options.perPage, 10) }),
    },
  });
  spinner.stop();

  if (options.json) { printJson(data); return; }

  printHeader('Tasks');
  console.log();

  if (data.data.length > 0) {
    const rows = data.data.map((t: any) => ({
      id: t.id,
      title: truncate(t.title, 40),
      completed: t.is_completed ? 'Yes' : 'No',
      due: t.due_date ? formatDate(t.due_date) : '—',
      opportunity: t.opportunity_id || '—',
      property: t.property_id || '—',
    }));
    printTable(rows, ['id', 'title', 'completed', 'due', 'opportunity', 'property']);
  } else {
    console.log(chalk.dim('  No tasks found.'));
  }

  const p = data.pagination;
  console.log();
  console.log(chalk.dim(`Page ${p.page} — ${p.total} total${p.has_more ? ' (more available)' : ''}`));
  console.log();
}

// ============================================================================
// Get Task
// ============================================================================

export async function tasksGet(id: string, options: { json?: boolean }): Promise<void> {
  const spinner = ora('Fetching task...').start();
  const data = await apiRequest<{ data: any }>(`/tasks/${id}`);
  spinner.stop();

  if (options.json) { printJson(data); return; }

  const t = data.data;
  printHeader(`Task ${t.id}`);
  printKeyValue({
    'Title': t.title,
    'Description': t.description || '—',
    'Completed': t.is_completed ? `Yes (${formatDate(t.completed_at)})` : 'No',
    'Due Date': t.due_date ? formatDate(t.due_date) : '—',
    'Assigned To': t.assigned_to_user_id || t.assigned_to_agent_id || '—',
    'Opportunity': t.opportunity_id || '—',
    'Property': t.property_id || '—',
    'Person': t.person_id || '—',
    'Created': formatDate(t.created_at),
    'Updated': formatDate(t.updated_at),
  });
  console.log();
}

// ============================================================================
// Create Task
// ============================================================================

export async function tasksCreate(options: { body?: string; file?: string; json?: boolean }): Promise<void> {
  const requestBody = await parseRequestBody(options);
  const spinner = ora('Creating task...').start();
  const data = await apiRequest<{ data: any }>('/tasks', { method: 'POST', body: requestBody });
  spinner.stop();

  if (options.json) { printJson(data); return; }
  const t = data.data;
  printHeader('Task Created');
  printKeyValue({
    'ID': t.id,
    'Title': t.title,
    'Opportunity': t.opportunity_id || '—',
    'Property': t.property_id || '—',
    'Person': t.person_id || '—',
  });
  console.log();
}

// ============================================================================
// Update Task
// ============================================================================

export async function tasksUpdate(id: string, options: { body?: string; file?: string; json?: boolean }): Promise<void> {
  const requestBody = await parseRequestBody(options);
  const spinner = ora('Updating task...').start();
  const data = await apiRequest<{ data: any }>(`/tasks/${id}`, { method: 'PATCH', body: requestBody });
  spinner.stop();

  if (options.json) { printJson(data); return; }
  const t = data.data;
  printHeader('Task Updated');
  printKeyValue({ 'ID': t.id, 'Title': t.title, 'Completed': t.is_completed ? 'Yes' : 'No' });
  console.log();
}

// ============================================================================
// Delete Task
// ============================================================================

export async function tasksDelete(id: string, options: { json?: boolean }): Promise<void> {
  const spinner = ora('Deleting task...').start();
  const data = await apiRequest<{ data: { deleted: boolean } }>(`/tasks/${id}`, { method: 'DELETE' });
  spinner.stop();

  if (options.json) { printJson(data); return; }
  console.log(chalk.green(`  Task ${id} deleted.`));
  console.log();
}
