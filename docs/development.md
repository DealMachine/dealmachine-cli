# CLI development

This repository is the source of truth for the public CLI. Next consumes its built npm package. Private beta extensions remain in Next's `packages/cli-private`; do not move those files into this public repository.

```sh
npm ci
npm run check
npm run test:package
npm run dev
```

`build` creates JavaScript, declarations and source maps in `dist`, cleaning old output first. It bundles `playbook/PLAYBOOK.md` for offline agent onboarding. `dev` watches TypeScript; run `build` once before the watcher and again after changing the Playbook. From a second terminal, run `npm start -- --help` or `npm start -- agents playbook`.

The [Command reference](commands.md) describes CLI usage and JSON output. Tests under `tests/` exercise request behavior and output. `test:package` installs both npm archives into an empty temporary project and checks the executable, module import and project-local Claude Code Playbook installation. It does not write to your personal agent setup or call the API.

For local API work, start the API in its owning checkout, then use `DM_API_URL=http://localhost:3001/v1 npm start -- account`. Supply your development API key through the approved local environment or `dm login`; never commit it. Normal local build and tests need no credentials. `npm run smoke:live:coverage` runs the built binary against a real API with `DM_API_URL` and `DM_API_KEY`, using only read-only, credit-free Commands and a temporary home directory; see the README's Testing section. Production Commands can read or mutate live data and consume credits, so choose an environment deliberately.

The public agent plugin manifests and `skills/dealmachine` are retained in this repository. The hosted MCP server is a separate service. This extraction does not make MCP implementation or docs-site deployment part of CLI publication.

From Factory, use `npm run setup:cli`, `npm run dev:cli`, `npm run cli:check` and `npm run cli:test:package`. Factory's `where cli` locates this checkout and `scripts cli` discovers its npm scripts. Read [releases](releases.md) before publishing.

Every `master` push runs the production npm workflow; its publishing job stays skipped until `PRODUCTION_DEPLOY_ENABLED` is explicitly set to `true` during authorized commissioning. `npm run release:auto:dry-run` reads the public registry, chooses the version, validates both package archives and simulates publication without changing the registry. It restores the local version files after the run. Published packages record their exact source SHA; the automatic version does not create a source commit or tag.

## Service regression checks

`test:package` is the candidate smoke suite. It tests both installed npm names, command discovery, module import, Playbook installation, list request behavior and the live-smoke protocol against a local HTTP fixture, including credit-free estimates and authentication rejection. It runs in PR CI and needs no API key.

`npm run smoke:live` requires explicit `DM_API_URL` ending in `/v1` and `DM_API_KEY` for an approved QA workspace. It builds this candidate and runs real Commands for account identity, field discovery and a credit-free property estimate. It isolates configuration and the credential store, removes its temporary files and does not read your saved login. Missing configuration exits 2; a failed request or response assertion exits 1. It does not prove writes, paid data, OAuth consent, every Command or the published npm version.

Factory registers these as `cli:test:package` and `cli:smoke:live`. Keep executable checks here and the shared regression case, reviewed source version, runner delivery and private credentials in Factory. When adding or changing a Command, assess both suites and update the relevant public behavior check alongside its acceptance criteria. A local fixture pass never substitutes for an authenticated live result.

`npm run smoke:live:coverage` adds version and filter checks plus request-header and read-only relay assertions. It requires the same approved QA target and key, rejects non-HTTPS remote targets and non-plain `/v1` bases, and explicitly disables the OS credential store in child processes. Its built-CLI integration test uses a synthetic local API and runs in CI on Linux, macOS and Windows with Node 22 and 24. It checks missing credentials, request authentication, unchanged caller settings and temporary-directory cleanup, including paths with spaces and `#`. The isolation module is loaded by file URL so Windows drive letters and URL-significant path characters work. Authenticated live staging remains a separate operator check with the approved QA workspace reserved for the run; CI uses no live credentials.
