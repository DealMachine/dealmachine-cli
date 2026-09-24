#!/usr/bin/env node

import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';
import { CLI_VERSION } from './version.js';
import { login } from './commands/login.js';
import { logout } from './commands/logout.js';
import { whoami } from './commands/whoami.js';
import { configGet, configSet, configPath } from './commands/config.js';
import { account } from './commands/account.js';
import { usage } from './commands/usage.js';
import {
  agentsGuide,
  agentsInstallClaudeCode,
  agentsPermissions,
  agentsPlaybook,
} from './commands/agents.js';
import { checkout, plans, signup } from './commands/onboarding.js';
import {
  propertiesSearch,
  propertiesCount,
  propertiesGet,
  propertiesIds,
  propertiesExport,
} from './commands/properties.js';
import {
  peopleSearch,
  peopleCount,
  peopleGet,
  peopleIds,
  peopleExport,
} from './commands/people.js';
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
  addressesAutocomplete,
  locationsSearch,
  locationsAutocomplete,
  locationsGet,
} from './commands/locations.js';
import { phonesDnc } from './commands/phones.js';
import { exportsList, exportsGet } from './commands/exports.js';
import { subscriptionStatus } from './commands/subscription.js';
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
import { tasksList, tasksGet, tasksCreate, tasksUpdate, tasksDelete } from './commands/tasks.js';
import { drivingList, drivingGet } from './commands/driving.js';
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
  mailSettingsGet,
  mailSettingsUpdate,
  mailAnalyticsSummary,
  mailAnalyticsTimeseries,
} from './commands/mail.js';
import {
  prospectsList,
  prospectsGet,
  prospectsGetByRecord,
  prospectsAdd,
  prospectsArchive,
  prospectsRemove,
  prospectsReactivate,
  prospectsOpportunity,
  prospectsFavorite,
  prospectsCheck,
  prospectsCounts,
  prospectsActivity,
  prospectNotesList,
  prospectNotesGet,
  prospectNotesAdd,
  prospectNotesEdit,
  prospectNotesRemove,
  prospectFilesList,
  prospectFilesUpload,
  prospectFilesDownload,
  prospectFilesRemove,
  prospectPhotosList,
  prospectPhotosAdd,
  prospectPhotosRemove,
  prospectTagsList,
  prospectTagsSet,
  prospectTagsAdd,
  prospectTagsRemove,
} from './commands/prospects.js';
import {
  tagsList,
  tagsGet,
  tagsCreate,
  tagsUpdate,
  tagsDelete,
  tagsReorder,
} from './commands/tags.js';
import {
  webhooksList,
  webhooksGet,
  webhooksCreate,
  webhooksUpdate,
  webhooksDelete,
  webhooksTest,
  webhooksRotateSecret,
  webhooksDeliveries,
  webhooksDeliveryGet,
  webhooksRedeliver,
  webhooksEvents,
} from './commands/webhooks.js';

export const program = new Command();

program
  .name('dm')
  .description('DealMachine CLI - Property intelligence from the command line')
  .version(CLI_VERSION)
  .option('--quiet', 'Suppress spinners and decorative output (agent-friendly, also DM_QUIET=1)')
  .addHelpText(
    'after',
    `
Examples:
  dm login --key dm_sk_live_abc123       Login with an API key
  dm properties search -f query.json     Search properties from a file
  dm enrich address "123 Main St"        Enrich a single address
  dm lists search --json                 List all lists as JSON

Tip: Every subcommand supports --help with examples.
     Use --json on any command for machine-readable output.
     Pipe JSON via stdin: echo '{}' | dm properties search

Agents:
  dm agents guide                       Print concise agent usage guidance
  dm agents playbook                    Print the full DealMachine Playbook
  dm agents install claude-code         Install the Playbook as a Claude Code skill

Agent defaults: use --json and --quiet, fetch filters and fields before searches,
and count before credit-consuming commands.`
  );

// ============================================================================
// Agent commands
// ============================================================================

const agentsCmd = program
  .command('agents')
  .description('Agent bootstrap help and DealMachine Playbook contents')
  .option('--json', 'Output as JSON')
  .addHelpText(
    'after',
    `
Examples:
  dm agents                              Print concise agent usage guidance
  dm agents guide --json                 Print agent guidance as JSON
  dm agents playbook                     Print the full DealMachine Playbook
  dm agents install claude-code          Install the Playbook for Claude Code
  dm agents permissions                  Print a safe Claude Code allowlist
  dm agents skill                        Alias for dm agents playbook`
  )
  .action(async (options: { json?: boolean }) => {
    await agentsGuide({ ...options, json: options.json || agentsCmd.opts().json });
  });

agentsCmd
  .command('guide')
  .description('Print concise guidance for agents using the CLI')
  .option('--json', 'Output as JSON')
  .addHelpText(
    'after',
    `
Examples:
  dm agents guide                        Print concise agent usage guidance
  dm agents guide --json                 Print agent guidance as JSON`
  )
  .action(async (options: { json?: boolean }) => {
    await agentsGuide({ ...options, json: options.json || agentsCmd.opts().json });
  });

agentsCmd
  .command('playbook')
  .alias('skill')
  .description('Print the bundled DealMachine Playbook for agent workflows')
  .option('--json', 'Output as JSON')
  .addHelpText(
    'after',
    `
Examples:
  dm agents playbook                     Print the full Playbook Markdown
  dm agents playbook --json              Print the Playbook as JSON
  dm agents skill                        Alias for dm agents playbook`
  )
  .action(async (options: { json?: boolean }) => {
    await agentsPlaybook({ ...options, json: options.json || agentsCmd.opts().json });
  });

agentsCmd
  .command('install <agent>')
  .description('Install the bundled Playbook for a supported coding agent')
  .option('--project', 'Install in the current project instead of the personal Claude config')
  .option('--force', 'Replace a different existing DealMachine skill')
  .option('--json', 'Output as JSON')
  .addHelpText(
    'after',
    `
Supported agents:
  claude-code

Examples:
  dm agents install claude-code
  dm agents install claude-code --project
  dm agents install claude-code --force --json`
  )
  .action(
    async (agent: string, options: { project?: boolean; force?: boolean; json?: boolean }) => {
      const normalizedOptions = { ...options, json: options.json || agentsCmd.opts().json };
      if (agent !== 'claude-code') {
        const message = `Unsupported agent "${agent}". Supported agents: claude-code`;
        if (normalizedOptions.json) console.log(JSON.stringify({ error: message }, null, 2));
        else console.error(message);
        process.exitCode = 1;
        return;
      }
      await agentsInstallClaudeCode(normalizedOptions);
    }
  );

agentsCmd
  .command('permissions')
  .description('Print the recommended Claude Code allowlist for free DealMachine commands')
  .option('--json', 'Output as JSON')
  .addHelpText(
    'after',
    `
Examples:
  dm agents permissions
  dm agents permissions --json`
  )
  .action(async (options: { json?: boolean }) => {
    await agentsPermissions({ ...options, json: options.json || agentsCmd.opts().json });
  });

// ============================================================================
// Auth commands
// ============================================================================

program
  .command('login')
  .description('Authenticate with your DealMachine account')
  .option('--no-browser', 'Do not automatically open the browser')
  .option('--key <api-key>', 'Login directly with an API key (skips browser)')
  .option(
    '--env <environment>',
    'API environment: local, staging, or production (default: production)'
  )
  .addHelpText(
    'after',
    `
Examples:
  dm login                               Interactive browser login
  dm login --key dm_sk_live_abc123       Login with an API key (non-interactive)
  dm login --env staging --no-browser    Login to staging without opening browser
  dm login --env local --no-browser      Login to local env without opening browser`
  )
  .action(async (options) => {
    if (options.env) {
      process.env.DM_ENV = options.env;
    }
    await login({ noBrowser: options.browser === false, key: options.key, env: options.env });
  });

program
  .command('logout')
  .description('Remove stored credentials')
  .addHelpText(
    'after',
    `
Examples:
  dm logout                              Remove stored API key and config`
  )
  .action(async () => {
    await logout();
  });

program
  .command('whoami')
  .description('Show current authentication status')
  .option('--verify', 'Verify credentials with the API')
  .addHelpText(
    'after',
    `
Examples:
  dm whoami                              Show stored credentials
  dm whoami --verify                     Verify credentials against the API`
  )
  .action(async (options) => {
    await whoami(options);
  });

program
  .command('signup')
  .description('Create a public API account and receive an API key')
  .argument('<email>', 'Email address for the new account')
  .option('--first-name <name>', 'First name')
  .option('--last-name <name>', 'Last name')
  .option('--phone-number <phone-number>', 'Phone number in E.164 format, if required')
  .option('--login', 'Store the returned API key for the CLI')
  .option('--json', 'Output as JSON')
  .option(
    '--env <environment>',
    'API environment: local, staging, or production (default: production)'
  )
  .addHelpText(
    'after',
    `
Examples:
  dm signup ada@example.com --first-name Ada --last-name Lovelace --phone-number +15551234567
  dm signup ada@example.com --login
  dm signup ada@example.com --env staging --json`
  )
  .action(async (email: string, options) => {
    await signup({ ...options, email });
  });

program
  .command('plans')
  .description('List public self-serve subscription plans')
  .option('--type <type>', 'Plan family filter. Currently: solo')
  .option('--json', 'Output as JSON')
  .option(
    '--env <environment>',
    'API environment: local, staging, or production (default: production)'
  )
  .addHelpText(
    'after',
    `
Examples:
  dm plans
  dm plans --env staging
  dm plans --json`
  )
  .action(async (options) => {
    await plans(options);
  });

program
  .command('checkout')
  .description('Create a Stripe checkout session for a self-serve plan')
  .requiredOption('--price-id <price-id>', 'Stripe price ID from dm plans')
  .option('--quantity <quantity>', 'Seat quantity', '1')
  .option('--json', 'Output as JSON')
  .addHelpText(
    'after',
    `
Examples:
  dm checkout --price-id price_xxx_monthly
  dm checkout --price-id price_xxx_monthly --quantity 2 --json`
  )
  .action(async (options) => {
    await checkout(options);
  });

