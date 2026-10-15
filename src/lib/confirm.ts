/**
 * Confirmation before a Command changes something that cannot be undone or
 * that spends money. Interactive users answer a yes/no question. Agents,
 * scripts and --json callers must pass --yes instead.
 */

import { createInterface } from 'node:readline/promises';
import { isQuiet } from './output.js';

export function isNonInteractive(options: { json?: boolean } = {}): boolean {
  return (
    options.json === true ||
    isQuiet() ||
    process.env.DM_AGENT === '1' ||
    process.env.CI === 'true' ||
    process.stdin.isTTY !== true ||
    process.stdout.isTTY !== true
  );
}

/** Ask a yes/no question on the terminal. Anything but y or yes is a no. */
export async function confirmPrompt(question: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question(`${question} (y/N) `);
    return /^y(es)?$/i.test(answer.trim());
  } finally {
    rl.close();
  }
}
