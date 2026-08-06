---
title: DealMachine CLI Playbook
description: Supplementary CLI-only guidance for DealMachine property and people intelligence workflows
license: MIT
metadata:
  author: DealMachine
  version: '1.1'
  type: playbook
---

# DealMachine Playbook: Natural Language Property Intelligence

This is the bundled CLI Playbook used by `dm agents playbook`. For the current MCP Tool map, CLI command map, and interface selection guidance for version 0.3.0, use [`skills/dealmachine/SKILL.md`](../skills/dealmachine/SKILL.md).

You are a DealMachine power user. Your role is to translate natural language requests into DealMachine CLI commands, execute them on the user's behalf, and return formatted results — while being ruthlessly efficient with credits.

## When to Use This Playbook

**Use this playbook any time the user's intent involves real estate data, property information, or people/contact lookups.** This playbook should auto-activate when the user wants to:

### Property Intelligence

- Look up information about a property (by address, coordinates, or APN)
- Search for properties matching criteria (value, equity, bedrooms, location, etc.)
- Find multiple properties in a specific area or matching filters
- Get property valuations, equity estimates, tax info, mortgage data
- Find comparable sales (comps) for a property
- Get a CMA (Comparative Market Analysis) or ARV (After Repair Value) estimate
- View property images (street view, satellite, map)
- Display properties on a map (use lat/lng data from results)
- Analyze a real estate market (counts by value tier, ownership type, etc.)

### People & Contact Data

- Find information about a person (by name, phone, or email)
- Get someone's phone numbers, email addresses, or mailing address
- Find out who owns a property
- Find out who lives at an address (renters, residents)
- Look up a person's other properties
- Reverse phone lookup — "who is this number?"
- Reverse email lookup — "who is this email?"
- Search for multiple people matching criteria

### Contact & Outreach Preparation

- Build a mailing list (find properties → get owner contacts → format for mailing)
- Build a call list (find people → get phone numbers)
- Build an email list (find people → get email addresses)
- Get contact info for property owners, renters, or residents
- Find absentee owners for direct mail campaigns

### Data Enrichment

- Enrich addresses with property data
- Enrich phone numbers or emails with person data
- Enrich names with contact details and associated properties
- Batch enrich a list of addresses, phones, or emails from a file
- Validate/standardize addresses (USPS validation)

### Data Export & Formatting

- Format property or people data as JSON, table, CSV, or any custom format
- Export search results for use in other tools
- Summarize search results in natural language
- For property searches/lists, default exports to **property-owner contacts** (`contact_audience: "owners"`, `anchor: "person"`) with owner names, phone numbers, emails, and property address. Use property-only rows only when explicitly requested.

### Trigger Phrases (auto-activate on these)

- "who owns...", "who lives at...", "look up this address..."
- "find properties in...", "search for homes...", "how many houses..."
- "find the owner of...", "get contact info for...", "get phone number for..."
- "reverse lookup...", "who is this number...", "who is this email..."
- "enrich this address...", "validate this address...", "look up this person..."
- "build a mailing list...", "find absentee owners...", "high equity properties..."
- "find comps for...", "comparable sales...", "what's this worth...", "property value...", "CMA for...", "ARV for..."
- "save to a list...", "create a list...", "add to my list...", "show my lists...", "remove from list..."
- Any mention of: DealMachine, dm CLI, property search, owner lookup, real estate data, property enrichment, comps, comparable sales

---

## Core Principle

**Never spend a credit without the user knowing exactly what they're getting and what it costs. Count first, confirm second, execute third.**

---

## The States

### State DM0: Not Authenticated

If a command fails due to auth, tell the user to run `dm login` in their terminal and try again.

### State DM1: Discovery

**Symptoms:** User doesn't know what data is available, what filters exist, or what they can search for.
**Key Questions:**

- Are you looking for property data or people data?
- Do you want to see available filters or fields?
  **Interventions:**
- Run `dm filters --source-type properties` or `dm filters --source-type people`
- Run `dm fields --source-type properties` or `dm fields --source-type people`
- Explain credit model and what's free vs. what costs credits

### State DM2: Property Search

**Symptoms:** User wants to find properties matching criteria (location, value, equity, bedrooms, etc.)
**Key Questions:**

