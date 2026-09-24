/**
 * Dialer commands — calls, queues, queue items, dispositions, suppression, call notes
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
// Calls
// ============================================================================

export async function dialerCallsList(options: {
  status?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: string;
  perPage?: string;
  json?: boolean;
}): Promise<void> {
  const spinner = createSpinner('Fetching calls...').start();
  const data = await apiRequest<{ data: any[]; pagination: any }>('/dialer/calls', {
    query: {
      ...(options.status && { status: options.status }),
      ...(options.search && { search: options.search }),
      ...(options.dateFrom && { date_from: options.dateFrom }),
      ...(options.dateTo && { date_to: options.dateTo }),
      ...(options.page && { page: parseInt(options.page, 10) }),
      ...(options.perPage && { per_page: parseInt(options.perPage, 10) }),
    },
  });
  spinner.stop();

  if (options.json) { printJson(data); return; }

  printHeader('Call History');
  console.log();

  if (data.data.length > 0) {
    const rows = data.data.map((c: any) => ({
      uuid: truncate(c.uuid, 16),
      contact: truncate(c.contact_name || c.to_number, 20),
      status: c.status,
      duration: `${c.duration_seconds}s`,
      disposition: c.disposition?.name || '—',
      date: formatDate(c.created_at),
    }));
    printTable(rows, ['uuid', 'contact', 'status', 'duration', 'disposition', 'date']);
  } else {
    console.log(chalk.dim('  No calls found.'));
  }

  const p = data.pagination;
  console.log();
  console.log(chalk.dim(`Page ${p.page} — ${p.total} total${p.has_more ? ' (more available)' : ''}`));
  console.log();
}

export async function dialerCallsGet(uuid: string, options: { json?: boolean }): Promise<void> {
  const spinner = createSpinner('Fetching call...').start();
  const data = await apiRequest<{ data: any }>(`/dialer/calls/${uuid}`);
  spinner.stop();

  if (options.json) { printJson(data); return; }

  const c = data.data;
  printHeader(`Call ${c.uuid}`);
  printKeyValue({
    'Status': c.status,
    'From': c.from_number,
    'To': c.to_number,
    'Contact': c.contact_name || '—',
    'Contact ID': c.contact_id || '—',
    'Property': c.property_address || '—',
    'Property ID': c.property_id || '—',
    'Duration': `${c.duration_seconds}s`,
    'Talk Time': `${c.talk_time_seconds}s`,
    'Disposition': c.disposition?.name || '—',
    'AI Summary': c.ai_summary ? truncate(c.ai_summary, 80) : '—',
    'Started': c.started_at ? formatDate(c.started_at) : '—',
    'Answered': c.answered_at ? formatDate(c.answered_at) : '—',
    'Ended': c.ended_at ? formatDate(c.ended_at) : '—',
    'Created': formatDate(c.created_at),
  });
  console.log();
}

export async function dialerCallsStats(options: {
  dateFrom?: string;
  dateTo?: string;
  json?: boolean;
}): Promise<void> {
  const spinner = createSpinner('Fetching call stats...').start();
  const data = await apiRequest<{ data: any }>('/dialer/calls/stats', {
    query: {
      ...(options.dateFrom && { date_from: options.dateFrom }),
      ...(options.dateTo && { date_to: options.dateTo }),
    },
  });
  spinner.stop();

  if (options.json) { printJson(data); return; }

  const s = data.data;
  printHeader('Call Statistics');
  printKeyValue({
    'Total Calls': s.total_calls,
    'Connections': s.connections,
    'Connection Rate': `${s.connection_rate}%`,
    'Total Attempts': s.total_attempts,
    'Avg Duration': `${s.avg_duration_seconds}s`,
    'Avg Talk Time': `${s.avg_talk_time_seconds}s`,
    'Total Talk Time': `${s.total_talk_time_seconds}s`,
    'Positive Outcomes': s.positive_outcomes,
    'Positive Rate': `${s.positive_rate}%`,
  });
  console.log();
}

// ============================================================================
// Call Notes
// ============================================================================

export async function dialerNotesList(callUuid: string, options: { json?: boolean }): Promise<void> {
  const spinner = createSpinner('Fetching call notes...').start();
  const data = await apiRequest<{ data: any[] }>(`/dialer/calls/${callUuid}/notes`);
  spinner.stop();

  if (options.json) { printJson(data); return; }

  printHeader(`Notes for call ${truncate(callUuid, 16)}`);
  console.log();

  if (data.data.length > 0) {
    const rows = data.data.map((n: any) => ({
      id: n.id,
      author: `${n.author_name} (${n.author_type})`,
      content: truncate(n.content, 50),
      created: formatDate(n.created_at),
    }));
    printTable(rows, ['id', 'author', 'content', 'created']);
  } else {
    console.log(chalk.dim('  No notes found.'));
  }
  console.log();
}

export async function dialerNotesCreate(callUuid: string, options: { body?: string; file?: string; json?: boolean }): Promise<void> {
  const requestBody = await parseRequestBody(options);
  const spinner = createSpinner('Creating call note...').start();
  const data = await apiRequest<{ data: any }>(`/dialer/calls/${callUuid}/notes`, { method: 'POST', body: requestBody });
  spinner.stop();

  if (options.json) { printJson(data); return; }
  const n = data.data;
  printHeader('Note Created');
  printKeyValue({ 'ID': n.id, 'Content': truncate(n.content, 60) });
  console.log();
}

export async function dialerNotesDelete(callUuid: string, noteId: string, options: { json?: boolean }): Promise<void> {
  const spinner = createSpinner('Deleting call note...').start();
  const data = await apiRequest<{ data: { deleted: boolean } }>(`/dialer/calls/${callUuid}/notes/${noteId}`, { method: 'DELETE' });
  spinner.stop();

  if (options.json) { printJson(data); return; }
  console.log(chalk.green(`  Note ${noteId} deleted.`));
  console.log();
}

// ============================================================================
// Queues
// ============================================================================

export async function dialerQueuesList(options: { json?: boolean }): Promise<void> {
  const spinner = createSpinner('Fetching queues...').start();
  const data = await apiRequest<{ data: any[] }>('/dialer/queues');
  spinner.stop();

  if (options.json) { printJson(data); return; }

  printHeader('Dialer Queues');
  console.log();

  if (data.data.length > 0) {
    const rows = data.data.map((q: any) => ({
      id: q.id,
      name: truncate(q.name, 20),
      owner: q.owner_name || `user ${q.user_id}`,
      pending: q.pending_count ?? '—',
      completed: q.completed_count ?? '—',
      deferred: q.deferred_count ?? '—',
      default: q.is_default ? 'Yes' : '',
    }));
    printTable(rows, ['id', 'name', 'owner', 'pending', 'completed', 'deferred', 'default']);
  } else {
    console.log(chalk.dim('  No queues found.'));
  }
  console.log();
}

export async function dialerQueuesCreate(options: { body?: string; file?: string; json?: boolean }): Promise<void> {
  const requestBody = await parseRequestBody(options);
  const spinner = createSpinner('Creating queue...').start();
  const data = await apiRequest<{ data: any }>('/dialer/queues', { method: 'POST', body: requestBody });
  spinner.stop();

  if (options.json) { printJson(data); return; }
  const q = data.data;
  printHeader('Queue Created');
  printKeyValue({ 'ID': q.id, 'Name': q.name, 'Max Items': q.max_items });
  console.log();
}

export async function dialerQueuesDelete(id: string, options: { json?: boolean }): Promise<void> {
  const spinner = createSpinner('Deleting queue...').start();
  const data = await apiRequest<{ data: { deleted: boolean } }>(`/dialer/queues/${id}`, { method: 'DELETE' });
  spinner.stop();

  if (options.json) { printJson(data); return; }
  console.log(chalk.green(`  Queue ${id} deleted.`));
  console.log();
}

// ============================================================================
// Queue Items
// ============================================================================

export async function dialerQueueItemsList(queueId: string, options: {
  status?: string;
  page?: string;
  perPage?: string;
  json?: boolean;
}): Promise<void> {
  const spinner = createSpinner('Fetching queue items...').start();
  const data = await apiRequest<{ data: any[]; pagination: any }>(`/dialer/queues/${queueId}/items`, {
    query: {
      ...(options.status && { status: options.status }),
      ...(options.page && { page: parseInt(options.page, 10) }),
      ...(options.perPage && { per_page: parseInt(options.perPage, 10) }),
    },
  });
  spinner.stop();

  if (options.json) { printJson(data); return; }

  printHeader(`Queue ${queueId} Items`);
  console.log();

  if (data.data.length > 0) {
    const rows = data.data.map((item: any) => ({
      id: item.id,
      contact: truncate(item.contact_name || '—', 20),
      property: truncate(item.property_address || '—', 25),
      status: item.status,
      phones: item.phones?.length ?? 0,
      attempts: item.attempt_count,
    }));
    printTable(rows, ['id', 'contact', 'property', 'status', 'phones', 'attempts']);
  } else {
    console.log(chalk.dim('  No items in this queue.'));
  }

  const p = data.pagination;
  console.log();
  console.log(chalk.dim(`Page ${p.page} — ${p.total} total${p.has_more ? ' (more available)' : ''}`));
  console.log();
}

export async function dialerQueueItemsAdd(queueId: string, options: { body?: string; file?: string; json?: boolean }): Promise<void> {
  const requestBody = await parseRequestBody(options);
  const spinner = createSpinner('Adding items to queue...').start();
  const data = await apiRequest<{ data: any }>(`/dialer/queues/${queueId}/items`, { method: 'POST', body: requestBody });
  spinner.stop();

  if (options.json) { printJson(data); return; }
  const d = data.data;
  printHeader('Items Added');
  printKeyValue({
    'Added': d.added,
    'Skipped': d.skipped_contacts,
    'Phones Added': d.phones_added,
  });
  console.log();
}

export async function dialerQueueItemsUpdate(queueId: string, itemId: string, options: { body?: string; file?: string; json?: boolean }): Promise<void> {
  const requestBody = await parseRequestBody(options);
  const spinner = createSpinner('Updating queue item...').start();
  const data = await apiRequest<{ data: any }>(`/dialer/queues/${queueId}/items/${itemId}`, { method: 'PATCH', body: requestBody });
  spinner.stop();

  if (options.json) { printJson(data); return; }
  printHeader('Queue Item Updated');
  console.log(chalk.green('  Item updated successfully.'));
  console.log();
}

export async function dialerQueueItemsRemove(queueId: string, itemId: string, options: { json?: boolean }): Promise<void> {
  const spinner = createSpinner('Removing queue item...').start();
  const data = await apiRequest<{ data: { deleted: boolean } }>(`/dialer/queues/${queueId}/items/${itemId}`, { method: 'DELETE' });
  spinner.stop();

  if (options.json) { printJson(data); return; }
  console.log(chalk.green(`  Item ${itemId} removed from queue.`));
  console.log();
}

// ============================================================================
// Dispositions
// ============================================================================

export async function dialerDispositions(options: { json?: boolean }): Promise<void> {
  const spinner = createSpinner('Fetching dispositions...').start();
  const data = await apiRequest<{ data: any[] }>('/dialer/dispositions');
  spinner.stop();

  if (options.json) { printJson(data); return; }

  printHeader('Call Dispositions');
  console.log();

  if (data.data.length > 0) {
    const rows = data.data.map((d: any) => ({
      id: d.id,
      name: d.name,
      slug: d.slug,
      behavior: d.behavior,
      positive: d.is_positive ? 'Yes' : '',
      default: d.is_default ? 'Yes' : '',
    }));
    printTable(rows, ['id', 'name', 'slug', 'behavior', 'positive', 'default']);
  } else {
    console.log(chalk.dim('  No dispositions found.'));
  }
  console.log();
}

// ============================================================================
// Suppression
// ============================================================================

export async function dialerSuppressionList(options: {
  search?: string;
  page?: string;
  perPage?: string;
  json?: boolean;
}): Promise<void> {
  const spinner = createSpinner('Fetching suppression list...').start();
  const data = await apiRequest<{ data: any[]; pagination: any }>('/dialer/suppression', {
    query: {
      ...(options.search && { search: options.search }),
      ...(options.page && { page: parseInt(options.page, 10) }),
      ...(options.perPage && { per_page: parseInt(options.perPage, 10) }),
    },
  });
  spinner.stop();

  if (options.json) { printJson(data); return; }

  printHeader('Suppression List (Do Not Call)');
  console.log();

  if (data.data.length > 0) {
    const rows = data.data.map((s: any) => ({
      id: s.id,
      phone_number: s.phone_number,
      reason: truncate(s.reason || '—', 30),
      source: s.source,
      added: formatDate(s.created_at),
    }));
    printTable(rows, ['id', 'phone_number', 'reason', 'source', 'added']);
  } else {
    console.log(chalk.dim('  No suppressed numbers.'));
  }

  const p = data.pagination;
  console.log();
  console.log(chalk.dim(`Page ${p.page} — ${p.total} total${p.has_more ? ' (more available)' : ''}`));
  console.log();
}

export async function dialerSuppressionCheck(phoneNumber: string, options: { json?: boolean }): Promise<void> {
  const spinner = createSpinner('Checking suppression...').start();
  const data = await apiRequest<{ data: { phone_number: string; is_suppressed: boolean } }>('/dialer/suppression/check', {
    query: { phone_number: phoneNumber },
  });
  spinner.stop();

  if (options.json) { printJson(data); return; }

  const d = data.data;
  if (d.is_suppressed) {
    console.log(chalk.red(`  ${d.phone_number} is SUPPRESSED (do not call)`));
  } else {
    console.log(chalk.green(`  ${d.phone_number} is not suppressed`));
  }
  console.log();
}

export async function dialerSuppressionAdd(options: { body?: string; file?: string; json?: boolean }): Promise<void> {
  const requestBody = await parseRequestBody(options);
  const spinner = createSpinner('Adding to suppression list...').start();
  const data = await apiRequest<{ data: any }>('/dialer/suppression', { method: 'POST', body: requestBody });
  spinner.stop();

  if (options.json) { printJson(data); return; }
  console.log(chalk.green(`  ${data.data.phone_number} added to suppression list.`));
  console.log();
}