// ============================================================================
// Config commands
// ============================================================================

const configCmd = program.command('config').description('View and modify configuration');

configCmd
  .command('get [key]')
  .description('Get a configuration value (or all values)')
  .addHelpText(
    'after',
    `
Examples:
  dm config get                          Show all config values
  dm config get apiEnvironment           Show a specific config value`
  )
  .action(async (key?: string) => {
    await configGet(key);
  });

configCmd
  .command('set <key> <value>')
  .description('Set a configuration value')
  .addHelpText(
    'after',
    `
Examples:
  dm config set apiEnvironment production   Switch to production API
  dm config set apiEnvironment staging      Switch to staging API
  dm config set apiEnvironment local        Switch to local API`
  )
  .action(async (key: string, value: string) => {
    await configSet(key, value);
  });

configCmd
  .command('path')
  .description('Show config file path')
  .addHelpText(
    'after',
    `
Examples:
  dm config path                         Print path to ~/.dealmachine/config.json`
  )
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
  .addHelpText(
    'after',
    `
Examples:
  dm account                             Show account details
  dm account --json                      Show account details as JSON`
  )
  .action(async (options) => {
    await account(options);
  });

program
  .command('usage')
  .description('Show credit usage for current billing cycle')
  .option('--json', 'Output as JSON')
  .addHelpText(
    'after',
    `
Examples:
  dm usage                               Show credit usage summary
  dm usage --json                        Show credit usage as JSON`
  )
  .action(async (options) => {
    await usage(options);
  });

// ============================================================================
// Subscription commands
// ============================================================================

const subscriptionCmd = program
  .command('subscription')
  .alias('sub')
  .description('View subscription status and manage trial');

subscriptionCmd
  .command('status')
  .description('Show current subscription status, plan, trial, and credit caps')
  .option('--json', 'Output as JSON')
  .addHelpText(
    'after',
    `
Examples:
  dm subscription status
  dm subscription status --json
  dm sub status --json`
  )
  .action(async (options) => {
    await subscriptionStatus(options);
  });

// ============================================================================
// Locations commands
// ============================================================================

const locationsCmd = program
  .command('locations')
  .alias('loc')
  .description('Search and look up US locations (states, counties, cities, zip codes)');

locationsCmd
  .command('search')
  .alias('ls')
  .description('Search locations by name, code, or state')
  .requiredOption('-q, --query <text>', 'Search query (e.g., "Harris", "Austin", "MO", "78704")')
  .option('--type <type>', 'Filter by type: state, county, city, zip_code')
  .option('--state <code>', 'Filter by state (two-letter abbreviation, e.g., TX)')
  .option('-p, --page <n>', 'Page number')
  .option('--per-page <n>', 'Results per page (max 100)')
  .option('--json', 'Output as JSON')
  .addHelpText(
    'after',
    `
Examples:
  dm locations search -q "Harris" --json
  dm locations search -q "787" --type zip_code --state TX
  dm locations search -q "saint louis" --type city --state MO --json
  dm locations search -q "MO" --type state --json
  dm loc search -q "California" --type state --json`
  )
  .action(async (options) => {
    await locationsSearch(options);
  });

locationsCmd
  .command('autocomplete <query>')
  .alias('complete')
  .description('Deprecated alias for dm addresses autocomplete')
  .option('--state <code>', 'Prefer a state (two-letter abbreviation, e.g., TX)')
  .option('--limit <n>', 'Maximum suggestions (default 5, max 10)', '5')
  .option('--latitude <number>', 'Latitude for nearby address ranking')
  .option('--longitude <number>', 'Longitude for nearby address ranking')
  .option('--json', 'Output as JSON')
  .addHelpText(
    'after',
    `
Examples:
  dm locations autocomplete "1200 Barton Springs" --state TX
  dm loc autocomplete "46 Joyce St" --limit 5 --json`
  )
  .action(async (query, options) => {
    await locationsAutocomplete({ query, ...options });
  });

locationsCmd
  .command('get <locationId>')
  .description('Get a location by ID (e.g., loc_county_48201, loc_city_7333)')
  .option('--json', 'Output as JSON')
  .addHelpText(
    'after',
    `
Examples:
  dm locations get loc_county_48201 --json
  dm locations get loc_city_7333 --json
  dm locations get loc_state_TX
  dm loc get loc_zip_code_78704 --json`
  )
  .action(async (locationId, options) => {
    await locationsGet(locationId, options);
  });

// ============================================================================
// Phones commands
// ============================================================================

const phonesCmd = program.command('phones').description('Phone number utilities (DNC check)');

phonesCmd
  .command('dnc [phoneNumber]')
  .description('Check Do Not Call registry status for phone numbers')
  .option('--body <json>', 'Request body as JSON string')
  .option('-f, --file <path>', 'Read request body from a JSON file')
  .option('--json', 'Output as JSON')
  .addHelpText(
    'after',
    `
Examples:
  dm phones dnc "5125551234" --json
  dm phones dnc --body '{"phones":[{"number":"5125551234"},{"number":"5125559876"}]}'
  dm phones dnc -f phones.json --json`
  )
  .action(async (phoneNumber, options) => {
    await phonesDnc(phoneNumber, options);
  });

// ============================================================================
// Exports commands
// ============================================================================

const exportsCmd = program.command('exports').description('View past exports and download files');

exportsCmd
  .command('list')
  .alias('ls')
  .description('List past exports')
  .option('--limit <n>', 'Number of exports to return (1-100, default 25)')
  .option('--offset <n>', 'Number to skip (default 0)')
  .option('--status <status>', 'Filter by status: pending, processing, completed, failed')
  .option('--json', 'Output as JSON')
  .addHelpText(
    'after',
    `
Examples:
  dm exports list --json
  dm exports list --status completed --limit 10
  dm exports ls --status processing`
  )
  .action(async (options) => {
    await exportsList(options);
  });