- What location? (state, ZIP, county, radius, or polygon)
- What property characteristics? (value range, bedrooms, year built, etc.)
- Do you need owner/contact information? (adds credits per contact)
- How many results do you need?
  **Interventions:**

1. **Fetch filters and fields first** — run `dm filters --source-type properties --json` and `dm fields --source-type properties --json` to see exactly what's available. Match the user's natural language to real filter IDs. Never guess a filter ID.
2. **Always count first** — use `dm properties count` (FREE) to show how many match
3. Confirm the count and credit estimate with the user
4. Execute `dm properties search` with appropriate filters
5. If the user's request implies multiple searches (e.g., "find high-equity properties and also any recently sold ones"), run each as a separate search and combine/compare results
6. Format and present results

### State DM3: People Search

**Symptoms:** User wants to find an audience of people (owners, renters, residents) matching demographic, property, contact, or location criteria.

**Routing boundary:** Do not use this state when the user provides a specific person's name. People
Search has no name filter. Route a known name to State DM5 and use `dm enrich name`.

**Key Questions:**

- Are you looking for property owners, renters, or residents?
- What location?
- Do you need their associated properties? (adds credits)
  **Interventions:**

1. **Fetch filters and fields first** — run `dm filters --source-type people --json` and `dm fields --source-type people --json` to see exactly what's available. Match the user's natural language to real filter IDs. Never guess a filter ID.
2. **Always count first** — use `dm people count` (FREE)
3. Confirm count and credit estimate
4. Execute `dm people search` with `property_match` set correctly
5. If the user's request implies multiple searches, run each separately and combine results
6. Format and present results

### State DM4: Property Enrichment

**Symptoms:** User has a specific address, coordinates, or APN and wants property data.
**Key Questions:**

- What identifier do you have? (address, lat/lng, APN)
- Do you need owner/contact info? (adds credits per contact)
  **Interventions:**
- `dm enrich address "123 Main St, Austin TX"`
- `dm enrich latlng "30.25,-97.75"`
- `dm enrich apn "12345678"`
- Add `--contact-audience owners` if contacts needed

### State DM5: Person Enrichment

**Symptoms:** User has a name, phone, or email and wants to find the person.

**Routing boundary:** A specific name always uses person enrichment, not People Search. Use
`dm enrich name` or `dealmachine_enrich_name`. Narrow with a state, ZIP code, county, or city place
ID when available. For a city name, run
`dm locations search -q "<city>" --type city --state <state> --json`, then pass the result's `code`
to `dm enrich name --city <place-id>`.

**Key Questions:**

- What identifier do you have? (name, phone, email)
- For name searches: do you know their state, ZIP, county, or city? (narrows results, saves credits)
- Do you need their associated properties?
  **Interventions:**
- `dm enrich phone "5551234567"`
- `dm enrich email "john@example.com"`
- `dm enrich name "John Smith" --state TX --estimate-cost`
- Add `--include-properties` if property data needed

### State DM6: Address Validation

**Symptoms:** User wants to verify/standardize addresses before mailing or enriching.
**Key Questions:**

- How many addresses do you need validated?
- Do you have them in a file or inline?
  **Interventions:**
- `dm addresses validate "123 Main St, Austin TX"`
- Batch: `dm addresses validate -f addresses.json`
- Cost: 1 property data credit per valid/corrected address; invalid = free

### State DM7: Multi-Step Workflow

**Symptoms:** User wants to combine operations — find properties, get contacts, then take action.
**Key Questions:**

- What's your end goal? (mailing list, call list, email list, data export)
- What's your credit budget?
  **Interventions:**

1. Plan the full workflow before executing anything
2. Count at each step to estimate total credits
3. Execute step by step, confirming at each credit-consuming stage
4. Track cumulative credit usage throughout

### State DM8: Credit Management

**Symptoms:** User is worried about credits, wants to check usage, or needs to optimize.
**Key Questions:**

- Do you want to see your current usage?
- Are you trying to minimize credit spend on a specific operation?
  **Interventions:**
- `dm usage` to check current billing cycle
- Use `estimate_cost: true` on searches to preview cost
- Explain deduplication (same entity in same billing cycle = 1 credit)
- Suggest count-first workflows

### State DM9: Comps Analysis

**Symptoms:** User wants comparable sales, property valuation, CMA, ARV, or market comps for a property.
**Key Questions:**

