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
import {
  tasksList,
  tasksGet,
  tasksCreate,
  tasksUpdate,
  tasksDelete,
} from './commands/tasks.js';
import {
  crmPipelines,
  crmOpportunitiesList,
  crmOpportunitiesGet,
  crmOpportunitiesCreate,
  crmOpportunitiesUpdate,
  crmOpportunitiesDelete,
  crmOpportunitiesMove,
  crmTasksList,
  crmTasksCreate,
  crmTasksUpdate,
  crmNotesList,
  crmNotesCreate,
  crmNotesUpdate,
  crmRecordsList,
  crmRecordsLink,
  crmRecordsUnlink,
  crmLabelsList,
  crmLabelsCreate,
  crmLabelsUpdate,
  crmLabelsDelete,
  crmActivity,
} from './commands/crm.js';
import {
  dialerCallsList,
  dialerCallsGet,
  dialerCallsStats,
  dialerNotesList,
  dialerNotesCreate,
  dialerNotesDelete,
  dialerQueuesList,
  dialerQueuesCreate,
  dialerQueuesDelete,
  dialerQueueItemsList,
  dialerQueueItemsAdd,
  dialerQueueItemsUpdate,
  dialerQueueItemsRemove,
  dialerDispositions,
  dialerSuppressionList,
  dialerSuppressionCheck,
  dialerSuppressionAdd,
} from './commands/dialer.js';
import {
  mailCampaignsList,
  mailCampaignsCreate,
  mailCampaignsGet,
  mailCampaignsUpdate,
  mailCampaignsDelete,
  mailCampaignsSend,
  mailCampaignsPause,
  mailCampaignsResume,
  mailCampaignsRecipients,
  mailCampaignsAnalytics,
  mailCampaignsCostEstimate,
  mailDesignsList,
  mailDesignsCreate,
  mailDesignsGet,
  mailDesignsUpdate,
  mailDesignsDelete,
  mailReturnAddressesList,
  mailReturnAddressesCreate,
  mailReturnAddressesGet,
  mailReturnAddressesUpdate,
  mailReturnAddressesDelete,
  mailReturnAddressesSetDefault,
  mailWalletBalance,
  mailWalletAddFunds,
  mailWalletTransactions,
  mailWalletPricing,
} from './commands/mail.js';

const program = new Command();

program
  .name('dm')
  .description('DealMachine CLI — Property intelligence from the command line')
  .version('0.1.0')
  .option('--quiet', 'Suppress spinners and decorative output (agent-friendly, also DM_QUIET=1)')
  .addHelpText('after', `
Examples:
  dm login --key dm_sk_live_abc123       Login with an API key
  dm properties search -f query.json     Search properties from a file
  dm enrich address "123 Main St"        Enrich a single address
  dm lists search --json                 List all lists as JSON
  dm crm opportunities list --json       List CRM opportunities

Tip: Every subcommand supports --help with examples.
     Use --json on any command for machine-readable output.
     Pipe JSON via stdin: echo '{}' | dm properties search`);

// ============================================================================
// Auth commands
// ============================================================================

program
  .command('login')
  .description('Authenticate with your DealMachine account')
  .option('--no-browser', 'Do not automatically open the browser')
  .option('--key <api-key>', 'Login directly with an API key (skips browser)')
  .option('--env <environment>', 'API environment: local or production (default: production)')
  .addHelpText('after', `
Examples:
  dm login                               Interactive browser login
  dm login --key dm_sk_live_abc123       Login with an API key (non-interactive)
  dm login --env local --no-browser      Login to local env without opening browser`)
  .action(async (options) => {
    if (options.env) {
      process.env.DM_ENV = options.env;
    }
    await login({ noBrowser: options.browser === false, key: options.key, env: options.env });
  });

program
  .command('logout')
  .description('Remove stored credentials')
  .addHelpText('after', `
Examples:
  dm logout                              Remove stored API key and config`)
  .action(async () => {
    await logout();
  });

program
  .command('whoami')
  .description('Show current authentication status')
  .option('--verify', 'Verify credentials with the API')
  .addHelpText('after', `
Examples:
  dm whoami                              Show stored credentials
  dm whoami --verify                     Verify credentials against the API`)
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
  .addHelpText('after', `
Examples:
  dm config get                          Show all config values
  dm config get apiEnvironment           Show a specific config value`)
  .action(async (key?: string) => {
    await configGet(key);
  });

configCmd
  .command('set <key> <value>')
  .description('Set a configuration value')
  .addHelpText('after', `
Examples:
  dm config set apiEnvironment production   Switch to production API
  dm config set apiEnvironment local        Switch to local API`)
  .action(async (key: string, value: string) => {
    await configSet(key, value);
  });

configCmd
  .command('path')
  .description('Show config file path')
  .addHelpText('after', `
Examples:
  dm config path                         Print path to ~/.dealmachine/config.json`)
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
  .addHelpText('after', `
Examples:
  dm account                             Show account details
  dm account --json                      Show account details as JSON`)
  .action(async (options) => {
    await account();
  });

program
  .command('usage')
  .description('Show credit usage for current billing cycle')
  .option('--json', 'Output as JSON')
  .addHelpText('after', `
Examples:
  dm usage                               Show credit usage summary
  dm usage --json                        Show credit usage as JSON`)
  .action(async (options) => {
    await usage(options);
  });

// ============================================================================
// Properties commands
// ============================================================================

const propertiesCmd = program
  .command('properties')
  .alias('prop')
  .description('Search and look up properties');

propertiesCmd
  .command('search')
  .description('Search properties with filters and locations')
  .option('--body <json>', 'Request body as JSON string')
  .option('-f, --file <path>', 'Read request body from a JSON file')
  .option('--json', 'Output as JSON')
  .addHelpText('after', `
Examples:
  dm properties search --body '{"locations":[{"type":"zip_code","code":"78704"}]}'
  dm properties search -f search-query.json
  dm properties search -f query.json --json
  cat query.json | dm properties search --json`)
  .action(async (options) => {
    await propertiesSearch(options);
  });

propertiesCmd
  .command('count')
  .description('Count properties matching filters (no credits consumed)')
  .option('--body <json>', 'Request body as JSON string')
  .option('-f, --file <path>', 'Read request body from a JSON file')
  .option('--json', 'Output as JSON')
  .addHelpText('after', `
Examples:
  dm properties count --body '{"locations":[{"type":"zip_code","code":"78704"}]}'
  dm properties count -f query.json --json`)
  .action(async (options) => {
    await propertiesCount(options);
  });

