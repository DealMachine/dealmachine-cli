import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockApiRequest, mockParseRequestBody } = vi.hoisted(() => ({
  mockApiRequest: vi.fn(),
  mockParseRequestBody: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../src/lib/client.js', () => ({ apiRequest: mockApiRequest }));
vi.mock('../../src/lib/output.js', () => ({
  parseRequestBody: mockParseRequestBody,
  printJson: vi.fn(),
  printHeader: vi.fn(),
  printTable: vi.fn(),
  printPagination: vi.fn(),
  printTotals: vi.fn(),
  printCredits: vi.fn(),
  printWarning: vi.fn(),
  truncate: vi.fn((value: string) => value),
  formatCurrency: vi.fn((value: unknown) => String(value)),
  createSpinner: vi.fn(() => ({
    start() {
      return this;
    },
    stop: vi.fn(),
    text: '',
  })),
}));

import { peopleGet, peopleIds } from '../../src/commands/people.js';
import { enrichEmail, enrichName, enrichPhone } from '../../src/commands/enrich.js';

beforeEach(() => {
  vi.clearAllMocks();
  mockApiRequest.mockResolvedValue({
    data: [],
    totals: { submitted: 0, matched: 0, unmatched: 0, found: 0, not_found: 0 },
    pagination: { page: 1, per_page: 25, total: 0, total_pages: 1 },
    credits: { used: 0, properties: 0, people: 0, deduplicated: 0 },
  });
});

describe('CLI public API extensions', () => {
  it('passes fields to a single person lookup', async () => {
    mockApiRequest.mockResolvedValue({
      data: { dm_person_id: 'per_123' },
      credits: { used: 1, properties: 0, people: 1, deduplicated: 0 },
    });

    await peopleGet('per_123', {
      fields: 'estimated_household_income,estimated_value',
      json: true,
    });

    expect(mockApiRequest).toHaveBeenCalledWith('/people/per_123', {
      query: { fields: 'estimated_household_income,estimated_value' },
    });
  });

  it('passes fields as an array to batch person lookup', async () => {
    await peopleIds({
      ids: ['per_123', 'per_456'],
      fields: 'estimated_household_income, estimated_value',
      json: true,
    });

    expect(mockApiRequest).toHaveBeenCalledWith('/people/ids', {
      method: 'POST',
      body: {
        ids: ['per_123', 'per_456'],
        fields: ['estimated_household_income', 'estimated_value'],
      },
    });
  });

  it.each([
    ['email', enrichEmail, 'jane@example.com', '/enrichment/email'],
    ['phone', enrichPhone, '5125551234', '/enrichment/phone'],
  ] as const)('passes a city place ID to %s enrichment', async (_label, command, value, path) => {
    await command(value, { city: '53584', json: true });

    expect(mockApiRequest).toHaveBeenCalledWith(
      path,
      expect.objectContaining({
        method: 'POST',
        body: expect.objectContaining({ location: { type: 'city', code: '53584' } }),
      })
    );
  });

  it('passes a city place ID to name enrichment', async () => {
    await enrichName('Jane Owner', { city: '53584', json: true });

    expect(mockApiRequest).toHaveBeenCalledWith('/enrichment/name', {
      method: 'POST',
      body: expect.objectContaining({ location: { type: 'city', code: '53584' } }),
    });
  });
});
