/**
 * CRM commands — pipelines, opportunities, tasks, notes, records, labels, activity
 */

import chalk from 'chalk';

import { apiRequest, formatDate } from '../lib/client.js';
import {
  parseRequestBody,
  printJson,
  printHeader,
  printTable,
  printKeyValue,
  truncate,
  createSpinner,
} from '../lib/output.js';

// ============================================================================
// Pipelines
// ============================================================================

export async function crmPipelines(options: { json?: boolean }): Promise<void> {
  const spinner = createSpinner('Fetching pipelines...').start();
  const data = await apiRequest<{ data: any[] }>('/crm/pipelines');
  spinner.stop();

  if (options.json) { printJson(data); return; }

  printHeader('CRM Pipelines');
  console.log();

  if (data.data.length > 0) {
    const rows = data.data.map((p: any) => ({
      id: p.id,
      name: truncate(p.name, 30),
      stages: p.stages?.length ?? 0,
      opportunities: p.opportunity_count ?? 0,
      default: p.is_default ? 'Yes' : '',
    }));
    printTable(rows, ['id', 'name', 'stages', 'opportunities', 'default']);
  } else {
    console.log(chalk.dim('  No pipelines found.'));
  }
  console.log();
}

// ============================================================================
// Opportunities
// ============================================================================

export async function crmOpportunitiesList(options: {
  pipelineId?: string;
  stageId?: string;
  search?: string;
  priority?: string;
  page?: string;
  perPage?: string;
  json?: boolean;
}): Promise<void> {
  const spinner = createSpinner('Fetching opportunities...').start();
  const data = await apiRequest<{ data: any[]; pagination: any }>('/crm/opportunities', {
    query: {
      ...(options.pipelineId && { pipeline_id: options.pipelineId }),
      ...(options.stageId && { stage_id: options.stageId }),
      ...(options.search && { search: options.search }),
      ...(options.priority && { priority: options.priority }),
      ...(options.page && { page: parseInt(options.page, 10) }),
      ...(options.perPage && { per_page: parseInt(options.perPage, 10) }),
    },
  });
  spinner.stop();

  if (options.json) { printJson(data); return; }

  printHeader('Opportunities');
  console.log();

  if (data.data.length > 0) {
    const rows = data.data.map((o: any) => ({
      id: truncate(o.uuid || o.id, 20),
      name: truncate(o.name, 30),
      stage: o.stage?.name || '—',
      priority: o.priority,
      value: o.value || '—',
      created: formatDate(o.created_at),
    }));
    printTable(rows, ['id', 'name', 'stage', 'priority', 'value', 'created']);
  } else {
    console.log(chalk.dim('  No opportunities found.'));
  }

  const p = data.pagination;
  console.log();
  console.log(chalk.dim(`Page ${p.page} — ${p.total} total${p.has_more ? ' (more available)' : ''}`));
  console.log();
}

export async function crmOpportunitiesGet(id: string, options: { json?: boolean }): Promise<void> {
  const spinner = createSpinner('Fetching opportunity...').start();
  const data = await apiRequest<{ data: any }>(`/crm/opportunities/${id}`);
  spinner.stop();

  if (options.json) { printJson(data); return; }

  const o = data.data;
  printHeader(`Opportunity ${o.uuid || o.id}`);
  printKeyValue({
    'Name': o.name,
    'Pipeline': o.pipeline?.name || o.pipeline_id,
    'Stage': o.stage?.name || o.stage_id,
    'Priority': o.priority,
    'Value': o.value || '—',
    'Assigned To': o.assigned_to_user_id || '—',
    'Closed At': o.closed_at || '—',
    'Records': o._count?.records ?? 0,
    'Tasks': o._count?.tasks ?? 0,
    'Notes': o._count?.notes ?? 0,
    'Created': formatDate(o.created_at),
    'Updated': formatDate(o.updated_at),
  });
  console.log();
}

