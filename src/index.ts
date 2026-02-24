#!/usr/bin/env node

import { Command } from 'commander';
import { login } from './commands/login.js';
import { logout } from './commands/logout.js';
import { whoami } from './commands/whoami.js';
import { configGet, configSet, configPath } from './commands/config.js';
import { account } from './commands/account.js';
import { usage } from './commands/usage.js';
import { propertiesSearch, propertiesCount, propertiesGet, propertiesIds, propertiesExport } from './commands/properties.js';
import { peopleSearch, peopleCount, peopleGet, peopleIds, peopleExport } from './commands/people.js';
import {
  enrichAddress,
  enrichLatLng,
  enrichApn,
  enrichEmail,
  enrichPhone,
  enrichName,
} from './commands/enrich.js';
import { filters } from './commands/filters.js';
import { fields } from './commands/fields.js';
import { activitySearch, activityGet } from './commands/activity.js';
import { addressesValidate } from './commands/addresses.js';
import { licenseAdd, licenseList, licenseRemove } from './commands/dev.js';
import { comps } from './commands/comps.js';
import {
  listsList,
  listsCreate,
  listsGet,
  listsUpdate,
  listsDelete,
  listsBuild,
  listsImport,
  listsItems,
  listsAdd,
  listsRemove,
  listsExport,
} from './commands/lists.js';

const program = new Command();

program
  .name('dm')
  .description('DealMachine CLI — Property intelligence from the command line')
  .version('0.1.0');

// ============================================================================
// Auth commands
// ============================================================================

program
  .command('login')
  .description('Authenticate with your DealMachine account')
  .option('--no-browser', 'Do not automatically open the browser')
  .option('--key <api-key>', 'Login directly with an API key (skips browser)')
  .option('--env <environment>', 'API environment: local or production (default: production)')
  .action(async (options) => {
    if (options.env) {
      process.env.DM_ENV = options.env;
    }
    await login({ noBrowser: options.browser === false, key: options.key, env: options.env });
  });

program
  .command('logout')
  .description('Remove stored credentials')
  .action(async () => {
    await logout();
  });

program
  .command('whoami')
  .description('Show current authentication status')
  .option('--verify', 'Verify credentials with the API')
  .action(async (options) => {
    await whoami(options);
  });

// ============================================================================
// Config commands
// ============================================================================

const configCmd = program
  .command('config')
  .description('View and modify configuration');

configCmd
  .command('get [key]')
  .description('Get a configuration value (or all values)')
  .action(async (key?: string) => {
    await configGet(key);
  });

configCmd
  .command('set <key> <value>')
  .description('Set a configuration value')
  .action(async (key: string, value: string) => {
    await configSet(key, value);
  });

configCmd
  .command('path')
  .description('Show config file path')
  .action(async () => {
    await configPath();
  });

// ============================================================================
// Account commands
// ============================================================================

program
  .command('account')
  .description('Show account information')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    await account();
  });

program
  .command('usage')
  .description('Show credit usage for current billing cycle')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    await usage(options);
  });

// ============================================================================
// Properties commands
// ============================================================================

const propertiesCmd = program
  .command('properties')
  .description('Search and look up properties');

propertiesCmd
  .command('search')
  .description('Search properties with filters and locations')
  .option('--body <json>', 'Request body as JSON string')
  .option('-f, --file <path>', 'Read request body from a JSON file')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    await propertiesSearch(options);
  });

propertiesCmd
  .command('count')
  .description('Count properties matching filters (no credits consumed)')
  .option('--body <json>', 'Request body as JSON string')
  .option('-f, --file <path>', 'Read request body from a JSON file')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    await propertiesCount(options);
  });

propertiesCmd
  .command('get <id>')
  .description('Get a property by ID (e.g., prop_12345)')
  .option('--contact-audience <audience>', 'Include contacts: owners, owners_and_family, renters, residents, all')
  .option('--json', 'Output as JSON')
  .action(async (id, options) => {
    await propertiesGet(id, options);
  });

propertiesCmd
  .command('ids [ids...]')
  .description('Get multiple properties by IDs')
  .option('--body <json>', 'Request body as JSON string')
  .option('-f, --file <path>', 'Read request body from a JSON file')
  .option('--contact-audience <audience>', 'Include contacts: owners, owners_and_family, renters, residents, all')
  .option('--json', 'Output as JSON')
  .action(async (ids, options) => {
    await propertiesIds({ ...options, ids: ids.length > 0 ? ids : undefined });
  });

