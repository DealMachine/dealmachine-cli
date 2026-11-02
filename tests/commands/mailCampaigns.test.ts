import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockApiRequest, mockConfirm, mockNonInteractive } = vi.hoisted(() => ({
  mockApiRequest: vi.fn(),
  mockConfirm: vi.fn(),
  mockNonInteractive: vi.fn(() => false),
}));

vi.mock('../../src/lib/client.js', () => ({
  apiRequest: mockApiRequest,
  formatDate: () => 'Oct 14, 2026',
}));
vi.mock('../../src/lib/confirm.js', () => ({
  confirmPrompt: mockConfirm,
  isNonInteractive: mockNonInteractive,
}));
vi.mock('../../src/lib/output.js', () => ({
  isQuiet: vi.fn(() => false),
  parseRequestBody: vi.fn(),
  printJson: vi.fn(),
  printHeader: vi.fn(),
  printTable: vi.fn(),
  printKeyValue: vi.fn(),
  printPagination: vi.fn(),
  truncate: vi.fn((value: string) => value),
  createSpinner: vi.fn(() => ({
    start() {
      return this;
    },
    stop: vi.fn(),
    text: '',
  })),
}));

import { printJson, printKeyValue, printTable } from '../../src/lib/output.js';
import {
  mailCampaignsAddProperties,
  mailCampaignsEnd,
  mailCampaignsArchive,
  mailCampaignsEstimateAdd,
  mailCampaignsList,
  parsePropertyIds,
} from '../../src/commands/mail.js';

const estimate = {
  data: {
    campaign_id: 'camp_1',
    status: 'active',
    property_count: 2,
    pay_today_cents: 250,
    pay_later_cents: 500,
    total_cost_cents: 750,
    pieces_per_property: 3,
    wallet_available_cents: 10000,
    auto_reload_enabled: true,
    can_afford: true,
    requires_auto_reload: false,
    steps: [],
  },
};

const addResult = {
  data: {
    campaign_id: 'camp_1',
    status: 'active',
    added_count: 1,
    skipped: [{ property_id: '102', reason: 'do_not_contact' }],
    enqueued_count: 1,
    scheduled_count: 2,
  },
};

let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockNonInteractive.mockReturnValue(false);
  process.exitCode = undefined;
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  process.exitCode = undefined;
  vi.restoreAllMocks();
});