propertiesCmd
  .command('get <id>')
  .description('Get a property by ID (e.g., prop_12345)')
  .option('--contact-audience <audience>', 'Include contacts: owners, owners_and_family, renters, residents, all')
  .option('--json', 'Output as JSON')
  .addHelpText('after', `
Examples:
  dm properties get prop_12345
  dm properties get prop_12345 --contact-audience owners --json`)
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
  .addHelpText('after', `
Examples:
  dm properties ids prop_111 prop_222 prop_333 --json
  dm properties ids --body '{"ids":["prop_111","prop_222"]}'`)
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
  .addHelpText('after', `
Examples:
  dm properties export -f query.json --json
  dm properties export -f query.json --require-phone --scrub-dnc
  dm properties export --body '{"locations":[{"type":"state","code":"TX"}]}' --mobile-only`)
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
  .addHelpText('after', `
Examples:
  dm comps prop_12345 --json
  dm comps prop_111 prop_222 --radius 0.5 --timeframe 3months
  dm comps prop_12345 --sort-by price --sort-direction asc --limit 10
  dm comps --body '{"property_ids":["prop_12345"]}' --include-foreclosures`)
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
  .alias('ls')
  .description('Search and list all saved lists')
  .option('--search <term>', 'Search lists by name')
  .option('--source-type <type>', 'Filter by source type: properties or people')
  .option('--sort <order>', 'Sort order: newest, oldest, name, count')
  .option('-p, --page <n>', 'Page number')
  .option('--per-page <n>', 'Results per page')
  .option('--json', 'Output as JSON')
  .addHelpText('after', `
Examples:
  dm lists search                        List all lists
  dm lists search --source-type properties --sort newest --json
  dm lists search --search "Austin" --per-page 50`)
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
  .addHelpText('after', `
Examples:
  dm lists create --name "Austin Leads"
  dm lists create --name "TX Owners" --source-type properties --json
  dm lists create --name "Import" --ids 100,200,300`)
  .action(async (options) => {
    await listsCreate(options);
  });

listsCmd
  .command('get <id>')
  .description('Get details of a specific list')
  .option('--json', 'Output as JSON')
  .addHelpText('after', `
Examples:
  dm lists get list_abc123
  dm lists get list_abc123 --json`)
  .action(async (id, options) => {
    await listsGet(id, options);
  });

listsCmd
  .command('update <id>')
  .description('Update a list')
  .option('--name <name>', 'New list name')
  .option('--json', 'Output as JSON')
  .addHelpText('after', `
Examples:
  dm lists update list_abc123 --name "Renamed List"`)
  .action(async (id, options) => {
    await listsUpdate(id, options);
  });

listsCmd
  .command('delete <id>')
  .description('Delete a list and all its items')
  .option('--dry-run', 'Preview what would be deleted without making changes')
  .option('--json', 'Output as JSON')
  .addHelpText('after', `
Examples:
  dm lists delete list_abc123
  dm lists delete list_abc123 --dry-run   Preview deletion
  dm lists delete list_abc123 --json`)
  .action(async (id, options) => {
    if (options.dryRun) {
      console.log(`Would delete list ${id} and all its items.`);
      console.log('No changes made (--dry-run).');
      return;
    }
    await listsDelete(id, options);
  });

listsCmd
  .command('build <id>')
  .description('Build a list from search filters')
  .option('--body <json>', 'Request body as JSON (filters/locations)')
  .option('-f, --file <path>', 'Read request body from a JSON file')
  .option('--json', 'Output as JSON')
  .addHelpText('after', `
Examples:
  dm lists build list_abc123 -f filters.json
  dm lists build list_abc123 --body '{"locations":[{"type":"zip_code","code":"78704"}]}'

Note: Building is async. Poll status with: dm lists get list_abc123`)
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
  .addHelpText('after', `
Examples:
  dm lists import list_abc123 --ids 100,200,300 --source-type properties
  dm lists import list_abc123 -f import.json

Note: Import is async. Poll status with: dm lists get list_abc123`)
  .action(async (id, options) => {
    await listsImport(id, options);
  });

listsCmd
  .command('items <id>')
  .description('List items in a list')
  .option('-p, --page <n>', 'Page number')
  .option('--per-page <n>', 'Results per page')
  .option('--json', 'Output as JSON')
  .addHelpText('after', `
Examples:
  dm lists items list_abc123
  dm lists items list_abc123 --page 2 --per-page 100 --json`)
  .action(async (id, options) => {
    await listsItems(id, options);
  });

listsCmd
  .command('add <id>')
  .description('Add items to a list')
  .requiredOption('--ids <csv>', 'Comma-separated list of IDs to add')
  .option('--id-type <type>', 'ID type: internal_property_id or internal_person_id')
  .option('--json', 'Output as JSON')
  .addHelpText('after', `
Examples:
  dm lists add list_abc123 --ids 100,200,300
  dm lists add list_abc123 --ids 100,200 --id-type internal_property_id --json`)
  .action(async (id, options) => {
    await listsAdd(id, options);
  });

listsCmd
  .command('remove <id>')
  .description('Remove items from a list')
  .requiredOption('--ids <csv>', 'Comma-separated list of IDs to remove')
  .option('--id-type <type>', 'ID type: internal_property_id or internal_person_id')
  .option('--dry-run', 'Preview what would be removed without making changes')
  .option('--json', 'Output as JSON')
  .addHelpText('after', `
Examples:
  dm lists remove list_abc123 --ids 100,200,300
  dm lists remove list_abc123 --ids 100 --dry-run   Preview removal`)
  .action(async (id, options) => {
    if (options.dryRun) {
      const ids = options.ids.split(',').map((s: string) => s.trim());
      console.log(`Would remove ${ids.length} item(s) from list ${id}.`);
      console.log('No changes made (--dry-run).');
      return;
    }
    await listsRemove(id, options);
  });

listsCmd
  .command('export <id>')
  .description('Export list items (credits charged per record)')
  .option('--fields <csv>', 'Comma-separated list of fields to export')
  .option('--anchor <type>', 'Anchor type: property or person')
  .option('--json', 'Output as JSON')
  .addHelpText('after', `
Examples:
  dm lists export list_abc123 --json
  dm lists export list_abc123 --fields name,address,phone --anchor property`)
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
  .addHelpText('after', `
Examples:
  dm people search -f people-query.json --json
  dm people search --body '{"locations":[{"type":"zip_code","code":"78704"}]}'`)
  .action(async (options) => {
    await peopleSearch(options);
  });

peopleCmd
  .command('count')
  .description('Count people matching filters (no credits consumed)')
  .option('--body <json>', 'Request body as JSON string')
  .option('-f, --file <path>', 'Read request body from a JSON file')
  .option('--json', 'Output as JSON')
  .addHelpText('after', `
Examples:
  dm people count -f query.json --json
  dm people count --body '{"locations":[{"type":"state","code":"TX"}]}'`)
  .action(async (options) => {
    await peopleCount(options);
  });

