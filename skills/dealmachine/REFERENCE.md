# DealMachine interface reference

This reference matches DealMachine CLI and hosted MCP 0.3.0.

## Hosted MCP Tools

Use these exact Tool IDs. Do not pluralize `property`.

### Discovery and account

- `dealmachine_filters`
- `dealmachine_fields`
- `dealmachine_location_search`
- `dealmachine_usage`
- `dealmachine_whoami`

### Property intelligence

- `dealmachine_property_count`
- `dealmachine_property_search`
- `dealmachine_property_get`
- `dealmachine_property_get_many`
- `dealmachine_property_export`
- `dealmachine_comps`

### People intelligence

- `dealmachine_people_count`
- `dealmachine_people_search`
- `dealmachine_people_get`
- `dealmachine_people_get_many`

People export is available through the CLI.

### Enrichment

- `dealmachine_enrich_address`
- `dealmachine_enrich_latlng`
- `dealmachine_enrich_apn`
- `dealmachine_enrich_email`
- `dealmachine_enrich_phone`
- `dealmachine_enrich_name`

## CLI command map

Run `dm <command> --help` for options and examples. Prefer `--json` for automation.

### Authentication and account

- `dm login`, `dm logout`, `dm signup`
- `dm whoami`, `dm account`, `dm usage`
- `dm plans`, `dm checkout`
- `dm subscription status`
- `dm config get|set|path`

### Data discovery and research

- `dm filters`, `dm fields`
- `dm locations search|autocomplete|get`
- `dm properties search|count|get|ids|export`
- `dm people search|count|get|ids|export`
- `dm enrich address|latlng|apn|email|phone|name`
- `dm comps`
- `dm addresses autocomplete|validate`
- `dm phones dnc`

### Lists, exports, and activity

- `dm lists search|create|get|update|delete|build|import|items|add|remove|export`
- `dm exports list|get`
- `dm activity search|get`

### Task operations

- `dm tasks list|get|create|update|delete`

### Direct mail

- `dm mail campaigns list|create|get|update|delete|send|pause|resume|recipients|analytics|cost-estimate`
- `dm mail designs list|create|get|update|delete`
- `dm mail return-addresses list|create|get|update|delete|set-default`
- `dm mail wallet balance|add-funds|transactions|pricing`
- `dm mail settings get|update`
- `dm mail analytics summary|timeseries`

### Developer utilities

- `dm agents`, `dm agents guide`, `dm agents playbook`
- `dm dev license add|list|remove`
