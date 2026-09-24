import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const [version, ...extra] = process.argv.slice(2);
if (extra.length || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[a-zA-Z0-9]+(?:[.-][a-zA-Z0-9]+)*)?$/.test(version ?? '')) {
  throw new Error('Usage: npm run release:version -- <version>, such as 0.4.0-rc.1 or 0.4.0');
}
for (const name of ['package.json', 'npm-alias/package.json', 'package-lock.json']) {
  const path = resolve(root, name);
  const data = JSON.parse(readFileSync(path, 'utf8'));
  data.version = version;
  if (name === 'npm-alias/package.json') data.dependencies['@dealmachine/cli'] = version;
  if (name === 'package-lock.json') data.packages[''].version = version;
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
}
writeFileSync(resolve(root, 'src/version.ts'), `export const CLI_VERSION = '${version}';\nexport const CLI_USER_AGENT = \`dm-cli/\${CLI_VERSION}\`;\n`);
console.log(`CLI and alias set to ${version}. Run npm run check and npm run test:package before release.`);
