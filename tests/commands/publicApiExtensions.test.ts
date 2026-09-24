import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockApiRequest, mockParseRequestBody } = vi.hoisted(() => ({
  mockApiRequest: vi.fn(),
  mockParseRequestBody: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../src/lib/client.js', () => ({
  apiRequest: mockApiRequest,
  formatDate: () => 'Sep 24, 2026',
}));
vi.mock('../../src/lib/output.js', () => ({
  isQuiet: vi.fn(() => false),
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

import { printJson, printTable } from '../../src/lib/output.js';
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
import { listsItems } from '../../src/commands/lists.js';
import { phonesDnc } from '../../src/commands/phones.js';

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
      meta: { query: '1200 Barton', limit: 5, returned: 0, partial_results: false },
    });

    await locationsAutocomplete({ query: 'Austin', scope: 'location', json: true });

    expect(mockApiRequest).toHaveBeenCalledWith('/addresses/autocomplete', {
      query: { q: 'Austin', scope: 'location' },
    });
  });
  it('renders legacy location suggestions alongside property address suggestions', async () => {
    mockApiRequest.mockResolvedValue({
      data: [
        {
          suggestion_id: 'loc_1',
          kind: 'location',
          label: 'Austin, TX',
          location: { location_id: 'loc_city_1', state: 'TX' },
        },
        {
          suggestion_id: 'addr_1',
          kind: 'address',
          label: '123 Main St',
          property_id: 'prop_123',
          address: { city: 'Austin', state: 'TX', zip: '78701' },
        },
      ],
      meta: { query: 'Austin', scope: 'all', partial_results: false },
    });

    await addressesAutocomplete({ query: 'Austin', scope: 'all' });

    expect(printTable).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          kind: 'location',
          location_id: 'loc_city_1',
          state: 'TX',
        }),
        expect.objectContaining({
          kind: 'address',
          property_id: 'prop_123',
          city: 'Austin',
          zip: '78701',
        }),
      ],
      expect.arrayContaining(['kind', 'location_id', 'property_id'])
    );
  });

  it('keeps the legacy autocomplete columns when the response has no property IDs', async () => {
    mockApiRequest.mockResolvedValue({
      data: [
        {
          suggestion_id: 'addr_1',
          kind: 'address',
          label: '123 Main St',
          address: { city: 'Austin', state: 'TX' },
        },
      ],
      meta: { query: '123 Main', scope: 'address', partial_results: false },
    });

    await addressesAutocomplete({ query: '123 Main', scope: 'address' });

    expect(printTable).toHaveBeenCalledWith(
      [
        {
          kind: 'address',
          label: '123 Main St',
          location_id: '-',
          city: 'Austin',
          state: 'TX',
          zip: '-',
        },
      ],
      ['kind', 'label', 'location_id', 'city', 'state', 'zip']
    );
  });

  it('shows the free property count before falling back to included records in name enrichment', async () => {
    mockApiRequest.mockResolvedValue({
      data: [
        {
          dm_person_id: 'per_123',
          full_name: 'Jane Owner',
          property_count: 7,
          properties: [{}, {}],
        },
        { dm_person_id: 'per_124', full_name: 'Zero Owner', property_count: 0 },
        {
          dm_person_id: 'per_125',
          full_name: 'Legacy Owner',
          properties: [{}],
        },
      ],
      pagination: { page: 1, per_page: 25, total: 3, total_pages: 1 },
      credits: { used: 3, properties: 0, people: 3, deduplicated: 0 },
    });

    await enrichName('Jane Owner', { yes: true });

    expect(printTable).toHaveBeenCalledWith(
      [
        expect.objectContaining({ properties: '7' }),
        expect.objectContaining({ properties: '0' }),
        expect.objectContaining({ properties: '1' }),
      ],
      ['id', 'name', 'phones', 'emails', 'properties']
    );
  });

  it.each([
    ['email', enrichEmail, 'jane@example.com'],
    ['phone', enrichPhone, '5125551234'],
  ] as const)(
    'keeps the free property count in %s enrichment output',
    async (_name, command, value) => {
      const output = vi.spyOn(console, 'log').mockImplementation(() => {});
      mockApiRequest.mockResolvedValue({
        data: [
          {
            matched: true,
            input: { value },
            contacts: [
              {
                dm_person_id: 'per_123',
                full_name: 'Jane Owner',
                property_count: 7,
              },
            ],
          },
        ],
        totals: { submitted: 1, matched: 1, unmatched: 0 },
        credits: { used: 1, properties: 0, people: 1, deduplicated: 0 },
      });
      try {
        await command(value, {});
        expect(output.mock.calls.flat().join('\n')).toContain('properties: 7');
      } finally {
        output.mockRestore();
      }
    }
  );

  it('keeps numeric list person IDs and uses opaque IDs only when the numeric ID is unavailable', async () => {
    mockApiRequest.mockResolvedValue({
      data: [
        { list_item_id: 'item_1', internal_property_id: null, internal_person_id: 123, dm_person_id: 'per_123' },
        { list_item_id: 'item_2', internal_property_id: null, internal_person_id: null, dm_person_id: 'per_9007199254740993' },
      ],
      pagination: { page: 1, total: 2, has_more: false },
    });

    await listsItems('list_1', {});

    expect(printTable).toHaveBeenCalledWith([
      expect.objectContaining({ person_id: 123 }),
      expect.objectContaining({ person_id: 'per_9007199254740993' }),
    ], ['item_id', 'property_id', 'person_id', 'added']);
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
  ])('%s keeps the existing phone display when carrier metadata is returned', async (_name, get) => {
    mockApiRequest.mockResolvedValue(personResponse);
    const printed = captureLog();
    await get('per_123', {});
    const output = printed();

    expect(output).toContain('5125551234 (wireless)');
    expect(output).not.toContain('AT&T Mobility');
    // An unknown carrier prints nothing rather than "null".
    expect(output).toContain('5125559876 (landline)');
    expect(output).not.toContain('null');
  });

  it('enrich keeps the existing nested contact phone display', async () => {
    mockApiRequest.mockResolvedValue(enrichResponse);
    const printed = captureLog();
    await enrichPhone('5125551234', {});
    const output = printed();

    expect(output).toContain('phone: 5125551234');
    expect(output).toContain('phone: 5125559876');
    expect(output).not.toContain('wireless');
    expect(output).not.toContain('AT&T Mobility');
  });

  it('preserves DNC text formatting and keeps carrier metadata available in JSON', async () => {
    const response = {
      data: [{ input: { number: '5125551234' }, matched: true, do_not_call: false, phone_type: 'wireless', carrier: 'AT&T Mobility' }],
      totals: { submitted: 1, matched: 1, unmatched: 0 },
      credits: { used: 1 },
    };
    mockApiRequest.mockResolvedValue(response);
    await phonesDnc('5125551234', { json: true });
    expect(printJson).toHaveBeenLastCalledWith(response);

    const printed = captureLog();
    await phonesDnc('5125551234', {});
    const output = printed();
    expect(output).toContain('5125551234  OK (wireless)');
    expect(output).not.toContain('AT&T Mobility');
  });

});
