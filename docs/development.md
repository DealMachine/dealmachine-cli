# CLI development

This repository is the source of truth for the public CLI. Next consumes its built npm package. Private beta extensions remain in Next's `packages/cli-private`; do not move those files into this public repository.

```sh
npm ci
npm run check
npm run test:package
npm run dev
```

`build` creates JavaScript, declarations and source maps in `dist`, cleaning old output first. It runs the installed TypeScript compiler through Node so it also works on Windows without relying on a shell shim. It bundles `playbook/PLAYBOOK.md` for offline agent onboarding. `dev` watches TypeScript; run `build` once before the watcher and again after changing the Playbook. From a second terminal, run `npm start -- --help` or `npm start -- agents playbook`.

The [Command reference](commands.md) describes CLI usage and JSON output. Tests under `tests/` exercise request behavior and output. `test:package` installs both npm archives into an empty temporary project and checks the executable, module import and project-local Claude Code Playbook installation. It does not write to your personal agent setup or call the API.

For local API work, start the API in its owning checkout, then use `DM_API_URL=http://localhost:3001/v1 npm start -- account`. Supply your development API key through the approved local environment or `dm login`; never commit it. Normal local build and tests need no credentials. Production Commands can read or mutate live data and consume credits, so choose an environment deliberately.

The public agent plugin manifests and `skills/dealmachine` are retained in this repository. The hosted MCP server is a separate service. This extraction does not make MCP implementation or docs-site deployment part of CLI publication.

From Factory, use `npm run setup:cli`, `npm run dev:cli`, `npm run cli:check` and `npm run cli:test:package`. Factory's `where cli` locates this checkout and `scripts cli` discovers its npm scripts. Read [releases](releases.md) before publishing.

`npm run smoke:live:coverage` adds version and filter checks plus request-header and read-only relay assertions. It requires the same approved QA target and key, rejects non-HTTPS remote targets and non-plain `/v1` bases, and explicitly disables the OS credential store in child processes. Its built-CLI integration test uses a synthetic local API and runs in routine CI on Ubuntu with Node 22 and 24. It checks missing credentials, request authentication, unchanged caller settings and temporary-directory cleanup, including paths with spaces and `#`. The isolation module is loaded by file URL so Windows drive letters and URL-significant path characters work. Factory runs the registered live smoke against staging with its approved QA workspace reserved for the run. Full macOS and Windows verification is performed separately by the authorized local coding session or an approved platform runner; routine CI uses no live credentials.