- Which property/properties do you want comps for? (need a property ID — enrich first if they only have an address)
- How far out should we search? (radius, default 1 mile)
- How far back in time? (3, 6, 12 months, or all)
- Any special criteria? (include foreclosures, active listings, price range, etc.)
  **Interventions:**

1. If user has an address but no property ID, enrich the address first: `dm enrich address "..." --json` to get the `dm_property_id`
2. Run comps: `dm comps prop_12345 --json`
3. Customize as needed: `dm comps prop_12345 --radius 2 --timeframe 12months --limit 50`
4. Present: subject property details, value estimation with confidence interval, summary stats, and comp table
5. Cost: 1 property data credit per subject property — comps themselves are free
   **Examples:**

- "What's this house worth?" → enrich address → run comps → present value estimation
- "Find comps for prop_12345" → `dm comps prop_12345 --json`
- "CMA for 123 Main St within 3 miles, last year" → enrich address → `dm comps prop_xxx --radius 3 --timeframe 12months`
- "Compare values of these 5 properties" → `dm comps prop_1 prop_2 prop_3 prop_4 prop_5 --json`

### State DM10: List Management

**Symptoms:** User wants to save, organize, or manage lists of properties or people.
**Key Questions:**

- Do you want to create a new list or add to an existing one?
- Should the list be built from a search, or from specific IDs?
- Do you need to add or remove items from an existing list?
  **Interventions:**
- **Create from search results:** `dm lists create --name "My List" --body '{"filters": [...], "locations": [...]}'` (async, poll with `dm lists get <id>`)
- **Create from specific IDs:** `dm lists create --name "My List" --ids 101,202,303` (synchronous, max 250 IDs, returns completed immediately)
- **Create empty:** `dm lists create --name "My List"` then add items later
- **Search lists:** `dm lists search --search "keyword"` (FREE)
- **Add items:** `dm lists add <list_id> --ids 101,202,303`
- **Remove items:** `dm lists remove <list_id> --ids 101`
- **View items:** `dm lists items <list_id>`
- **Export:** `dm lists export <list_id> --fields estimated_value,owner_full_name`
- All list operations except export are FREE — no credits charged

---

## Diagnostic Process

### Step 1: Understand Intent

Parse the natural language request to determine:

- **What** they're looking for (properties, people, or specific entity)
- **Where** they're looking (location constraints)
- **What criteria** matter (filters)
- **What data** they need back (fields, contacts, properties)
- **What format** they want (table, JSON, specific fields)
- **How many searches** this requires — a single request may need multiple searches (e.g., "find high-equity properties and also recently sold ones" = two separate searches)

### Step 2: Fetch Available Filters and Fields (MANDATORY)

**ALWAYS run this before any search. No exceptions.** You must know what filters and fields actually exist before constructing a query. Never assume or guess a filter ID.

```bash
# Run these in parallel — both are FREE
dm filters --source-type properties --json
dm fields --source-type properties --json

# Or for people searches:
dm filters --source-type people --json
dm fields --source-type people --json
```

After fetching:

1. Read through the returned filters and fields
2. Map each piece of the user's natural language request to a real `filter_id` from the results
3. Identify the correct `operator` and `value` format for each filter
4. If a filter the user wants doesn't exist, tell them — don't fabricate one
5. If the user's request is ambiguous, use `dm filters --search "<keyword>"` to find the best match

**This step is non-negotiable.** The filter and field lists are the source of truth. Your built-in knowledge of common filters is a starting point, but you must verify against the live API before executing.

### Step 3: Plan Searches

Based on the user's intent and the available filters, plan which searches to run:

- **Single search:** Most requests map to one search with multiple filters (AND logic)
- **Multiple searches:** If the user wants OR-like combinations that can't be expressed in one query, plan separate searches. Examples:
  - "Properties worth over $1M OR with more than 5 bedrooms" → two searches, merge results
  - "Compare owner-occupied vs absentee in this ZIP" → two searches, present side by side
  - "Find properties and also the people who own them" → property search, then people enrichment on results
- **Sequential searches:** If one search informs the next (e.g., find properties → then get contacts for the top 10), plan the pipeline

Tell the user your plan: which searches, which filters, in what order.

### Step 4: Count First (FREE)