describe('dm mail campaigns', () => {
  it('lists only campaigns that accept properties with the new status values', async () => {
    mockApiRequest.mockResolvedValue({
      data: [],
      pagination: { page: 1, per_page: 25, total: 0, has_more: false },
    });
    await mailCampaignsList({ status: 'ready', acceptingProperties: true, json: true });
    expect(mockApiRequest).toHaveBeenCalledWith('/mail/campaigns', {
      query: { status: 'ready', accepting_properties: true },
    });
  });

  it('shows the charge due today and adds properties only after confirmation', async () => {
    mockApiRequest.mockResolvedValueOnce(estimate).mockResolvedValueOnce(addResult);
    mockConfirm.mockResolvedValue(true);

    await mailCampaignsAddProperties('camp_1', { propertyIds: ['101,102'], recipient: 'owner' });

    expect(mockApiRequest).toHaveBeenNthCalledWith(1, '/mail/campaigns/camp_1/properties/estimate', {
      query: { count: 2 },
    });
    expect(printKeyValue).toHaveBeenCalledWith(
      expect.objectContaining({ 'Charged Today': '$2.50', 'Charged Later': '$5.00' })
    );
    expect(mockConfirm).toHaveBeenCalledWith('Add 2 properties and charge $2.50 today?');
    expect(mockApiRequest).toHaveBeenNthCalledWith(2, '/mail/campaigns/camp_1/properties', {
      method: 'POST',
      body: { property_ids: ['101', '102'], recipient: 'owner' },
    });
    expect(printTable).toHaveBeenCalledWith(
      [{ property: '102', reason: 'Marked Do Not Contact' }],
      ['property', 'reason']
    );
  });

  it('adds nothing when the person declines', async () => {
    mockApiRequest.mockResolvedValueOnce(estimate);
    mockConfirm.mockResolvedValue(false);
    await mailCampaignsAddProperties('camp_1', { propertyIds: ['101'], recipient: 'resident' });
    expect(mockApiRequest).toHaveBeenCalledTimes(1);
  });

  it('returns only the estimate to agents that did not pass --yes', async () => {
    mockNonInteractive.mockReturnValue(true);
    mockApiRequest.mockResolvedValueOnce(estimate);

    await mailCampaignsAddProperties('camp_1', {
      propertyIds: ['101', '102'],
      recipient: 'owner',
      json: true,
    });

    expect(mockApiRequest).toHaveBeenCalledTimes(1);
    expect(mockConfirm).not.toHaveBeenCalled();
    expect(printJson).toHaveBeenCalledWith(
      expect.objectContaining({ added: false, confirmation_required: true, data: estimate.data })
    );
    expect(errorSpy.mock.calls.join(' ')).toContain('No properties were added');
    // Nothing was added, so scripts and agents see a failure, as end does.
    expect(process.exitCode).toBe(1);
  });

  it('adds immediately with --yes', async () => {
    mockApiRequest.mockResolvedValueOnce(addResult);
    await mailCampaignsAddProperties('camp_1', {
      propertyIds: ['101'],
      recipient: 'owner',
      yes: true,
      json: true,
    });
    expect(mockApiRequest).toHaveBeenCalledTimes(1);
    expect(mockApiRequest).toHaveBeenCalledWith('/mail/campaigns/camp_1/properties', {
      method: 'POST',
      body: { property_ids: ['101'], recipient: 'owner' },
    });
    expect(printJson).toHaveBeenCalledWith(addResult);
  });

  it('rejects a missing recipient and bad property IDs before calling the API', async () => {
    await mailCampaignsAddProperties('camp_1', { propertyIds: ['101'], yes: true });
    await mailCampaignsAddProperties('camp_1', { propertyIds: ['abc'], recipient: 'owner', yes: true });
    expect(mockApiRequest).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
    expect(() => parsePropertyIds(Array(5001).fill(0).map((_, i) => String(i + 1)))).toThrow(
      'at most 5000'
    );
    expect(parsePropertyIds(['5 5', '6'])).toEqual(['5', '6']);
  });

  it('estimates adding a number of properties', async () => {
    mockApiRequest.mockResolvedValueOnce(estimate);
    await mailCampaignsEstimateAdd('camp_1', { count: '25', json: true });
    expect(mockApiRequest).toHaveBeenCalledWith('/mail/campaigns/camp_1/properties/estimate', {
      query: { count: 25 },
    });
    await mailCampaignsEstimateAdd('camp_1', { count: '0' });
    expect(mockApiRequest).toHaveBeenCalledTimes(1);
    expect(process.exitCode).toBe(1);
  });

  it('ends a campaign only after the person confirms', async () => {
    mockConfirm.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    mockApiRequest.mockResolvedValue({
      data: { id: 'camp_1', status: 'ended' },
      stopped_mail_count: 4,
      already_printed_count: 1,
    });

    await mailCampaignsEnd('camp_1', {});
    expect(mockApiRequest).not.toHaveBeenCalled();

    await mailCampaignsEnd('camp_1', {});
    expect(mockApiRequest).toHaveBeenCalledWith('/mail/campaigns/camp_1/end', {
      method: 'POST',
      body: {},
    });
  });

  it('refuses to end a campaign for an agent without --yes', async () => {
    mockNonInteractive.mockReturnValue(true);
    await mailCampaignsEnd('camp_1', { json: true });
    expect(mockApiRequest).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
    expect(errorSpy.mock.calls.join(' ')).toContain('permanent');

    mockApiRequest.mockResolvedValue({ data: { id: 'camp_1', status: 'ended' } });
    await mailCampaignsEnd('camp_1', { json: true, yes: true });
    expect(mockApiRequest).toHaveBeenCalledTimes(1);
  });
});


it('requires confirmation before archiving and posts the archive request after approval', async () => {
  mockNonInteractive.mockReturnValue(true);
  await mailCampaignsArchive('camp_1', { json: true });
  expect(mockApiRequest).not.toHaveBeenCalled();
  mockApiRequest.mockResolvedValue({ data: { id: 'camp_1', status: 'archived' } });
  await mailCampaignsArchive('camp_1', { yes: true, json: true });
  expect(mockApiRequest).toHaveBeenCalledWith('/mail/campaigns/camp_1/archive', { method: 'POST', body: {} });
});
