import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockApiRequest, mockParseRequestBody, mockPrintTable } = vi.hoisted(() => ({
  mockApiRequest: vi.fn(),
  mockParseRequestBody: vi.fn().mockResolvedValue({}),
  mockPrintTable: vi.fn(),
}));

vi.mock('../../src/lib/client.js', () => ({ apiRequest: mockApiRequest }));
vi.mock('../../src/lib/output.js', () => ({
  parseRequestBody: mockParseRequestBody,
  printJson: vi.fn(),
  printHeader: vi.fn(),
  printTable: mockPrintTable,
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
import { propertiesGet, propertiesIds } from '../../src/commands/properties.js';
import {
  enrichAddress,
  enrichApn,
  enrichEmail,
  enrichLatLng,
  enrichName,
  enrichPhone,
} from '../../src/commands/enrich.js';
import {
  addressesAutocomplete,
  locationsAutocomplete,
} from '../../src/commands/locations.js';

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
  it('passes contact_audience=none to single and batch property lookups', async () => {
    mockApiRequest.mockResolvedValue({
      data: { dm_property_id: 'prop_123' },
      credits: { used: 1, properties: 1, people: 0, deduplicated: 0 },
    });

    await propertiesGet('prop_123', { contactAudience: 'none', json: true });
    expect(mockApiRequest).toHaveBeenCalledWith('/properties/prop_123', {
      query: { contact_audience: 'none' },
    });

    await propertiesIds({ ids: ['prop_123'], contactAudience: 'none', json: true });
    expect(mockApiRequest).toHaveBeenCalledWith('/properties/ids', {
      method: 'POST',
      body: { ids: ['prop_123'], contact_audience: 'none' },
    });
  });

  it('passes contact_audience=none to property enrichment', async () => {
    await enrichAddress('123 Main St, Austin, TX 78704', {
      contactAudience: 'none',
      json: true,
    });
    expect(mockApiRequest).toHaveBeenCalledWith('/enrichment/address', {
      method: 'POST',
      body: {
        data: [{ full_address: '123 Main St, Austin, TX 78704' }],
        contact_audience: 'none',
      },
    });

    await enrichLatLng('30.25,-97.75', { contactAudience: 'none', json: true });
    expect(mockApiRequest).toHaveBeenCalledWith('/enrichment/reverse-geocode', {
      method: 'POST',
      body: {
        data: [{ latitude: 30.25, longitude: -97.75 }],
        contact_audience: 'none',
      },
    });

    await enrichApn('1234567890', { contactAudience: 'none', json: true });
    expect(mockApiRequest).toHaveBeenCalledWith('/enrichment/apn', {
      method: 'POST',
      body: {
        data: [{ apn: '1234567890' }],
        contact_audience: 'none',
      },
    });
  });

  it('passes fields and property_limit to a single person lookup', async () => {
    mockApiRequest.mockResolvedValue({
      data: { dm_person_id: 'per_123' },
      credits: { used: 1, properties: 0, people: 1, deduplicated: 0 },
    });

    await peopleGet('per_123', {
      includeProperties: true,
      propertyLimit: '20',
      fields: 'estimated_household_income,estimated_value',
      json: true,
    });

    expect(mockApiRequest).toHaveBeenCalledWith('/people/per_123', {
      query: {
        include_properties: 'true',
        property_limit: '20',
        fields: 'estimated_household_income,estimated_value',
      },
    });
  });

  it('passes fields and property_limit to batch person lookup', async () => {
    await peopleIds({
      ids: ['per_123', 'per_456'],
      includeProperties: true,
      propertyLimit: '15',
      fields: 'estimated_household_income, estimated_value',
      json: true,
    });

    expect(mockApiRequest).toHaveBeenCalledWith('/people/ids', {
      method: 'POST',
      body: {
        ids: ['per_123', 'per_456'],
        include_properties: true,
        property_limit: 15,
        fields: ['estimated_household_income', 'estimated_value'],
      },
    });
  });

  it('passes fields to a single property lookup', async () => {
    mockApiRequest.mockResolvedValue({
      data: { dm_property_id: 'prop_123' },
      credits: { used: 1, properties: 1, people: 0, deduplicated: 0 },
    });

    await propertiesGet('prop_123', {
      fields: 'estimated_value,equity',
      json: true,
    });

    expect(mockApiRequest).toHaveBeenCalledWith('/properties/prop_123', {
      query: { fields: 'estimated_value,equity' },
    });
  });

  it.each([
    ['address', enrichAddress, '123 Main St, Austin, TX 78704', '/enrichment/address'],
    ['coordinates', enrichLatLng, '30.25,-97.75', '/enrichment/reverse-geocode'],
    ['APN', enrichApn, '0123-456-789', '/enrichment/apn'],
    ['email', enrichEmail, 'jane@example.com', '/enrichment/email'],
    ['phone', enrichPhone, '5125551234', '/enrichment/phone'],
    ['name', enrichName, 'Jane Owner', '/enrichment/name'],
  ] as const)('passes selected fields to %s enrichment', async (_label, command, value, path) => {
    await command(value, { fields: 'estimated_value, equity', json: true });

    expect(mockApiRequest).toHaveBeenCalledWith(path, {
      method: 'POST',
      body: expect.objectContaining({ fields: ['estimated_value', 'equity'] }),
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

  it('passes autocomplete controls to the addresses endpoint', async () => {
    mockApiRequest.mockResolvedValue({
      data: [],
      meta: { query: '1200 Barton', scope: 'all', limit: 5, returned: 0, partial_results: false },
    });

    await addressesAutocomplete({
      query: '1200 Barton',
      scope: 'all',
      state: 'TX',
      limit: '5',
      latitude: '30.26',
      longitude: '-97.76',
      json: true,
    });

    expect(mockApiRequest).toHaveBeenCalledWith('/addresses/autocomplete', {
      query: {
        q: '1200 Barton',
        scope: 'all',
        state: 'TX',
        limit: '5',
        latitude: '30.26',
        longitude: '-97.76',
      },
    });
  });

  it('keeps the locations autocomplete command as a compatibility alias', async () => {
    mockApiRequest.mockResolvedValue({
      data: [],
      meta: { query: 'Austin', scope: 'location', limit: 5, returned: 0, partial_results: false },
    });

    await locationsAutocomplete({ query: 'Austin', scope: 'location', json: true });

    expect(mockApiRequest).toHaveBeenCalledWith('/addresses/autocomplete', {
      query: { q: 'Austin', scope: 'location' },
    });
  });

  it('shows the free property_count in name enrichment output', async () => {
    mockApiRequest.mockResolvedValue({
      data: [{ dm_person_id: 'per_123', full_name: 'Jane Owner', property_count: 7 }],
      pagination: { page: 1, per_page: 25, total: 1, total_pages: 1 },
      credits: { used: 1, properties: 0, people: 1, deduplicated: 0 },
    });

    await enrichName('Jane Owner', {});

    expect(mockPrintTable).toHaveBeenCalledWith(
      [expect.objectContaining({ properties: '7' })],
      ['id', 'name', 'phones', 'emails', 'properties']
    );
  });

  it('shows the free property_count in email and phone enrichment output', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    mockApiRequest.mockResolvedValue({
      data: [
        {
          matched: true,
          input: { email: 'jane@example.com' },
          contacts: [{ dm_person_id: 'per_123', full_name: 'Jane Owner', property_count: 7 }],
        },
      ],
      totals: { submitted: 1, matched: 1, unmatched: 0 },
      credits: { used: 1, properties: 0, people: 1, deduplicated: 0 },
    });

    await enrichEmail('jane@example.com', {});

    const rendered = consoleSpy.mock.calls.flat().join('\n');
    expect(rendered).toContain('properties:');
    expect(rendered).toContain('7');
    consoleSpy.mockRestore();
  });
});