exportsCmd
  .command('get <exportId>')
  .description('Get export details and download URLs')
  .option('--json', 'Output as JSON')
  .addHelpText(
    'after',
    `
Examples:
  dm exports get abc-123 --json`
  )
  .action(async (exportId, options) => {
    await exportsGet(exportId, options);
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
  .option('--include-lists <ids>', 'Comma-separated list IDs to include')
  .option('--exclude-lists <ids>', 'Comma-separated list IDs to exclude')
  .option('--exclude-previously-exported', 'Exclude records already exported by this organization')
  .option(
    '--bigquery-data-environment <n>',
    'Query Builder data environment: 1 production, 2 staging, 3 development'
  )
  .option('--estimate-cost', 'Return counts and estimated credits without consuming credits')
  .option('--yes', 'Confirm the estimated credit spend for non-interactive execution')
  .option('--json', 'Output as JSON')
  .addHelpText(
    'after',
    `
Examples:
  dm properties search --body '{"locations":[{"type":"zip_code","code":"78704"}]}'
  dm properties search -f search-query.json --estimate-cost
  dm properties search -f query.json --json             Estimate automatically
  dm properties search -f query.json --json --yes       Run after approval
  cat query.json | dm properties search --json`
  )
  .action(async (options) => {
    await propertiesSearch(options);
  });

propertiesCmd
  .command('count')
  .description('Count properties matching filters (no credits consumed)')
  .option('--body <json>', 'Request body as JSON string')
  .option('-f, --file <path>', 'Read request body from a JSON file')
  .option('--include-lists <ids>', 'Comma-separated list IDs to include')
  .option('--exclude-lists <ids>', 'Comma-separated list IDs to exclude')
  .option('--exclude-previously-exported', 'Exclude records already exported by this organization')
  .option(
    '--bigquery-data-environment <n>',
    'Query Builder data environment: 1 production, 2 staging, 3 development'
  )
  .option('--json', 'Output as JSON')
  .addHelpText(
    'after',
    `
Examples:
  dm properties count --body '{"locations":[{"type":"zip_code","code":"78704"}]}'
  dm properties count -f query.json --json`
  )
  .action(async (options) => {
    await propertiesCount(options);
  });

propertiesCmd
  .command('get <id>')
  .description('Get a property by ID (e.g., prop_12345)')
  .option(
    '--contact-audience <audience>',
    'Include contacts: owners, owners_and_family, renters, residents, all, none'
  )
  .option('--fields <csv>', 'Comma-separated property field IDs from dm fields')
  .option('--json', 'Output as JSON')
  .addHelpText(
    'after',
    `
Examples:
  dm properties get prop_12345
  dm properties get prop_12345 --contact-audience none --json
  dm properties get prop_12345 --contact-audience owners --json`
  )
  .action(async (id, options) => {
    await propertiesGet(id, options);
  });

propertiesCmd
  .command('ids [ids...]')
  .description('Get multiple properties by IDs')
  .option('--body <json>', 'Request body as JSON string')
  .option('-f, --file <path>', 'Read request body from a JSON file')
  .option(
    '--contact-audience <audience>',
    'Include contacts: owners, owners_and_family, renters, residents, all, none'
  )
  .option('--json', 'Output as JSON')
  .addHelpText(
    'after',
    `
Examples:
  dm properties ids prop_111 prop_222 prop_333 --json
  dm properties ids --body '{"ids":["prop_111","prop_222"]}'`
  )
  .action(async (ids, options) => {
    await propertiesIds({ ...options, ids: ids.length > 0 ? ids : undefined });
  });

propertiesCmd
  .command('export')
  .description('Export property-owner contacts as CSV by default (up to 1,000,000 records)')
  .option('--body <json>', 'Request body as JSON string')
  .option('-f, --file <path>', 'Read request body from a JSON file')
  .option('--include-lists <ids>', 'Comma-separated list IDs to include')
  .option('--exclude-lists <ids>', 'Comma-separated list IDs to exclude')
  .option('--exclude-previously-exported', 'Exclude records already exported by this organization')
  .option(
    '--contact-audience <audience>',
    'Contact audience: owners (default), owners_and_family, renters, residents, none'
  )
  .option(
    '--anchor <type>',
    'Row anchor: person (default owner contacts), phone, email, or property'
  )
  .option(
    '--bigquery-data-environment <n>',
    'Query Builder data environment: 1 production, 2 staging, 3 development'
  )
  .option('--require-phone', 'Only include records where the contact has a phone number')
  .option('--require-email', 'Only include records where the contact has an email address')
  .option('--mobile-only', 'Only include wireless phone numbers')
  .option('--landline-only', 'Only include landline phone numbers')
  .option('--scrub-dnc', 'Exclude contacts on the Do Not Call registry')
  .option('--json', 'Output as JSON')
  .addHelpText(
    'after',
    `
Examples:
  dm properties export -f query.json --json
  dm properties export -f query.json --require-phone --scrub-dnc
  dm properties export --body '{"locations":[{"type":"state","code":"TX"}]}' --mobile-only
  dm properties export -f query.json --anchor property --contact-audience none`
  )
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
  .addHelpText(
    'after',
    `
Examples:
  dm comps prop_12345 --json
  dm comps prop_111 prop_222 --radius 0.5 --timeframe 3months
  dm comps prop_12345 --sort-by price --sort-direction asc --limit 10
  dm comps --body '{"property_ids":["prop_12345"]}' --include-foreclosures`
  )
  .action(async (propertyIds, options) => {
    await comps(propertyIds || [], options);
  });

// ============================================================================
// Lists commands
// ============================================================================

const listsCmd = program.command('lists').description('Manage saved lists');

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
  .addHelpText(
    'after',
    `
Examples:
  dm lists search                        List all lists
  dm lists search --source-type properties --sort newest --json
  dm lists search --search "Austin" --per-page 50`
  )
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
  .option('--no-prospects', 'File the records without adding them as prospects (default adds them)')
  .option('--json', 'Output as JSON')
  .addHelpText(
    'after',
    `
Examples:
  dm lists create --name "Austin Leads"
  dm lists create --name "TX Owners" --source-type properties --json
  dm lists create --name "Import" --ids 100,200,300
  dm lists create --name "Mailing only" --ids 100,200 --no-prospects`
  )
  .action(async (options) => {
    await listsCreate(options);
  });

listsCmd
  .command('get <id>')
  .description('Get details of a specific list')
  .option('--json', 'Output as JSON')
  .addHelpText(
    'after',
    `
Examples:
  dm lists get list_abc123
  dm lists get list_abc123 --json`
  )
  .action(async (id, options) => {
    await listsGet(id, options);
  });

listsCmd
  .command('update <id>')
  .description('Update a list')
  .option('--name <name>', 'New list name')
  .option('--json', 'Output as JSON')
  .addHelpText(
    'after',
    `
Examples:
  dm lists update list_abc123 --name "Renamed List"`
  )
  .action(async (id, options) => {
    await listsUpdate(id, options);
  });

listsCmd
  .command('delete <id>')
  .description('Delete a list and all its items')
  .option('--dry-run', 'Preview what would be deleted without making changes')
  .option('--json', 'Output as JSON')
  .addHelpText(
    'after',
    `
Examples:
  dm lists delete list_abc123
  dm lists delete list_abc123 --dry-run   Preview deletion
  dm lists delete list_abc123 --json`
  )
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
  .option('--no-prospects', 'File the records without adding them as prospects (default adds them)')
  .option('--json', 'Output as JSON')
  .addHelpText(
    'after',
    `
Examples:
  dm lists build list_abc123 -f filters.json
  dm lists build list_abc123 --body '{"locations":[{"type":"zip_code","code":"78704"}]}'

Note: Building is async. Poll status with: dm lists get list_abc123`
  )
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
  .option('--no-prospects', 'File the records without adding them as prospects (default adds them)')
  .option('--json', 'Output as JSON')
  .addHelpText(
    'after',
    `
Examples:
  dm lists import list_abc123 --ids 100,200,300 --source-type properties
  dm lists import list_abc123 -f import.json

Note: Import is async. Poll status with: dm lists get list_abc123`
  )
  .action(async (id, options) => {
    await listsImport(id, options);
  });

listsCmd
  .command('items <id>')
  .description('List items in a list')
  .option('-p, --page <n>', 'Page number')
  .option('--per-page <n>', 'Results per page')
  .option('--json', 'Output as JSON')
  .addHelpText(
    'after',
    `
Examples:
  dm lists items list_abc123
  dm lists items list_abc123 --page 2 --per-page 100 --json`
  )
  .action(async (id, options) => {
    await listsItems(id, options);
  });

listsCmd
  .command('add <id>')
  .description('Add items to a list')
  .requiredOption('--ids <csv>', 'Comma-separated list of IDs to add')
  .option('--id-type <type>', 'ID type: internal_property_id or internal_person_id')
  .option('--no-prospects', 'File the records without adding them as prospects (default adds them)')
  .option('--json', 'Output as JSON')
  .addHelpText(
    'after',
    `
Examples:
  dm lists add list_abc123 --ids 100,200,300
  dm lists add list_abc123 --ids 100,200 --id-type internal_property_id --json`
  )
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
  .addHelpText(
    'after',
    `
Examples:
  dm lists remove list_abc123 --ids 100,200,300
  dm lists remove list_abc123 --ids 100 --dry-run   Preview removal`
  )
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
  .addHelpText(
    'after',
    `
Examples:
  dm lists export list_abc123 --json
  dm lists export list_abc123 --fields name,address,phone --anchor property`
  )
  .action(async (id, options) => {
    await listsExport(id, options);
  });

// ============================================================================
// People commands
// ============================================================================

const peopleCmd = program
  .command('people')
  .description('Search and look up people')
  .addHelpText(
    'after',
    `
Looking up one specific person by name, email, or phone?
  Use dm enrich name, dm enrich email, or dm enrich phone.
  People Search is for filtered audiences and does not have a name filter.`
  );

peopleCmd
  .command('search')
  .description('Search people with filters and locations')
  .option('--body <json>', 'Request body as JSON string')
  .option('-f, --file <path>', 'Read request body from a JSON file')
  .option('--include-lists <ids>', 'Comma-separated list IDs to include')
  .option('--exclude-lists <ids>', 'Comma-separated list IDs to exclude')
  .option('--exclude-previously-exported', 'Exclude records already exported by this organization')
  .option(
    '--bigquery-data-environment <n>',
    'Query Builder data environment: 1 production, 2 staging, 3 development'
  )
  .option('--estimate-cost', 'Return counts and estimated credits without consuming credits')
  .option('--yes', 'Confirm the estimated credit spend for non-interactive execution')
  .option('--json', 'Output as JSON')
  .addHelpText(
    'after',
    `
Examples:
  dm people search -f people-query.json --estimate-cost
  dm people search -f people-query.json --json            Estimate automatically
  dm people search -f people-query.json --json --yes      Run after approval

Specific person by name:
  dm enrich name "Jane Smith" --state TX --estimate-cost`
  )
  .action(async (options) => {
    await peopleSearch(options);
  });

peopleCmd
  .command('count')
  .description('Count people matching filters (no credits consumed)')
  .option('--body <json>', 'Request body as JSON string')
  .option('-f, --file <path>', 'Read request body from a JSON file')
  .option('--include-lists <ids>', 'Comma-separated list IDs to include')
  .option('--exclude-lists <ids>', 'Comma-separated list IDs to exclude')
  .option('--exclude-previously-exported', 'Exclude records already exported by this organization')
  .option(
    '--bigquery-data-environment <n>',
    'Query Builder data environment: 1 production, 2 staging, 3 development'
  )
  .option('--json', 'Output as JSON')
  .addHelpText(
    'after',
    `
Examples:
  dm people count -f query.json --json
  dm people count --body '{"locations":[{"type":"state","code":"TX"}]}'`
  )
  .action(async (options) => {
    await peopleCount(options);
  });

peopleCmd
  .command('get <id>')
  .description('Get a person by ID (e.g., per_12345)')
  .option('--include-properties', 'Include associated properties')
  .option('--property-limit <n>', 'Maximum associated properties to return when included')
  .option('--fields <csv>', 'Comma-separated field IDs from dm fields')
  .option('--json', 'Output as JSON')
  .addHelpText(
    'after',
    `
Examples:
  dm people get per_12345
  dm people get per_12345 --fields estimated_household_income,estimated_value --json
  dm people get per_12345 --include-properties --json`
  )
  .action(async (id, options) => {
    await peopleGet(id, options);
  });

peopleCmd
  .command('ids [ids...]')
  .description('Get multiple people by IDs')
  .option('--body <json>', 'Request body as JSON string')
  .option('-f, --file <path>', 'Read request body from a JSON file')
  .option('--include-properties', 'Include associated properties')
  .option('--property-limit <n>', 'Maximum associated properties to return per person')
  .option('--fields <csv>', 'Comma-separated field IDs from dm fields')
  .option('--json', 'Output as JSON')
  .addHelpText(
    'after',
    `
Examples:
  dm people ids per_111 per_222 per_333 --json
  dm people ids per_111 per_222 --fields estimated_household_income,estimated_value
  dm people ids --body '{"ids":["per_111","per_222"]}' --include-properties`
  )
  .action(async (ids, options) => {
    await peopleIds({ ...options, ids: ids.length > 0 ? ids : undefined });
  });

peopleCmd
  .command('export')
  .description('Export people as CSV (up to 1,000,000 records)')
  .option('--body <json>', 'Request body as JSON string')
  .option('-f, --file <path>', 'Read request body from a JSON file')
  .option('--include-lists <ids>', 'Comma-separated list IDs to include')
  .option('--exclude-lists <ids>', 'Comma-separated list IDs to exclude')
  .option('--exclude-previously-exported', 'Exclude records already exported by this organization')
  .option(
    '--bigquery-data-environment <n>',
    'Query Builder data environment: 1 production, 2 staging, 3 development'
  )
  .option('--require-phone', 'Only include records where the contact has a phone number')
  .option('--require-email', 'Only include records where the contact has an email address')
  .option('--mobile-only', 'Only include wireless phone numbers')
  .option('--landline-only', 'Only include landline phone numbers')
  .option('--scrub-dnc', 'Exclude contacts on the Do Not Call registry')
  .option('--json', 'Output as JSON')
  .addHelpText(
    'after',
    `
Examples:
  dm people export -f query.json --json
  dm people export -f query.json --require-phone --scrub-dnc`
  )
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
  .option(
    '--contact-audience <audience>',
    'Include contacts: owners, owners_and_family, renters, residents, none'
  )
  .option('--fields <csv>', 'Comma-separated field IDs from dm fields')
  .option('--json', 'Output as JSON')
  .addHelpText(
    'after',
    `
Examples:
  dm enrich address "123 Main St, Austin, TX 78704" --json
  dm enrich address "123 Main St, Austin, TX" --contact-audience none --json
  dm enrich address "123 Main St, Austin, TX" --contact-audience owners
  dm enrich address -f addresses.csv --json          Batch enrich from CSV
  dm enrich address --body '{"addresses":[{"full_address":"123 Main St, Austin, TX"}]}'`
  )
  .action(async (address, options) => {
    await enrichAddress(address, options);
  });

enrichCmd
  .command('latlng [coords]')
  .description('Look up a property by lat,lng coordinates')
  .option('--body <json>', 'Request body as JSON string')
  .option('-f, --file <path>', 'Read request body from a JSON file (JSON or CSV)')
  .option(
    '--contact-audience <audience>',
    'Include contacts: owners, owners_and_family, renters, residents, none'
  )
  .option('--fields <csv>', 'Comma-separated field IDs from dm fields')
  .option('--json', 'Output as JSON')
  .addHelpText(
    'after',
    `
Examples:
  dm enrich latlng "30.2672,-97.7431" --json
  dm enrich latlng -f coordinates.csv --contact-audience owners`
  )
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
  .option(
    '--contact-audience <audience>',
    'Include contacts: owners, owners_and_family, renters, residents, none'
  )
  .option('--fields <csv>', 'Comma-separated field IDs from dm fields')
  .option('--json', 'Output as JSON')
  .addHelpText(
    'after',
    `
Examples:
  dm enrich apn "01-2345-0067" --state TX --json
  dm enrich apn -f parcels.csv --state TX`
  )
  .action(async (apn, options) => {
    await enrichApn(apn, options);
  });

enrichCmd
  .command('email [email]')
  .description('Look up a person by email address')
  .option('--body <json>', 'Request body as JSON string')
  .option('-f, --file <path>', 'Read request body from a JSON file (JSON or CSV)')
  .option('--include-properties', 'Include associated properties')
  .option('--state <code>', 'Narrow by state')
  .option('--zip <code>', 'Narrow by ZIP code')
  .option('--county <fips>', 'Narrow by county FIPS')
  .option('--city <place-id>', 'Narrow by city place ID from dm locations search')
  .option('--fields <csv>', 'Comma-separated field IDs from dm fields')
  .option('--json', 'Output as JSON')
  .addHelpText(
    'after',
    `
Examples:
  dm enrich email "john@example.com" --json
  dm enrich email "john@example.com" --city 53584 --include-properties
  dm enrich email -f emails.csv --json               Batch enrich from CSV`
  )
  .action(async (email, options) => {
    await enrichEmail(email, options);
  });

enrichCmd
  .command('phone [phone]')
  .description('Look up a person by phone number')
  .option('--body <json>', 'Request body as JSON string')
  .option('-f, --file <path>', 'Read request body from a JSON file (JSON or CSV)')
  .option('--include-properties', 'Include associated properties')
  .option('--state <code>', 'Narrow by state')
  .option('--zip <code>', 'Narrow by ZIP code')
  .option('--county <fips>', 'Narrow by county FIPS')
  .option('--city <place-id>', 'Narrow by city place ID from dm locations search')
  .option('--fields <csv>', 'Comma-separated field IDs from dm fields')
  .option('--json', 'Output as JSON')
  .addHelpText(
    'after',
    `
Examples:
  dm enrich phone "5125551234" --city 53584 --json
  dm enrich phone -f phones.csv --include-properties`
  )
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
  .option('--county <fips>', 'Narrow by county FIPS')
  .option('--city <place-id>', 'Narrow by city place ID from dm locations search')
  .option('--include-properties', 'Include associated properties')
  .option('--estimate-cost', 'Return match count and estimated credits without consuming credits')
  .option('--yes', 'Confirm the estimated credit spend for non-interactive execution')
  .option('--page <n>', 'Page number')
  .option('--per-page <n>', 'Results per page')
  .option('--fields <csv>', 'Comma-separated field IDs from dm fields')
  .option('--json', 'Output as JSON')
  .addHelpText(
    'after',
    `
Examples:
  dm enrich name "David Oster" --city 53584 --json         Estimate automatically
  dm enrich name "David Oster" --state TX --estimate-cost
  dm enrich name "Jane Smith" --zip 78704 --json --yes      Run after approval
  dm enrich name "Jane Smith" --zip 78704 --include-properties --yes
  dm enrich name -f names.csv --state TX`
  )
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
  .addHelpText(
    'after',
    `
Examples:
  dm filters --json                                  List all filters
  dm filters --source-type properties --search "owner"
  dm filters --source-type people --per-page 100 --json`
  )
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
  .addHelpText(
    'after',
    `
Examples:
  dm fields --json                                   List all fields
  dm fields --source-type properties --search "value"
  dm fields --source-type people --per-page 100 --json`
  )
  .action(async (options) => {
    await fields(options);
  });

// ============================================================================
// Activity commands
// ============================================================================

const activityCmd = program.command('activity').description('View API activity history');

activityCmd
  .command('search')
  .description('Search past API activity')
  .option('--body <json>', 'Request body as JSON string')
  .option('-f, --file <path>', 'Read request body from a JSON file')
  .option(
    '-t, --types <types...>',
    'Filter by activity types (e.g., search_properties enrich_address)'
  )
  .option('-q, --query <text>', 'Free-text search across activity')
  .option('--page <n>', 'Page number')
  .option('--per-page <n>', 'Results per page')
  .option('--json', 'Output as JSON')
  .addHelpText(
    'after',
    `
Examples:
  dm activity search --json
  dm activity search --types search_properties enrich_address
  dm activity search --query "Austin" --page 2 --json`
  )
  .action(async (options) => {
    await activitySearch(options);
  });

activityCmd
  .command('get <id>')
  .description('Get details of a specific activity record')
  .option('--json', 'Output as JSON')
  .addHelpText(
    'after',
    `
Examples:
  dm activity get act_abc123 --json`
  )
  .action(async (id, options) => {
    await activityGet(id, options);
  });

// ============================================================================
// Address validation
// ============================================================================

const addressesCmd = program
  .command('addresses')
  .description('Autocomplete, validate, and standardize addresses');

addressesCmd
  .command('autocomplete <query>')
  .alias('complete')
  .description('Suggest DealMachine property addresses with property IDs')
  .option('--state <code>', 'Prefer a state (two-letter abbreviation, e.g., TX)')
  .option('--limit <n>', 'Maximum suggestions (default 5, max 10)', '5')
  .option('--latitude <number>', 'Latitude for nearby address ranking')
  .option('--longitude <number>', 'Longitude for nearby address ranking')
  .option('--json', 'Output as JSON')
  .addHelpText(
    'after',
    `
Examples:
  dm addresses autocomplete "1200 Barton Springs" --state TX
  dm addresses autocomplete "46 Joyce St" --limit 5 --json`
  )
  .action(async (query, options) => {
    await addressesAutocomplete({ query, ...options });
  });

addressesCmd
  .command('validate [address]')
  .description('Validate addresses via USPS')
  .option('--body <json>', 'Request body as JSON string')
  .option('-f, --file <path>', 'Read request body from a JSON file')
  .option('--json', 'Output as JSON')
  .addHelpText(
    'after',
    `
Examples:
  dm addresses validate "123 Main St, Austin, TX 78704" --json
  dm addresses validate -f addresses.json`
  )
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
  .addHelpText(
    'after',
    `
Examples:
  dm tasks list --json
  dm tasks list --status open --assigned-to user_123
  dm tasks list --search "follow up" --per-page 50`
  )
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
  .addHelpText(
    'after',
    `
Examples:
  dm tasks get task_abc123 --json`
  )
  .action(async (id, options) => {
    await tasksGet(id, options);
  });

tasksCmd
  .command('create')
  .description('Create a task')
  .option('--body <json>', 'Request body as JSON string')
  .option('-f, --file <path>', 'Read request body from a JSON file')
  .option('--json', 'Output as JSON')
  .addHelpText(
    'after',
    `
Examples:
  dm tasks create --body '{"title":"Call owner","due_date":"2025-01-15"}' --json
  dm tasks create -f task.json`
  )
  .action(async (options) => {
    await tasksCreate(options);
  });

tasksCmd
  .command('update <id>')
  .description('Update a task')
  .option('--body <json>', 'Request body as JSON string')
  .option('-f, --file <path>', 'Read request body from a JSON file')
  .option('--json', 'Output as JSON')
  .addHelpText(
    'after',
    `
Examples:
  dm tasks update task_abc123 --body '{"status":"completed"}' --json`
  )
  .action(async (id, options) => {
    await tasksUpdate(id, options);
  });

tasksCmd
  .command('delete <id>')
  .description('Delete a task')
  .option('--dry-run', 'Preview what would be deleted without making changes')
  .option('--json', 'Output as JSON')
  .addHelpText(
    'after',
    `
Examples:
  dm tasks delete task_abc123
  dm tasks delete task_abc123 --dry-run   Preview deletion`
  )
  .action(async (id, options) => {
    if (options.dryRun) {
      console.log(`Would delete task ${id}.`);
      console.log('No changes made (--dry-run).');
      return;
    }
    await tasksDelete(id, options);
  });

// ============================================================================
// Dialer commands
// ============================================================================
// The dialer app is launch-held (HIDDEN_APP_SLUGS in launchVisibility.ts) and
// every /v1/dialer endpoint returns 403 unless the org has the app enabled, so
// this command group is not registered by default. Set DM_ENABLE_DIALER=1 (or
// "true") to register it for internal use.

function registerDialerCommands(program: Command): void {
  const dialerCmd = program
    .command('dialer')
    .description('Manage dialer queues, calls, dispositions, and suppression');

  // ── Calls ──

  const dialerCallsCmd = dialerCmd.command('calls').description('View call history and stats');

  dialerCallsCmd
    .command('list')
    .alias('ls')
    .description('List call history')
    .option(
      '--status <status>',
      'Filter by status: initiating, ringing, answered, completed, failed, busy, no_answer, cancelled'
    )
    .option('--search <term>', 'Search by contact name or phone number')
    .option('--date-from <date>', 'Filter from date (ISO 8601)')
    .option('--date-to <date>', 'Filter to date (ISO 8601)')
    .option('-p, --page <n>', 'Page number')
    .option('--per-page <n>', 'Results per page')
    .option('--json', 'Output as JSON')
    .addHelpText(
      'after',
      `
Examples:
  dm dialer calls list --json
  dm dialer calls list --status completed --date-from 2025-01-01
  dm dialer calls list --search "5125551234" --per-page 50`
    )
    .action(async (options) => {
      await dialerCallsList(options);
    });

  dialerCallsCmd
    .command('get <uuid>')
    .description('Get call details by UUID')
    .option('--json', 'Output as JSON')
    .addHelpText(
      'after',
      `
Examples:
  dm dialer calls get call_uuid_123 --json`
    )
    .action(async (uuid, options) => {
      await dialerCallsGet(uuid, options);
    });

  dialerCallsCmd
    .command('stats')
    .description('Get call statistics')
    .option('--date-from <date>', 'Filter from date (ISO 8601)')
    .option('--date-to <date>', 'Filter to date (ISO 8601)')
    .option('--json', 'Output as JSON')
    .addHelpText(
      'after',
      `
Examples:
  dm dialer calls stats --json
  dm dialer calls stats --date-from 2025-01-01 --date-to 2025-01-31`
    )
    .action(async (options) => {
      await dialerCallsStats(options);
    });

  // ── Call Notes ──

  const dialerNotesCmd = dialerCmd.command('notes').description('Manage call notes');

  dialerNotesCmd
    .command('list <callUuid>')
    .alias('ls')
    .description('List notes for a call')
    .option('--json', 'Output as JSON')
    .addHelpText(
      'after',
      `
Examples:
  dm dialer notes list call_uuid_123 --json`
    )
    .action(async (callUuid, options) => {
      await dialerNotesList(callUuid, options);
    });

  dialerNotesCmd
    .command('create <callUuid>')
    .description('Add a note to a call')
    .option('--body <json>', 'Request body as JSON string')
    .option('-f, --file <path>', 'Read request body from a JSON file')
    .option('--json', 'Output as JSON')
    .addHelpText(
      'after',
      `
Examples:
  dm dialer notes create call_uuid_123 --body '{"content":"Left voicemail."}' --json`
    )
    .action(async (callUuid, options) => {
      await dialerNotesCreate(callUuid, options);
    });

  dialerNotesCmd
    .command('delete <callUuid> <noteId>')
    .description('Delete a call note')
    .option('--dry-run', 'Preview what would be deleted without making changes')
    .option('--json', 'Output as JSON')
    .addHelpText(
      'after',
      `
Examples:
  dm dialer notes delete call_uuid_123 note_456
  dm dialer notes delete call_uuid_123 note_456 --dry-run`
    )
    .action(async (callUuid, noteId, options) => {
      if (options.dryRun) {
        console.log(`Would delete note ${noteId} from call ${callUuid}.`);
        console.log('No changes made (--dry-run).');
        return;
      }
      await dialerNotesDelete(callUuid, noteId, options);
    });

  // ── Queues ──

  const dialerQueuesCmd = dialerCmd.command('queues').description('Manage dialer queues');

  dialerQueuesCmd
    .command('list')
    .alias('ls')
    .description('List all dialer queues')
    .option('--json', 'Output as JSON')
    .addHelpText(
      'after',
      `
Examples:
  dm dialer queues list --json`
    )
    .action(async (options) => {
      await dialerQueuesList(options);
    });

  dialerQueuesCmd
    .command('create')
    .description('Create a new queue')
    .option('--body <json>', 'Request body as JSON string')
    .option('-f, --file <path>', 'Read request body from a JSON file')
    .option('--json', 'Output as JSON')
    .addHelpText(
      'after',
      `
Examples:
  dm dialer queues create --body '{"name":"Morning Calls"}' --json`
    )
    .action(async (options) => {
      await dialerQueuesCreate(options);
    });

  dialerQueuesCmd
    .command('delete <id>')
    .description('Delete a queue')
    .option('--dry-run', 'Preview what would be deleted without making changes')
    .option('--json', 'Output as JSON')
    .addHelpText(
      'after',
      `
Examples:
  dm dialer queues delete queue_abc123
  dm dialer queues delete queue_abc123 --dry-run`
    )
    .action(async (id, options) => {
      if (options.dryRun) {
        console.log(`Would delete queue ${id} and all its items.`);
        console.log('No changes made (--dry-run).');
        return;
      }
      await dialerQueuesDelete(id, options);
    });

  // ── Queue Items ──

  const dialerItemsCmd = dialerCmd.command('items').description('Manage queue items');

  dialerItemsCmd
    .command('list <queueId>')
    .alias('ls')
    .description('List items in a queue')
    .option(
      '--status <status>',
      'Filter by status: pending, in_progress, completed, skipped, deferred'
    )
    .option('-p, --page <n>', 'Page number')
    .option('--per-page <n>', 'Results per page')
    .option('--json', 'Output as JSON')
    .addHelpText(
      'after',
      `
Examples:
  dm dialer items list queue_abc123 --json
  dm dialer items list queue_abc123 --status pending --per-page 50`
    )
    .action(async (queueId, options) => {
      await dialerQueueItemsList(queueId, options);
    });

  dialerItemsCmd
    .command('add <queueId>')
    .description('Add items to a queue')
    .option('--body <json>', 'Request body as JSON string')
    .option('-f, --file <path>', 'Read request body from a JSON file')
    .option('--json', 'Output as JSON')
    .addHelpText(
      'after',
      `
Examples:
  dm dialer items add queue_abc123 --body '{"phone_numbers":["5125551234"]}' --json`
    )
    .action(async (queueId, options) => {
      await dialerQueueItemsAdd(queueId, options);
    });

  dialerItemsCmd
    .command('update <queueId> <itemId>')
    .description('Update a queue item')
    .option('--body <json>', 'Request body as JSON string')
    .option('-f, --file <path>', 'Read request body from a JSON file')
    .option('--json', 'Output as JSON')
    .addHelpText(
      'after',
      `
Examples:
  dm dialer items update queue_abc123 item_456 --body '{"status":"skipped"}' --json`
    )
    .action(async (queueId, itemId, options) => {
      await dialerQueueItemsUpdate(queueId, itemId, options);
    });

  dialerItemsCmd
    .command('remove <queueId> <itemId>')
    .description('Remove an item from a queue')
    .option('--dry-run', 'Preview what would be removed without making changes')
    .option('--json', 'Output as JSON')
    .addHelpText(
      'after',
      `
Examples:
  dm dialer items remove queue_abc123 item_456
  dm dialer items remove queue_abc123 item_456 --dry-run`
    )
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
    .addHelpText(
      'after',
      `
Examples:
  dm dialer dispositions --json`
    )
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
    .addHelpText(
      'after',
      `
Examples:
  dm dialer suppression list --json
  dm dialer suppression list --search "512" --per-page 100`
    )
    .action(async (options) => {
      await dialerSuppressionList(options);
    });

  dialerSuppCmd
    .command('check <phoneNumber>')
    .description('Check if a phone number is suppressed')
    .option('--json', 'Output as JSON')
    .addHelpText(
      'after',
      `
Examples:
  dm dialer suppression check 5125551234 --json`
    )
    .action(async (phoneNumber, options) => {
      await dialerSuppressionCheck(phoneNumber, options);
    });

  dialerSuppCmd
    .command('add')
    .description('Add a phone number to the suppression list')
    .option('--body <json>', 'Request body as JSON string')
    .option('-f, --file <path>', 'Read request body from a JSON file')
    .option('--json', 'Output as JSON')
    .addHelpText(
      'after',
      `
Examples:
  dm dialer suppression add --body '{"phone_number":"5125551234","reason":"Do not contact"}' --json`
    )
    .action(async (options) => {
      await dialerSuppressionAdd(options);
    });
}

if (process.env.DM_ENABLE_DIALER === '1' || process.env.DM_ENABLE_DIALER === 'true') {
  registerDialerCommands(program);
}

// ============================================================================
// Driving commands
// ============================================================================

const drivingCmd = program.command('driving').description('Read recorded drive history');

drivingCmd
  .command('list')
  .alias('ls')
  .description('List recorded drives')
  .option('--driver-user-id <id>', 'Only drives by this user')
  .option('--mode <mode>', 'free_drive, route_plan, or area_drive')
  .option('--started-after <date>', 'Inclusive start date or timestamp')
  .option('--started-before <date>', 'Inclusive end date or timestamp')
  .option('-p, --page <n>', 'Page number')
  .option('--per-page <n>', 'Results per page (max 100)')
  .option('--json', 'Output as JSON')
  .addHelpText(
    'after',
    `
Examples:
  dm driving list
  dm driving list --mode free_drive --started-after 2026-08-01 --json`
  )
  .action(async (options) => {
    await drivingList(options);
  });

drivingCmd
  .command('get <id>')
  .description('Show a drive with visits, events, and prospects added')
  .option('--json', 'Output as JSON')
  .addHelpText(
    'after',
    `
Examples:
  dm driving get drive_session_501
  dm driving get drive_route_7 --json`
  )
  .action(async (id, options) => {
    await drivingGet(id, options);
  });

// ============================================================================
// Prospects commands
// ============================================================================

const prospectsCmd = program
  .command('prospects')
  .description('Work prospects: add, list, archive, notes, files, photos, tags, activity');

prospectsCmd
  .command('list')
  .alias('ls')
  .description('List prospects')
  .option('--record-type <type>', 'property (default) or person')
  .option('--lifecycle <lifecycle>', 'active (default), opportunity, or archived')
  .option('--source <source>', 'Filter by source, e.g. driving, import, api, cli, or mcp')
  .option('--favorites', 'Only starred prospects')
  .option('--list <listId>', 'Only members of this list')
  .option('--tag <tagId>', 'Only prospects with this tag, e.g. tag_5')
  .option('--search <term>', 'Address words for properties; name or city for people')
  .option('--sort <order>', 'newest (default) or oldest')
  .option('-p, --page <n>', 'Page number')
  .option('--per-page <n>', 'Results per page (max 100)')
  .option('--json', 'Output as JSON')
  .addHelpText(
    'after',
    `
Examples:
  dm prospects list
  dm prospects list --source driving
  dm prospects list --lifecycle opportunity --tag tag_1
  dm prospects list --record-type person --search "austin" --json`
  )
  .action(async (options) => {
    await prospectsList(options);
  });

prospectsCmd
  .command('get <id>')
  .description('Show one prospect')
  .option('--json', 'Output as JSON')
  .action(async (id, options) => {
    await prospectsGet(id, options);
  });

prospectsCmd
  .command('get-by-record <recordId>')
  .description('Find a prospect by its property, person, or company record ID')
  .option('--record-type <type>', 'property (default), person, or company')
  .option('--json', 'Output as JSON')
  .action(async (recordId, options) => {
    await prospectsGetByRecord({ ...options, recordId });
  });

prospectsCmd
  .command('add')
  .description('Track records as prospects (up to 1,000)')
  .option('--ids <csv>', 'Comma-separated record IDs, e.g. prop_123,prop_456')
  .option('--record-type <type>', 'property (default), person, or company')
  .option('--favorite', 'Also star them')
  .option('--body <json>', 'Request body as JSON')
  .option('-f, --file <path>', 'Read request body from a JSON file')
  .option('--json', 'Output as JSON')
  .addHelpText(
    'after',
    `
Examples:
  dm prospects add --ids prop_12345,prop_67890
  dm prospects add --ids person_777 --record-type person --favorite`
  )
  .action(async (options) => {
    await prospectsAdd(options);
  });

prospectsCmd
  .command('archive <id>')
  .description('Archive a prospect (ends its mail and keeps its lists and opportunities)')
  .option('--no-cascade', 'Skip optional archive cleanup; mail always ends and deals stay open')
  .option('--json', 'Output as JSON')
  .action(async (id, options) => {
    await prospectsArchive(id, { json: options.json, noCascade: options.cascade === false });
  });

prospectsCmd
  .command('remove <id>')
  .alias('rm')
  .description('Archive a prospect through the remove endpoint')
  .option('--no-cascade', 'Skip optional archive cleanup; mail always ends and deals stay open')
  .option('--json', 'Output as JSON')
  .action(async (id, options) => {
    await prospectsRemove(id, { json: options.json, noCascade: options.cascade === false });
  });

prospectsCmd
  .command('reactivate <id>')
  .description('Return an archived prospect to active')
  .option('--json', 'Output as JSON')
  .action(async (id, options) => {
    await prospectsReactivate(id, options);
  });

prospectsCmd
  .command('opportunity <id>')
  .description('Mark a prospect as an opportunity')
  .option('--json', 'Output as JSON')
  .action(async (id, options) => {
    await prospectsOpportunity(id, options);
  });

prospectsCmd
  .command('favorite <id>')
  .description('Star a prospect (or --off to unstar)')
  .option('--off', 'Remove the star')
  .option('--json', 'Output as JSON')
  .action(async (id, options) => {
    await prospectsFavorite(id, options);
  });

prospectsCmd
  .command('check')
  .description('See which records are prospects')
  .requiredOption('--ids <csv>', 'Comma-separated record IDs (max 500)')
  .option('--record-type <type>', 'property (default), person, or company')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    await prospectsCheck(options);
  });

