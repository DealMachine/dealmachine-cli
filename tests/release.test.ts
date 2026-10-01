import { describe, expect, it } from 'vitest';
import { planRelease, verifyPublishedPackage } from '../scripts/release-plan.mjs';

const sourceSha = 'a'.repeat(40);
const otherSha = 'b'.repeat(40);
const published = (sha = otherSha, integrity = 'sha512-reviewed') => ({
  dealmachineRelease: { sourceSha: sha },
  dist: { integrity },
  dependencies: { '@dealmachine/cli': '0.4.1' },
});
const registry = (versions = {}, latest = '0.3.0') => ({ versions, 'dist-tags': { latest } });
const registries = (implementation = registry(), alias = registry()) => ({ '@dealmachine/cli': implementation, dealmachine: alias });

describe('automatic CLI release contract', () => {
  it.each([
    ['0.4.0', ['0.3.0', '0.4.0-rc.4'], '0.4.0'],
    ['0.4.0', ['0.4.1', '0.4.10', '0.4.9'], '0.4.11'],
    ['1.0.0', ['0.4.12'], '1.0.0'],
  ])('selects a stable version from baseline %s and existing %j', (base, existing, expected) => {
    const snapshot = registry(Object.fromEntries(existing.map(version => [version, published()])));
    expect(planRelease(base, sourceSha, registries(snapshot)).version).toBe(expected);
  });

  it('resumes the implementation version when alias publication failed', () => {
    const snapshot = registry({ '0.4.1': published(sourceSha) }, '0.4.1');
    const plan = planRelease('0.4.0', sourceSha, registries(snapshot));
    expect(plan).toEqual({ version: '0.4.1', sourceSha, tag: 'latest' });
    expect(() => verifyPublishedPackage({ name: '@dealmachine/cli', integrity: 'sha512-reviewed' }, snapshot, plan, { requireTag: true })).not.toThrow();
    expect(() => verifyPublishedPackage({ name: 'dealmachine', integrity: 'sha512-reviewed' }, registry(), plan, { requireTag: true })).toThrow(/missing from npm/);
  });

  it('rejects an alias for another source before completing a partial release', () => {
    expect(() => planRelease('0.4.0', sourceSha, registries(
      registry({ '0.4.1': published(sourceSha) }),
      registry({ '0.4.1': published(otherSha) }),
    ))).toThrow(/mixed release/);
  });

  it('refuses a retry that would roll back a newer published version', () => {
    expect(() => planRelease('0.4.0', sourceSha, registries(registry({
      '0.4.1': published(sourceSha), '0.4.2': published(otherSha),
    })))).toThrow(/move latest backward/);
  });

  it.each([
    ['changed bytes', { ...published(sourceSha), dist: { integrity: 'sha512-different' } }, '0.4.1', /published bytes differ/],
    ['wrong alias dependency', { ...published(sourceSha), dependencies: { '@dealmachine/cli': '^0.4.1' } }, '0.4.1', /exact implementation/],
    ['unmoved channel', published(sourceSha), '0.3.0', /latest is not this version/],
    ['wrong source', published(otherSha), '0.4.1', /source does not match/],
  ])('does not report a successful release with %s', (_, metadata, latest, error) => {
    expect(() => verifyPublishedPackage(
      { name: 'dealmachine', integrity: 'sha512-reviewed' },
      registry({ '0.4.1': metadata }, latest),
      { version: '0.4.1', tag: 'latest', sourceSha },
      { requireTag: true },
    )).toThrow(error);
  });
});
