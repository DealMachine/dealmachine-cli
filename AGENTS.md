# DealMachine CLI

This repository owns the public `@dealmachine/cli` package, the `dealmachine` npm alias, and the existing agent plugin assets. Start with [development](docs/development.md), [releases](docs/releases.md), and the [Command reference](docs/commands.md).

Use `codex/` task branches and PRs into `master`. Inspect Git status before editing and preserve unrelated work. Node.js 22.18 or newer is recommended for development; the shipped CLI supports Node.js 18 and newer.

Public Commands live in `src/commands`; HTTP, configuration and output helpers live in `src/lib`. Keep ESM `.js` import extensions in TypeScript. The repository builds independently with `npm ci` and `npm run check`. No Next checkout, database or API credentials are needed for those checks.

Do not copy private beta Commands, private references, application credentials or backend source from Next into this public repository. Next's private CLI extends the installed npm artifact. Keep the public artifact guard and packed-install check passing. The bundled CLI Playbook lives at `playbook/PLAYBOOK.md`; the existing MCP-oriented agent plugin lives under `skills/dealmachine`. They have different execution surfaces.

Use the existing behavioral tests for changed Commands. Run `npm run check` and `npm run test:package` for packaging or release changes. Cold-start published/deployed evaluations contact external services and are separate release verification.

Set versions with `npm run release:version -- <version>` so the canonical package, alias and lockfile agree. A release requires an explicit channel and approved release scope. Publishing the CLI does not deploy the API, MCP server, docs site or Next app.

Call CLI capabilities Commands, API capabilities Endpoints, and distributable agent instructions Playbooks. Write concrete copy and do not add em dashes to docs or comments.