prospectsCmd
  .command('counts')
  .description('Prospect counts by lifecycle and record type')
  .option('--list <listId>', 'Count only members of this list')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    await prospectsCounts(options);
  });

prospectsCmd
  .command('activity <id>')
  .description('Show the prospect activity feed')
  .option(
    '--category <category>',
    'record, note, tag, list, communication, crm, driving, enrichment'
  )
  .option('--since <iso>', 'Only activity after this ISO 8601 time')
  .option('-p, --page <n>', 'Page number')
  .option('--per-page <n>', 'Results per page (max 100)')
  .option('--json', 'Output as JSON')
  .action(async (id, options) => {
    await prospectsActivity(id, options);
  });

const prospectNotesCmd = prospectsCmd.command('notes').description('Notes on a prospect');
prospectNotesCmd
  .command('list <id>')
  .description('List notes')
  .option('-p, --page <n>', 'Page number')
  .option('--per-page <n>', 'Results per page')
  .option('--json', 'Output as JSON')
  .action(async (id, options) => {
    await prospectNotesList(id, options);
  });
prospectNotesCmd
  .command('get <id> <noteId>')
  .description('Show one note')
  .option('--json', 'Output as JSON')
  .action(async (id, noteId, options) => {
    await prospectNotesGet(id, noteId, options);
  });
