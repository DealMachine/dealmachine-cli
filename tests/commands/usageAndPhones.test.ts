import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockApiRequest } = vi.hoisted(() => ({
  mockApiRequest: vi.fn(),
}));

vi.mock('../../src/lib/client.js', () => ({ apiRequest: mockApiRequest }));
vi.mock('../../src/lib/output.js', () => ({
  parseRequestBody: vi.fn().mockResolvedValue({}),
  printJson: vi.fn(),
  printHeader: vi.fn(),
  printTotals: vi.fn(),
  printCredits: vi.fn(),
  createSpinner: vi.fn(() => ({
    start() {
      return this;
    },
    stop: vi.fn(),
  })),
}));

import { phonesDnc } from '../../src/commands/phones.js';
import { usage } from '../../src/commands/usage.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('usage and phone status output', () => {
  it('shows the combined credit cap and separate remaining balances', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    mockApiRequest.mockResolvedValue({
      plan: { name: 'Pro', is_paid: true },
      billing_cycle: { start: '2026-07-01T00:00:00.000Z', end: '2026-08-01T00:00:00.000Z' },
      credits: {
        included: 1000,
        total_cap: 2000,
        total_available: 500,
        monthly_remaining: 200,
        additional_remaining: 300,
        used: 1500,
        remaining: 0,
        overage: 0,
        breakdown: { properties: 900, people: 600, companies: 0 },
      },
    });

    await usage({});

    const rendered = consoleSpy.mock.calls.flat().join('\n');
    expect(rendered).toContain('1,500 / 2,000 (75%)');
    expect(rendered).toContain('Remaining:    500');
    expect(rendered).toContain('Monthly left: 200');
    expect(rendered).toContain('Extra left:   300');
    consoleSpy.mockRestore();
  });

  it('does not report an unknown DNC value as clear', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    mockApiRequest.mockResolvedValue({
      data: [{ input: { number: '5125551234' }, matched: true }],
      totals: { submitted: 1, matched: 1, unmatched: 0 },
      credits: { used: 0, people: 0, deduplicated: 0 },
    });

    await phonesDnc('5125551234', {});

    const rendered = consoleSpy.mock.calls.flat().join('\n');
    expect(rendered).toContain('UNKNOWN');
    expect(rendered).not.toContain('  OK');
    consoleSpy.mockRestore();
  });
});
