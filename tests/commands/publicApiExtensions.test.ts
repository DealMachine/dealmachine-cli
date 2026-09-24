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

import { printJson } from '../../src/lib/output.js';
import { peopleGet, peopleIds, peopleSearch } from '../../src/commands/people.js';
import { propertiesGet, propertiesIds, propertiesSearch } from '../../src/commands/properties.js';
import {
  enrichAddress,
  enrichApn,
  enrichEmail,
  enrichLatLng,
  enrichName,
  enrichPhone,
} from '../../src/commands/enrich.js';
import { addressesAutocomplete, locationsAutocomplete } from '../../src/commands/locations.js';
import { drivingGet, drivingList } from '../../src/commands/driving.js';
import { prospectsList } from '../../src/commands/prospects.js';

beforeEach(() => {
  vi.clearAllMocks();
  mockParseRequestBody.mockResolvedValue({});
  mockApiRequest.mockResolvedValue({
    data: [],
    totals: { submitted: 0, matched: 0, unmatched: 0, found: 0, not_found: 0 },
    pagination: { page: 1, per_page: 25, total: 0, total_pages: 1 },
    credits: { used: 0, properties: 0, people: 0, deduplicated: 0 },
  });
});

describe('CLI public API extensions', () => {
  it('reads drive history and filters prospects added during drives', async () => {
    mockApiRequest
      .mockResolvedValueOnce({
        data: [],
        pagination: { page: 1, per_page: 25, total: 0, has_more: false },
      })
      .mockResolvedValueOnce({
        data: { id: 'drive_session_501', events: [], visits: [], prospects: [] },
      })
      .mockResolvedValueOnce({
        data: [],
        pagination: { page: 1, per_page: 25, total: 0, has_more: false },
      });

    await drivingList({ mode: 'free_drive', page: '2', perPage: '10', json: true });
    expect(mockApiRequest).toHaveBeenCalledWith('/driving/drives', {
      query: {
        driver_user_id: undefined,
        mode: 'free_drive',
        started_after: undefined,
        started_before: undefined,
        page: 2,
        per_page: 10,
      },
    });

    await drivingGet('drive_session_501', { json: true });
    expect(mockApiRequest).toHaveBeenCalledWith('/driving/drives/drive_session_501');

    await prospectsList({ source: 'driving', json: true });
    expect(mockApiRequest).toHaveBeenCalledWith(
      '/prospects',
      expect.objectContaining({ query: expect.objectContaining({ source: 'driving' }) })
    );
  });

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
    await enrichName('Jane Owner', { city: '53584', json: true, yes: true });

    expect(mockApiRequest).toHaveBeenCalledWith('/enrichment/name', {
      method: 'POST',
      body: expect.objectContaining({ location: { type: 'city', code: '53584' } }),
    });
  });

  it.each([
    ['property', propertiesSearch, '/properties/search'],
    ['people', peopleSearch, '/people/search'],
  ] as const)(
    'automatically estimates a non-interactive %s search and executes only with --yes',
    async (_label, command, endpoint) => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockApiRequest.mockResolvedValue({
        totals: { properties: 10, people: 10 },
        pagination: {
          page: 1,
          per_page: 25,
          total_results: 10,
          total_pages: 1,
          has_next_page: false,
          has_previous_page: false,
        },
        estimated_credits: {
          this_page: 10,
          total_all_pages: 10,
          breakdown: {
            properties: 10,
            people: 0,
            already_accessed: 0,
            note: 'Estimate only',
          },
        },
      });

      await command({ body: '{}', json: true });
      expect(mockApiRequest).toHaveBeenLastCalledWith(endpoint, {
        method: 'POST',
        body: { estimate_cost: true },
      });
      expect(error).toHaveBeenCalledWith(expect.stringContaining('No credits were spent'));

      mockParseRequestBody.mockResolvedValueOnce({});
      await command({ body: '{}', json: true, yes: true });
      expect(mockApiRequest).toHaveBeenLastCalledWith(endpoint, {
        method: 'POST',
        body: {},
      });
    }
  );

  it('automatically estimates non-interactive name enrichment and requires --yes to execute', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockApiRequest.mockResolvedValue({
      totals: { people: 1, properties: 0 },
      pagination: {
        page: 1,
        per_page: 25,
        total_results: 1,
        total_pages: 1,
        has_next_page: false,
        has_previous_page: false,
      },
      estimated_credits: {
        this_page: 1,
        total_all_pages: 1,
        breakdown: {
          people: 1,
          properties: 0,
          already_accessed: 0,
          note: 'Estimate only',
        },
      },
    });

    await enrichName('Jane Owner', { state: 'TX', json: true });
    expect(mockApiRequest).toHaveBeenLastCalledWith('/enrichment/name', {
      method: 'POST',
      body: {
        data: [{ first_name: 'Jane', last_name: 'Owner' }],
        location: { type: 'state', code: 'TX' },
        estimate_cost: true,
      },
    });
    expect(error).toHaveBeenCalledWith(expect.stringContaining('No credits were spent'));

    await enrichName('Jane Owner', { state: 'TX', json: true, yes: true });
    expect(mockApiRequest).toHaveBeenLastCalledWith('/enrichment/name', {
      method: 'POST',
      body: {
        data: [{ first_name: 'Jane', last_name: 'Owner' }],
        location: { type: 'state', code: 'TX' },
      },
    });
  });

  it('passes autocomplete controls to the addresses endpoint', async () => {
    mockApiRequest.mockResolvedValue({
      data: [],
      meta: { query: '1200 Barton', limit: 5, returned: 0, partial_results: false },
    });

    await addressesAutocomplete({
      query: '1200 Barton',
      state: 'TX',
      limit: '5',
      latitude: '30.26',
      longitude: '-97.76',
      json: true,
    });

    expect(mockApiRequest).toHaveBeenCalledWith('/addresses/autocomplete', {
      query: {
        q: '1200 Barton',
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
      meta: { query: '1200 Barton', limit: 5, returned: 0, partial_results: false },
    });

    await locationsAutocomplete({ query: '1200 Barton', json: true });

    expect(mockApiRequest).toHaveBeenCalledWith('/addresses/autocomplete', {
      query: { q: '1200 Barton' },
    });
  });
});

