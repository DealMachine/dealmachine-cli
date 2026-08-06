import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockApiRequest, mockPrintJson, mockPrintWarning } = vi.hoisted(() => ({
  mockApiRequest: vi.fn(),
  mockPrintJson: vi.fn(),
  mockPrintWarning: vi.fn(),
}));

vi.mock('../../src/lib/client.js', () => ({ apiRequest: mockApiRequest }));
vi.mock('../../src/lib/output.js', () => ({
  printJson: mockPrintJson,
  printHeader: vi.fn(),
  printTable: vi.fn(),
  printPagination: vi.fn(),
  printWarning: mockPrintWarning,
  truncate: vi.fn((value: string) => value),
  createSpinner: vi.fn(() => ({
    start() {
      return this;
    },
    stop: vi.fn(),
  })),
}));

import { filters } from '../../src/commands/filters.js';

beforeEach(() => {
  vi.clearAllMocks();
  mockApiRequest.mockResolvedValue({
    data: [],
    pagination: {
      page: 1,
      per_page: 25,
      total_results: 0,
      total_pages: 1,
      has_next_page: false,
      has_previous_page: false,
    },
  });
});

describe('filter lookup guidance', () => {
  it('routes an empty people name-filter lookup to name enrichment in JSON output', async () => {
    await filters({ sourceType: 'people', search: 'full name', json: true });

    expect(mockPrintJson).toHaveBeenCalledWith(
      expect.objectContaining({
        suggestion: expect.stringContaining('dm enrich name'),
      })
    );
  });

  it('prints the same routing hint for human output', async () => {
    await filters({ sourceType: 'people', search: 'last_name' });

    expect(mockPrintWarning).toHaveBeenCalledWith(expect.stringContaining('dm enrich name'));
  });

  it('does not suggest name enrichment for unrelated empty filter searches', async () => {
    await filters({
      sourceType: 'people',
      search: 'household income',
      json: true,
    });

    expect(mockPrintJson).toHaveBeenCalledWith(expect.not.objectContaining({ suggestion: expect.anything() }));
  });
});