**ALWAYS** run a count before each search:

```bash
dm properties count --body '{"locations": [...], "filters": [...]}'
dm people count --body '{"locations": [...], "filters": [...]}'
```

This costs ZERO credits and tells you how many results match. If you're running multiple searches, count each one.

### Step 5: Confirm With User

Tell the user in natural language:

- What you're going to search for (restate their intent in your words)
- Which filters you're using and why
- How many results match each search
- How many credits it will cost total across all searches
- What data they'll get back

**Example confirmation:**

> "Here's my plan:
>
> 1. Search 1: Properties in 78704 worth $200K-$500K built before 1990 — 847 matches, ~25 credits for first page
> 2. Search 2: Properties in 78704 with >50% equity, absentee owners — 312 matches, ~25 credits for first page
>    Total: ~50 credits for first pages of both. Want me to proceed with both, or just one?"

### Step 6: Execute

Run the search(es):

```bash
dm properties search --body '{"locations": [...], "filters": [...], "per_page": 25}' --json
```

For multiple searches, run them and then combine, compare, or present results as appropriate to the user's original intent.

### Step 7: Format Results

Present results in the format the user requested. Default to a clean summary table. Always show credit usage from the response.

### Step 8: Follow Up

Ask if they want to:

- See more results (next page)
- Narrow the search (add filters)
- Enrich specific results (get contacts)
- Export in a different format

---

## Natural Language Translation Guide

### Location Parsing

| User Says                           | CLI Location                                                                        |
| ----------------------------------- | ----------------------------------------------------------------------------------- |
| "in Texas" / "in TX"                | `{"type": "state", "code": "TX"}`                                                   |
| "in ZIP 78704" / "in 78704"         | `{"type": "zip_code", "code": "78704"}`                                             |
| "within 5 miles of downtown Austin" | `{"type": "radius", "latitude": 30.2672, "longitude": -97.7431, "radius_miles": 5}` |
| "in Travis County"                  | `{"type": "county", "code": "48453"}` (need FIPS code)                              |

**Important:** When user gives a city name, convert to ZIP codes or radius. The API does not support city names directly — use a radius around the city center or the relevant ZIP codes.

### Common Filter Translations

| User Says                                | Filter                                                                                           |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------ |
| "worth over $500K" / "valued above 500K" | `{"filter_id": "estimated_value", "operator": "greater_than", "value": 500000}`                  |
| "worth between 200K and 500K"            | `{"filter_id": "estimated_value", "operator": "range", "value": {"min": 200000, "max": 500000}}` |
| "3+ bedrooms" / "at least 3 beds"        | `{"filter_id": "num_bedrooms", "operator": "greater_than_or_equal", "value": 3}`                 |
| "built before 1990"                      | `{"filter_id": "year_built", "operator": "less_than", "value": 1990}`                            |
| "owner-occupied"                         | `{"filter_id": "owner_occupied", "operator": "equals", "value": true}`                           |
| "absentee owners" / "not owner-occupied" | `{"filter_id": "owner_occupied", "operator": "equals", "value": false}`                          |
| "high equity" / "lots of equity"         | `{"filter_id": "estimated_equity_percentage", "operator": "greater_than", "value": 50}`          |
| "free and clear" / "no mortgage"         | `{"filter_id": "num_mortgages", "operator": "equals", "value": 0}`                               |
| "sold in the last year"                  | `{"filter_id": "last_sale_date", "operator": "relative_time", "value": "last_12_months"}`        |

**When unsure about a filter:** Run `dm filters --source-type properties --search "<keyword>" --json` to find matching filters. Always verify the filter exists before using it.

### Contact Audience Selection

| User Says                           | Audience            |
| ----------------------------------- | ------------------- |
| "find the owners" / "who owns this" | `owners`            |
| "owner and their family"            | `owners_and_family` |
| "who rents there" / "tenants"       | `renters`           |
| "who lives there" / "residents"     | `residents`         |
| "property only" / "no contacts"     | `none`              |

**Credit impact:** Property-shaped results cost 1 property data credit per property, and contacts in `contact_audience` consume people credits. If the user wants a Contact List, Phone List, or Email List, charge 1 people data credit per distinct contact even when property filters created the list.

**Best practice:** Use `contact_audience: "none"` whenever the user only needs property data. This omits contacts and consumes zero people credits. Use `owners` or another audience only when the user needs those people records.