peopleCmd
  .command('get <id>')
  .description('Get a person by ID (e.g., per_12345)')
  .option('--include-properties', 'Include associated properties')
  .option('--json', 'Output as JSON')
  .addHelpText('after', `
Examples:
  dm people get per_12345
  dm people get per_12345 --include-properties --json`)
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
  .addHelpText('after', `
Examples:
  dm people ids per_111 per_222 per_333 --json
  dm people ids --body '{"ids":["per_111","per_222"]}' --include-properties`)
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
  .addHelpText('after', `
Examples:
  dm people export -f query.json --json
  dm people export -f query.json --require-phone --scrub-dnc`)
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
  .option('-f, --file <path>', 'Read request body from a JSON file (JSON or CSV)')
  .option('--contact-audience <audience>', 'Include contacts: owners, owners_and_family, renters, residents')
  .option('--json', 'Output as JSON')
  .addHelpText('after', `
Examples:
  dm enrich address "123 Main St, Austin, TX 78704" --json
  dm enrich address "123 Main St, Austin, TX" --contact-audience owners
  dm enrich address -f addresses.csv --json          Batch enrich from CSV
  dm enrich address --body '{"addresses":[{"full_address":"123 Main St, Austin, TX"}]}'`)
  .action(async (address, options) => {
    await enrichAddress(address, options);
  });

enrichCmd
  .command('latlng [coords]')
  .description('Look up a property by lat,lng coordinates')
  .option('--body <json>', 'Request body as JSON string')
  .option('-f, --file <path>', 'Read request body from a JSON file (JSON or CSV)')
  .option('--contact-audience <audience>', 'Include contacts: owners, owners_and_family, renters, residents')
  .option('--json', 'Output as JSON')
  .addHelpText('after', `
Examples:
  dm enrich latlng "30.2672,-97.7431" --json
  dm enrich latlng -f coordinates.csv --contact-audience owners`)
  .action(async (coords, options) => {
    await enrichLatLng(coords, options);
  });

enrichCmd
  .command('apn [apn]')
  .description("Look up a property by Assessor's Parcel Number")
  .option('--body <json>', 'Request body as JSON string')
  .option('-f, --file <path>', 'Read request body from a JSON file (JSON or CSV)')
  .option('--state <code>', 'Narrow by state (e.g., TX)')
  .option('--zip <code>', 'Narrow by ZIP code')
  .option('--contact-audience <audience>', 'Include contacts: owners, owners_and_family, renters, residents')
  .option('--json', 'Output as JSON')
  .addHelpText('after', `
Examples:
  dm enrich apn "01-2345-0067" --state TX --json
  dm enrich apn -f parcels.csv --state TX`)
  .action(async (apn, options) => {
    await enrichApn(apn, options);
  });

enrichCmd
  .command('email [email]')
  .description('Look up a person by email address')
  .option('--body <json>', 'Request body as JSON string')
  .option('-f, --file <path>', 'Read request body from a JSON file (JSON or CSV)')
  .option('--include-properties', 'Include associated properties')
  .option('--json', 'Output as JSON')
  .addHelpText('after', `
Examples:
  dm enrich email "john@example.com" --json
  dm enrich email "john@example.com" --include-properties
  dm enrich email -f emails.csv --json               Batch enrich from CSV`)
  .action(async (email, options) => {
    await enrichEmail(email, options);
  });

enrichCmd
  .command('phone [phone]')
  .description('Look up a person by phone number')
  .option('--body <json>', 'Request body as JSON string')
  .option('-f, --file <path>', 'Read request body from a JSON file (JSON or CSV)')
  .option('--include-properties', 'Include associated properties')
  .option('--json', 'Output as JSON')
  .addHelpText('after', `
Examples:
  dm enrich phone "5125551234" --json
  dm enrich phone -f phones.csv --include-properties`)
  .action(async (phone, options) => {
    await enrichPhone(phone, options);
  });

enrichCmd
  .command('name [name]')
  .description('Look up people by name (e.g., "David Oster")')
  .option('--body <json>', 'Request body as JSON string')
  .option('-f, --file <path>', 'Read request body from a JSON file (JSON or CSV)')
  .option('--state <code>', 'Narrow by state (e.g., TX)')
  .option('--zip <code>', 'Narrow by ZIP code')
  .option('--include-properties', 'Include associated properties')
  .option('--page <n>', 'Page number')
  .option('--per-page <n>', 'Results per page')
  .option('--json', 'Output as JSON')
  .addHelpText('after', `
Examples:
  dm enrich name "David Oster" --state TX --json
  dm enrich name "Jane Smith" --zip 78704 --include-properties
  dm enrich name -f names.csv --state TX`)
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
  .addHelpText('after', `
Examples:
  dm filters --json                                  List all filters
  dm filters --source-type properties --search "owner"
  dm filters --source-type people --per-page 100 --json`)
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
  .addHelpText('after', `
Examples:
  dm fields --json                                   List all fields
  dm fields --source-type properties --search "value"
  dm fields --source-type people --per-page 100 --json`)
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
  .addHelpText('after', `
Examples:
  dm activity search --json
  dm activity search --types search_properties enrich_address
  dm activity search --query "Austin" --page 2 --json`)
  .action(async (options) => {
    await activitySearch(options);
  });

activityCmd
  .command('get <id>')
  .description('Get details of a specific activity record')
  .option('--json', 'Output as JSON')
  .addHelpText('after', `
Examples:
  dm activity get act_abc123 --json`)
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
  .addHelpText('after', `
Examples:
  dm addresses validate "123 Main St, Austin, TX 78704" --json
  dm addresses validate -f addresses.json`)
  .action(async (address, options) => {
    await addressesValidate(address, options);
  });

// ============================================================================
// Tasks commands
// ============================================================================

const tasksCmd = program
  .command('tasks')
  .description('Manage tasks (create, list, update, complete, delete)');

tasksCmd
  .command('list')
  .alias('ls')
  .description('List tasks')
  .option('--status <status>', 'Filter by status: open, completed, all')
  .option('--search <term>', 'Search tasks by title')
  .option('--assigned-to <userId>', 'Filter by assigned user ID')
  .option('-p, --page <n>', 'Page number')
  .option('--per-page <n>', 'Results per page')
  .option('--json', 'Output as JSON')
  .addHelpText('after', `
Examples:
  dm tasks list --json
  dm tasks list --status open --assigned-to user_123
  dm tasks list --search "follow up" --per-page 50`)
  .action(async (options) => {
    await tasksList({
      status: options.status,
      search: options.search,
      assignedToUserId: options.assignedTo,
      page: options.page,
      perPage: options.perPage,
      json: options.json,
    });
  });

tasksCmd
  .command('get <id>')
  .description('Get task details')
  .option('--json', 'Output as JSON')
  .addHelpText('after', `
Examples:
  dm tasks get task_abc123 --json`)
  .action(async (id, options) => {
    await tasksGet(id, options);
  });

tasksCmd
  .command('create')
  .description('Create a task')
  .option('--body <json>', 'Request body as JSON string')
  .option('-f, --file <path>', 'Read request body from a JSON file')
  .option('--json', 'Output as JSON')
  .addHelpText('after', `
Examples:
  dm tasks create --body '{"title":"Call owner","due_date":"2025-01-15"}' --json
  dm tasks create -f task.json`)
  .action(async (options) => {
    await tasksCreate(options);
  });

