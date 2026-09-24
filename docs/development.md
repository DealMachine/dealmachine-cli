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

For local API work, start the API in its owning checkout, then use `DM_API_URL=http://localhost:3001/v1 npm start -- account`. Supply your development API key through the approved local environment or `dm login`; never commit it. Normal local build and tests need no credentials. Production Commands can read or mutate live data and consume credits, so choose an environment deliberately.

The public agent plugin manifests and `skills/dealmachine` are retained in this repository. The hosted MCP server is a separate service. This extraction does not make MCP implementation or docs-site deployment part of CLI publication.

From Factory, use `npm run setup:cli`, `npm run dev:cli`, `npm run cli:check` and `npm run cli:test:package`. Factory's `where cli` locates this checkout and `scripts cli` discovers its npm scripts. Read [releases](releases.md) before publishing.