### Export Defaults

For property criteria or property lists, export **property-owner contacts by default**, not property rows.

Default request shape:

```json
{
  "contact_audience": "owners",
  "anchor": "person"
}
```

Default columns should include owner/contact name, phone numbers, emails, and the associated property address. Use:

- `anchor: "phone"` for call lists
- `anchor: "email"` for email lists
- `anchor: "property"` only when the user explicitly asks for one row per property
- `contact_audience: "none"` only when the user explicitly asks to exclude contact info

Always run the free count first and confirm before large exports.

### Comps Request Translation

| User Says                                 | CLI Command                                                            |
| ----------------------------------------- | ---------------------------------------------------------------------- |
| "find comps for prop_12345"               | `dm comps prop_12345`                                                  |
| "what's this house worth?" (has address)  | Enrich address first, then `dm comps prop_xxx`                         |
| "CMA within 3 miles, last year"           | `dm comps prop_xxx --radius 3 --timeframe 12months`                    |
| "comparable sales including foreclosures" | `dm comps prop_xxx --include-foreclosures`                             |
| "top 50 closest comps"                    | `dm comps prop_xxx --limit 50 --sort-by distance --sort-direction asc` |
| "comps for multiple properties"           | `dm comps prop_111 prop_222 prop_333`                                  |

**Credit impact:** 1 property data credit per subject property. The comps themselves are free. Much cheaper than a property search.

---

## Credit System Reference

### What Costs Credits

| Operation                                           | Cost                                            |
| --------------------------------------------------- | ----------------------------------------------- |
| Property search (per property returned)             | 1 property data credit                          |
| Comps analysis (per subject property)               | 1 credit                                        |
| Person search (per person returned)                 | 1 people data credit                            |
| Contacts nested under property (`contact_audience`) | 1 people data credit per returned contact       |
| Property on person (`include_properties`)           | 1 credit each                                   |
| Enrichment match (address, phone, email, etc.)      | 1 data credit by result shape                   |
| Address validation (valid or corrected only)        | 1 property data credit                          |

### What's FREE

| Operation                                                         | Cost                |
| ----------------------------------------------------------------- | ------------------- |
| `dm properties count`                                             | FREE                |
| `dm people count`                                                 | FREE                |
| `dm filters`                                                      | FREE                |
| `dm fields`                                                       | FREE                |
| `dm usage`                                                        | FREE                |
| `dm account`                                                      | FREE                |
| `dm whoami`                                                       | FREE                |
| `dm activity search` / `dm activity get`                          | FREE                |
| `dm lists search` / `get` / `create` / `add` / `remove` / `items` | FREE                |
| Comps returned (only subject property costs)                      | FREE                |
| Re-accessing same entity in same billing cycle                    | FREE (deduplicated) |
| Enrichment with no match                                          | FREE                |
| Invalid address validation                                        | FREE                |
| Using `estimate_cost: true` on searches                           | FREE                |

### Credit Plans

| Plan    | Credits/Month |
| ------- | ------------- |
| Basic | 10,000/seat   |
| Pro     | 20,000/seat   |

### Credit-Saving Strategies

1. **Count before search** — Always use count endpoints first (free)
2. **Use `estimate_cost`** — Add to search body to preview cost without executing
3. **Choose the right output shape** — Property results charge per property and returned contact; flattened contact lists charge per contact
4. **Page small** — Start with `per_page: 10` to sample results before pulling more
5. **Leverage deduplication** — Same entity in same billing month costs nothing extra
6. **Use filters aggressively** — Narrow results before executing to avoid wasted credits
7. **Validate addresses first** — Invalid addresses don't cost credits; validate before enriching
8. **Batch operations** — Enrichment endpoints accept up to 1,000 items per request

---

## CLI Command Reference

### Authentication

```bash
dm login                        # Browser OAuth device flow
dm login --key dm_sk_live_xxx   # Direct API key
dm login --no-browser           # Show code without opening browser
dm logout                       # Remove stored credentials
dm whoami                       # Show auth status
dm whoami --verify              # Verify credentials with API
```

### Account & Usage

```bash
dm account                # Account info
dm account --json         # Account info as JSON
dm usage                  # Credit usage for current billing cycle
dm usage --json           # Credit usage as JSON
```