propertiesCmd
  .command('export')
  .description('Export properties as CSV (up to 1,000,000 records)')
  .option('--body <json>', 'Request body as JSON string')
  .option('-f, --file <path>', 'Read request body from a JSON file')
  .option('--require-phone', 'Only include records where the contact has a phone number')
  .option('--require-email', 'Only include records where the contact has an email address')
  .option('--mobile-only', 'Only include mobile phone numbers')
  .option('--landline-only', 'Only include landline phone numbers')
  .option('--scrub-dnc', 'Exclude contacts on the Do Not Call registry')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    await propertiesExport(options);
  });

// ============================================================================
// Comps commands
// ============================================================================

program
  .command('comps [property_ids...]')
  .description('Find comparable properties (sales comps) for one or more properties')
  .option('--body <json>', 'Request body as JSON string')
  .option('-f, --file <path>', 'Read request body from a JSON file')
  .option('--radius <miles>', 'Search radius in miles (default: 1)')
  .option('--timeframe <period>', 'Timeframe: 3months, 6months, 12months, all (default: 6months)')
  .option('--limit <n>', 'Max comps per property (default: 25, max: 100)')
  .option('--sort-by <field>', 'Sort by: distance, price, date, match (default: match)')
  .option('--sort-direction <dir>', 'Sort direction: asc, desc (default: desc)')
  .option('--include-foreclosures', 'Include foreclosure sales')
  .option('--json', 'Output as JSON')
  .action(async (propertyIds, options) => {
    await comps(propertyIds || [], options);
  });

// ============================================================================
// Lists commands
// ============================================================================

const listsCmd = program
  .command('lists')
  .description('Manage saved lists');

listsCmd
  .command('search')
  .description('Search and list all saved lists')
  .option('--search <term>', 'Search lists by name')
  .option('--source-type <type>', 'Filter by source type: properties or people')
  .option('--sort <order>', 'Sort order: newest, oldest, name, count')
  .option('-p, --page <n>', 'Page number')
  .option('--per-page <n>', 'Results per page')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    await listsList(options);
  });

listsCmd
  .command('create')
  .description('Create a new list')
  .requiredOption('--name <name>', 'List name')
  .option('--source-type <type>', 'Source type: properties or people')
  .option('--ids <csv>', 'Comma-separated record IDs to pre-populate (max 250)')
  .option('--body <json>', 'Request body as JSON (filters/locations)')
  .option('-f, --file <path>', 'Read request body from a JSON file')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    await listsCreate(options);
  });

listsCmd
  .command('get <id>')
  .description('Get details of a specific list')
  .option('--json', 'Output as JSON')
  .action(async (id, options) => {
    await listsGet(id, options);
  });

listsCmd
  .command('update <id>')
  .description('Update a list')
  .option('--name <name>', 'New list name')
  .option('--json', 'Output as JSON')
  .action(async (id, options) => {
    await listsUpdate(id, options);
  });

listsCmd
  .command('delete <id>')
  .description('Delete a list and all its items')
  .option('--json', 'Output as JSON')
  .action(async (id, options) => {
    await listsDelete(id, options);
  });

listsCmd
  .command('build <id>')
  .description('Build a list from search filters')
  .option('--body <json>', 'Request body as JSON (filters/locations)')
  .option('-f, --file <path>', 'Read request body from a JSON file')
  .option('--json', 'Output as JSON')
  .action(async (id, options) => {
    await listsBuild(id, options);
  });

listsCmd
  .command('import <id>')
  .description('Import IDs into a list')
  .option('--ids <csv>', 'Comma-separated list of IDs')
  .option('--source-type <type>', 'Source type: properties or people')
  .option('--body <json>', 'Request body as JSON')
  .option('-f, --file <path>', 'Read request body from a JSON file')
  .option('--json', 'Output as JSON')
  .action(async (id, options) => {
    await listsImport(id, options);
  });

listsCmd
  .command('items <id>')
  .description('List items in a list')
  .option('-p, --page <n>', 'Page number')
  .option('--per-page <n>', 'Results per page')
  .option('--json', 'Output as JSON')
  .action(async (id, options) => {
    await listsItems(id, options);
  });

listsCmd
  .command('add <id>')
  .description('Add items to a list')
  .requiredOption('--ids <csv>', 'Comma-separated list of IDs to add')
  .option('--id-type <type>', 'ID type: internal_property_id or internal_person_id')
  .option('--json', 'Output as JSON')
  .action(async (id, options) => {
    await listsAdd(id, options);
  });