prospectNotesCmd
  .command('add <id> [text]')
  .description('Add a note')
  .option('--body <json>', 'Request body as JSON ({"body": "..."})')
  .option('-f, --file <path>', 'Read request body from a JSON file')
  .option('--json', 'Output as JSON')
  .addHelpText(
    'after',
    `\nExamples:\n  dm prospects notes add prospect_8812 "Owner wants an offer by Friday"`
  )
  .action(async (id, text, options) => {
    await prospectNotesAdd(id, text, options);
  });
prospectNotesCmd
  .command('edit <id> <noteId> <text>')
  .description('Edit a note')
  .option('--json', 'Output as JSON')
  .action(async (id, noteId, text, options) => {
    await prospectNotesEdit(id, noteId, text, options);
  });
prospectNotesCmd
  .command('remove <id> <noteId>')
  .alias('rm')
  .description('Delete a note')
  .option('--json', 'Output as JSON')
  .action(async (id, noteId, options) => {
    await prospectNotesRemove(id, noteId, options);
  });

const prospectFilesCmd = prospectsCmd.command('files').description('Files on a prospect');
prospectFilesCmd
  .command('list <id>')
  .description('List files')
  .option('--json', 'Output as JSON')
  .action(async (id, options) => {
    await prospectFilesList(id, options);
  });