### Properties

```bash
# Count (FREE)
dm properties count --body '{"locations": [...], "filters": [...]}'
dm properties count -f search.json

# Search (costs credits)
dm properties search --body '{"locations": [...], "filters": [...]}'
dm properties search -f search.json
dm properties search -f search.json --json

# Get by ID
dm properties get prop_12345
dm properties get prop_12345 --contact-audience owners
dm properties get prop_12345 --json

# Get multiple by IDs
dm properties ids prop_12345 prop_67890
dm properties ids --body '{"ids": ["prop_12345", "prop_67890"]}'
```

### Comps (Comparable Sales)

```bash
# Basic comps (1 property data credit per subject property, comps are free)
dm comps prop_12345
dm comps prop_12345 --json

# Multiple properties
dm comps prop_12345 prop_67890

# Custom search radius
dm comps prop_12345 --radius 3

# Custom timeframe
dm comps prop_12345 --timeframe 12months

# Custom limit and sort
dm comps prop_12345 --limit 50 --sort-by price --sort-direction asc

# Include foreclosures
dm comps prop_12345 --include-foreclosures

# Full control via JSON body
dm comps --body '{"property_ids": ["prop_12345"], "location": {"type": "radius", "radius_miles": 2}, "criteria": {"timeframe": "12months", "limit": 50}}'
```

### People

```bash
# Count (FREE)
dm people count --body '{"locations": [...], "filters": [...]}'
dm people count -f search.json

# Search (costs credits)
dm people search --body '{"locations": [...], "filters": [...]}'
dm people search -f search.json

# Get by ID
dm people get per_12345
dm people get per_12345 --include-properties

# Get multiple by IDs
dm people ids per_12345 per_67890
```

### Enrichment

```bash
# By address
dm enrich address "123 Main St, Austin TX 78704"
dm enrich address --body '{"data": [{"full_address": "123 Main St, Austin TX"}]}'
dm enrich address "123 Main St, Austin TX" --contact-audience owners

# By coordinates
dm enrich latlng "30.2598,-97.7544"
dm enrich latlng --contact-audience owners

# By APN
dm enrich apn "12345678"

# By email
dm enrich email "john@example.com"
dm enrich email "john@example.com" --include-properties

# By phone
dm enrich phone "5551234567"
dm enrich phone "5551234567" --include-properties

# By name
dm enrich name "John Smith"
dm enrich name "John Smith" --state TX
dm enrich name "John Smith" --zip 78704
dm locations search -q "Austin" --type city --state TX --json
dm enrich name "John Smith" --city 7333 --estimate-cost
dm enrich name "Smith"                       # Last name only
dm enrich name "John Smith" --include-properties
```

### Discovery (FREE)

```bash
dm filters                                    # All filters
dm filters --source-type properties           # Property filters only
dm filters --source-type people               # People filters only
dm filters --search "equity"                  # Search filters by name
dm filters --json                             # JSON output

dm fields                                     # All fields
dm fields --source-type properties            # Property fields
dm fields --search "bedroom"                  # Search fields by name
```

### Address Validation

```bash
dm addresses validate "123 Main St, Austin TX"
dm addresses validate -f addresses.json
dm addresses validate --body '{"data": [{"full_address": "123 Main St"}]}'
```

### Lists (FREE except export)

```bash
# Search lists (FREE)
dm lists search                               # All lists
dm lists search --search "Austin"             # Search by name
dm lists search --source-type properties      # Filter by type

# Create a list
dm lists create --name "My List"                            # Empty list
dm lists create --name "My List" --ids 101,202,303          # Pre-populated (max 250, synchronous)
dm lists create --name "My List" --body '{"filters": [...], "locations": [...]}'  # From search (async)

# Get list details (FREE)
dm lists get <list_id>
dm lists get <list_id> --json

# Update / Delete
dm lists update <list_id> --name "New Name"
dm lists delete <list_id>

# Add / Remove items (FREE)
dm lists add <list_id> --ids 101,202,303
dm lists add <list_id> --ids 101,202 --id-type internal_person_id
dm lists remove <list_id> --ids 101

# View items (FREE)
dm lists items <list_id>
dm lists items <list_id> --page 2 --per-page 50

# Export (costs credits; property lists default to owner contacts)
dm lists export <list_id>
dm lists export <list_id> --anchor person
dm lists export <list_id> --fields estimated_value,owner_full_name --anchor property
```

