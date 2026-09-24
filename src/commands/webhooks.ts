/**
 * Webhooks commands: register URLs that receive prospect and list events,
 * check their health, read the delivery log, and resend.
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

type Webhook = {
  id: string;
  url: string;
  description: string | null;
  event_types: string[];
  consumer: string;
  batch_max: number;
  include_contacts: boolean;
  is_active: boolean;
  disabled_reason: string | null;
  secret_last4: string;
  secret?: string;
  previous_secret_expires_at: string | null;
  health: {
    consecutive_failures: number;
    failing_since: string | null;
    last_success_at: string | null;
    last_failure_at: string | null;
    last_response_status: number | null;
  };
  created_at: string;
};

type Delivery = {
  id: string;
  event: { id: string; type: string; occurred_at: string };
  status: string;
  attempt_count: number;
  next_attempt_at: string | null;
  response_status: number | null;
  response_ms: number | null;
  error: string | null;
  created_at: string;
};

type Pagination = { page: number; per_page: number; total: number; has_more: boolean };

function splitList(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function healthLabel(hook: Webhook): string {
  if (!hook.is_active) return `off${hook.disabled_reason ? ` (${hook.disabled_reason})` : ''}`;
  if (hook.health.consecutive_failures > 0) return `failing x${hook.health.consecutive_failures}`;
  return hook.health.last_success_at ? 'healthy' : 'no deliveries yet';
}

function printWebhook(hook: Webhook) {
  printKeyValue({
    ID: hook.id,
    URL: hook.url,
    Description: hook.description ?? '—',
    Events: hook.event_types.join(', '),
    Consumer: hook.consumer,
    'Batch size': String(hook.batch_max),
    'Include contacts': hook.include_contacts ? 'Yes' : 'No',
    Status: healthLabel(hook),
    'Last success': hook.health.last_success_at ? formatDate(hook.health.last_success_at) : '—',
    'Last failure': hook.health.last_failure_at ? formatDate(hook.health.last_failure_at) : '—',
    Secret: hook.secret ?? `whsec_…${hook.secret_last4}`,
    Created: formatDate(hook.created_at),
  });
  if (hook.secret) {
    console.log(chalk.yellow('  Save the secret now. It is shown only once.'));
  }
  console.log();
}

export async function webhooksList(options: {
  includeZapier?: boolean;
  json?: boolean;
}): Promise<void> {
  const spinner = createSpinner('Fetching webhooks...').start();
  const data = await apiRequest<{ data: Webhook[] }>('/webhooks', {
    query: { include_zapier: options.includeZapier ? 'true' : undefined },
  });
  spinner.stop();
  if (options.json) {
    printJson(data);
    return;
  }
  printHeader('Webhooks');
  console.log();
  if (data.data.length) {
    printTable(
      data.data.map((hook) => ({
        id: hook.id,
        url: truncate(hook.url, 44),
        events: truncate(hook.event_types.join(', '), 30),
        status: healthLabel(hook),
        'last success': hook.health.last_success_at ? formatDate(hook.health.last_success_at) : '—',
      })),
      ['id', 'url', 'events', 'status', 'last success']
    );
  } else {
    console.log(
      chalk.dim(
        '  No webhooks yet. Create one with: dm webhooks create --url https://... --events prospect.added'
      )
    );
  }
  console.log();
}

export async function webhooksGet(id: string, options: { json?: boolean }): Promise<void> {
  const spinner = createSpinner('Fetching webhook...').start();
  const data = await apiRequest<{ data: Webhook }>(`/webhooks/${id}`);
  spinner.stop();
  if (options.json) {
    printJson(data);
    return;
  }
  printHeader(`Webhook ${data.data.id}`);
  printWebhook(data.data);
}

export async function webhooksCreate(options: {
  url: string;
  events: string;
  description?: string;
  batchMax?: string;
  includeContacts?: boolean;
  json?: boolean;
}): Promise<void> {
  const spinner = createSpinner('Creating webhook...').start();
  const data = await apiRequest<{ data: Webhook }>('/webhooks', {
    method: 'POST',
    body: {
      url: options.url,
      event_types: splitList(options.events),
      ...(options.description && { description: options.description }),
      ...(options.batchMax && { batch_max: parseInt(options.batchMax, 10) }),
      ...(options.includeContacts && { include_contacts: true }),
    },
  });
  spinner.stop();
  if (options.json) {
    printJson(data);
    return;
  }
  printHeader('Webhook Created');
  printWebhook(data.data);
}

export async function webhooksUpdate(
  id: string,
  options: {
    url?: string;
    events?: string;
    description?: string;
    batchMax?: string;
    includeContacts?: boolean;
    noIncludeContacts?: boolean;
    enable?: boolean;
    disable?: boolean;
    json?: boolean;
  }
): Promise<void> {
  const body: Record<string, unknown> = {
    ...(options.url && { url: options.url }),
    ...(options.events && { event_types: splitList(options.events) }),
    ...(options.description !== undefined && { description: options.description }),
    ...(options.batchMax && { batch_max: parseInt(options.batchMax, 10) }),
    ...(options.includeContacts && { include_contacts: true }),
    ...(options.noIncludeContacts && { include_contacts: false }),
    ...(options.enable && { is_active: true }),
    ...(options.disable && { is_active: false }),
  };
  if (Object.keys(body).length === 0) {
    console.error(
      chalk.red(
        'Error: nothing to change. Pass --url, --events, --description, --batch-max, --include-contacts, --enable, or --disable.'
      )
    );
    process.exit(1);
  }
  const spinner = createSpinner('Updating webhook...').start();
  const data = await apiRequest<{ data: Webhook }>(`/webhooks/${id}`, { method: 'PATCH', body });
  spinner.stop();
  if (options.json) {
    printJson(data);
    return;
  }
  printHeader('Webhook Updated');
  printWebhook(data.data);
}

export async function webhooksDelete(id: string, options: { json?: boolean }): Promise<void> {
  const spinner = createSpinner('Deleting webhook...').start();
  const data = await apiRequest<{ data: { deleted: boolean; id: string } }>(`/webhooks/${id}`, {
    method: 'DELETE',
  });
  spinner.stop();
  if (options.json) {
    printJson(data);
    return;
  }
  console.log(chalk.green(`✓ Deleted ${data.data.id}`));
  console.log();
}

export async function webhooksTest(id: string, options: { json?: boolean }): Promise<void> {
  const spinner = createSpinner('Sending test event...').start();
  const data = await apiRequest<{
    data: {
      ok: boolean;
      status: number | null;
      response_ms: number;
      response_excerpt: string | null;
      error: string | null;
    };
  }>(`/webhooks/${id}/test`, { method: 'POST' });
  spinner.stop();
  if (options.json) {
    printJson(data);
    return;
  }
  const result = data.data;
  if (result.ok) {
    console.log(chalk.green(`✓ Delivered: HTTP ${result.status} in ${result.response_ms} ms`));
  } else {
    console.log(chalk.red(`✗ Failed: ${result.error ?? 'no response'} (${result.response_ms} ms)`));
    if (result.response_excerpt)
      console.log(chalk.dim(`  ${truncate(result.response_excerpt, 200)}`));
  }
  console.log();
}

export async function webhooksRotateSecret(id: string, options: { json?: boolean }): Promise<void> {
  const spinner = createSpinner('Rotating secret...').start();
  const data = await apiRequest<{ data: Webhook }>(`/webhooks/${id}/rotate-secret`, {
    method: 'POST',
  });
  spinner.stop();
  if (options.json) {
    printJson(data);
    return;
  }
  printHeader('Secret Rotated');
  console.log(`  New secret: ${chalk.bold(data.data.secret ?? '')}`);
  console.log(
    chalk.dim(
      `  The old secret keeps working until ${data.data.previous_secret_expires_at ?? 'tomorrow'}.`
    )
  );
  console.log();
}

export async function webhooksDeliveries(
  id: string,
  options: {
    status?: string;
    eventType?: string;
    since?: string;
    page?: string;
    perPage?: string;
    json?: boolean;
  }
): Promise<void> {
  const spinner = createSpinner('Fetching deliveries...').start();
  const data = await apiRequest<{ data: Delivery[]; pagination: Pagination }>(
    `/webhooks/${id}/deliveries`,
    {
      query: {
        status: options.status,
        event_type: options.eventType,
        since: options.since,
        page: options.page ? parseInt(options.page, 10) : undefined,
        per_page: options.perPage ? parseInt(options.perPage, 10) : undefined,
      },
    }
  );
  spinner.stop();
  if (options.json) {
    printJson(data);
    return;
  }
  printHeader(`Deliveries for ${id}`);
  console.log();
  if (data.data.length) {
    printTable(
      data.data.map((delivery) => ({
        id: delivery.id,
        event: delivery.event.type,
        status: delivery.status,
        attempts: String(delivery.attempt_count),
        http: delivery.response_status ? String(delivery.response_status) : '—',
        ms: delivery.response_ms != null ? String(delivery.response_ms) : '—',
        error: truncate(delivery.error ?? '—', 36),
        when: formatDate(delivery.created_at),
      })),
      ['id', 'event', 'status', 'attempts', 'http', 'ms', 'error', 'when']
    );
  } else {
    console.log(chalk.dim('  No deliveries yet.'));
  }
  const p = data.pagination;
  console.log();
  console.log(
    chalk.dim(`Page ${p.page} — ${p.total} total${p.has_more ? ' (more available)' : ''}`)
  );
  console.log();
}

export async function webhooksDeliveryGet(
  id: string,
  deliveryId: string,
  options: { json?: boolean }
): Promise<void> {
  const spinner = createSpinner('Fetching delivery...').start();
  const data = await apiRequest<{ data: Delivery }>(`/webhooks/${id}/deliveries/${deliveryId}`);
  spinner.stop();
  if (options.json) {
    printJson(data);
    return;
  }
  const delivery = data.data;
  printHeader(`Delivery ${delivery.id}`);
  printKeyValue({
    Event: delivery.event.type,
    Status: delivery.status,
    Attempts: String(delivery.attempt_count),
    HTTP: delivery.response_status == null ? '—' : String(delivery.response_status),
    'Response time': delivery.response_ms == null ? '—' : `${delivery.response_ms} ms`,
    Error: delivery.error ?? '—',
    Created: formatDate(delivery.created_at),
  });
  console.log();
}

export async function webhooksRedeliver(
  id: string,
  deliveryId: string | undefined,
  options: { since?: string; json?: boolean }
): Promise<void> {
  const target = deliveryId ?? 'all';
  if (target === 'all' && !options.since) {
    console.error(
      chalk.red('Error: pass a delivery ID, or --since <ISO time> to resend a window.')
    );
    process.exit(1);
  }
  const spinner = createSpinner('Requeueing...').start();
  const data = await apiRequest<{ data: { requeued: number } }>(
    `/webhooks/${id}/deliveries/${target}/redeliver`,
    {
      method: 'POST',
      query: { since: options.since },
    }
  );
  spinner.stop();
  if (options.json) {
    printJson(data);
    return;
  }
  console.log(
    chalk.green(
      `✓ Requeued ${data.data.requeued} ${data.data.requeued === 1 ? 'delivery' : 'deliveries'}`
    )
  );
  console.log();
}

export async function webhooksEvents(options: { json?: boolean; example?: string }): Promise<void> {
  const spinner = createSpinner('Fetching event catalog...').start();
  const data = await apiRequest<{
    data: Array<{ type: string; description: string; example: unknown }>;
    api_version: string;
  }>('/webhooks/events');
  spinner.stop();
  if (options.example) {
    const entry = data.data.find((event) => event.type === options.example);
    if (!entry) {
      console.error(chalk.red(`Error: unknown event type ${options.example}`));
      process.exit(1);
    }
    printJson(entry.example);
    return;
  }
  if (options.json) {
    printJson(data);
    return;
  }
  printHeader(`Webhook Events (api version ${data.api_version})`);
  console.log();
  printTable(
    data.data.map((event) => ({ type: event.type, description: truncate(event.description, 70) })),
    ['type', 'description']
  );
  console.log();
  console.log(chalk.dim('  See a full example body: dm webhooks events --example prospect.added'));
  console.log();
}