tasksCmd
  .command('update <id>')
  .description('Update a task')
  .option('--body <json>', 'Request body as JSON string')
  .option('-f, --file <path>', 'Read request body from a JSON file')
  .option('--json', 'Output as JSON')
  .addHelpText('after', `
Examples:
  dm tasks update task_abc123 --body '{"status":"completed"}' --json`)
  .action(async (id, options) => {
    await tasksUpdate(id, options);
  });

tasksCmd
  .command('delete <id>')
  .description('Delete a task')
  .option('--dry-run', 'Preview what would be deleted without making changes')
  .option('--json', 'Output as JSON')
  .addHelpText('after', `
Examples:
  dm tasks delete task_abc123
  dm tasks delete task_abc123 --dry-run   Preview deletion`)
  .action(async (id, options) => {
    if (options.dryRun) {
      console.log(`Would delete task ${id}.`);
      console.log('No changes made (--dry-run).');
      return;
    }
    await tasksDelete(id, options);
  });

// ============================================================================
// CRM commands
// ============================================================================

const crmCmd = program
  .command('crm')
  .description('Manage CRM pipelines, opportunities, tasks, notes, records, and labels');

crmCmd
  .command('pipelines')
  .description('List pipelines with stages and opportunity counts')
  .option('--json', 'Output as JSON')
  .addHelpText('after', `
Examples:
  dm crm pipelines --json`)
  .action(async (options) => {
    await crmPipelines(options);
  });

const crmOppCmd = crmCmd
  .command('opportunities')
  .alias('opp')
  .description('Manage CRM opportunities');

crmOppCmd
  .command('list')
  .alias('ls')
  .description('List/search opportunities')
  .option('--pipeline-id <id>', 'Filter by pipeline ID')
  .option('--stage-id <id>', 'Filter by stage ID')
  .option('--search <term>', 'Search by name')
  .option('--priority <level>', 'Filter by priority: low, medium, high, urgent')
  .option('-p, --page <n>', 'Page number')
  .option('--per-page <n>', 'Results per page')
  .option('--json', 'Output as JSON')
  .addHelpText('after', `
Examples:
  dm crm opportunities list --json
  dm crm opp list --pipeline-id pipe_123 --priority high
  dm crm opp ls --search "Main St" --per-page 50`)
  .action(async (options) => {
    await crmOpportunitiesList(options);
  });

crmOppCmd
  .command('get <id>')
  .description('Get opportunity details')
  .option('--json', 'Output as JSON')
  .addHelpText('after', `
Examples:
  dm crm opp get opp_abc123 --json`)
  .action(async (id, options) => {
    await crmOpportunitiesGet(id, options);
  });

crmOppCmd
  .command('create')
  .description('Create an opportunity')
  .option('--body <json>', 'Request body as JSON string')
  .option('-f, --file <path>', 'Read request body from a JSON file')
  .option('--json', 'Output as JSON')
  .addHelpText('after', `
Examples:
  dm crm opp create --body '{"name":"123 Main St","pipeline_id":"pipe_123","stage_id":"stage_456"}' --json
  dm crm opp create -f opportunity.json`)
  .action(async (options) => {
    await crmOpportunitiesCreate(options);
  });

crmOppCmd
  .command('update <id>')
  .description('Update an opportunity')
  .option('--body <json>', 'Request body as JSON string')
  .option('-f, --file <path>', 'Read request body from a JSON file')
  .option('--json', 'Output as JSON')
  .addHelpText('after', `
Examples:
  dm crm opp update opp_abc123 --body '{"priority":"high"}' --json`)
  .action(async (id, options) => {
    await crmOpportunitiesUpdate(id, options);
  });

crmOppCmd
  .command('delete <id>')
  .description('Delete an opportunity')
  .option('--dry-run', 'Preview what would be deleted without making changes')
  .option('--json', 'Output as JSON')
  .addHelpText('after', `
Examples:
  dm crm opp delete opp_abc123
  dm crm opp delete opp_abc123 --dry-run  Preview deletion`)
  .action(async (id, options) => {
    if (options.dryRun) {
      console.log(`Would delete opportunity ${id}.`);
      console.log('No changes made (--dry-run).');
      return;
    }
    await crmOpportunitiesDelete(id, options);
  });

crmOppCmd
  .command('move <id>')
  .description('Move opportunity to a different stage')
  .option('--body <json>', 'Request body as JSON string (stage_id required)')
  .option('-f, --file <path>', 'Read request body from a JSON file')
  .option('--json', 'Output as JSON')
  .addHelpText('after', `
Examples:
  dm crm opp move opp_abc123 --body '{"stage_id":"stage_789"}' --json`)
  .action(async (id, options) => {
    await crmOpportunitiesMove(id, options);
  });

const crmTaskCmd = crmCmd
  .command('tasks')
  .description('Manage CRM tasks');

crmTaskCmd
  .command('list <opportunityId>')
  .alias('ls')
  .description('List tasks for an opportunity')
  .option('-p, --page <n>', 'Page number')
  .option('--per-page <n>', 'Results per page')
  .option('--json', 'Output as JSON')
  .addHelpText('after', `
Examples:
  dm crm tasks list opp_abc123 --json`)
  .action(async (opportunityId, options) => {
    await crmTasksList(opportunityId, options);
  });

crmTaskCmd
  .command('create <opportunityId>')
  .description('Create a task on an opportunity')
  .option('--body <json>', 'Request body as JSON string')
  .option('-f, --file <path>', 'Read request body from a JSON file')
  .option('--json', 'Output as JSON')
  .addHelpText('after', `
Examples:
  dm crm tasks create opp_abc123 --body '{"title":"Call owner"}' --json`)
  .action(async (opportunityId, options) => {
    await crmTasksCreate(opportunityId, options);
  });

crmTaskCmd
  .command('update <opportunityId> <taskId>')
  .description('Update a task')
  .option('--body <json>', 'Request body as JSON string')
  .option('-f, --file <path>', 'Read request body from a JSON file')
  .option('--json', 'Output as JSON')
  .addHelpText('after', `
Examples:
  dm crm tasks update opp_abc123 task_456 --body '{"status":"completed"}' --json`)
  .action(async (opportunityId, taskId, options) => {
    await crmTasksUpdate(opportunityId, taskId, options);
  });

const crmNoteCmd = crmCmd
  .command('notes')
  .description('Manage CRM notes');

crmNoteCmd
  .command('list <opportunityId>')
  .alias('ls')
  .description('List notes for an opportunity')
  .option('-p, --page <n>', 'Page number')
  .option('--per-page <n>', 'Results per page')
  .option('--json', 'Output as JSON')
  .addHelpText('after', `
Examples:
  dm crm notes list opp_abc123 --json`)
  .action(async (opportunityId, options) => {
    await crmNotesList(opportunityId, options);
  });

