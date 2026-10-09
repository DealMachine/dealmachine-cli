import { execFileSync } from 'node:child_process';

// npm exposes its JS entrypoint to lifecycle scripts on every supported OS.
// Running that entrypoint avoids trying to execute Windows npm.cmd as a binary.
export function runNpm(args, options) {
  if (process.env.npm_execpath) return execFileSync(process.execPath, [process.env.npm_execpath, ...args], options);
  return execFileSync('npm', args, options);
}