export async function crmOpportunitiesCreate(options: { body?: string; file?: string; json?: boolean }): Promise<void> {
  const requestBody = await parseRequestBody(options);
  const spinner = createSpinner('Creating opportunity...').start();
  const data = await apiRequest<{ data: any }>('/crm/opportunities', { method: 'POST', body: requestBody });
  spinner.stop();

  if (options.json) { printJson(data); return; }

  const o = data.data;
  printHeader('Opportunity Created');
  printKeyValue({ 'ID': o.id, 'UUID': o.uuid, 'Name': o.name, 'Stage': o.stage?.name || o.stage_id });
  console.log();
}

export async function crmOpportunitiesUpdate(id: string, options: { body?: string; file?: string; json?: boolean }): Promise<void> {
  const requestBody = await parseRequestBody(options);
  const spinner = createSpinner('Updating opportunity...').start();
  const data = await apiRequest<{ data: any }>(`/crm/opportunities/${id}`, { method: 'PATCH', body: requestBody });
  spinner.stop();

  if (options.json) { printJson(data); return; }

  const o = data.data;
  printHeader('Opportunity Updated');
  printKeyValue({ 'ID': o.id, 'Name': o.name, 'Updated': formatDate(o.updated_at) });
  console.log();
}

export async function crmOpportunitiesDelete(id: string, options: { json?: boolean }): Promise<void> {
  const spinner = createSpinner('Deleting opportunity...').start();
  const data = await apiRequest<{ data: { deleted: boolean } }>(`/crm/opportunities/${id}`, { method: 'DELETE' });
  spinner.stop();

  if (options.json) { printJson(data); return; }
  console.log(chalk.green(`  Opportunity ${id} deleted.`));
  console.log();
}

export async function crmOpportunitiesMove(id: string, options: { body?: string; file?: string; json?: boolean }): Promise<void> {
  const requestBody = await parseRequestBody(options);
  const spinner = createSpinner('Moving opportunity...').start();
  const data = await apiRequest<{ data: any }>(`/crm/opportunities/${id}/move`, { method: 'POST', body: requestBody });
  spinner.stop();

  if (options.json) { printJson(data); return; }

  const d = data.data;
  printHeader('Opportunity Moved');
  printKeyValue({ 'Stage': d.stage_name, 'Stage ID': d.stage_id });
  console.log();
}

// ============================================================================
// Tasks
// ============================================================================

export async function crmTasksList(opportunityId: string, options: { page?: string; perPage?: string; json?: boolean }): Promise<void> {
  const spinner = createSpinner('Fetching tasks...').start();
  const data = await apiRequest<{ data: any[]; pagination: any }>(`/crm/opportunities/${opportunityId}/tasks`, {
    query: {
      ...(options.page && { page: parseInt(options.page, 10) }),
      ...(options.perPage && { per_page: parseInt(options.perPage, 10) }),
    },
  });
  spinner.stop();

  if (options.json) { printJson(data); return; }

  printHeader(`Tasks for ${opportunityId}`);
  console.log();

  if (data.data.length > 0) {
    const rows = data.data.map((t: any) => ({
      id: t.id,
      title: truncate(t.title, 40),
      completed: t.is_completed ? 'Yes' : 'No',
      due: t.due_date ? formatDate(t.due_date) : '—',
    }));
    printTable(rows, ['id', 'title', 'completed', 'due']);
  } else {
    console.log(chalk.dim('  No tasks found.'));
  }
  console.log();
}

export async function crmTasksCreate(opportunityId: string, options: { body?: string; file?: string; json?: boolean }): Promise<void> {
  const requestBody = await parseRequestBody(options);
  const spinner = createSpinner('Creating task...').start();
  const data = await apiRequest<{ data: any }>(`/crm/opportunities/${opportunityId}/tasks`, { method: 'POST', body: requestBody });
  spinner.stop();

  if (options.json) { printJson(data); return; }
  const t = data.data;
  printHeader('Task Created');
  printKeyValue({ 'ID': t.id, 'Title': t.title });
  console.log();
}

export async function crmTasksUpdate(opportunityId: string, taskId: string, options: { body?: string; file?: string; json?: boolean }): Promise<void> {
  const requestBody = await parseRequestBody(options);
  const spinner = createSpinner('Updating task...').start();
  const data = await apiRequest<{ data: any }>(`/crm/opportunities/${opportunityId}/tasks/${taskId}`, { method: 'PATCH', body: requestBody });
  spinner.stop();

  if (options.json) { printJson(data); return; }
  const t = data.data;
  printHeader('Task Updated');
  printKeyValue({ 'ID': t.id, 'Title': t.title, 'Completed': t.is_completed ? 'Yes' : 'No' });
  console.log();
}