prospectFilesCmd
  .command('upload <id> <path>')
  .description('Attach a local file (up to 25 MB)')
  .option('--content-type <mime>', 'MIME type, e.g. application/pdf')
  .option('--name <fileName>', 'Name to show instead of the local file name')
  .option('--json', 'Output as JSON')
  .addHelpText(
    'after',
    `\nExamples:\n  dm prospects files upload prospect_8812 ./inspection.pdf --content-type application/pdf`
  )
  .action(async (id, path, options) => {
    await prospectFilesUpload(id, path, options);
  });
prospectFilesCmd
  .command('download <id> <fileId>')
  .description('Download a file')
  .option('-o, --out <path>', 'Where to save it')
  .option('--json', 'Print the signed URL instead of downloading')
  .action(async (id, fileId, options) => {
    await prospectFilesDownload(id, fileId, options);
  });
prospectFilesCmd
  .command('remove <id> <fileId>')
  .alias('rm')
  .description('Delete a file')
  .option('--json', 'Output as JSON')
  .action(async (id, fileId, options) => {
    await prospectFilesRemove(id, fileId, options);
  });

const prospectPhotosCmd = prospectsCmd
  .command('photos')
  .description('Property photos on a prospect');
prospectPhotosCmd
  .command('list <id>')
  .description('List photos')
  .option('--json', 'Output as JSON')
  .action(async (id, options) => {
    await prospectPhotosList(id, options);
  });
prospectPhotosCmd
  .command('add <id>')
  .description('Add a photo from a local file (under 700 KB) or a public https URL')
  .option('--file <path>', 'Local JPEG, PNG, or WebP')
  .option('--url <url>', 'Public https image URL (up to 10 MB)')
  .option(
    '--type <type>',
    'street_view, property_front, property_side, property_back, condition, damage, other'
  )
  .option('--caption <text>', 'Caption')
  .option('--json', 'Output as JSON')
  .action(async (id, options) => {
    await prospectPhotosAdd(id, options);
  });
prospectPhotosCmd
  .command('remove <id> <photoId>')
  .alias('rm')
  .description('Delete a photo')
  .option('--json', 'Output as JSON')
  .action(async (id, photoId, options) => {
    await prospectPhotosRemove(id, photoId, options);
  });

const prospectTagsCmd = prospectsCmd.command('tags').description('Tags on a prospect');
prospectTagsCmd
  .command('list <id>')
  .description('Show the catalog with what is assigned')
  .option('--json', 'Output as JSON')
  .action(async (id, options) => {
    await prospectTagsList(id, options);
  });
prospectTagsCmd
  .command('set <id>')
  .description('Replace the prospect tags with exactly these')
  .requiredOption('--ids <csv>', 'Comma-separated tag IDs (empty string clears)')
  .option('--json', 'Output as JSON')
  .action(async (id, options) => {
    await prospectTagsSet(id, options);
  });
