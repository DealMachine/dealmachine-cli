import assert from 'node:assert/strict';

export const releasePackages = ['@dealmachine/cli', 'dealmachine'];
const stable = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const compare = (left, right) => {
  const a = left.split('.').map(Number);
  const b = right.split('.').map(Number);
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
};

// Registry metadata makes a retry recover the version already published for this commit.
export function planRelease(baseVersion, sourceSha, registries) {
  assert(stable.test(baseVersion), 'Automatic production releases require a stable committed version.');
  assert(/^[a-f0-9]{40}$/.test(sourceSha), 'A full Git source SHA is required.');
  const versions = releasePackages.flatMap(name => Object.entries(registries[name].versions ?? {}));
  const matching = [...new Set(versions.filter(([, value]) => value.dealmachineRelease?.sourceSha === sourceSha).map(([version]) => version))];
  assert(matching.length <= 1, 'This source has multiple published versions. An owner must reconcile the registry.');
  const stableVersions = versions.map(([version]) => version).filter(version => stable.test(version)).sort(compare);
  const highest = stableVersions.at(-1);
  let version = matching[0];
  if (version) {
    assert(stable.test(version), 'This source was published as a prerelease; production needs a new reviewed commit.');
    assert(!highest || compare(version, highest) >= 0, 'A newer version already exists. Refusing to move latest backward.');
    for (const name of releasePackages) {
      const existing = registries[name].versions?.[version];
      assert(!existing || existing.dealmachineRelease?.sourceSha === sourceSha, `${name}@${version} belongs to another source. Refusing a mixed release.`);
    }
  } else if (!highest || compare(baseVersion, highest) > 0) {
    version = baseVersion;
  } else {
    const [major, minor, patch] = highest.split('.').map(Number);
    version = `${major}.${minor}.${patch + 1}`;
  }
  return { version, tag: 'latest', sourceSha };
}

export function verifyPublishedPackage(artifact, metadata, plan, { requireTag = false } = {}) {
  const published = metadata.versions?.[plan.version];
  assert(published, `${artifact.name}@${plan.version} is missing from npm.`);
  assert.equal(published.dealmachineRelease?.sourceSha, plan.sourceSha, `${artifact.name} source does not match this release.`);
  assert.equal(published.dist?.integrity, artifact.integrity, `${artifact.name} published bytes differ. Never replace an existing version.`);
  if (artifact.name === 'dealmachine') {
    assert.equal(published.dependencies?.['@dealmachine/cli'], plan.version, 'The alias must pin this exact implementation version.');
  }
  if (requireTag) assert.equal(metadata['dist-tags']?.[plan.tag], plan.version, `${artifact.name} latest is not this version. An owner must reconcile the channel.`);
  return published;
}