describe('CLI phone carrier (DEA-2144)', () => {
  const phones = [
    { number: '5125551234', type: 'wireless', do_not_call: false, carrier: 'AT&T Mobility' },
    { number: '5125559876', type: 'landline', do_not_call: true, carrier: null },
  ];
  const personResponse = {
    data: { dm_person_id: 'per_123', full_name: 'JANE DOE', phones, emails: [] },
    credits: { used: 1, properties: 0, people: 1, deduplicated: 0 },
  };
  const enrichResponse = {
    data: [
      {
        input: { phone: '5125551234' },
        matched: true,
        contacts: [{ dm_person_id: 'per_123', full_name: 'JANE DOE', phones, emails: [] }],
      },
    ],
    totals: { submitted: 1, matched: 1, unmatched: 0 },
    credits: { used: 1, properties: 0, people: 1, deduplicated: 0 },
  };

  function captureLog(): () => string {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    return () => {
      const printed = log.mock.calls.map((call) => call.join(' ')).join('\n');
      log.mockRestore();
      return printed;
    };
  }

  it('hands --json output the API response untouched, carrier included', async () => {
    mockApiRequest.mockResolvedValue(personResponse);
    await peopleGet('per_123', { json: true });
    expect(printJson).toHaveBeenLastCalledWith(personResponse);

    mockApiRequest.mockResolvedValue(enrichResponse);
    await enrichPhone('5125551234', { json: true });
    expect(printJson).toHaveBeenLastCalledWith(enrichResponse);
  });

  it.each([
    ['people get', peopleGet],
  ])('%s prints the carrier beside the line type', async (_name, get) => {
    mockApiRequest.mockResolvedValue(personResponse);
    const printed = captureLog();
    await get('per_123', {});
    const output = printed();

    expect(output).toContain('5125551234 (wireless, AT&T Mobility)');
    // An unknown carrier prints nothing rather than "null".
    expect(output).toContain('5125559876 (landline)');
    expect(output).not.toContain('null');
  });

  it('enrich prints the carrier on nested contact phones', async () => {
    mockApiRequest.mockResolvedValue(enrichResponse);
    const printed = captureLog();
    await enrichPhone('5125551234', {});
    const output = printed();

    expect(output).toContain('5125551234 (wireless, AT&T Mobility)');
    expect(output).toContain('5125559876 (landline)');
  });
});
