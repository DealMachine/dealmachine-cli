/**
 * Mail commands — campaigns, designs, return addresses, wallet
 */

import chalk from 'chalk';
import { apiRequest, formatDate } from '../lib/client.js';
import {
  parseRequestBody,
  printJson,
  printHeader,
  printTable,
  printKeyValue,
  printPagination,
  truncate,
  createSpinner,
} from '../lib/output.js';

// ============================================================================
// Types
// ============================================================================

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  status: string;
  type: string;
  source: string;
  audience_kind: string | null;
  total_recipients: number;
  total_sent: number;
  total_delivered: number;
  created_at: string;
  updated_at: string;
  launched_at: string | null;
  completed_at: string | null;
  steps: CampaignStep[];
}

interface CampaignStep {
  id: string;
  step_order: number;
  step_name: string | null;
  design_id: string | null;
  design_prompt: string | null;
  delay_days: number;
  interval_days: number;
  repeat_count: number;
  skip_if_responded: boolean;
}

interface CampaignListResponse {
  data: Campaign[];
  pagination: { page: number; per_page: number; total: number; has_more: boolean };
}

interface CampaignResponse {
  data: Campaign;
}

interface Recipient {
  id: string;
  campaign_id: string;
  recipient_name: string | null;
  recipient_address_1: string | null;
  recipient_city: string | null;
  recipient_state: string | null;
  recipient_zip: string | null;
  status: string;
  current_step_order: number;
  created_at: string;
}

interface RecipientListResponse {
  data: Recipient[];
  pagination: { page: number; per_page: number; total: number; has_more: boolean };
}

interface AnalyticsResponse {
  data: {
    campaign_id: string;
    campaign_name: string;
    total_recipients: number;
    total_sent: number;
    total_delivered: number;
    total_bounced: number;
    total_responses: number;
    delivery_rate: number;
    response_rate: number;
  };
}

interface CostEstimateResponse {
  data: {
    recipient_count: number;
    price_per_card_cents: number;
    total_cost_cents: number;
    total_cost_dollars: number;
    pay_now_cost_cents: number;
    pay_later_cost_cents: number;
    wallet_balance_cents: number;
    wallet_available_cents: number;
    can_afford: boolean;
    auto_reload_available: boolean;
  };
}