prospectTagsCmd
  .command('add <id> <tagId>')
  .description('Add one tag')
  .option('--json', 'Output as JSON')
  .action(async (id, tagId, options) => {
    await prospectTagsAdd(id, tagId, options);
  });
prospectTagsCmd
  .command('remove <id> <tagId>')
  .alias('rm')
  .description('Remove one tag')
  .option('--json', 'Output as JSON')
  .action(async (id, tagId, options) => {
    await prospectTagsRemove(id, tagId, options);
  });

// ============================================================================
// Tags commands (catalog)
// ============================================================================

const tagsCmd = program.command('tags').description('Manage the prospect tag catalog');

tagsCmd
  .command('list')
  .alias('ls')
  .description('List built-in and workspace tags')
  .option('--include-inactive', 'Show archived tags too')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    await tagsList(options);
  });

tagsCmd
  .command('get <id>')
  .description('Show one tag')
  .option('--json', 'Output as JSON')
  .action(async (id, options) => {
    await tagsGet(id, options);
  });

tagsCmd
  .command('create')
  .description('Create a workspace tag')
  .requiredOption('--name <name>', 'Tag name (unique in the workspace)')
  .option('--description <text>', 'What the tag means')
  .option('--color <variant>', 'default, secondary, info, warning, or destructive')
  .option('--order <n>', 'Sort order (lower first)')
  .option('--json', 'Output as JSON')
  .addHelpText('after', `\nExamples:\n  dm tags create --name Probate --color info`)
  .action(async (options) => {
    await tagsCreate(options);
  });

tagsCmd
  .command('update <id>')
  .description('Change a workspace tag')
  .option('--name <name>', 'New name')
  .option('--description <text>', 'New description')
  .option('--color <variant>', 'default, secondary, info, warning, or destructive')
  .option('--order <n>', 'Sort order')
  .option('--archive', 'Hide the tag without removing it from prospects')
  .option('--restore', 'Show an archived tag again')
  .option('--json', 'Output as JSON')
  .action(async (id, options) => {
    await tagsUpdate(id, options);
  });

tagsCmd
  .command('delete <id>')
  .description('Delete a workspace tag')
  .option('--force', 'Remove it from every prospect first')
  .option('--json', 'Output as JSON')
  .action(async (id, options) => {
    await tagsDelete(id, options);
  });

tagsCmd
  .command('reorder')
  .description('Set the display order of workspace tags')
  .requiredOption('--ids <csv>', 'Comma-separated tag IDs in the order you want')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    await tagsReorder(options);
  });

// ============================================================================
// Webhooks commands
// ============================================================================

const webhooksCmd = program
  .command('webhooks')
  .description('Receive prospect and list events at your own URLs');

webhooksCmd
  .command('list')
  .alias('ls')
  .description('List webhooks with their health')
  .option('--include-zapier', 'Also show subscriptions the Zapier app created')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    await webhooksList(options);
  });

webhooksCmd
  .command('get <id>')
  .description('Show one webhook')
  .option('--json', 'Output as JSON')
  .action(async (id, options) => {
    await webhooksGet(id, options);
  });

webhooksCmd
  .command('create')
  .description('Register a URL (the signing secret is shown once)')
  .requiredOption('--url <url>', 'Public https URL that accepts POST requests')
  .requiredOption(
    '--events <csv>',
    'Event types, e.g. prospect.added,prospect.tags_changed (or prospect.* or *)'
  )
  .option('--description <text>', 'What this webhook is for')
  .option('--batch-max <n>', 'Most events per request (1 to 100, default 50)')
  .option('--include-contacts', 'Include phone numbers and emails on person prospects')
  .option('--json', 'Output as JSON')
  .addHelpText(
    'after',
    `
Examples:
  dm webhooks create --url https://example.com/hooks/dm --events prospect.added
  dm webhooks create --url https://example.com/hooks/dm --events "prospect.*" --batch-max 10`
  )
  .action(async (options) => {
    await webhooksCreate(options);
  });

webhooksCmd
  .command('update <id>')
  .description('Change a webhook or turn it on or off')
  .option('--url <url>', 'New URL')
  .option('--events <csv>', 'New event types')
  .option('--description <text>', 'New description')
  .option('--batch-max <n>', 'Most events per request')
  .option('--include-contacts', 'Include contact data')
  .option('--no-include-contacts', 'Stop including contact data')
  .option('--enable', 'Turn on (also clears a failure lockout)')
  .option('--disable', 'Turn off')
  .option('--json', 'Output as JSON')
  .action(async (id, options) => {
    await webhooksUpdate(id, {
      ...options,
      includeContacts: options.includeContacts === true ? true : undefined,
      noIncludeContacts: options.includeContacts === false ? true : undefined,
    });
  });

webhooksCmd
  .command('delete <id>')
  .description('Delete a webhook and its delivery log')
  .option('--json', 'Output as JSON')
  .action(async (id, options) => {
    await webhooksDelete(id, options);
  });

webhooksCmd
  .command('test <id>')
  .description('Send a signed ping event now and show the response')
  .option('--json', 'Output as JSON')
  .action(async (id, options) => {
    await webhooksTest(id, options);
  });

webhooksCmd
  .command('rotate-secret <id>')
  .description('Issue a new signing secret (the old one works for 24 hours)')
  .option('--json', 'Output as JSON')
  .action(async (id, options) => {
    await webhooksRotateSecret(id, options);
  });

webhooksCmd
  .command('deliveries <id>')
  .description('Show the delivery log')
  .option('--status <status>', 'pending, processing, delivered, failed, abandoned, or skipped')
  .option('--event-type <type>', 'Only this event type')
  .option('--since <iso>', 'Only deliveries after this ISO 8601 time')
  .option('-p, --page <n>', 'Page number')
  .option('--per-page <n>', 'Results per page (max 100)')
  .option('--json', 'Output as JSON')
  .action(async (id, options) => {
    await webhooksDeliveries(id, options);
  });

webhooksCmd
  .command('delivery <id> <deliveryId>')
  .description('Show one delivery attempt')
  .option('--json', 'Output as JSON')
  .action(async (id, deliveryId, options) => {
    await webhooksDeliveryGet(id, deliveryId, options);
  });

webhooksCmd
  .command('redeliver <id> [deliveryId]')
  .description('Send a delivery again, or every delivery since a time')
  .option('--since <iso>', 'Resend everything created after this ISO 8601 time')
  .option('--json', 'Output as JSON')
  .addHelpText(
    'after',
    `
Examples:
  dm webhooks redeliver whk_12 dlv_9001
  dm webhooks redeliver whk_12 --since 2026-08-26T00:00:00Z`
  )
  .action(async (id, deliveryId, options) => {
    await webhooksRedeliver(id, deliveryId, options);
  });

webhooksCmd
  .command('events')
  .description('List event types, or print an example body')
  .option('--example <type>', 'Print the full example request body for one event type')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    await webhooksEvents(options);
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
  .addHelpText(
    'after',
    `
Examples:
  dm mail campaigns list --json
  dm mail camp ls --status active
  dm mail campaigns list --search "Austin" --per-page 50`
  )
  .action(async (options) => {
    await mailCampaignsList(options);
  });

mailCampaignsCmd
  .command('create')
  .description('Create a mail campaign')
  .option('--body <json>', 'Request body as JSON string')
  .option('-f, --file <path>', 'Read request body from a JSON file')
  .option('--json', 'Output as JSON')
  .addHelpText(
    'after',
    `
Examples:
  dm mail campaigns create -f campaign.json --json
  dm mail campaigns create --body '{"name":"Austin Owners","property_ids":[123],"address_to":"owner","steps":[{"design_prompt":"Professional postcard"}]}'

Note: Set "launch": true in body to send immediately, or leave as draft.`
  )
  .action(async (options) => {
    await mailCampaignsCreate(options);
  });

mailCampaignsCmd
  .command('get <id>')
  .description('Get campaign details')
  .option('--json', 'Output as JSON')
  .addHelpText(
    'after',
    `
Examples:
  dm mail campaigns get camp_abc123 --json`
  )
  .action(async (id, options) => {
    await mailCampaignsGet(id, options);
  });

mailCampaignsCmd
  .command('update <id>')
  .description('Update a draft campaign')
  .option('--body <json>', 'Request body as JSON string')
  .option('-f, --file <path>', 'Read request body from a JSON file')
  .option('--json', 'Output as JSON')
  .addHelpText(
    'after',
    `
Examples:
  dm mail campaigns update camp_abc123 --body '{"name":"Updated Name"}' --json

Note: Only draft campaigns can be updated.`
  )
  .action(async (id, options) => {
    await mailCampaignsUpdate(id, options);
  });

mailCampaignsCmd
  .command('delete <id>')
  .description('Cancel a campaign')
  .option('--dry-run', 'Preview what would be cancelled without making changes')
  .option('--json', 'Output as JSON')
  .addHelpText(
    'after',
    `
Examples:
  dm mail campaigns delete camp_abc123
  dm mail campaigns delete camp_abc123 --dry-run

Note: Active campaigns will stop sending. Already-submitted mail cannot be recalled.`
  )
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
  .addHelpText(
    'after',
    `
Examples:
  dm mail campaigns send camp_abc123 --json
  dm mail campaigns send camp_abc123 --dry-run   Check cost before sending

Note: Verify wallet balance first with: dm mail wallet balance`
  )
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
  .addHelpText(
    'after',
    `
Examples:
  dm mail campaigns pause camp_abc123`
  )
  .action(async (id, options) => {
    await mailCampaignsPause(id, options);
  });

mailCampaignsCmd
  .command('resume <id>')
  .description('Resume a paused campaign')
  .option('--json', 'Output as JSON')
  .addHelpText(
    'after',
    `
Examples:
  dm mail campaigns resume camp_abc123`
  )
  .action(async (id, options) => {
    await mailCampaignsResume(id, options);
  });