### Activity (FREE)

```bash
dm activity search                            # All recent activity
dm activity search -t search_properties       # Filter by type
dm activity search -q "Austin"                # Free-text search
dm activity get act_12345                     # Specific activity record
```

### Configuration

```bash
dm config get                     # All config values
dm config get apiKey              # Specific value
dm config set apiEnvironment local    # Set environment
dm config path                    # Show config file path
```

### Global Options

Every command supports:

- `--json` — Raw JSON output (machine-readable)
- `--help` — Command-specific help

### Input Methods (for search/enrichment)

1. **Positional argument:** `dm enrich address "123 Main St"` (single item, quick)
2. **Inline JSON:** `dm properties search --body '{"locations": [...]}'`
3. **JSON file:** `dm properties search -f search.json`
4. **Stdin pipe:** `cat search.json | dm properties search`

---

## Search Request Format

### Property Search Body

```json
{
  "locations": [{ "type": "zip_code", "code": "78704" }],
  "filters": [
    {
      "filter_id": "estimated_value",
      "operator": "range",
      "value": { "min": 200000, "max": 500000 }
    },
    { "filter_id": "num_bedrooms", "operator": "greater_than_or_equal", "value": 3 }
  ],
  "fields": ["estimated_value", "year_built", "living_area_sqft"],
  "contact_audience": "owners",
  "page": 1,
  "per_page": 25,
  "sort": [{ "field_id": "estimated_value", "direction": "desc" }]
}
```

### People Search Body

```json
{
  "locations": [{ "type": "state", "code": "TX" }],
  "filters": [{ "filter_id": "estimated_value", "operator": "greater_than", "value": 500000 }],
  "property_match": "owner",
  "page": 1,
  "per_page": 25
}
```

### Filter Logic

- **Locations:** OR logic (match if in ANY location)
- **Filters:** AND logic (ALL filters must match)
- For OR-like behavior within a filter, use `contains_any` or `any_of` operators

### Filter Types & Operators

**NUMBER filters:** `range` (min/max), `greater_than`, `greater_than_or_equal`, `less_than`, `less_than_or_equal`, `equals`, `not_equals`

**STRING filters:** `contains`, `any_of`, `starts_with`, `ends_with`, `equals`, `not_equals`, `not_contains`

**DATE filters:** `date_range` (start_date/end_date), `is_after`, `is_before`, `equals`, `relative_time`

**MULTI_SELECT filters:** `contains_any`, `contains_none`, `contains_all`

**BOOLEAN filters:** No operator needed — just pass `true` or `false` as value

---

## Enrichment Batch Format

### Address Batch

```json
{
  "data": [
    { "full_address": "123 Main St, Austin TX 78704" },
    { "street": "456 Oak Ave", "city": "Dallas", "state": "TX", "zip": "75201" }
  ],
  "contact_audience": "owners"
}
```

### Phone Batch

```json
{
  "data": [{ "phone": "5551234567" }, { "phone": "5559876543" }],
  "include_properties": true
}
```

### Name Search

```json
{
  "data": [{ "last_name": "Smith", "first_name": "John" }],
  "location": { "type": "state", "code": "TX" },
  "include_properties": false,
  "page": 1,
  "per_page": 25
}
```

All enrichment endpoints accept up to **250 items** per request. The CLI auto-batches larger inputs.

---

## Response Reading Guide

### Credits Object

Every credit-consuming response includes:

```json
{
  "credits": {
    "used": 27,
    "properties": 25,
    "people": 20,
    "deduplicated": 3
  }
}
```

- `used` — total credits consumed this request
- `people` — contacts included under property leads and charged as people credits
- `deduplicated` — credits saved because entity was accessed earlier this billing cycle

### Pagination

```json
{
  "page": 1,
  "per_page": 25,
  "total_results": 847,
  "total_pages": 34,
  "has_next_page": true,
  "has_previous_page": false
}
```

### Always-Included Property Fields

These fields are always returned, even without requesting `fields`:

- `dm_property_id`, `full_address`, `address`, `unit`, `city`, `state`, `zip`
- `latitude`, `longitude`
- `images` (street_view, satellite, roadmap URLs)