crmNoteCmd
  .command('create <opportunityId>')
  .description('Create a note on an opportunity')
  .option('--body <json>', 'Request body as JSON string')
  .option('-f, --file <path>', 'Read request body from a JSON file')
  .option('--json', 'Output as JSON')
  .addHelpText('after', `
Examples:
  dm crm notes create opp_abc123 --body '{"content":"Spoke with owner, interested in selling."}' --json`)
  .action(async (opportunityId, options) => {
    await crmNotesCreate(opportunityId, options);
  });

crmNoteCmd
  .command('update <opportunityId> <noteId>')
  .description('Update a note')
  .option('--body <json>', 'Request body as JSON string')
  .option('-f, --file <path>', 'Read request body from a JSON file')
  .option('--json', 'Output as JSON')
  .addHelpText('after', `
Examples:
  dm crm notes update opp_abc123 note_456 --body '{"content":"Updated note."}' --json`)
  .action(async (opportunityId, noteId, options) => {
    await crmNotesUpdate(opportunityId, noteId, options);
  });

const crmRecordCmd = crmCmd
  .command('records')
  .description('Manage linked records on opportunities');

crmRecordCmd
  .command('list <opportunityId>')
  .alias('ls')
  .description('List records linked to an opportunity')
  .option('--json', 'Output as JSON')
  .addHelpText('after', `
Examples:
  dm crm records list opp_abc123 --json`)
  .action(async (opportunityId, options) => {
    await crmRecordsList(opportunityId, options);
  });

crmRecordCmd
  .command('link <opportunityId>')
  .description('Link a record to an opportunity')
  .option('--body <json>', 'Request body as JSON string')
  .option('-f, --file <path>', 'Read request body from a JSON file')
  .option('--json', 'Output as JSON')
  .addHelpText('after', `
Examples:
  dm crm records link opp_abc123 --body '{"record_id":"prop_456","record_type":"property"}' --json`)
  .action(async (opportunityId, options) => {
    await crmRecordsLink(opportunityId, options);
  });

crmRecordCmd
  .command('unlink <opportunityId> <recordId>')
  .description('Unlink a record from an opportunity')
  .option('--dry-run', 'Preview what would be unlinked without making changes')
  .option('--json', 'Output as JSON')
  .addHelpText('after', `
Examples:
  dm crm records unlink opp_abc123 rec_456
  dm crm records unlink opp_abc123 rec_456 --dry-run`)
  .action(async (opportunityId, recordId, options) => {
    if (options.dryRun) {
      console.log(`Would unlink record ${recordId} from opportunity ${opportunityId}.`);
      console.log('No changes made (--dry-run).');
      return;
    }
    await crmRecordsUnlink(opportunityId, recordId, options);
  });

const crmLabelCmd = crmCmd
  .command('labels')
  .description('Manage CRM labels');

crmLabelCmd
  .command('list')
  .alias('ls')
  .description('List all CRM labels')
  .option('--json', 'Output as JSON')
  .addHelpText('after', `
Examples:
  dm crm labels list --json`)
  .action(async (options) => {
    await crmLabelsList(options);
  });

crmLabelCmd
  .command('create')
  .description('Create a label')
  .option('--body <json>', 'Request body as JSON string')
  .option('-f, --file <path>', 'Read request body from a JSON file')
  .option('--json', 'Output as JSON')
  .addHelpText('after', `
Examples:
  dm crm labels create --body '{"name":"Hot Lead","color":"red"}' --json`)
  .action(async (options) => {
    await crmLabelsCreate(options);
  });

crmLabelCmd
  .command('update <id>')
  .description('Update a label')
  .option('--body <json>', 'Request body as JSON string')
  .option('-f, --file <path>', 'Read request body from a JSON file')
  .option('--json', 'Output as JSON')
  .addHelpText('after', `
Examples:
  dm crm labels update label_abc123 --body '{"name":"Warm Lead"}' --json`)
  .action(async (id, options) => {
    await crmLabelsUpdate(id, options);
  });

crmLabelCmd
  .command('delete <id>')
  .description('Delete a label')
  .option('--dry-run', 'Preview what would be deleted without making changes')
  .option('--json', 'Output as JSON')
  .addHelpText('after', `
Examples:
  dm crm labels delete label_abc123
  dm crm labels delete label_abc123 --dry-run`)
  .action(async (id, options) => {
    if (options.dryRun) {
      console.log(`Would delete label ${id}.`);
      console.log('No changes made (--dry-run).');
      return;
    }
    await crmLabelsDelete(id, options);
  });

crmCmd
  .command('activity <opportunityId>')
  .description('View activity feed for an opportunity')
  .option('--cursor <cursor>', 'Cursor for pagination')
  .option('--limit <n>', 'Items per page')
  .option('--category <cat>', 'Filter by category')
  .option('--json', 'Output as JSON')
  .addHelpText('after', `
Examples:
  dm crm activity opp_abc123 --json
  dm crm activity opp_abc123 --category notes --limit 20`)
  .action(async (opportunityId, options) => {
    await crmActivity(opportunityId, options);
  });

// ============================================================================
// Dialer commands
// ============================================================================

const dialerCmd = program
  .command('dialer')
  .description('Manage dialer queues, calls, dispositions, and suppression');

// ── Calls ──

const dialerCallsCmd = dialerCmd
  .command('calls')
  .description('View call history and stats');

dialerCallsCmd
  .command('list')
  .alias('ls')
  .description('List call history')
  .option('--status <status>', 'Filter by status: initiating, ringing, answered, completed, failed, busy, no_answer, cancelled')
  .option('--search <term>', 'Search by contact name or phone number')
  .option('--date-from <date>', 'Filter from date (ISO 8601)')
  .option('--date-to <date>', 'Filter to date (ISO 8601)')
  .option('-p, --page <n>', 'Page number')
  .option('--per-page <n>', 'Results per page')
  .option('--json', 'Output as JSON')
  .addHelpText('after', `
Examples:
  dm dialer calls list --json
  dm dialer calls list --status completed --date-from 2025-01-01
  dm dialer calls list --search "5125551234" --per-page 50`)
  .action(async (options) => {
    await dialerCallsList(options);
  });

dialerCallsCmd
  .command('get <uuid>')
  .description('Get call details by UUID')
  .option('--json', 'Output as JSON')
  .addHelpText('after', `
Examples:
  dm dialer calls get call_uuid_123 --json`)
  .action(async (uuid, options) => {
    await dialerCallsGet(uuid, options);
  });

dialerCallsCmd
  .command('stats')
  .description('Get call statistics')
  .option('--date-from <date>', 'Filter from date (ISO 8601)')
  .option('--date-to <date>', 'Filter to date (ISO 8601)')
  .option('--json', 'Output as JSON')
  .addHelpText('after', `
Examples:
  dm dialer calls stats --json
  dm dialer calls stats --date-from 2025-01-01 --date-to 2025-01-31`)
  .action(async (options) => {
    await dialerCallsStats(options);
  });