mailCampaignsCmd
  .command('recipients <id>')
  .description('List campaign recipients')
  .option('-p, --page <n>', 'Page number')
  .option('--per-page <n>', 'Results per page')
  .option('--json', 'Output as JSON')
  .addHelpText(
    'after',
    `
Examples:
  dm mail campaigns recipients camp_abc123 --json
  dm mail campaigns recipients camp_abc123 --per-page 100`
  )
  .action(async (id, options) => {
    await mailCampaignsRecipients(id, options);
  });

mailCampaignsCmd
  .command('analytics <id>')
  .description('Get campaign delivery and response analytics')
  .option('--json', 'Output as JSON')
  .addHelpText(
    'after',
    `
Examples:
  dm mail campaigns analytics camp_abc123 --json`
  )
  .action(async (id, options) => {
    await mailCampaignsAnalytics(id, options);
  });

mailCampaignsCmd
  .command('cost-estimate <id>')
  .description('Estimate campaign cost before sending')
  .option('--json', 'Output as JSON')
  .addHelpText(
    'after',
    `
Examples:
  dm mail campaigns cost-estimate camp_abc123 --json`
  )
  .action(async (id, options) => {
    await mailCampaignsCostEstimate(id, options);
  });

// ── Designs ──

const mailDesignsCmd = mailCmd.command('designs').description('Manage postcard designs');

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
  .addHelpText(
    'after',
    `
Examples:
  dm mail designs list --json
  dm mail designs list --status active --size 4x6
  dm mail designs list --search "professional"`
  )
  .action(async (options) => {
    await mailDesignsList(options);
  });

mailDesignsCmd
  .command('create')
  .description('Create a postcard design')
  .option('--body <json>', 'Request body as JSON string')
  .option('-f, --file <path>', 'Read request body from a JSON file')
  .option('--json', 'Output as JSON')
  .addHelpText(
    'after',
    `
Examples:
  dm mail designs create --body '{"name":"My Card","prompt":"Professional real estate postcard","size":"4x6"}' --json
  dm mail designs create -f design.json

Note: Provide either "prompt" (AI-generated) or "html_front" (custom HTML).`
  )
  .action(async (options) => {
    await mailDesignsCreate(options);
  });

mailDesignsCmd
  .command('get <id>')
  .description('Get design details')
  .option('--json', 'Output as JSON')
  .addHelpText(
    'after',
    `
Examples:
  dm mail designs get des_abc123 --json`
  )
  .action(async (id, options) => {
    await mailDesignsGet(id, options);
  });

mailDesignsCmd
  .command('update <id>')
  .description('Update a design')
  .option('--body <json>', 'Request body as JSON string')
  .option('-f, --file <path>', 'Read request body from a JSON file')
  .option('--json', 'Output as JSON')
  .addHelpText(
    'after',
    `
Examples:
  dm mail designs update des_abc123 --body '{"name":"Updated Name","publish":true}' --json

Note: Set "publish": true to promote draft HTML to active.`
  )
  .action(async (id, options) => {
    await mailDesignsUpdate(id, options);
  });

mailDesignsCmd
  .command('delete <id>')
  .description('Delete a design')
  .option('--dry-run', 'Preview what would be deleted without making changes')
  .option('--json', 'Output as JSON')
  .addHelpText(
    'after',
    `
Examples:
  dm mail designs delete des_abc123
  dm mail designs delete des_abc123 --dry-run

Note: Designs used in active campaigns cannot be deleted.`
  )
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
  .addHelpText(
    'after',
    `
Examples:
  dm mail return-addresses list --json
  dm mail addr ls --json`
  )
  .action(async (options) => {
    await mailReturnAddressesList(options);
  });

mailAddressesCmd
  .command('create')
  .description('Create a return address (USPS-validated)')
  .option('--body <json>', 'Request body as JSON string')
  .option('-f, --file <path>', 'Read request body from a JSON file')
  .option('--json', 'Output as JSON')
  .addHelpText(
    'after',
    `
Examples:
  dm mail addr create --body '{"name":"DealMachine","address_1":"123 Main St","city":"Austin","state":"TX","zip":"78704"}' --json
  dm mail addr create --body '{"name":"Office","label":"HQ","address_1":"456 Oak","city":"Dallas","state":"TX","zip":"75201","set_as_default":true}'`
  )
  .action(async (options) => {
    await mailReturnAddressesCreate(options);
  });

mailAddressesCmd
  .command('get <id>')
  .description('Get return address details')
  .option('--json', 'Output as JSON')
  .addHelpText(
    'after',
    `
Examples:
  dm mail addr get addr_abc123 --json`
  )
  .action(async (id, options) => {
    await mailReturnAddressesGet(id, options);
  });

mailAddressesCmd
  .command('update <id>')
  .description('Update a return address (re-validated by USPS)')
  .option('--body <json>', 'Request body as JSON string')
  .option('-f, --file <path>', 'Read request body from a JSON file')
  .option('--json', 'Output as JSON')
  .addHelpText(
    'after',
    `
Examples:
  dm mail addr update addr_abc123 --body '{"name":"New Name"}' --json`
  )
  .action(async (id, options) => {
    await mailReturnAddressesUpdate(id, options);
  });

mailAddressesCmd
  .command('delete <id>')
  .description('Delete a return address')
  .option('--dry-run', 'Preview what would be deleted without making changes')
  .option('--json', 'Output as JSON')
  .addHelpText(
    'after',
    `
Examples:
  dm mail addr delete addr_abc123
  dm mail addr delete addr_abc123 --dry-run

Note: Cannot delete the default address. Set another as default first.`
  )
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
  .addHelpText(
    'after',
    `
Examples:
  dm mail addr set-default addr_abc123`
  )
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
  .addHelpText(
    'after',
    `
Examples:
  dm mail wallet balance --json`
  )
  .action(async (options) => {
    await mailWalletBalance(options);
  });

mailWalletCmd
  .command('add-funds')
  .description('Add credits to your mail wallet ($50–$10,000)')
  .option('--body <json>', 'Request body as JSON string')
  .option('-f, --file <path>', 'Read request body from a JSON file')
  .option('--json', 'Output as JSON')
  .addHelpText(
    'after',
    `
Examples:
  dm mail wallet add-funds --body '{"amount_cents":5000}' --json                      Add $50
  dm mail wallet add-funds --body '{"amount_cents":10000,"payment_method_id":"pm_..."}' --json`
  )
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
  .addHelpText(
    'after',
    `
Examples:
  dm mail wallet transactions --json
  dm mail wallet txns --type spend --campaign-id camp_abc123
  dm mail wallet transactions --type purchase --per-page 50`
  )
  .action(async (options) => {
    await mailWalletTransactions(options);
  });

mailWalletCmd
  .command('pricing')
  .description('Get postcard pricing for your plan')
  .option('--json', 'Output as JSON')
  .addHelpText(
    'after',
    `
Examples:
  dm mail wallet pricing --json`
  )
  .action(async (options) => {
    await mailWalletPricing(options);
  });

// ── Settings ──

const mailSettingsCmd = mailCmd
  .command('settings')
  .description('View and update organization-level mail defaults');

mailSettingsCmd
  .command('get')
  .description('Get organization mail settings')
  .option('--json', 'Output as JSON')
  .addHelpText(
    'after',
    `
Examples:
  dm mail settings get --json`
  )
  .action(async (options) => {
    await mailSettingsGet(options);
  });

mailSettingsCmd
  .command('update')
  .description('Update organization mail settings (partial; pass null to clear a field)')
  .option('--body <json>', 'Request body as JSON string')
  .option('-f, --file <path>', 'Read request body from a JSON file')
  .option('--json', 'Output as JSON')
  .addHelpText(
    'after',
    `
Examples:
  dm mail settings update --body '{"default_postcard_size":"6x9","default_sender_name":"DealMachine"}' --json
  dm mail settings update --body '{"default_qr_code_url":null}'`
  )
  .action(async (options) => {
    await mailSettingsUpdate(options);
  });

// ── Analytics (account-wide) ──

const mailAnalyticsCmd = mailCmd
  .command('analytics')
  .description('View account-wide mail analytics');

mailAnalyticsCmd
  .command('summary')
  .description('Account-wide totals plus per-campaign engagement')
  .option('--start-date <date>', 'Start of date range (ISO, by campaign launch date)')
  .option('--end-date <date>', 'End of date range (ISO)')
  .option('--launched-only', 'Only include launched campaigns')
  .option('-p, --page <n>', 'Page number')
  .option('--per-page <n>', 'Results per page')
  .option('--json', 'Output as JSON')
  .addHelpText(
    'after',
    `
Examples:
  dm mail analytics summary --json
  dm mail analytics summary --launched-only --per-page 50`
  )
  .action(async (options) => {
    await mailAnalyticsSummary(options);
  });

mailAnalyticsCmd
  .command('timeseries')
  .description('Time series for a single metric, bucketed by day or week')
  .option('--metric <metric>', 'Metric: sent, delivered, scans, open_rate (default sent)')
  .option('--group-by <bucket>', 'Bucket size: day or week (default day)')
  .option('--days <n>', 'Days back from today when no date range given (1-365, default 30)')
  .option('--start-date <date>', 'Start of date range (ISO; overrides --days)')
  .option('--end-date <date>', 'End of date range (ISO, defaults to now)')
  .option('--json', 'Output as JSON')
  .addHelpText(
    'after',
    `
Examples:
  dm mail analytics timeseries --json
  dm mail analytics timeseries --metric open_rate --group-by week --days 90`
  )
  .action(async (options) => {
    await mailAnalyticsTimeseries(options);
  });

// ============================================================================
// Dev commands (local DB operations)
// ============================================================================

const devCmd = program
  .command('dev')
  .description('Local development utilities (requires Docker MySQL)');

const devLicenseCmd = devCmd.command('license').description('Manage API key licenses');

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

function isMainModule(): boolean {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
  } catch {
    // Importing the program must not depend on the caller's entry file existing.
    return false;
  }
}

if (isMainModule()) {
  program.parse();
}
