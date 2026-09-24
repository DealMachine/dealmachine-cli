import { rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cwd = fileURLToPath(new URL('..', import.meta.url));
// A previous private build must never leave files in the public npm artifact.
rmSync(new URL('../dist', import.meta.url), { recursive: true, force: true });
execFileSync('tsc', ['--build', '--force'], { cwd, stdio: 'inherit' });
await import('./copy-agent-assets.mjs');
