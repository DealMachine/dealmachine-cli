# npm releases

`@dealmachine/cli` is the implementation and `dealmachine` is the short install alias. Both are public on npmjs.org. They have the same version; the alias pins the exact implementation version. The runtime version in `src/version.ts` is updated with the package manifests, and the packed consumer check verifies it. Agent plugin and hosted MCP manifest versions follow their own release lifecycle.

## Automatic production publication

Every push to this public repository's `master` runs `publish-npm.yml`, named **Publish CLI to npm**. The **Publish production CLI packages** job builds, checks, installs and publishes both packages to `latest`, then verifies their source SHA, integrity and distribution tags through the public registry. Factory observes that job for production build and release tracking. A failed or incomplete pair is not a successful deployment. Source merges, publication and any subsequent production regression are separate evidence.

The committed stable version, initially `0.4.0`, sets the minimum release version. When that version or a later stable version already exists in either package, the workflow selects the next patch after the highest stable version. For example, a committed `0.4.0` with published `0.4.10` produces `0.4.11`. Set and commit a higher minor or major version with `release:version` when the change warrants it. Automatic publishing refuses a prerelease baseline.

The job updates the version only in its temporary build checkout. Both npm manifests contain `dealmachineRelease.sourceSha`; the workflow does not create a source commit or Git tag. The source version is a floor, so it can differ from an installed package's actual runtime version. The receipt and published metadata identify the exact source and package versions.

Releases run serially. A job whose source is no longer current `master` stops before publication. Re-running the current commit discovers any package already published for that SHA, rebuilds and compares its integrity, then publishes only the missing package. A conflicting source, changed bytes, multiple versions for one source, or a newer published stable version stops the retry. The workflow never overwrites immutable npm versions or silently moves `latest` backward.

The workflow retains both archives and `release.json` under the `cli-release-<sha>-<attempt>` GitHub artifact for 90 days, including evidence available after a failure. The receipt has source SHA, workflow run ID, version, channel, integrity digests and a `verified` result. A successful job requires verification of both packages. The run summary links to both exact npm versions.

## One-time access setup

For **both** npm package settings, configure a GitHub trusted publisher with these exact values:

| Setting | Value |
| --- | --- |
| Organization | `DealMachine` |
| Repository | `dealmachine-cli` |
| Workflow filename | `publish-npm.yml` |
| Environment | `npm` |
| Allowed action | Direct publication with `npm publish` |

Create the GitHub `npm` environment and restrict deployment branches to `master`. For unattended publication on a reviewed master merge, this environment must not require a second manual review. Repository branch review and checks remain the source approval gate. Do not weaken an existing environment rule without the release owner's approval.

The job uses GitHub-hosted Ubuntu, Node 24, npm 11.5.1 or later, and `id-token: write`. No npm token belongs in GitHub secrets or chat. Trusted publication from this public repository supplies npm provenance. npm package-owner access is needed for the publisher setup, which cannot be verified from public package metadata. See [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/).

After setup and merge, recover the current `master` release with:

```sh
gh workflow run publish-npm.yml --repo DealMachine/dealmachine-cli --ref master
```

Do not dispatch an older run to roll back a release. If registry access is missing, the run fails and preserves its built artifacts; configure the access above and rerun the current master workflow.

## Validate without publication

```sh
npm run release:auto:dry-run
```

This reads public registry metadata, selects the candidate version, runs `check` and `test:package`, and calls `npm publish --dry-run` on each unpublished archive. It restores local version files, publishes nothing and leaves artifacts under ignored `artifacts/<version>/`. It does not prove npm publishing permission.

For an explicit local prerelease or manually selected version:

```sh
npm run release:version -- 0.5.0-rc.1
npm run release:dry-run -- --tag next
npm run release:pack
# Only with authorized release scope, a clean committed checkout and npm access:
npm run release:publish -- --tag next
```

The manual commands retain an explicit `next` or `latest` channel; prereleases cannot use `latest`. Do not merge a prerelease version into master because its automatic production job requires a stable version. Do not run manual publication concurrently with the automatic workflow.

## Verify and recover

```sh
npm view @dealmachine/cli dist-tags --json
npm view dealmachine dist-tags --json
npx --yes --package=dealmachine@0.4.0 dm --version
npx --yes --package=dealmachine@0.4.0 dm agents playbook
```

Replace `0.4.0` with the exact version from the release receipt. `eval:cold-start:published` checks the default npm channel; `eval:cold-start:deployed` checks the hosted docs independently. A package release does not deploy API, MCP, Next or the documentation site.

The two npm uploads are separate operations. If the alias upload fails, the implementation may already be available; keep the workflow failed until both are verified. Retry the current master workflow to reuse the same source version and verify its bytes. If the source has moved, its next release can publish a new pair, while the partial version remains available for diagnosis. If bytes differ on a retry, retain the original archive and receipt for an owner; do not bypass the integrity check.

An authorized rollback moves both distribution tags to the previous verified version, then verifies fresh installs. Existing installed versions do not change. The automated publisher never performs that rollback. After a rollback, a new reviewed master commit receives a higher version, even though `latest` points backward. Moving a tag does not rename an immutable package version.