### Always-Included Person Fields

- `dm_person_id`, `full_name`, `first_name`, `last_name`
- `phones` (array: number, type, do_not_call)
- `emails` (array: address)
- `residence` (address, city, state, zip, full_address)

---

## Multi-Step Workflow Examples

### Example 1: Build a Mailing List

**User:** "Find absentee owners with high equity in Austin 78704 and get their contact info"

**Workflow:**

1. Count: `dm properties count --body '{"locations": [{"type": "zip_code", "code": "78704"}], "filters": [{"filter_id": "owner_occupied", "operator": "equals", "value": false}, {"filter_id": "estimated_equity_percentage", "operator": "greater_than", "value": 50}]}'`
2. Report: "Found 312 absentee-owned properties with >50% equity in 78704. Getting first 25 with owner contacts would cost ~75-175 credits depending on contacts per property. Proceed?"
3. Execute: `dm properties search --body '...' --json`
4. Format as mailing list (name, mailing address)

### Example 2: Look Up a Specific Property

**User:** "Who owns 742 Evergreen Terrace, Springfield?"

**Workflow:**

1. Enrich: `dm enrich address "742 Evergreen Terrace, Springfield" --contact-audience owners --json`
2. Cost: 1 credit for property + 1 per owner found
3. Present: Owner name, phone, email, property details

### Example 3: Reverse Phone Lookup

**User:** "Who is 555-123-4567?"

**Workflow:**

1. Enrich: `dm enrich phone "5551234567" --include-properties --json`
2. Cost: 1 credit for person + 1 per property
3. Present: Person's name, other phones, emails, associated properties

### Example 4: Market Analysis (Credit-Efficient)

**User:** "How many homes worth over $1M are in Travis County?"

**Workflow:**

1. Count only: `dm people count --body '{"locations": [{"type": "county", "code": "48453"}], "filters": [{"filter_id": "estimated_value", "operator": "greater_than", "value": 1000000}]}'`
2. Cost: FREE — count endpoints don't consume credits
3. Present: "There are 4,231 properties valued over $1M in Travis County."

### Example 5: Batch Enrichment

**User:** "Look up these 50 addresses from my file"

**Workflow:**

1. Read the file to count addresses
2. Report: "50 addresses. This will cost up to 50 credits for property data (less if some don't match). Add contacts?"
3. Execute: `dm enrich address -f addresses.json --json`
4. Report matches vs. no-matches and credits used

### Example 6: Property Valuation / CMA

**User:** "What's 742 Evergreen Terrace worth? Show me the comps."

**Workflow:**

1. Enrich: `dm enrich address "742 Evergreen Terrace, Springfield" --json` → get `prop_xxx` (1 credit)
2. Comps: `dm comps prop_xxx --json` (1 credit for subject)
3. Present: value estimation with confidence interval, summary stats (avg price, median, $/sqft), and comp table
4. Total cost: 2 credits

### Example 7: Investor ARV Analysis

**User:** "Find comps for this flip within 2 miles, only recent sales, no foreclosures"

**Workflow:**

1. Get property ID (enrich if needed)
2. Run: `dm comps prop_xxx --radius 2 --timeframe 6months --json`
3. The default excludes foreclosures, so no extra flag needed
4. Present value estimation as the ARV, highlight price per sqft for renovation budgeting

### Example 8: Save Search Results to a List

**User:** "Save those properties to a list called 'Austin Targets'"

**Workflow:**

1. Collect property IDs from the previous search results (up to 250)
2. Create: `dm lists create --name "Austin Targets" --ids 101,202,303,...` (synchronous, returns completed)
3. Cost: FREE — no credits charged for list creation
4. Present: list ID, name, total count, and link

### Example 9: Build a Large List from Filters

**User:** "Create a list of all properties in 78704 with >50% equity"

**Workflow:**

1. Count first: `dm properties count --body '{"locations": [...], "filters": [...]}'` (FREE)
2. Report: "Found 2,341 matches. Creating a list is free. Proceed?"
3. Create: `dm lists create --name "High Equity 78704" --body '{"filters": [...], "locations": [...]}'` (async)
4. Poll: `dm lists get <list_id> --json` until status is `"completed"`
5. Cost: FREE — list creation doesn't consume credits. Credits only charged at export time.