listsCmd
  .command('remove <id>')
  .description('Remove items from a list')
  .requiredOption('--ids <csv>', 'Comma-separated list of IDs to remove')
  .option('--id-type <type>', 'ID type: internal_property_id or internal_person_id')
  .option('--json', 'Output as JSON')
  .action(async (id, options) => {
    await listsRemove(id, options);
  });

listsCmd
  .command('export <id>')
  .description('Export list items (credits charged per record)')
  .option('--fields <csv>', 'Comma-separated list of fields to export')
  .option('--anchor <type>', 'Anchor type: property or person')
  .option('--json', 'Output as JSON')
  .action(async (id, options) => {
    await listsExport(id, options);
  });

// ============================================================================
// People commands
// ============================================================================

const peopleCmd = program
  .command('people')
  .description('Search and look up people');

peopleCmd
  .command('search')
  .description('Search people with filters and locations')
  .option('--body <json>', 'Request body as JSON string')
  .option('-f, --file <path>', 'Read request body from a JSON file')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    await peopleSearch(options);
  });

peopleCmd
  .command('count')
  .description('Count people matching filters (no credits consumed)')
  .option('--body <json>', 'Request body as JSON string')
  .option('-f, --file <path>', 'Read request body from a JSON file')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    await peopleCount(options);
  });

peopleCmd
  .command('get <id>')
  .description('Get a person by ID (e.g., per_12345)')
  .option('--include-properties', 'Include associated properties')
  .option('--json', 'Output as JSON')
  .action(async (id, options) => {
    await peopleGet(id, options);
  });

peopleCmd
  .command('ids [ids...]')
  .description('Get multiple people by IDs')
  .option('--body <json>', 'Request body as JSON string')
  .option('-f, --file <path>', 'Read request body from a JSON file')
  .option('--include-properties', 'Include associated properties')
  .option('--json', 'Output as JSON')
  .action(async (ids, options) => {
    await peopleIds({ ...options, ids: ids.length > 0 ? ids : undefined });
  });

peopleCmd
  .command('export')
  .description('Export people as CSV (up to 1,000,000 records)')
  .option('--body <json>', 'Request body as JSON string')
  .option('-f, --file <path>', 'Read request body from a JSON file')
  .option('--require-phone', 'Only include records where the contact has a phone number')
  .option('--require-email', 'Only include records where the contact has an email address')
  .option('--mobile-only', 'Only include mobile phone numbers')
  .option('--landline-only', 'Only include landline phone numbers')
  .option('--scrub-dnc', 'Exclude contacts on the Do Not Call registry')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    await peopleExport(options);
  });

// ============================================================================
// Enrichment commands
// ============================================================================

const enrichCmd = program
  .command('enrich')
  .description('Enrich data by address, coordinates, email, phone, or name');

enrichCmd
  .command('address [address]')
  .description('Look up a property by street address')
  .option('--body <json>', 'Request body as JSON string')
  .option('-f, --file <path>', 'Read request body from a JSON file')
  .option('--contact-audience <audience>', 'Include contacts: owners, owners_and_family, renters, residents')
  .option('--json', 'Output as JSON')
  .action(async (address, options) => {
    await enrichAddress(address, options);
  });

enrichCmd
  .command('latlng [coords]')
  .description('Look up a property by lat,lng coordinates')
  .option('--body <json>', 'Request body as JSON string')
  .option('-f, --file <path>', 'Read request body from a JSON file')
  .option('--contact-audience <audience>', 'Include contacts: owners, owners_and_family, renters, residents')
  .option('--json', 'Output as JSON')
  .action(async (coords, options) => {
    await enrichLatLng(coords, options);
  });

enrichCmd
  .command('apn [apn]')
  .description("Look up a property by Assessor's Parcel Number")
  .option('--body <json>', 'Request body as JSON string')
  .option('-f, --file <path>', 'Read request body from a JSON file')
  .option('--state <code>', 'Narrow by state (e.g., TX)')
  .option('--zip <code>', 'Narrow by ZIP code')
  .option('--contact-audience <audience>', 'Include contacts: owners, owners_and_family, renters, residents')
  .option('--json', 'Output as JSON')
  .action(async (apn, options) => {
    await enrichApn(apn, options);
  });

