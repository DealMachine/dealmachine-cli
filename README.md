# DealMachine CLI

DealMachine CLI (`dm`) -- property intelligence from the command line.

A standalone Commander.js CLI that talks to the DealMachine REST API. Provides **17 command groups** covering agent guidance, authentication, property search, people lookup, enrichment, comps, list management, and developer utilities. Compiles to a single ESM bundle via `tsc`.

This package has **zero** `@dealmachine/*` dependencies -- it is a self-contained binary that communicates exclusively through the public API.

---

## Table of Contents

- [Installation](#installation)
- [Authentication](#authentication)
- [Configuration](#configuration)
- [Commands](#commands)
  - [Agents](#agents-commands) -- `agents`, `agents guide`, `agents playbook`
  - [Auth](#auth-commands) -- `login`, `logout`, `whoami`
  - [Config](#config-commands) -- `config get`, `config set`, `config path`
  - [Account](#account-commands) -- `account`
  - [Usage](#usage-commands) -- `usage`
  - [Properties](#properties-commands) -- `search`, `count`, `get`, `ids`, `export`
  - [People](#people-commands) -- `search`, `count`, `get`, `ids`, `export`
  - [Enrich](#enrich-commands) -- `address`, `latlng`, `apn`, `email`, `phone`, `name`
  - [Comps](#comps-commands) -- comparable property analysis
  - [Lists](#lists-commands) -- `search`, `create`, `get`, `update`, `delete`, `build`, `import`, `items`, `add`, `remove`, `export`
  - [Filters](#filters-commands) -- list available search filters
  - [Fields](#fields-commands) -- list available data fields
  - [Activity](#activity-commands) -- `search`, `get`
  - [Addresses](#addresses-commands) -- `validate`
  - [Dev](#dev-commands) -- `license add`, `license list`, `license remove`
- [Global Options](#global-options)
- [Input Methods](#input-methods)
- [Project Structure](#project-structure)
- [Building](#building)
- [Adding New Commands](#adding-new-commands)
- [Dependencies](#dependencies)

---

## Installation

### From npm (global)

```bash
npm install -g dealmachine
dm login
```

The canonical implementation package is `@dealmachine/cli`. The `dealmachine` package is the short install alias and provides the same `dm` command.

### From source

```bash
cd packages/cli
npm run build
node dist/index.js whoami
```

### Link for local development

```bash
cd packages/cli
npm link
dm --version
```

The binary entry is `dist/index.js`, declared in `package.json` under `bin.dm`. Requires Node.js >= 18.

---

## Authentication

The CLI supports two authentication methods.

### Device Auth Flow (RFC 8628)

The default `dm login` command uses the OAuth 2.0 Device Authorization Grant (RFC 8628). This is the recommended flow for interactive use:

```bash
dm login
```

1. The CLI requests a device code from `POST /v1/auth/device/code` with client ID `dealmachine-next-cli` and your machine's hostname.
2. A verification URL and user code are displayed. The browser opens automatically (unless `--no-browser`).
3. You authorize the device in the browser by entering the user code.
4. The CLI polls `POST /v1/auth/device/token` at the server-specified interval.
5. On success, the API key, key ID, and organization details are stored to `~/.dealmachine/config.json`.

The polling handles all RFC 8628 responses: `authorization_pending`, `slow_down` (backs off by 5s), `access_denied`, and `expired_token`.

```bash
# Skip auto-opening the browser
dm login --no-browser

# Target a specific environment
dm login --env local
dm login --env staging
```

### Direct API Key Login

For CI pipelines, scripts, or local development, pass an API key directly:

```bash
dm login --key dm_sk_live_abc123...
```

The key is verified against `GET /v1/account` before being stored. If verification fails, the CLI exits with a non-zero code.

If you do not have an API key yet, use `dm signup`, `dm plans`, and `dm checkout` first. Public plan checkout only accepts self-serve Basic and Pro prices from the shared plan catalog and is capped at 60,000 monthly data credits.

### Switching Environments

If you are already logged in, you can switch the target API environment without logging out:

```bash
dm login --env local       # Switch to http://localhost:3001/v1
dm login --env staging     # Switch to https://api-staging.v2.dealmachine.com/v1
dm login --env production  # Switch to https://api.v2.dealmachine.com/v1
```

### Logout

```bash
dm logout
```

Removes the config file at `~/.dealmachine/config.json`.

---

## Configuration

Credentials are stored at `~/.dealmachine/config.json` with file permissions `0600` (owner read/write only). The config directory `~/.dealmachine/` is created with mode `0700`.

### Config File Schema

```json
{
  "apiKey": "dm_sk_live_...",
  "keyId": "key_abc123",
  "organizationId": 42,
  "organizationName": "Acme Corp",
  "organizationSlug": "acme-corp",
  "apiEnvironment": "production"
}
```

### Environment Variables

The CLI checks these environment variables for API URL resolution (in priority order):

| Variable                             | Purpose             | Example                             |
| ------------------------------------ | ------------------- | ----------------------------------- |
| `DM_API_URL` / `DEALMACHINE_API_URL` | Direct URL override | `http://localhost:3001/v1`          |
| `DM_ENV` / `DEALMACHINE_ENVIRONMENT` | Environment name    | `local`, `staging`, or `production` |

If none are set, the CLI falls back to the `apiEnvironment` field in the config file, then defaults to `production`.

### API Environments

| Environment  | URL                                         |
| ------------ | ------------------------------------------- |
| `local`      | `http://localhost:3001/v1`                  |
| `staging`    | `https://api-staging.v2.dealmachine.com/v1` |
| `production` | `https://api.v2.dealmachine.com/v1`         |

---

## Commands

### Agents Commands

#### `dm agents`

Print concise guidance for agents using the CLI. This is the recommended first command when an agent has access to `dm` but has not loaded the DealMachine Playbook yet.

```bash
dm agents
dm agents --json
```

The guide tells agents to use `--json` and `--quiet`, verify auth, fetch live filters and fields before searches, count before credit-consuming work, and confirm expected credit usage before fetching records or exporting.

#### `dm agents guide`

Print the same concise agent guidance explicitly.

```bash
dm agents guide
dm agents guide --json
```

#### `dm agents playbook`

Print the bundled DealMachine Playbook Markdown. Agents should load this before translating natural language property, people, contact, enrichment, list, export, comps, or credit-usage requests into CLI commands.

```bash
dm agents playbook
dm agents playbook --json
dm agents skill        # alias
```

The Playbook is copied from `packages/playbooks/playbook/SKILL.md` into `dist/agents/dealmachine-playbook.md` during `npm run build`, so the command works from a published CLI package as well as a local source checkout.

---

### Auth Commands

#### `dm signup`

Create a public API account and receive an API key:

```bash
dm signup developer@example.com --first-name Ada --last-name Lovelace --phone-number +15551234567
dm signup developer@example.com --login
```

#### `dm plans`

List public self-serve Basic and Pro plans:

```bash
dm plans
dm plans --json
```

#### `dm checkout`

Create a Stripe checkout session using a price ID from `dm plans`:

```bash
dm checkout --price-id price_xxx_monthly
```

#### `dm login`

Authenticate with your DealMachine account.

```bash
dm login                            # Device auth flow (opens browser)
dm login --no-browser               # Device auth, manual code entry
dm login --key dm_sk_live_abc123    # Direct API key
dm login --env local                # Target local API
```

| Option                | Description                                          |
| --------------------- | ---------------------------------------------------- |
| `--no-browser`        | Do not automatically open the browser                |
| `--key <api-key>`     | Login directly with an API key (skips browser)       |
| `--env <environment>` | API environment: `local`, `staging`, or `production` |

#### `dm logout`

Remove stored credentials.

```bash
dm logout
```

#### `dm whoami`

Show current authentication status.

```bash
dm whoami               # Show stored credentials
dm whoami --verify      # Verify credentials against the API
```

| Option     | Description                     |
| ---------- | ------------------------------- |
| `--verify` | Verify credentials with the API |

---

### Config Commands

#### `dm config get [key]`

Get a configuration value, or display all values when no key is given.

```bash
dm config get                   # Show all config values
dm config get apiEnvironment    # Show specific value
dm config get apiKey            # Shows truncated key (first 20 chars)
```

Available keys: `organizationName`, `organizationSlug`, `organizationId`, `apiEnvironment`, `keyId`, `apiKey`.

#### `dm config set <key> <value>`

Set a configuration value. Only `apiEnvironment` is editable.

```bash
dm config set apiEnvironment local
dm config set apiEnvironment staging
dm config set apiEnvironment production
```

#### `dm config path`

Print the absolute path to the config file.

```bash
dm config path
# /Users/you/.dealmachine/config.json
```

---

### Account Commands

#### `dm account`

Display account information including organization name, ID, creation date, and auth type.

```bash
dm account
```

Output:

```
Account
────────────────────────────────────────
Organization:  Acme Corp
Org ID:        42
Created:       Jan 15, 2025
Auth Type:     api_key
```

---

### Usage Commands

#### `dm usage`

Show credit usage for the current billing cycle.

```bash
dm usage           # Human-readable table
dm usage --json    # Machine-readable JSON
```

Output:

```
Credit Usage
──────────────────────────────────────────────────
  Plan:         Pro
  Cycle:        Mar 1, 2026 — Mar 31, 2026

  Credits:      4,200 / 10,000 (42%)
  Remaining:    5,800

  Breakdown:
    Properties: 3,100
    People:     1,100
```

---

### Properties Commands

#### `dm properties search`

Search properties with filters and locations.

```bash
# Inline JSON body
dm properties search --body '{
  "locations": [{"type": "zip_code", "code": "78704"}],
  "filters": [{"filter_id": "property_type", "operator": "is_any_of", "value": ["single_family"]}]
}'

# From a file
dm properties search -f search.json

# Pipe from stdin
cat search.json | dm properties search

# Machine-readable output
dm properties search -f search.json --json

# Query Builder protocol filters
dm properties search --include-lists 123,456 --exclude-previously-exported --body '{"locations":[]}'
```

| Option                            | Description                                                                   |
| --------------------------------- | ----------------------------------------------------------------------------- |
| `--body <json>`                   | Request body as JSON string                                                   |
| `-f, --file <path>`               | Read request body from a JSON file                                            |
| `--include-lists <ids>`           | Comma-separated list IDs to include                                           |
| `--exclude-lists <ids>`           | Comma-separated list IDs to exclude                                           |
| `--exclude-previously-exported`   | Exclude records already exported by your organization                         |
| `--bigquery-data-environment <n>` | Query Builder data environment (`1` production, `2` staging, `3` development) |
| `--json`                          | Output as JSON                                                                |

#### `dm properties count`

Count properties matching filters without consuming credits.

```bash
dm properties count --body '{"locations": [{"type": "state", "code": "TX"}]}'
dm properties count -f filters.json --json
```

#### `dm properties get <id>`

Get a single property by its DealMachine ID.

```bash
dm properties get prop_12345
dm properties get prop_12345 --contact-audience owners_and_family
dm properties get prop_12345 --fields estimated_value,equity
dm properties get prop_12345 --json
```

| Option                          | Description                                                  |
| ------------------------------- | ------------------------------------------------------------ |
| `--contact-audience <audience>` | `owners`, `owners_and_family`, `renters`, `residents`, `all` |
| `--fields <csv>`                | Comma-separated property field IDs from `dm fields`          |
| `--json`                        | Output as JSON                                               |

#### `dm properties ids [ids...]`

Get multiple properties by their IDs in a single batch request.

```bash
# Positional arguments
dm properties ids prop_111 prop_222 prop_333

# Via JSON body
dm properties ids --body '{"ids": ["prop_111", "prop_222"]}'

# From file
dm properties ids -f ids.json --contact-audience owners
```

| Option                          | Description                                                                    |
| ------------------------------- | ------------------------------------------------------------------------------ |
| `--body <json>`                 | Request body as JSON string                                                    |
| `-f, --file <path>`             | Read request body from a JSON file                                             |
| `--contact-audience <audience>` | Include contacts: `owners`, `owners_and_family`, `renters`, `residents`, `all` |
| `--json`                        | Output as JSON                                                                 |

#### `dm properties export`

Export properties as CSV (up to 1,000,000 records). Returns signed download URLs.

```bash
dm properties export -f search.json
dm properties export -f search.json --require-phone --scrub-dnc
dm properties export --body '{"locations": [...]}' --mobile-only --json
```

| Option              | Description                                                 |
| ------------------- | ----------------------------------------------------------- |
| `--body <json>`     | Request body as JSON string                                 |
| `-f, --file <path>` | Read request body from a JSON file                          |
| `--require-phone`   | Only include records where the contact has a phone number   |
| `--require-email`   | Only include records where the contact has an email address |
| `--mobile-only`     | Only include mobile phone numbers                           |
| `--landline-only`   | Only include landline phone numbers                         |
| `--scrub-dnc`       | Exclude contacts on the Do Not Call registry                |
| `--json`            | Output as JSON                                              |

---

### People Commands

#### `dm people search`

Search people with filters and locations.

```bash
dm people search --body '{
  "locations": [{"type": "zip_code", "code": "78704"}],
  "filters": [{"filter_id": "age", "operator": "between", "value": [30, 50]}]
}'
dm people search -f people-search.json --json
dm people search --include-lists 123 --exclude-lists 456 --exclude-previously-exported --body '{"locations":[]}'
```

#### `dm people count`

Count people matching filters without consuming credits.

```bash
dm people count -f filters.json
```

#### `dm people get <id>`

Get a single person by their DealMachine ID.

```bash
dm people get per_12345
dm people get per_12345 --include-properties --property-limit 20
dm people get per_12345 --fields estimated_household_income,estimated_value
dm people get per_12345 --json
```

| Option                 | Description                                                |
| ---------------------- | ---------------------------------------------------------- |
| `--include-properties` | Include associated properties                              |
| `--property-limit <n>` | Maximum associated properties to return, from 1 through 100 |
| `--fields <csv>`       | Comma-separated field IDs from `dm fields`                 |
| `--json`               | Output as JSON                                             |

#### `dm people ids [ids...]`

Get multiple people by their IDs in a single batch request.

```bash
dm people ids per_111 per_222 per_333
dm people ids --body '{"ids": ["per_111", "per_222"]}' --include-properties --property-limit 20
dm people ids per_111 per_222 --fields estimated_household_income,estimated_value
```

| Option                 | Description                                                    |
| ---------------------- | -------------------------------------------------------------- |
| `--include-properties` | Include associated properties                                  |
| `--property-limit <n>` | Maximum associated properties to return per person, up to 100 |
| `--fields <csv>`       | Comma-separated field IDs from `dm fields`                     |

#### `dm people export`

Export people as CSV (up to 1,000,000 records). Returns signed download URLs.

```bash
dm people export -f search.json --require-email
dm people export -f search.json --mobile-only --scrub-dnc --json
```

Contact filter options are the same as `dm properties export`.

---

### Enrich Commands

All enrichment commands support three input modes: a positional argument for single-item lookup, `--body`/`-f` for JSON payloads, and `-f` with a `.csv` file for batch enrichment from CSV. Batches larger than 250 items are automatically chunked. Every enrichment command accepts `--fields <csv>` and sends the selected field IDs to the API. Email, phone, and name matches also include a free `property_count`; use `--include-properties` when you need the property records themselves.

#### `dm enrich address [address]`

Look up a property by street address.

```bash
# Single address
dm enrich address "123 Main St, Austin, TX 78704"
dm enrich address "123 Main St, Austin, TX 78704" --fields estimated_value,equity

# Batch from JSON
dm enrich address --body '{"data": [{"full_address": "123 Main St, Austin, TX"}]}'

# Batch from CSV (auto-detected by .csv extension)
dm enrich address -f addresses.csv --contact-audience owners

# CSV columns: full_address (or street, city, state, zip)
```

| Option                          | Description                                           |
| ------------------------------- | ----------------------------------------------------- |
| `--body <json>`                 | Request body as JSON string                           |
| `-f, --file <path>`             | Read from JSON or CSV file                            |
| `--contact-audience <audience>` | `owners`, `owners_and_family`, `renters`, `residents` |
| `--fields <csv>`                | Comma-separated field IDs from `dm fields`            |
| `--json`                        | Output as JSON                                        |

#### `dm enrich latlng [coords]`

Look up a property by latitude/longitude coordinates.

```bash
dm enrich latlng 30.25,-97.75
dm enrich latlng -f coordinates.csv --fields estimated_value,equity
# CSV columns: latitude, longitude (or lat, lng/lon/long)
```

#### `dm enrich apn [apn]`

Look up a property by Assessor's Parcel Number. Narrow results with `--state` or `--zip`.

```bash
dm enrich apn "0123-456-789" --state TX
dm enrich apn -f parcels.csv --zip 78704 --fields estimated_value,equity
# CSV columns: apn (or parcel_id, parcel_number)
```

| Option                          | Description                                           |
| ------------------------------- | ----------------------------------------------------- |
| `--state <code>`                | Narrow by state (e.g., TX)                            |
| `--zip <code>`                  | Narrow by ZIP code                                    |
| `--contact-audience <audience>` | `owners`, `owners_and_family`, `renters`, `residents` |
| `--fields <csv>`                | Comma-separated field IDs from `dm fields`            |

#### `dm enrich email [email]`

Look up a person by email address.

```bash
dm enrich email jane@example.com
dm enrich email jane@example.com --include-properties
dm enrich email -f emails.csv --fields estimated_household_income,estimated_value --json
# CSV columns: email (or email_address)
```

| Option                 | Description                                    |
| ---------------------- | ---------------------------------------------- |
| `--include-properties` | Include associated properties                  |
| `--fields <csv>`       | Comma-separated field IDs from `dm fields`     |

#### `dm enrich phone [phone]`

Look up a person by phone number.

```bash
dm enrich phone 5125551234
dm enrich phone -f phones.csv --include-properties --fields estimated_value
# CSV columns: phone (or phone_number)
```

| Option                 | Description                                |
| ---------------------- | ------------------------------------------ |
| `--include-properties` | Include associated properties              |
| `--fields <csv>`       | Comma-separated field IDs from `dm fields` |

#### `dm enrich name [name]`

Look up people by name. Supports "First Last" or just "Last" format.

```bash
dm enrich name "Jane Doe"
dm enrich name "Jane Doe" --state TX --estimate-cost
dm enrich name "Doe" --state TX --page 2
dm enrich name "Jane Doe" --zip 78704 --include-properties
dm enrich name "Jane Doe" --fields estimated_household_income,estimated_value
```

| Option                 | Description                   |
| ---------------------- | ----------------------------- |
| `--state <code>`       | Narrow by state               |
| `--zip <code>`         | Narrow by ZIP code            |
| `--include-properties` | Include associated properties |
| `--fields <csv>`       | Field IDs from `dm fields`     |
| `--estimate-cost`      | Preview count and credits     |
| `--page <n>`           | Page number                   |
| `--per-page <n>`       | Results per page              |

---

### Comps Commands

#### `dm comps [property_ids...]`

Find comparable properties (sales comps) for one or more properties.

```bash
# Single property with defaults
dm comps prop_12345

# Multiple properties with options
dm comps prop_12345 prop_67890 --radius 2 --timeframe 12months --limit 50

# Full control via JSON body
dm comps --body '{
  "property_ids": ["prop_12345"],
  "location": {"type": "radius", "radius_miles": 1.5},
  "criteria": {"timeframe": "6months", "sort_by": "match", "limit": 25}
}'
```

| Option                   | Description                                                |
| ------------------------ | ---------------------------------------------------------- |
| `--body <json>`          | Request body as JSON string                                |
| `-f, --file <path>`      | Read request body from a JSON file                         |
| `--radius <miles>`       | Search radius in miles (default: 1)                        |
| `--timeframe <period>`   | `3months`, `6months`, `12months`, `all` (default: 6months) |
| `--limit <n>`            | Max comps per property (default: 25, max: 100)             |
| `--sort-by <field>`      | `distance`, `price`, `date`, `match` (default: match)      |
| `--sort-direction <dir>` | `asc`, `desc` (default: desc)                              |
| `--include-foreclosures` | Include foreclosure sales                                  |
| `--json`                 | Output as JSON                                             |

Output includes subject property details, value estimation with confidence interval, summary statistics (average/median price, price per sqft), and a table of comparable properties.

---

### Lists Commands

#### `dm lists search`

Search and list all saved lists.

```bash
dm lists search
dm lists search --search "Austin" --source-type properties --sort newest
dm lists search --page 2 --per-page 50 --json
```

| Option                 | Description                         |
| ---------------------- | ----------------------------------- |
| `--search <term>`      | Search lists by name                |
| `--source-type <type>` | `properties` or `people`            |
| `--sort <order>`       | `newest`, `oldest`, `name`, `count` |
| `-p, --page <n>`       | Page number                         |
| `--per-page <n>`       | Results per page                    |

#### `dm lists create`

Create a new list.

```bash
# Empty list
dm lists create --name "Austin Leads"

# Pre-populated with record IDs (max 250)
dm lists create --name "Hot Leads" --source-type properties --ids 123,456,789

# With search filters for a list build
dm lists create --name "TX SFR" -f search-filters.json
```

| Option                 | Description                                          |
| ---------------------- | ---------------------------------------------------- |
| `--name <name>`        | List name (required)                                 |
| `--source-type <type>` | `properties` or `people`                             |
| `--ids <csv>`          | Comma-separated record IDs to pre-populate (max 250) |
| `--body <json>`        | Request body as JSON (filters/locations)             |
| `-f, --file <path>`    | Read request body from a JSON file                   |

#### `dm lists get <id>`

Get details of a specific list including status, progress, and error state.

```bash
dm lists get list_abc123
```

#### `dm lists update <id>`

Rename a list.

```bash
dm lists update list_abc123 --name "New Name"
```

#### `dm lists delete <id>`

Delete a list and all its items.

```bash
dm lists delete list_abc123
```

#### `dm lists build <id>`

Build a list from search filters. This is an asynchronous operation -- poll with `dm lists get` for status.

```bash
dm lists build list_abc123 -f search-filters.json
```

#### `dm lists import <id>`

Import record IDs into an existing list.

```bash
dm lists import list_abc123 --ids 111,222,333 --source-type properties
dm lists import list_abc123 -f import-payload.json
```

#### `dm lists items <id>`

List items in a list with pagination.

```bash
dm lists items list_abc123
dm lists items list_abc123 --page 2 --per-page 100 --json
```

#### `dm lists add <id>`

Add items to a list by ID.

```bash
dm lists add list_abc123 --ids 111,222,333
dm lists add list_abc123 --ids 111,222 --id-type internal_property_id
```

| Option             | Description                                    |
| ------------------ | ---------------------------------------------- |
| `--ids <csv>`      | Comma-separated list of IDs to add (required)  |
| `--id-type <type>` | `internal_property_id` or `internal_person_id` |

#### `dm lists remove <id>`

Remove items from a list by ID.

```bash
dm lists remove list_abc123 --ids 111,222,333
```

#### `dm lists export <id>`

Export list items. Credits are charged per record.

```bash
dm lists export list_abc123
dm lists export list_abc123 --fields "full_address,estimated_value,owner_name" --anchor property
```

| Option            | Description                              |
| ----------------- | ---------------------------------------- |
| `--fields <csv>`  | Comma-separated list of fields to export |
| `--anchor <type>` | `property` or `person`                   |

---

### Filters Commands

#### `dm filters`

List available search filters with their types, operators, and groupings.

```bash
dm filters
dm filters --source-type properties --search "bed"
dm filters --group-id building_information --json
```

| Option                 | Description              |
| ---------------------- | ------------------------ |
| `--source-type <type>` | `properties` or `people` |
| `--group-id <id>`      | Filter by group ID       |
| `--search <term>`      | Search filters by name   |
| `--page <n>`           | Page number              |
| `--per-page <n>`       | Results per page         |

---

### Fields Commands

#### `dm fields`

List available data fields with filterable/sortable flags.

```bash
dm fields
dm fields --source-type people --search "phone"
dm fields --group-id contact_info --json
```

| Option                 | Description              |
| ---------------------- | ------------------------ |
| `--source-type <type>` | `properties` or `people` |
| `--group-id <id>`      | Filter by group ID       |
| `--search <term>`      | Search fields by name    |
| `--page <n>`           | Page number              |
| `--per-page <n>`       | Results per page         |

---

### Activity Commands

#### `dm activity search`

Search past API activity with type filters and free-text search.

```bash
dm activity search -t search_properties enrich_address
dm activity search -q "Austin" --page 2
dm activity search --body '{"types": ["search_properties"], "page": 1}'
```

| Option                   | Description                                |
| ------------------------ | ------------------------------------------ |
| `--body <json>`          | Request body as JSON string                |
| `-f, --file <path>`      | Read request body from a JSON file         |
| `-t, --types <types...>` | Filter by activity types (space-separated) |
| `-q, --query <text>`     | Free-text search across activity           |
| `--page <n>`             | Page number                                |
| `--per-page <n>`         | Results per page                           |

#### `dm activity get <id>`

Get full details of a specific activity record, including the original request, result summary, and entity IDs (people and properties).

```bash
dm activity get act_abc123
dm activity get act_abc123 --json
```

---

### Addresses Commands

#### `dm addresses validate [address]`

Validate and standardize addresses via USPS.

```bash
# Single address
dm addresses validate "123 Main St, Austin, TX 78704"

# Batch via JSON
dm addresses validate --body '{"data": [{"full_address": "123 Main St, Austin TX"}]}'

# From file
dm addresses validate -f addresses.json --json
```

Output shows each address as valid, corrected (with corrections listed), or invalid (with reason).

---

### Dev Commands

Local development utilities that operate directly against the Docker MySQL container (`dealmachine-next-mysql`). These require the local database to be running (`npm run db:start` from the repo root).

#### `dm dev license add <key_id>`

Add a license to an API key in the local database.

```bash
dm dev license add key_abc123 --type state --code TX
dm dev license add key_abc123 --type zip_code --code 78704
dm dev license add key_abc123 --type unlimited
dm dev license add key_abc123 --type county --code 48453 --expires 2026-12-31
```

| Option             | Description                                              |
| ------------------ | -------------------------------------------------------- |
| `--type <type>`    | `state`, `county`, `zip_code`, or `unlimited` (required) |
| `--code <code>`    | Location code: state abbreviation, FIPS code, or ZIP     |
| `--expires <date>` | Expiration date in ISO format                            |

#### `dm dev license list [key_id]`

List all licenses, optionally filtered by key ID.

```bash
dm dev license list
dm dev license list key_abc123
```

#### `dm dev license remove <license_id>`

Remove a license by its numeric ID.

```bash
dm dev license remove 42
```

---

## Global Options

Every command supports these flags:

| Flag        | Description                                                |
| ----------- | ---------------------------------------------------------- |
| `--json`    | Output as machine-readable JSON (for scripting and piping) |
| `--quiet`   | Suppress spinners and decorative output for agents/scripts |
| `--help`    | Show usage information for any command                     |
| `--version` | Show the CLI version                                       |

---

## Input Methods

Commands that accept a request body support three input methods, checked in this order:

1. **`--body <json>`** -- Inline JSON string.
2. **`-f, --file <path>`** -- Read from a JSON file. Enrichment commands also accept `.csv` files for batch processing.
3. **Stdin pipe** -- Read JSON from piped input (detected when stdin is not a TTY).

```bash
# Inline
dm properties search --body '{"locations": [...]}'

# File
dm properties search -f query.json

# Pipe
cat query.json | dm properties search

# CSV enrichment (enrich commands only)
dm enrich address -f addresses.csv
```

### CSV Batch Enrichment

The `enrich` commands detect `.csv` files by extension and auto-parse them. Expected column names per command:

| Command          | Required Columns        | Alternative Column Names             |
| ---------------- | ----------------------- | ------------------------------------ |
| `enrich address` | `full_address`          | or `street` + `city`, `state`, `zip` |
| `enrich latlng`  | `latitude`, `longitude` | `lat`, `lng`/`lon`/`long`            |
| `enrich apn`     | `apn`                   | `parcel_id`, `parcel_number`         |
| `enrich email`   | `email`                 | `email_address`                      |
| `enrich phone`   | `phone`                 | `phone_number`                       |

Batches larger than 250 items are automatically chunked with progress spinners. If an export limit is reached mid-batch, the CLI stops and returns results collected so far.

---

## Project Structure

```
packages/cli/
  scripts/
    copy-agent-assets.mjs      # Bundles the Playbook Markdown into dist/agents
  src/
    index.ts                  # Program entrypoint -- registers all 17 command groups
    lib/
      config.ts               # Read/write ~/.dealmachine/config.json (mode 0600)
      client.ts               # HTTP client wrapper (apiRequest, formatDate, getApiKey)
      api.ts                  # Device auth flow client (requestDeviceCode, pollForToken, verifyCredentials)
      output.ts               # Formatting helpers (printTable, printJson, printKeyValue, parseRequestBody)
    commands/
      agents.ts               # dm agents    -- agent guide and Playbook output
      login.ts                # dm login     -- device auth + API key login
      logout.ts               # dm logout    -- remove credentials
      whoami.ts               # dm whoami    -- show/verify auth status
      config.ts               # dm config    -- get, set, path
      account.ts              # dm account   -- show account info
      usage.ts                # dm usage     -- credit usage
      properties.ts           # dm properties -- search, count, get, ids, export
      people.ts               # dm people    -- search, count, get, ids, export
      enrich.ts               # dm enrich    -- address, latlng, apn, email, phone, name
      comps.ts                # dm comps     -- comparable properties
      lists.ts                # dm lists     -- full CRUD + build, import, export
      filters.ts              # dm filters   -- list available filters
      fields.ts               # dm fields    -- list available fields
      activity.ts             # dm activity  -- search, get
      addresses.ts            # dm addresses -- validate
      dev.ts                  # dm dev       -- local license management
  dist/                       # Compiled output (ESM)
  package.json
  tsconfig.json
```

### Key Modules

| Module          | Responsibility                                                                                                                                                                                                                                          |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/config.ts` | Manages `~/.dealmachine/config.json`. Enforces `0600` file permissions and `0700` directory permissions. Provides typed read/write/delete helpers.                                                                                                      |
| `lib/client.ts` | Central HTTP client. Resolves the API base URL from env vars, config, or defaults. Attaches the `Authorization: Bearer` header and versioned `User-Agent`. Exits with a non-zero code on HTTP errors.                                                        |
| `lib/api.ts`    | Device authorization flow implementation. Handles `POST /v1/auth/device/code` and `POST /v1/auth/device/token` with RFC 8628-compliant polling and error mapping. Also provides `verifyCredentials` for key validation.                                 |
| `lib/output.ts` | All output formatting: `printTable` (auto-width columns), `printJson`, `printKeyValue`, `printPagination`, `printCredits`, `printTotals`, `printWarning`, `printHeader`. Also exports `parseRequestBody` which handles `--body`, `-f`, and stdin input. |

---

## Building

```bash
npm run build      # Compile TypeScript and bundle agent Playbook assets to dist/
npm run dev        # Watch mode (tsc --watch)
```

### Standalone Binary

The compiled `dist/index.js` includes a `#!/usr/bin/env node` shebang and is declared in `package.json` under `bin.dm`. When installed globally via npm, it becomes available as `dm` on the PATH.

For distribution as a standalone binary without npm:

```bash
# Build
cd packages/cli
npm run build

# The entire dist/ directory is the distributable artifact
# dist/index.js is the entrypoint (requires Node.js >= 18 on the target machine)
```

The `files` array in `package.json` ensures only `dist/` is included in the published package.

### TypeScript Configuration

- Target: ES2022
- Module: NodeNext (ESM)
- Strict mode enabled
- Outputs declarations, declaration maps, and source maps
- No project references (standalone compilation)

---

## Adding New Commands

### Step 1: Create the command file

Create `src/commands/mycommand.ts`:

```typescript
/**
 * MyCommand -- description of what this command does
 */

import chalk from 'chalk';
import ora from 'ora';
import { apiRequest } from '../lib/client.js';
import { printJson, printHeader, printKeyValue } from '../lib/output.js';

interface MyResponse {
  data: { id: string; name: string };
}

export async function myCommand(options: { json?: boolean }): Promise<void> {
  const spinner = ora('Doing something...').start();
  const data = await apiRequest<MyResponse>('/my-endpoint');
  spinner.stop();

  if (options.json) {
    printJson(data);
    return;
  }

  printHeader('My Command');
  printKeyValue({
    ID: data.data.id,
    Name: data.data.name,
  });
  console.log();
}
```

### Step 2: Register in index.ts

Import and wire up the command in `src/index.ts`:

```typescript
import { myCommand } from './commands/mycommand.js';

// Top-level command
program
  .command('mycommand')
  .description('Description shown in --help')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    await myCommand(options);
  });

// Or as a subcommand group
const myGroup = program.command('mygroup').description('Group description');

myGroup
  .command('sub1')
  .description('Subcommand description')
  .action(async (options) => {
    await mySub1(options);
  });
```

### Step 3: Build and test

```bash
npm run build
node dist/index.js mycommand --json
```

### Conventions

- One file per command group in `src/commands/`.
- Always support `--json` for machine-readable output.
- Use `ora` for spinners during API calls.
- Use `chalk` for colored terminal output.
- Use `apiRequest<T>` from `lib/client.ts` for all API calls -- it handles auth, errors, and exits.
- Use `parseRequestBody` from `lib/output.ts` when the command accepts `--body`, `-f`, or stdin input.
- Use `printHeader`, `printTable`, `printKeyValue`, `printCredits`, `printPagination` for consistent output formatting.
- All imports must use the `.js` extension (ESM requirement with NodeNext resolution).

---

## Dependencies

### Runtime

| Package     | Version | Purpose                                                                |
| ----------- | ------- | ---------------------------------------------------------------------- |
| `commander` | ^12.1.0 | CLI framework -- command registration, option parsing, help generation |
| `chalk`     | ^5.3.0  | Terminal string styling (colors, bold, dim)                            |
| `ora`       | ^8.1.0  | Spinner animations for async operations                                |
| `open`      | ^10.1.0 | Opens the browser for the device auth flow                             |

### Dev

| Package       | Version | Purpose                  |
| ------------- | ------- | ------------------------ |
| `typescript`  | ^5.6.3  | TypeScript compiler      |
| `@types/node` | ^22.0.0 | Node.js type definitions |

### Internal Package Dependencies

**None.** This package is a fully standalone binary with zero `@dealmachine/*` dependencies. It communicates exclusively through the public REST API.

### Used By

The **Playbook** at `packages/playbooks/playbook/` uses `dm` commands to execute property intelligence workflows. The CLI is the primary interface through which the Playbook interacts with DealMachine data. Agents can load the bundled Playbook directly with `dm agents playbook`.