// ── Call Notes ──

const dialerNotesCmd = dialerCmd
  .command('notes')
  .description('Manage call notes');

dialerNotesCmd
  .command('list <callUuid>')
  .alias('ls')
  .description('List notes for a call')
  .option('--json', 'Output as JSON')
  .addHelpText('after', `
Examples:
  dm dialer notes list call_uuid_123 --json`)
  .action(async (callUuid, options) => {
    await dialerNotesList(callUuid, options);
  });

dialerNotesCmd
  .command('create <callUuid>')
  .description('Add a note to a call')
  .option('--body <json>', 'Request body as JSON string')
  .option('-f, --file <path>', 'Read request body from a JSON file')
  .option('--json', 'Output as JSON')
  .addHelpText('after', `
Examples:
  dm dialer notes create call_uuid_123 --body '{"content":"Left voicemail."}' --json`)
  .action(async (callUuid, options) => {
    await dialerNotesCreate(callUuid, options);
  });

dialerNotesCmd
  .command('delete <callUuid> <noteId>')
  .description('Delete a call note')
  .option('--dry-run', 'Preview what would be deleted without making changes')
  .option('--json', 'Output as JSON')
  .addHelpText('after', `
Examples:
  dm dialer notes delete call_uuid_123 note_456
  dm dialer notes delete call_uuid_123 note_456 --dry-run`)
  .action(async (callUuid, noteId, options) => {
    if (options.dryRun) {
      console.log(`Would delete note ${noteId} from call ${callUuid}.`);
      console.log('No changes made (--dry-run).');
      return;
    }
    await dialerNotesDelete(callUuid, noteId, options);
  });

// ── Queues ──

const dialerQueuesCmd = dialerCmd
  .command('queues')
  .description('Manage dialer queues');

dialerQueuesCmd
  .command('list')
  .alias('ls')
  .description('List all dialer queues')
  .option('--json', 'Output as JSON')
  .addHelpText('after', `
Examples:
  dm dialer queues list --json`)
  .action(async (options) => {
    await dialerQueuesList(options);
  });

dialerQueuesCmd
  .command('create')
  .description('Create a new queue')
  .option('--body <json>', 'Request body as JSON string')
  .option('-f, --file <path>', 'Read request body from a JSON file')
  .option('--json', 'Output as JSON')
  .addHelpText('after', `
Examples:
  dm dialer queues create --body '{"name":"Morning Calls"}' --json`)
  .action(async (options) => {
    await dialerQueuesCreate(options);
  });

dialerQueuesCmd
  .command('delete <id>')
  .description('Delete a queue')
  .option('--dry-run', 'Preview what would be deleted without making changes')
  .option('--json', 'Output as JSON')
  .addHelpText('after', `
Examples:
  dm dialer queues delete queue_abc123
  dm dialer queues delete queue_abc123 --dry-run`)
  .action(async (id, options) => {
    if (options.dryRun) {
      console.log(`Would delete queue ${id} and all its items.`);
      console.log('No changes made (--dry-run).');
      return;
    }
    await dialerQueuesDelete(id, options);
  });

// ── Queue Items ──

const dialerItemsCmd = dialerCmd
  .command('items')
  .description('Manage queue items');

dialerItemsCmd
  .command('list <queueId>')
  .alias('ls')
  .description('List items in a queue')
  .option('--status <status>', 'Filter by status: pending, in_progress, completed, skipped, deferred')
  .option('-p, --page <n>', 'Page number')
  .option('--per-page <n>', 'Results per page')
  .option('--json', 'Output as JSON')
  .addHelpText('after', `
Examples:
  dm dialer items list queue_abc123 --json
  dm dialer items list queue_abc123 --status pending --per-page 50`)
  .action(async (queueId, options) => {
    await dialerQueueItemsList(queueId, options);
  });

dialerItemsCmd
  .command('add <queueId>')
  .description('Add items to a queue')
  .option('--body <json>', 'Request body as JSON string')
  .option('-f, --file <path>', 'Read request body from a JSON file')
  .option('--json', 'Output as JSON')
  .addHelpText('after', `
Examples:
  dm dialer items add queue_abc123 --body '{"phone_numbers":["5125551234"]}' --json`)
  .action(async (queueId, options) => {
    await dialerQueueItemsAdd(queueId, options);
  });

dialerItemsCmd
  .command('update <queueId> <itemId>')
  .description('Update a queue item')
  .option('--body <json>', 'Request body as JSON string')
  .option('-f, --file <path>', 'Read request body from a JSON file')
  .option('--json', 'Output as JSON')
  .addHelpText('after', `
Examples:
  dm dialer items update queue_abc123 item_456 --body '{"status":"skipped"}' --json`)
  .action(async (queueId, itemId, options) => {
    await dialerQueueItemsUpdate(queueId, itemId, options);
  });

dialerItemsCmd
  .command('remove <queueId> <itemId>')
  .description('Remove an item from a queue')
  .option('--dry-run', 'Preview what would be removed without making changes')
  .option('--json', 'Output as JSON')
  .addHelpText('after', `
Examples:
  dm dialer items remove queue_abc123 item_456
  dm dialer items remove queue_abc123 item_456 --dry-run`)
  .action(async (queueId, itemId, options) => {
    if (options.dryRun) {
      console.log(`Would remove item ${itemId} from queue ${queueId}.`);
      console.log('No changes made (--dry-run).');
      return;
    }
    await dialerQueueItemsRemove(queueId, itemId, options);
  });

// ── Dispositions ──

dialerCmd
  .command('dispositions')
  .description('List call dispositions')
  .option('--json', 'Output as JSON')
  .addHelpText('after', `
Examples:
  dm dialer dispositions --json`)
  .action(async (options) => {
    await dialerDispositions(options);
  });

// ── Suppression ──

const dialerSuppCmd = dialerCmd
  .command('suppression')
  .description('Manage suppression list (Do Not Call)');

dialerSuppCmd
  .command('list')
  .alias('ls')
  .description('List suppressed phone numbers')
  .option('--search <term>', 'Search by phone number')
  .option('-p, --page <n>', 'Page number')
  .option('--per-page <n>', 'Results per page')
  .option('--json', 'Output as JSON')
  .addHelpText('after', `
Examples:
  dm dialer suppression list --json
  dm dialer suppression list --search "512" --per-page 100`)
  .action(async (options) => {
    await dialerSuppressionList(options);
  });

dialerSuppCmd
  .command('check <phoneNumber>')
  .description('Check if a phone number is suppressed')
  .option('--json', 'Output as JSON')
  .addHelpText('after', `
Examples:
  dm dialer suppression check 5125551234 --json`)
  .action(async (phoneNumber, options) => {
    await dialerSuppressionCheck(phoneNumber, options);
  });

