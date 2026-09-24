import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

it('imports the public program when the caller entry file is missing', () => {
  const entry = new URL('../src/index.ts', import.meta.url).href;
  const missingCaller = fileURLToPath(new URL('./missing-caller.mjs', import.meta.url));
  const output = execFileSync(
    process.execPath,
    [
      '--import',
      'tsx',
      '--input-type=module',
      '--eval',
      `process.argv[1] = ${JSON.stringify(missingCaller)};
       const { program } = await import(${JSON.stringify(entry)});
       console.log(program.name());`,
    ],
    { encoding: 'utf8', timeout: 20_000 }
  );
  expect(output.trim()).toBe('dm');
});