// ============================================================================
// Notes
// ============================================================================

export async function crmNotesList(opportunityId: string, options: { page?: string; perPage?: string; json?: boolean }): Promise<void> {
  const spinner = createSpinner('Fetching notes...').start();
  const data = await apiRequest<{ data: any[]; pagination: any }>(`/crm/opportunities/${opportunityId}/notes`, {
    query: {
      ...(options.page && { page: parseInt(options.page, 10) }),
      ...(options.perPage && { per_page: parseInt(options.perPage, 10) }),
    },
  });
  spinner.stop();

  if (options.json) { printJson(data); return; }

  printHeader(`Notes for ${opportunityId}`);
  console.log();

  if (data.data.length > 0) {
    const rows = data.data.map((n: any) => ({
      id: n.id,
      content: truncate(n.content, 60),
      edited: n.is_edited ? 'Yes' : 'No',
      created: formatDate(n.created_at),
    }));
    printTable(rows, ['id', 'content', 'edited', 'created']);
  } else {
    console.log(chalk.dim('  No notes found.'));
  }
  console.log();
}

export async function crmNotesCreate(opportunityId: string, options: { body?: string; file?: string; json?: boolean }): Promise<void> {
  const requestBody = await parseRequestBody(options);
  const spinner = createSpinner('Creating note...').start();
  const data = await apiRequest<{ data: any }>(`/crm/opportunities/${opportunityId}/notes`, { method: 'POST', body: requestBody });
  spinner.stop();

  if (options.json) { printJson(data); return; }
  const n = data.data;
  printHeader('Note Created');
  printKeyValue({ 'ID': n.id, 'Content': truncate(n.content, 60) });
  console.log();
}

export async function crmNotesUpdate(opportunityId: string, noteId: string, options: { body?: string; file?: string; json?: boolean }): Promise<void> {
  const requestBody = await parseRequestBody(options);
  const spinner = createSpinner('Updating note...').start();
  const data = await apiRequest<{ data: any }>(`/crm/opportunities/${opportunityId}/notes/${noteId}`, { method: 'PATCH', body: requestBody });
  spinner.stop();

  if (options.json) { printJson(data); return; }
  const n = data.data;
  printHeader('Note Updated');
  printKeyValue({ 'ID': n.id, 'Content': truncate(n.content, 60) });
  console.log();
}

// ============================================================================
// Records
// ============================================================================

export async function crmRecordsList(opportunityId: string, options: { json?: boolean }): Promise<void> {
  const spinner = createSpinner('Fetching records...').start();
  const data = await apiRequest<{ data: any[] }>(`/crm/opportunities/${opportunityId}/records`);
  spinner.stop();

  if (options.json) { printJson(data); return; }

  printHeader(`Records linked to ${opportunityId}`);
  console.log();

  if (data.data.length > 0) {
    const rows = data.data.map((r: any) => ({
      id: r.id,
      type: r.record_type,
      record_id: r.record_id,
      display_name: truncate(r.display_name || '—', 30),
      primary: r.is_primary ? 'Yes' : '',
    }));
    printTable(rows, ['id', 'type', 'record_id', 'display_name', 'primary']);
  } else {
    console.log(chalk.dim('  No records linked.'));
  }
  console.log();
}

export async function crmRecordsLink(opportunityId: string, options: { body?: string; file?: string; json?: boolean }): Promise<void> {
  const requestBody = await parseRequestBody(options);
  const spinner = createSpinner('Linking record...').start();
  const data = await apiRequest<{ data: any }>(`/crm/opportunities/${opportunityId}/records`, { method: 'POST', body: requestBody });
  spinner.stop();

  if (options.json) { printJson(data); return; }
  const r = data.data;
  printHeader('Record Linked');
  printKeyValue({ 'ID': r.id, 'Type': r.record_type, 'Record ID': r.record_id });
  console.log();
}