dialerSuppCmd
  .command('add')
  .description('Add a phone number to the suppression list')
  .option('--body <json>', 'Request body as JSON string')
  .option('-f, --file <path>', 'Read request body from a JSON file')
  .option('--json', 'Output as JSON')
  .addHelpText('after', `
Examples:
  dm dialer suppression add --body '{"phone_number":"5125551234","reason":"Do not contact"}' --json`)
  .action(async (options) => {
    await dialerSuppressionAdd(options);
  });

// ============================================================================
// Mail commands
// ============================================================================

const mailCmd = program
  .command('mail')
  .description('Manage direct mail campaigns, designs, return addresses, and wallet');

// ── Campaigns ──

const mailCampaignsCmd = mailCmd
  .command('campaigns')
  .alias('camp')
  .description('Manage mail campaigns');

mailCampaignsCmd
  .command('list')
  .alias('ls')
  .description('List mail campaigns')
  .option('--status <status>', 'Filter by status: draft, active, paused, completed, cancelled')
  .option('--search <term>', 'Search by campaign name')
  .option('-p, --page <n>', 'Page number')
  .option('--per-page <n>', 'Results per page')
  .option('--json', 'Output as JSON')
  .addHelpText('after', `
Examples:
  dm mail campaigns list --json
  dm mail camp ls --status active
  dm mail campaigns list --search "Austin" --per-page 50`)
  .action(async (options) => {
    await mailCampaignsList(options);
  });

mailCampaignsCmd
  .command('create')
  .description('Create a mail campaign')
  .option('--body <json>', 'Request body as JSON string')
  .option('-f, --file <path>', 'Read request body from a JSON file')
  .option('--json', 'Output as JSON')
  .addHelpText('after', `
Examples:
  dm mail campaigns create -f campaign.json --json
  dm mail campaigns create --body '{"name":"Austin Owners","property_ids":[123],"address_to":"owner","steps":[{"design_prompt":"Professional postcard"}]}'

Note: Set "launch": true in body to send immediately, or leave as draft.`)
  .action(async (options) => {
    await mailCampaignsCreate(options);
  });

mailCampaignsCmd
  .command('get <id>')
  .description('Get campaign details')
  .option('--json', 'Output as JSON')
  .addHelpText('after', `
Examples:
  dm mail campaigns get camp_abc123 --json`)
  .action(async (id, options) => {
    await mailCampaignsGet(id, options);
  });

mailCampaignsCmd
  .command('update <id>')
  .description('Update a draft campaign')
  .option('--body <json>', 'Request body as JSON string')
  .option('-f, --file <path>', 'Read request body from a JSON file')
  .option('--json', 'Output as JSON')
  .addHelpText('after', `
Examples:
  dm mail campaigns update camp_abc123 --body '{"name":"Updated Name"}' --json

Note: Only draft campaigns can be updated.`)
  .action(async (id, options) => {
    await mailCampaignsUpdate(id, options);
  });

mailCampaignsCmd
  .command('delete <id>')
  .description('Cancel a campaign')
  .option('--dry-run', 'Preview what would be cancelled without making changes')
  .option('--json', 'Output as JSON')
  .addHelpText('after', `
Examples:
  dm mail campaigns delete camp_abc123
  dm mail campaigns delete camp_abc123 --dry-run

Note: Active campaigns will stop sending. Already-submitted mail cannot be recalled.`)
  .action(async (id, options) => {
    if (options.dryRun) {
      console.log(`Would cancel campaign ${id}. Already-submitted mail cannot be recalled.`);
      console.log('No changes made (--dry-run).');
      return;
    }
    await mailCampaignsDelete(id, options);
  });

mailCampaignsCmd
  .command('send <id>')
  .description('Launch a draft campaign')
  .option('--dry-run', 'Check cost estimate without launching')
  .option('--json', 'Output as JSON')
  .addHelpText('after', `
Examples:
  dm mail campaigns send camp_abc123 --json
  dm mail campaigns send camp_abc123 --dry-run   Check cost before sending

Note: Verify wallet balance first with: dm mail wallet balance`)
  .action(async (id, options) => {
    if (options.dryRun) {
      await mailCampaignsCostEstimate(id, options);
      return;
    }
    await mailCampaignsSend(id, options);
  });

mailCampaignsCmd
  .command('pause <id>')
  .description('Pause an active campaign')
  .option('--json', 'Output as JSON')
  .addHelpText('after', `
Examples:
  dm mail campaigns pause camp_abc123`)
  .action(async (id, options) => {
    await mailCampaignsPause(id, options);
  });

mailCampaignsCmd
  .command('resume <id>')
  .description('Resume a paused campaign')
  .option('--json', 'Output as JSON')
  .addHelpText('after', `
Examples:
  dm mail campaigns resume camp_abc123`)
  .action(async (id, options) => {
    await mailCampaignsResume(id, options);
  });

mailCampaignsCmd
  .command('recipients <id>')
  .description('List campaign recipients')
  .option('-p, --page <n>', 'Page number')
  .option('--per-page <n>', 'Results per page')
  .option('--json', 'Output as JSON')
  .addHelpText('after', `
Examples:
  dm mail campaigns recipients camp_abc123 --json
  dm mail campaigns recipients camp_abc123 --per-page 100`)
  .action(async (id, options) => {
    await mailCampaignsRecipients(id, options);
  });

mailCampaignsCmd
  .command('analytics <id>')
  .description('Get campaign delivery and response analytics')
  .option('--json', 'Output as JSON')
  .addHelpText('after', `
Examples:
  dm mail campaigns analytics camp_abc123 --json`)
  .action(async (id, options) => {
    await mailCampaignsAnalytics(id, options);
  });

mailCampaignsCmd
  .command('cost-estimate <id>')
  .description('Estimate campaign cost before sending')
  .option('--json', 'Output as JSON')
  .addHelpText('after', `
Examples:
  dm mail campaigns cost-estimate camp_abc123 --json`)
  .action(async (id, options) => {
    await mailCampaignsCostEstimate(id, options);
  });

// ── Designs ──

const mailDesignsCmd = mailCmd
  .command('designs')
  .description('Manage postcard designs');

mailDesignsCmd
  .command('list')
  .alias('ls')
  .description('List designs')
  .option('--status <status>', 'Filter by status: draft, active, archived')
  .option('--size <size>', 'Filter by size: 4x6, 6x9, 6x11')
  .option('--search <term>', 'Search by name')
  .option('-p, --page <n>', 'Page number')
  .option('--per-page <n>', 'Results per page')
  .option('--json', 'Output as JSON')
  .addHelpText('after', `
Examples:
  dm mail designs list --json
  dm mail designs list --status active --size 4x6
  dm mail designs list --search "professional"`)
  .action(async (options) => {
    await mailDesignsList(options);
  });

