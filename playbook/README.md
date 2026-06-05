# @dealmachine/playbook

Claude Code skill manifest for DealMachine property intelligence workflows.

## What's Inside

This package is a **pure specification** -- it contains no executable code. The single file `SKILL.md` defines a Claude Code skill (Playbook) that translates natural language requests into DealMachine CLI commands.

| File | Description |
|------|-------------|
| `SKILL.md` | Full skill manifest with states, workflows, CLI reference, and credit system |

## How It Works

When a user installs this skill in Claude Code, the Playbook enables natural language property intelligence. It auto-activates on trigger phrases like "who owns...", "find properties in...", "what's this worth...", and any mention of real estate data.

### Example interactions

- "Who owns 742 Evergreen Terrace?" -- enriches the address, returns owner contacts
- "Find high-equity properties in 78704" -- counts first (free), confirms credits, then searches
- "Build a mailing list of absentee owners in Austin" -- multi-step workflow with cost tracking
- "What's this house worth? Show me the comps." -- enriches address, runs comps analysis
- "Reverse lookup this phone number" -- enriches phone, returns person and properties
- "How many homes over $1M in Travis County?" -- runs a free count, no credits

### Diagnostic process

Every request follows a strict 8-step flow:

1. Understand intent (what, where, criteria, format)
2. Fetch available filters and fields (mandatory, never guess filter IDs)
3. Plan searches (single, multiple, or sequential)
4. Count first (free)
5. Confirm with user (restate intent, show credit estimate)
6. Execute
7. Format results
8. Follow up (next page, narrow, enrich, export)

### States

The Playbook operates through 11 defined states:

| State | Name | Purpose |
|-------|------|---------|
| DM0 | Not Authenticated | Guides user to run `dm login` |
| DM1 | Discovery | Helps explore available filters and fields |
| DM2 | Property Search | Builds and executes property searches |
| DM3 | People Search | Builds and executes people searches |
| DM4 | Property Enrichment | Looks up properties by address/coords/APN |
| DM5 | Person Enrichment | Looks up people by name/phone/email |
| DM6 | Address Validation | Validates/standardizes addresses via USPS |
| DM7 | Multi-Step Workflow | Chains operations (find -> enrich -> export) |
| DM8 | Credit Management | Checks usage, optimizes spend |
| DM9 | Comps Analysis | Finds comparable sales, estimates values |
| DM10 | List Management | Creates, builds, and manages saved lists |

### Core Principle

> Never spend a credit without the user knowing exactly what they're getting and what it costs. Count first, confirm second, execute third.

## SKILL.md Structure

The manifest is organized into these sections:

| Section | What it covers |
|---------|---------------|
| Metadata | Skill name, version, license |
| When to Use | Trigger phrases and auto-activation rules |
| The States | 11 states with symptoms, key questions, and interventions |
| Diagnostic Process | 8-step flow from intent parsing to follow-up |
| Natural Language Translation | Location parsing, filter mapping, audience selection |
| Credit System Reference | What costs credits, what is free, credit-saving strategies |
| CLI Command Reference | Full `dm` command catalog with examples |
| Search Request Format | JSON body structure for property/people searches |
| Multi-Step Workflow Examples | 9 end-to-end examples (mailing list, reverse lookup, CMA, etc.) |

## Dependencies

**Depends on:** Nothing (pure markdown specification)

**Requires at runtime:** `@dealmachine/cli` must be installed and authenticated (`dm login`)