export async function crmRecordsUnlink(opportunityId: string, recordId: string, options: { json?: boolean }): Promise<void> {
  const spinner = createSpinner('Unlinking record...').start();
  const data = await apiRequest<{ data: { deleted: boolean } }>(`/crm/opportunities/${opportunityId}/records/${recordId}`, { method: 'DELETE' });
  spinner.stop();

  if (options.json) { printJson(data); return; }
  console.log(chalk.green(`  Record ${recordId} unlinked.`));
  console.log();
}

// ============================================================================
// Labels
// ============================================================================

export async function crmLabelsList(options: { json?: boolean }): Promise<void> {
  const spinner = createSpinner('Fetching labels...').start();
  const data = await apiRequest<{ data: any[] }>('/crm/labels');
  spinner.stop();

  if (options.json) { printJson(data); return; }

  printHeader('CRM Labels');
  console.log();

  if (data.data.length > 0) {
    const rows = data.data.map((l: any) => ({
      id: l.id,
      name: l.name,
      color: l.color,
      default: l.is_default ? 'Yes' : '',
    }));
    printTable(rows, ['id', 'name', 'color', 'default']);
  } else {
    console.log(chalk.dim('  No labels found.'));
  }
  console.log();
}

export async function crmLabelsCreate(options: { body?: string; file?: string; json?: boolean }): Promise<void> {
  const requestBody = await parseRequestBody(options);
  const spinner = createSpinner('Creating label...').start();
  const data = await apiRequest<{ data: any }>('/crm/labels', { method: 'POST', body: requestBody });
  spinner.stop();

  if (options.json) { printJson(data); return; }
  const l = data.data;
  printHeader('Label Created');
  printKeyValue({ 'ID': l.id, 'Name': l.name, 'Color': l.color });
  console.log();
}

export async function crmLabelsUpdate(id: string, options: { body?: string; file?: string; json?: boolean }): Promise<void> {
  const requestBody = await parseRequestBody(options);
  const spinner = createSpinner('Updating label...').start();
  const data = await apiRequest<{ data: any }>(`/crm/labels/${id}`, { method: 'PATCH', body: requestBody });
  spinner.stop();

  if (options.json) { printJson(data); return; }
  const l = data.data;
  printHeader('Label Updated');
  printKeyValue({ 'ID': l.id, 'Name': l.name, 'Color': l.color });
  console.log();
}

export async function crmLabelsDelete(id: string, options: { json?: boolean }): Promise<void> {
  const spinner = createSpinner('Deleting label...').start();
  const data = await apiRequest<{ data: { deleted: boolean } }>(`/crm/labels/${id}`, { method: 'DELETE' });
  spinner.stop();

  if (options.json) { printJson(data); return; }
  console.log(chalk.green(`  Label ${id} deleted.`));
  console.log();
}

// ============================================================================
// Activity
// ============================================================================

export async function crmActivity(opportunityId: string, options: { cursor?: string; limit?: string; category?: string; json?: boolean }): Promise<void> {
  const spinner = createSpinner('Fetching activity...').start();
  const data = await apiRequest<{ data: any[]; next_cursor: string | null; has_more: boolean }>(
    `/crm/opportunities/${opportunityId}/activity`,
    {
      query: {
        ...(options.cursor && { cursor: options.cursor }),
        ...(options.limit && { limit: options.limit }),
        ...(options.category && { category: options.category }),
      },
    },
  );
  spinner.stop();

  if (options.json) { printJson(data); return; }

  printHeader(`Activity for ${opportunityId}`);
  console.log();

  if (data.data.length > 0) {
    const rows = data.data.map((a: any) => ({
      id: truncate(a.record_activity_id, 12),
      type: a.slug,
      summary: truncate(a.summary || '—', 50),
      source: a.source,
      created: formatDate(a.created_at),
    }));
    printTable(rows, ['id', 'type', 'summary', 'source', 'created']);
  } else {
    console.log(chalk.dim('  No activity found.'));
  }

  if (data.has_more && data.next_cursor) {
    console.log();
    console.log(chalk.dim(`  Next cursor: ${data.next_cursor}`));
  }
  console.log();
}