mailDesignsCmd
  .command('create')
  .description('Create a postcard design')
  .option('--body <json>', 'Request body as JSON string')
  .option('-f, --file <path>', 'Read request body from a JSON file')
  .option('--json', 'Output as JSON')
  .addHelpText('after', `
Examples:
  dm mail designs create --body '{"name":"My Card","prompt":"Professional real estate postcard","size":"4x6"}' --json
  dm mail designs create -f design.json

Note: Provide either "prompt" (AI-generated) or "html_front" (custom HTML).`)
  .action(async (options) => {
    await mailDesignsCreate(options);
  });

mailDesignsCmd
  .command('get <id>')
  .description('Get design details')
  .option('--json', 'Output as JSON')
  .addHelpText('after', `
Examples:
  dm mail designs get des_abc123 --json`)
  .action(async (id, options) => {
    await mailDesignsGet(id, options);
  });

mailDesignsCmd
  .command('update <id>')
  .description('Update a design')
  .option('--body <json>', 'Request body as JSON string')
  .option('-f, --file <path>', 'Read request body from a JSON file')
  .option('--json', 'Output as JSON')
  .addHelpText('after', `
Examples:
  dm mail designs update des_abc123 --body '{"name":"Updated Name","publish":true}' --json

Note: Set "publish": true to promote draft HTML to active.`)
  .action(async (id, options) => {
    await mailDesignsUpdate(id, options);
  });

mailDesignsCmd
  .command('delete <id>')
  .description('Delete a design')
  .option('--dry-run', 'Preview what would be deleted without making changes')
  .option('--json', 'Output as JSON')
  .addHelpText('after', `
Examples:
  dm mail designs delete des_abc123
  dm mail designs delete des_abc123 --dry-run

Note: Designs used in active campaigns cannot be deleted.`)
  .action(async (id, options) => {
    if (options.dryRun) {
      console.log(`Would delete design ${id}.`);
      console.log('No changes made (--dry-run).');
      return;
    }
    await mailDesignsDelete(id, options);
  });

// ── Return Addresses ──

const mailAddressesCmd = mailCmd
  .command('return-addresses')
  .alias('addr')
  .description('Manage return addresses for mail campaigns');

mailAddressesCmd
  .command('list')
  .alias('ls')
  .description('List return addresses')
  .option('--json', 'Output as JSON')
  .addHelpText('after', `
Examples:
  dm mail return-addresses list --json
  dm mail addr ls --json`)
  .action(async (options) => {
    await mailReturnAddressesList(options);
  });

mailAddressesCmd
  .command('create')
  .description('Create a return address (USPS-validated)')
  .option('--body <json>', 'Request body as JSON string')
  .option('-f, --file <path>', 'Read request body from a JSON file')
  .option('--json', 'Output as JSON')
  .addHelpText('after', `
Examples:
  dm mail addr create --body '{"name":"DealMachine","address_1":"123 Main St","city":"Austin","state":"TX","zip":"78704"}' --json
  dm mail addr create --body '{"name":"Office","label":"HQ","address_1":"456 Oak","city":"Dallas","state":"TX","zip":"75201","set_as_default":true}'`)
  .action(async (options) => {
    await mailReturnAddressesCreate(options);
  });

mailAddressesCmd
  .command('get <id>')
  .description('Get return address details')
  .option('--json', 'Output as JSON')
  .addHelpText('after', `
Examples:
  dm mail addr get addr_abc123 --json`)
  .action(async (id, options) => {
    await mailReturnAddressesGet(id, options);
  });

mailAddressesCmd
  .command('update <id>')
  .description('Update a return address (re-validated by USPS)')
  .option('--body <json>', 'Request body as JSON string')
  .option('-f, --file <path>', 'Read request body from a JSON file')
  .option('--json', 'Output as JSON')
  .addHelpText('after', `
Examples:
  dm mail addr update addr_abc123 --body '{"name":"New Name"}' --json`)
  .action(async (id, options) => {
    await mailReturnAddressesUpdate(id, options);
  });

mailAddressesCmd
  .command('delete <id>')
  .description('Delete a return address')
  .option('--dry-run', 'Preview what would be deleted without making changes')
  .option('--json', 'Output as JSON')
  .addHelpText('after', `
Examples:
  dm mail addr delete addr_abc123
  dm mail addr delete addr_abc123 --dry-run

Note: Cannot delete the default address. Set another as default first.`)
  .action(async (id, options) => {
    if (options.dryRun) {
      console.log(`Would delete return address ${id}.`);
      console.log('No changes made (--dry-run).');
      return;
    }
    await mailReturnAddressesDelete(id, options);
  });

mailAddressesCmd
  .command('set-default <id>')
  .description('Set a return address as the default')
  .option('--json', 'Output as JSON')
  .addHelpText('after', `
Examples:
  dm mail addr set-default addr_abc123`)
  .action(async (id, options) => {
    await mailReturnAddressesSetDefault(id, options);
  });

// ── Wallet ──

const mailWalletCmd = mailCmd
  .command('wallet')
  .description('Manage mail wallet balance and transactions');

mailWalletCmd
  .command('balance')
  .description('Get wallet balance')
  .option('--json', 'Output as JSON')
  .addHelpText('after', `
Examples:
  dm mail wallet balance --json`)
  .action(async (options) => {
    await mailWalletBalance(options);
  });

mailWalletCmd
  .command('add-funds')
  .description('Add credits to your mail wallet ($50–$10,000)')
  .option('--body <json>', 'Request body as JSON string')
  .option('-f, --file <path>', 'Read request body from a JSON file')
  .option('--json', 'Output as JSON')
  .addHelpText('after', `
Examples:
  dm mail wallet add-funds --body '{"amount_cents":5000}' --json                      Add $50
  dm mail wallet add-funds --body '{"amount_cents":10000,"payment_method_id":"pm_..."}' --json`)
  .action(async (options) => {
    await mailWalletAddFunds(options);
  });

mailWalletCmd
  .command('transactions')
  .alias('txns')
  .description('List wallet transactions')
  .option('--type <type>', 'Filter by type: purchase, spend, refund')
  .option('--reference-type <type>', 'Filter by reference type: campaign, stripe_payment')
  .option('--campaign-id <id>', 'Filter by campaign ID')
  .option('-p, --page <n>', 'Page number')
  .option('--per-page <n>', 'Results per page')
  .option('--json', 'Output as JSON')
  .addHelpText('after', `
Examples:
  dm mail wallet transactions --json
  dm mail wallet txns --type spend --campaign-id camp_abc123
  dm mail wallet transactions --type purchase --per-page 50`)
  .action(async (options) => {
    await mailWalletTransactions(options);
  });

mailWalletCmd
  .command('pricing')
  .description('Get postcard pricing for your plan')
  .option('--json', 'Output as JSON')
  .addHelpText('after', `
Examples:
  dm mail wallet pricing --json`)
  .action(async (options) => {
    await mailWalletPricing(options);
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