enrichCmd
  .command('email [email]')
  .description('Look up a person by email address')
  .option('--body <json>', 'Request body as JSON string')
  .option('-f, --file <path>', 'Read request body from a JSON file')
  .option('--include-properties', 'Include associated properties')
  .option('--json', 'Output as JSON')
  .action(async (email, options) => {
    await enrichEmail(email, options);
  });

enrichCmd
  .command('phone [phone]')
  .description('Look up a person by phone number')
  .option('--body <json>', 'Request body as JSON string')
  .option('-f, --file <path>', 'Read request body from a JSON file')
  .option('--include-properties', 'Include associated properties')
  .option('--json', 'Output as JSON')
  .action(async (phone, options) => {
    await enrichPhone(phone, options);
  });

enrichCmd
  .command('name [name]')
  .description('Look up people by name (e.g., "David Oster")')
  .option('--body <json>', 'Request body as JSON string')
  .option('-f, --file <path>', 'Read request body from a JSON file')
  .option('--state <code>', 'Narrow by state (e.g., TX)')
  .option('--zip <code>', 'Narrow by ZIP code')
  .option('--include-properties', 'Include associated properties')
  .option('--page <n>', 'Page number')
  .option('--per-page <n>', 'Results per page')
  .option('--json', 'Output as JSON')
  .action(async (name, options) => {
    await enrichName(name, options);
  });

// ============================================================================
// Filters & Fields
// ============================================================================

program
  .command('filters')
  .description('List available filters for search queries')
  .option('--source-type <type>', 'Filter by source: properties or people')
  .option('--group-id <id>', 'Filter by group ID')
  .option('--search <term>', 'Search filters by name')
  .option('--page <n>', 'Page number')
  .option('--per-page <n>', 'Results per page')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    await filters(options);
  });

program
  .command('fields')
  .description('List available data fields')
  .option('--source-type <type>', 'Filter by source: properties or people')
  .option('--group-id <id>', 'Filter by group ID')
  .option('--search <term>', 'Search fields by name')
  .option('--page <n>', 'Page number')
  .option('--per-page <n>', 'Results per page')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    await fields(options);
  });

// ============================================================================
// Activity commands
// ============================================================================

const activityCmd = program
  .command('activity')
  .description('View API activity history');

activityCmd
  .command('search')
  .description('Search past API activity')
  .option('--body <json>', 'Request body as JSON string')
  .option('-f, --file <path>', 'Read request body from a JSON file')
  .option('-t, --types <types...>', 'Filter by activity types (e.g., search_properties enrich_address)')
  .option('-q, --query <text>', 'Free-text search across activity')
  .option('--page <n>', 'Page number')
  .option('--per-page <n>', 'Results per page')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    await activitySearch(options);
  });

activityCmd
  .command('get <id>')
  .description('Get details of a specific activity record')
  .option('--json', 'Output as JSON')
  .action(async (id, options) => {
    await activityGet(id, options);
  });

// ============================================================================
// Address validation
// ============================================================================

const addressesCmd = program
  .command('addresses')
  .description('Validate and standardize addresses');

addressesCmd
  .command('validate [address]')
  .description('Validate addresses via USPS')
  .option('--body <json>', 'Request body as JSON string')
  .option('-f, --file <path>', 'Read request body from a JSON file')
  .option('--json', 'Output as JSON')
  .action(async (address, options) => {
    await addressesValidate(address, options);
  });

// ============================================================================
// Dev commands (local DB operations)
// ============================================================================

const devCmd = program
  .command('dev')
  .description('Local development utilities (requires Docker MySQL)');

const devLicenseCmd = devCmd
  .command('license')
  .description('Manage API key licenses');

devLicenseCmd
  .command('add <key_id>')
  .description('Add a license to an API key')
  .requiredOption('--type <type>', 'License type: state, county, zip_code, or unlimited')
  .option('--code <code>', 'Location code (state abbrev, FIPS, or ZIP)')
  .option('--expires <date>', 'Expiration date (ISO format)')
  .action(async (keyId, options) => {
    await licenseAdd(keyId, options);
  });

devLicenseCmd
  .command('list [key_id]')
  .description('List licenses (optionally filter by key_id)')
  .action(async (keyId) => {
    await licenseList(keyId);
  });

devLicenseCmd
  .command('remove <license_id>')
  .description('Remove a license by ID')
  .action(async (licenseId) => {
    await licenseRemove(licenseId);
  });

// ============================================================================
// Parse and execute
// ============================================================================

program.parse();
