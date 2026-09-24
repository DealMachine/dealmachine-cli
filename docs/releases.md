# npm releases

`@dealmachine/cli` is the implementation and `dealmachine` is the short install alias. Both are public on npmjs.org. They must have the same version; the alias pins the exact implementation version. The version command also updates `src/version.ts`, and packed-install checks verify the reported version against the manifest. Agent plugin and hosted MCP manifest versions follow their own release lifecycle.

The extraction candidate is `0.4.0-rc.1`; `0.3.0` remains the published baseline until a new release runs. Review the newly moved Commands against the intended API environment before promoting a stable release.

```sh
npm run release:version -- 0.4.0-rc.1
npm run release:dry-run -- --tag next
```

The version command updates both manifests, the runtime version and the canonical lockfile without creating a Git tag. The dry run executes checks, installs both packed archives in a clean consumer, and calls `npm publish --dry-run`. It does not publish. `release:pack` performs the same validation and leaves archives plus a `release.json` integrity record in ignored `artifacts/<version>/`.

For a local approved release, commit the reviewed changes and use:

```sh
npm run release:publish -- --tag next
```

Publishing requires a clean checkout, authenticated npm access and an explicit `next` or `latest` tag. Prereleases cannot use `latest`. The implementation is published before the alias. Both uploads are independent registry operations: if the second fails, verify the first package's published integrity against `artifacts/<version>/release.json`, then publish only the matching alias archive with `npm publish artifacts/<version>/dealmachine-<version>.tgz --access public --registry https://registry.npmjs.org --tag next`. Do not rebuild or replace an already published version.

## GitHub publishing

The manual `publish-npm.yml` workflow runs only from `master`, checks the requested version, validates the packages and publishes through npm trusted publishing. It uses the GitHub environment `npm` and an OIDC token. It is not triggered by a normal commit or merge.

For **both** npm package settings, configure a GitHub trusted publisher with organization `DealMachine`, repository `dealmachine-cli`, workflow filename `publish-npm.yml`, environment `npm`, and permission to publish. Configure the GitHub `npm` environment with the team's release reviewers. Do not add tokens to the repository. npm requires CLI 11.5.1+ and Node 22.14+; the workflow uses Node 24. See [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/).

After the source PR is reviewed and merged, an authorized maintainer can dispatch:

```sh
gh workflow run publish-npm.yml --repo DealMachine/dealmachine-cli --ref master -f version=0.4.0-rc.1 -f channel=next
```

To publish a stable version, set a new stable version, rerun validation, merge the reviewed change and dispatch with `channel=latest`. Removing `-rc` creates a new artifact; moving a tag does not rename a version. Never overwrite an existing npm version.

## Verify and recover

```sh
npm view @dealmachine/cli dist-tags --json
npm view dealmachine dist-tags --json
npx --yes --package=dealmachine@0.4.0-rc.1 dm --version
npx --yes --package=dealmachine@0.4.0-rc.1 dm agents playbook
```

Use exact versions for release verification. `eval:cold-start:published` checks the existing default npm channel; it does not select a prerelease automatically. `eval:cold-start:deployed` checks the hosted docs surface and can fail independently of a valid CLI package.

Rollback means moving the affected distribution tags for both packages back to the previously verified version, then verifying new installs. Existing installed versions do not change automatically. Publishing this client does not deploy the API, MCP, Next application, or docs site.