interface Design {
  id: string;
  name: string;
  status: string;
  size: string;
  orientation: string;
  layout: string | null;
  theme: string | null;
  prompt: string | null;
  front_preview_url: string | null;
  back_preview_url: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

interface DesignListResponse {
  data: Design[];
  pagination: { page: number; per_page: number; total: number; has_more: boolean };
}

interface DesignResponse {
  data: Design;
}

interface ReturnAddress {
  id: string;
  label: string | null;
  name: string;
  address_1: string;
  address_2: string | null;
  city: string;
  state: string;
  zip: string;
  is_validated: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

interface ReturnAddressListResponse {
  data: ReturnAddress[];
}

interface ReturnAddressResponse {
  data: ReturnAddress;
  corrected?: boolean;
  dpv_description?: string | null;
}

interface WalletBalance {
  data: {
    balance_cents: number;
    available_cents: number;
    pending_cents: number;
    balance_formatted: string;
    available_formatted: string;
    lifetime_credits_cents: number;
    lifetime_spent_cents: number;
    auto_reload: { enabled: boolean; threshold_cents: number; amount_cents: number };
  };
}

interface WalletTransaction {
  id: string;
  amount_cents: number;
  balance_after_cents: number;
  type: string;
  reference_type: string | null;
  description: string | null;
  campaign_id: string | null;
  created_at: string;
}

interface WalletTransactionsResponse {
  data: WalletTransaction[];
  pagination: { page: number; per_page: number; total: number; has_more: boolean };
}

interface WalletPricingResponse {
  data: {
    plan_slug: string;
    sizes: { size: string; price_cents: number; label: string | null }[];
    current_usage?: number;
    bands?: { threshold_quantity: number; label: string | null; prices: { size: string; price_cents: number }[] }[];
  };
}

// ============================================================================
// Campaigns — List
// ============================================================================

export async function mailCampaignsList(options: {
  status?: string;
  search?: string;
  page?: string;
  perPage?: string;
  json?: boolean;
}): Promise<void> {
  const spinner = createSpinner('Fetching campaigns...').start();
  const data = await apiRequest<CampaignListResponse>('/mail/campaigns', {
    query: {
      ...(options.status && { status: options.status }),
      ...(options.search && { search: options.search }),
      ...(options.page && { page: parseInt(options.page, 10) }),
      ...(options.perPage && { per_page: parseInt(options.perPage, 10) }),
    },
  });
  spinner.stop();

  if (options.json) {
    printJson(data);
    return;
  }

  printHeader('Mail Campaigns');
  console.log();

  if (data.data.length > 0) {
    const rows = data.data.map((c) => ({
      id: truncate(c.id, 20),
      name: truncate(c.name, 30),
      status: c.status,
      recipients: c.total_recipients,
      sent: c.total_sent,
      delivered: c.total_delivered,
      created: formatDate(c.created_at),
    }));
    printTable(rows, ['id', 'name', 'status', 'recipients', 'sent', 'delivered', 'created']);
  } else {
    console.log(chalk.dim('  No campaigns found.'));
  }

  const p = data.pagination;
  console.log();
  console.log(chalk.dim(`Page ${p.page} — ${p.total} total campaigns${p.has_more ? ' (more available)' : ''}`));
  console.log();
}

// ============================================================================
// Campaigns — Create
// ============================================================================

export async function mailCampaignsCreate(options: {
  body?: string;
  file?: string;
  json?: boolean;
}): Promise<void> {
  const requestBody = await parseRequestBody(options);

  const spinner = createSpinner('Creating campaign...').start();
  const data = await apiRequest<CampaignResponse>('/mail/campaigns', {
    method: 'POST',
    body: requestBody,
  });
  spinner.stop();

  if (options.json) {
    printJson(data);
    return;
  }

  const c = data.data;
  printHeader('Campaign Created');
  printKeyValue({
    'Campaign ID': c.id,
    'Name': c.name,
    'Status': c.status,
    'Recipients': c.total_recipients,
    'Steps': c.steps.length,
    'Created': formatDate(c.created_at),
  });
  console.log();
}

// ============================================================================
// Campaigns — Get
// ============================================================================

export async function mailCampaignsGet(
  id: string,
  options: { json?: boolean }
): Promise<void> {
  const spinner = createSpinner('Fetching campaign...').start();
  const data = await apiRequest<CampaignResponse>(`/mail/campaigns/${id}`);
  spinner.stop();

  if (options.json) {
    printJson(data);
    return;
  }

  const c = data.data;
  printHeader(`Campaign ${c.id}`);
  printKeyValue({
    'Name': c.name,
    'Description': c.description || '—',
    'Status': c.status,
    'Audience': c.audience_kind || '—',
    'Recipients': c.total_recipients,
    'Sent': c.total_sent,
    'Delivered': c.total_delivered,
    'Steps': c.steps.length,
    'Created': formatDate(c.created_at),
    'Launched': c.launched_at ? formatDate(c.launched_at) : '—',
    'Completed': c.completed_at ? formatDate(c.completed_at) : '—',
  });

  if (c.steps.length > 0) {
    console.log();
    console.log(chalk.bold('Steps'));
    console.log(chalk.dim('─'.repeat(50)));
    const stepRows = c.steps.map((s) => ({
      order: s.step_order,
      name: s.step_name || '—',
      design: s.design_id ? truncate(s.design_id, 16) : '(prompt)',
      delay: `${s.delay_days}d`,
      repeat: s.repeat_count,
    }));
    printTable(stepRows, ['order', 'name', 'design', 'delay', 'repeat']);
  }
  console.log();
}

// ============================================================================
// Campaigns — Update
// ============================================================================

export async function mailCampaignsUpdate(
  id: string,
  options: { body?: string; file?: string; json?: boolean }
): Promise<void> {
  const requestBody = await parseRequestBody(options);

  const spinner = createSpinner('Updating campaign...').start();
  const data = await apiRequest<CampaignResponse>(`/mail/campaigns/${id}`, {
    method: 'PATCH',
    body: requestBody,
  });
  spinner.stop();

  if (options.json) {
    printJson(data);
    return;
  }

  const c = data.data;
  printHeader('Campaign Updated');
  printKeyValue({
    'Campaign ID': c.id,
    'Name': c.name,
    'Status': c.status,
    'Updated': formatDate(c.updated_at),
  });
  console.log();
}

// ============================================================================
// Campaigns — Delete (Cancel)
// ============================================================================

export async function mailCampaignsDelete(
  id: string,
  options: { json?: boolean }
): Promise<void> {
  const spinner = createSpinner('Cancelling campaign...').start();
  const data = await apiRequest<CampaignResponse>(`/mail/campaigns/${id}`, {
    method: 'DELETE',
  });
  spinner.stop();

  if (options.json) {
    printJson(data);
    return;
  }

  console.log(chalk.green(`  Campaign ${id} cancelled.`));
  console.log();
}

// ============================================================================
// Campaigns — Send (Launch)
// ============================================================================

export async function mailCampaignsSend(
  id: string,
  options: { json?: boolean }
): Promise<void> {
  const spinner = createSpinner('Launching campaign...').start();
  const data = await apiRequest<CampaignResponse>(`/mail/campaigns/${id}/send`, {
    method: 'POST',
    body: {},
  });
  spinner.stop();

  if (options.json) {
    printJson(data);
    return;
  }

  const c = data.data;
  printHeader('Campaign Launched');
  printKeyValue({
    'Campaign ID': c.id,
    'Name': c.name,
    'Status': c.status,
    'Recipients': c.total_recipients,
  });
  console.log();
}

// ============================================================================
// Campaigns — Pause
// ============================================================================

export async function mailCampaignsPause(
  id: string,
  options: { json?: boolean }
): Promise<void> {
  const spinner = createSpinner('Pausing campaign...').start();
  const data = await apiRequest<CampaignResponse>(`/mail/campaigns/${id}/pause`, {
    method: 'POST',
    body: {},
  });
  spinner.stop();

  if (options.json) {
    printJson(data);
    return;
  }

  console.log(chalk.green(`  Campaign ${id} paused.`));
  console.log();
}

// ============================================================================
// Campaigns — Resume
// ============================================================================

export async function mailCampaignsResume(
  id: string,
  options: { json?: boolean }
): Promise<void> {
  const spinner = createSpinner('Resuming campaign...').start();
  const data = await apiRequest<CampaignResponse>(`/mail/campaigns/${id}/resume`, {
    method: 'POST',
    body: {},
  });
  spinner.stop();

  if (options.json) {
    printJson(data);
    return;
  }

  console.log(chalk.green(`  Campaign ${id} resumed.`));
  console.log();
}

// ============================================================================
// Campaigns — Recipients
// ============================================================================

export async function mailCampaignsRecipients(
  id: string,
  options: { page?: string; perPage?: string; json?: boolean }
): Promise<void> {
  const spinner = createSpinner('Fetching recipients...').start();
  const data = await apiRequest<RecipientListResponse>(`/mail/campaigns/${id}/recipients`, {
    query: {
      ...(options.page && { page: parseInt(options.page, 10) }),
      ...(options.perPage && { per_page: parseInt(options.perPage, 10) }),
    },
  });
  spinner.stop();

  if (options.json) {
    printJson(data);
    return;
  }

  printHeader(`Recipients for Campaign ${id}`);
  console.log();

  if (data.data.length > 0) {
    const rows = data.data.map((r) => ({
      id: truncate(r.id, 16),
      name: r.recipient_name ? truncate(r.recipient_name, 20) : '—',
      address: r.recipient_address_1 ? truncate(r.recipient_address_1, 25) : '—',
      city: r.recipient_city || '—',
      state: r.recipient_state || '—',
      status: r.status,
      step: r.current_step_order,
    }));
    printTable(rows, ['id', 'name', 'address', 'city', 'state', 'status', 'step']);
  } else {
    console.log(chalk.dim('  No recipients found.'));
  }

  const p = data.pagination;
  printPagination({ ...p, total_results: p.total, total_pages: Math.ceil(p.total / p.per_page) });
  console.log();
}

// ============================================================================
// Campaigns — Analytics
// ============================================================================

export async function mailCampaignsAnalytics(
  id: string,
  options: { json?: boolean }
): Promise<void> {
  const spinner = createSpinner('Fetching analytics...').start();
  const data = await apiRequest<AnalyticsResponse>(`/mail/campaigns/${id}/analytics`);
  spinner.stop();

  if (options.json) {
    printJson(data);
    return;
  }

  const a = data.data;
  printHeader(`Analytics — ${a.campaign_name}`);
  printKeyValue({
    'Recipients': a.total_recipients,
    'Sent': a.total_sent,
    'Delivered': a.total_delivered,
    'Bounced': a.total_bounced,
    'Responses': a.total_responses,
    'Delivery Rate': `${a.delivery_rate.toFixed(1)}%`,
    'Response Rate': `${a.response_rate.toFixed(1)}%`,
  });
  console.log();
}

// ============================================================================
// Campaigns — Cost Estimate
// ============================================================================

export async function mailCampaignsCostEstimate(
  id: string,
  options: { json?: boolean }
): Promise<void> {
  const spinner = createSpinner('Estimating cost...').start();
  const data = await apiRequest<CostEstimateResponse>(`/mail/campaigns/${id}/cost-estimate`);
  spinner.stop();

  if (options.json) {
    printJson(data);
    return;
  }

  const e = data.data;
  printHeader('Cost Estimate');
  printKeyValue({
    'Recipients': e.recipient_count,
    'Price Per Card': `$${(e.price_per_card_cents / 100).toFixed(2)}`,
    'Total Cost': `$${e.total_cost_dollars.toFixed(2)}`,
    'Pay Now': `$${(e.pay_now_cost_cents / 100).toFixed(2)}`,
    'Pay Later': `$${(e.pay_later_cost_cents / 100).toFixed(2)}`,
    'Wallet Balance': `$${(e.wallet_balance_cents / 100).toFixed(2)}`,
    'Can Afford': e.can_afford ? 'yes' : 'no',
  });
  console.log();
}

// ============================================================================
// Designs — List
// ============================================================================

export async function mailDesignsList(options: {
  status?: string;
  size?: string;
  search?: string;
  page?: string;
  perPage?: string;
  json?: boolean;
}): Promise<void> {
  const spinner = createSpinner('Fetching designs...').start();
  const data = await apiRequest<DesignListResponse>('/mail/designs', {
    query: {
      ...(options.status && { status: options.status }),
      ...(options.size && { size: options.size }),
      ...(options.search && { search: options.search }),
      ...(options.page && { page: parseInt(options.page, 10) }),
      ...(options.perPage && { per_page: parseInt(options.perPage, 10) }),
    },
  });
  spinner.stop();

  if (options.json) {
    printJson(data);
    return;
  }

  printHeader('Mail Designs');
  console.log();

  if (data.data.length > 0) {
    const rows = data.data.map((d) => ({
      id: truncate(d.id, 20),
      name: truncate(d.name, 25),
      status: d.status,
      size: d.size,
      orientation: d.orientation,
      created: formatDate(d.created_at),
    }));
    printTable(rows, ['id', 'name', 'status', 'size', 'orientation', 'created']);
  } else {
    console.log(chalk.dim('  No designs found.'));
  }

  const p = data.pagination;
  console.log();
  console.log(chalk.dim(`Page ${p.page} — ${p.total} total designs${p.has_more ? ' (more available)' : ''}`));
  console.log();
}

// ============================================================================
// Designs — Create
// ============================================================================

export async function mailDesignsCreate(options: {
  body?: string;
  file?: string;
  json?: boolean;
}): Promise<void> {
  const requestBody = await parseRequestBody(options);

  const spinner = createSpinner('Creating design...').start();
  const data = await apiRequest<DesignResponse>('/mail/designs', {
    method: 'POST',
    body: requestBody,
  });
  spinner.stop();

  if (options.json) {
    printJson(data);
    return;
  }

  const d = data.data;
  printHeader('Design Created');
  printKeyValue({
    'Design ID': d.id,
    'Name': d.name,
    'Status': d.status,
    'Size': d.size,
    'Orientation': d.orientation,
    'Created': formatDate(d.created_at),
  });
  if (d.front_preview_url) {
    console.log();
    console.log(chalk.dim(`  Front preview: ${d.front_preview_url}`));
  }
  console.log();
}

// ============================================================================
// Designs — Get
// ============================================================================

export async function mailDesignsGet(
  id: string,
  options: { json?: boolean }
): Promise<void> {
  const spinner = createSpinner('Fetching design...').start();
  const data = await apiRequest<DesignResponse>(`/mail/designs/${id}`);
  spinner.stop();

  if (options.json) {
    printJson(data);
    return;
  }

  const d = data.data;
  printHeader(`Design ${d.id}`);
  printKeyValue({
    'Name': d.name,
    'Status': d.status,
    'Size': d.size,
    'Orientation': d.orientation,
    'Layout': d.layout || '—',
    'Theme': d.theme || '—',
    'Prompt': d.prompt ? truncate(d.prompt, 60) : '—',
    'Front Preview': d.front_preview_url || '—',
    'Back Preview': d.back_preview_url || '—',
    'Created': formatDate(d.created_at),
    'Published': d.published_at ? formatDate(d.published_at) : '—',
  });
  console.log();
}

// ============================================================================
// Designs — Update
// ============================================================================

export async function mailDesignsUpdate(
  id: string,
  options: { body?: string; file?: string; json?: boolean }
): Promise<void> {
  const requestBody = await parseRequestBody(options);

  const spinner = createSpinner('Updating design...').start();
  const data = await apiRequest<DesignResponse>(`/mail/designs/${id}`, {
    method: 'PATCH',
    body: requestBody,
  });
  spinner.stop();

  if (options.json) {
    printJson(data);
    return;
  }

  const d = data.data;
  printHeader('Design Updated');
  printKeyValue({
    'Design ID': d.id,
    'Name': d.name,
    'Status': d.status,
    'Updated': formatDate(d.updated_at),
  });
  console.log();
}

// ============================================================================
// Designs — Delete
// ============================================================================

export async function mailDesignsDelete(
  id: string,
  options: { json?: boolean }
): Promise<void> {
  const spinner = createSpinner('Deleting design...').start();
  const data = await apiRequest<{ deleted: boolean }>(`/mail/designs/${id}`, {
    method: 'DELETE',
  });
  spinner.stop();

  if (options.json) {
    printJson(data);
    return;
  }

  console.log(chalk.green(`  Design ${id} deleted.`));
  console.log();
}

// ============================================================================
// Return Addresses — List
// ============================================================================

export async function mailReturnAddressesList(options: {
  json?: boolean;
}): Promise<void> {
  const spinner = createSpinner('Fetching return addresses...').start();
  const data = await apiRequest<ReturnAddressListResponse>('/mail/return-addresses');
  spinner.stop();

  if (options.json) {
    printJson(data);
    return;
  }

  printHeader('Return Addresses');
  console.log();

  if (data.data.length > 0) {
    const rows = data.data.map((a) => ({
      id: truncate(a.id, 16),
      label: a.label || '—',
      name: truncate(a.name, 20),
      address: truncate(`${a.address_1}, ${a.city}, ${a.state} ${a.zip}`, 40),
      default: a.is_default ? 'yes' : '—',
      validated: a.is_validated ? 'yes' : 'no',
    }));
    printTable(rows, ['id', 'label', 'name', 'address', 'default', 'validated']);
  } else {
    console.log(chalk.dim('  No return addresses found.'));
  }
  console.log();
}

// ============================================================================
// Return Addresses — Create
// ============================================================================

export async function mailReturnAddressesCreate(options: {
  body?: string;
  file?: string;
  json?: boolean;
}): Promise<void> {
  const requestBody = await parseRequestBody(options);

  const spinner = createSpinner('Creating return address...').start();
  const data = await apiRequest<ReturnAddressResponse>('/mail/return-addresses', {
    method: 'POST',
    body: requestBody,
  });
  spinner.stop();

  if (options.json) {
    printJson(data);
    return;
  }

  const a = data.data;
  printHeader('Return Address Created');
  printKeyValue({
    'ID': a.id,
    'Name': a.name,
    'Label': a.label || '—',
    'Address': `${a.address_1}, ${a.city}, ${a.state} ${a.zip}`,
    'Validated': a.is_validated ? 'yes' : 'no',
    'Default': a.is_default ? 'yes' : 'no',
  });
  if (data.corrected) {
    console.log(chalk.yellow('  Address was corrected by USPS validation.'));
  }
  console.log();
}

// ============================================================================
// Return Addresses — Get
// ============================================================================

export async function mailReturnAddressesGet(
  id: string,
  options: { json?: boolean }
): Promise<void> {
  const spinner = createSpinner('Fetching return address...').start();
  const data = await apiRequest<{ data: ReturnAddress }>(`/mail/return-addresses/${id}`);
  spinner.stop();

  if (options.json) {
    printJson(data);
    return;
  }

  const a = data.data;
  printHeader(`Return Address ${a.id}`);
  printKeyValue({
    'Name': a.name,
    'Label': a.label || '—',
    'Address 1': a.address_1,
    'Address 2': a.address_2 || '—',
    'City': a.city,
    'State': a.state,
    'ZIP': a.zip,
    'Validated': a.is_validated ? 'yes' : 'no',
    'Default': a.is_default ? 'yes' : 'no',
    'Created': formatDate(a.created_at),
  });
  console.log();
}

// ============================================================================
// Return Addresses — Update
// ============================================================================

export async function mailReturnAddressesUpdate(
  id: string,
  options: { body?: string; file?: string; json?: boolean }
): Promise<void> {
  const requestBody = await parseRequestBody(options);

  const spinner = createSpinner('Updating return address...').start();
  const data = await apiRequest<ReturnAddressResponse>(`/mail/return-addresses/${id}`, {
    method: 'PATCH',
    body: requestBody,
  });
  spinner.stop();

  if (options.json) {
    printJson(data);
    return;
  }

  const a = data.data;
  printHeader('Return Address Updated');
  printKeyValue({
    'ID': a.id,
    'Name': a.name,
    'Address': `${a.address_1}, ${a.city}, ${a.state} ${a.zip}`,
    'Validated': a.is_validated ? 'yes' : 'no',
  });
  if (data.corrected) {
    console.log(chalk.yellow('  Address was corrected by USPS validation.'));
  }
  console.log();
}

// ============================================================================
// Return Addresses — Delete
// ============================================================================

export async function mailReturnAddressesDelete(
  id: string,
  options: { json?: boolean }
): Promise<void> {
  const spinner = createSpinner('Deleting return address...').start();
  const data = await apiRequest<{ deleted: boolean }>(`/mail/return-addresses/${id}`, {
    method: 'DELETE',
  });
  spinner.stop();

  if (options.json) {
    printJson(data);
    return;
  }

  console.log(chalk.green(`  Return address ${id} deleted.`));
  console.log();
}

// ============================================================================
// Return Addresses — Set Default
// ============================================================================

export async function mailReturnAddressesSetDefault(
  id: string,
  options: { json?: boolean }
): Promise<void> {
  const spinner = createSpinner('Setting default...').start();
  const data = await apiRequest<{ data: ReturnAddress }>(`/mail/return-addresses/${id}/default`, {
    method: 'POST',
    body: {},
  });
  spinner.stop();

  if (options.json) {
    printJson(data);
    return;
  }

  const a = data.data;
  console.log(chalk.green(`  Return address ${a.id} (${a.name}) set as default.`));
  console.log();
}

// ============================================================================
// Wallet — Balance
// ============================================================================

export async function mailWalletBalance(options: {
  json?: boolean;
}): Promise<void> {
  const spinner = createSpinner('Fetching wallet balance...').start();
  const data = await apiRequest<WalletBalance>('/mail/wallet/balance');
  spinner.stop();

  if (options.json) {
    printJson(data);
    return;
  }

  const w = data.data;
  printHeader('Mail Wallet');
  printKeyValue({
    'Balance': w.balance_formatted,
    'Available': w.available_formatted,
    'Pending': `$${(w.pending_cents / 100).toFixed(2)}`,
    'Lifetime Credits': `$${(w.lifetime_credits_cents / 100).toFixed(2)}`,
    'Lifetime Spent': `$${(w.lifetime_spent_cents / 100).toFixed(2)}`,
    'Auto-Reload': w.auto_reload.enabled
      ? `Enabled (threshold: $${(w.auto_reload.threshold_cents / 100).toFixed(2)}, amount: $${(w.auto_reload.amount_cents / 100).toFixed(2)})`
      : 'Disabled',
  });
  console.log();
}

// ============================================================================
// Wallet — Add Funds
// ============================================================================

export async function mailWalletAddFunds(options: {
  body?: string;
  file?: string;
  json?: boolean;
}): Promise<void> {
  const requestBody = await parseRequestBody(options);

  const spinner = createSpinner('Adding funds...').start();
  const data = await apiRequest<{ data: { payment_intent_id: string; amount_cents: number; succeeded?: boolean; requires_action?: boolean } }>('/mail/wallet/add-funds', {
    method: 'POST',
    body: requestBody,
  });
  spinner.stop();

  if (options.json) {
    printJson(data);
    return;
  }

  const r = data.data;
  printHeader('Add Funds');
  printKeyValue({
    'Payment Intent': r.payment_intent_id,
    'Amount': `$${(r.amount_cents / 100).toFixed(2)}`,
    'Succeeded': r.succeeded ? 'yes' : 'no',
    'Requires Action': r.requires_action ? 'yes' : 'no',
  });
  console.log();
}

// ============================================================================
// Wallet — Transactions
// ============================================================================

export async function mailWalletTransactions(options: {
  type?: string;
  referenceType?: string;
  campaignId?: string;
  page?: string;
  perPage?: string;
  json?: boolean;
}): Promise<void> {
  const spinner = createSpinner('Fetching transactions...').start();
  const data = await apiRequest<WalletTransactionsResponse>('/mail/wallet/transactions', {
    query: {
      ...(options.type && { type: options.type }),
      ...(options.referenceType && { reference_type: options.referenceType }),
      ...(options.campaignId && { campaign_id: options.campaignId }),
      ...(options.page && { page: parseInt(options.page, 10) }),
      ...(options.perPage && { per_page: parseInt(options.perPage, 10) }),
    },
  });
  spinner.stop();

  if (options.json) {
    printJson(data);
    return;
  }

  printHeader('Wallet Transactions');
  console.log();

  if (data.data.length > 0) {
    const rows = data.data.map((t) => ({
      id: truncate(t.id, 16),
      type: t.type,
      amount: `$${(t.amount_cents / 100).toFixed(2)}`,
      balance: `$${(t.balance_after_cents / 100).toFixed(2)}`,
      description: t.description ? truncate(t.description, 30) : '—',
      date: formatDate(t.created_at),
    }));
    printTable(rows, ['id', 'type', 'amount', 'balance', 'description', 'date']);
  } else {
    console.log(chalk.dim('  No transactions found.'));
  }

  const p = data.pagination;
  console.log();
  console.log(chalk.dim(`Page ${p.page} — ${p.total} total transactions${p.has_more ? ' (more available)' : ''}`));
  console.log();
}

// ============================================================================
// Wallet — Pricing
// ============================================================================

export async function mailWalletPricing(options: {
  json?: boolean;
}): Promise<void> {
  const spinner = createSpinner('Fetching pricing...').start();
  const data = await apiRequest<WalletPricingResponse>('/mail/wallet/pricing');
  spinner.stop();

  if (options.json) {
    printJson(data);
    return;
  }

  printHeader('Mail Pricing');
  console.log();
  console.log(chalk.dim(`  Plan: ${data.data.plan_slug}`));
  if (data.data.current_usage !== undefined) {
    console.log(chalk.dim(`  Current usage: ${data.data.current_usage} cards`));
  }
  console.log();

  if (data.data.sizes.length > 0) {
    const rows = data.data.sizes.map((s) => ({
      size: s.size,
      price: `$${(s.price_cents / 100).toFixed(2)}`,
      label: s.label || '—',
    }));
    printTable(rows, ['size', 'price', 'label']);
  }

  if (data.data.bands && data.data.bands.length > 0) {
    console.log();
    console.log(chalk.bold('Volume Pricing'));
    console.log(chalk.dim('─'.repeat(50)));
    for (const band of data.data.bands) {
      const prices = band.prices.map((p) => `${p.size}: $${(p.price_cents / 100).toFixed(2)}`).join(', ');
      console.log(`  ${band.threshold_quantity}+ cards${band.label ? ` (${band.label})` : ''}: ${prices}`);
    }
  }
  console.log();
}
