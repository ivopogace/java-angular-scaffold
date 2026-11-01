import { execFileSync } from 'node:child_process';
import { runCommand } from './verify.mjs';

const CHECKED = /\.(ts|html|scss|json|md)$/;
const LINTED = /\.(ts|html)$/;

const staged = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR'], { encoding: 'utf8' })
  .split(/\r?\n/)
  .filter((file) => file.startsWith('frontend/') && CHECKED.test(file))
  .map((file) => file.slice('frontend/'.length));

if (staged.length === 0) process.exit(0);

const checks = [
  { command: 'npx', args: ['prettier', '--check', ...staged] },
  ...(staged.some((file) => LINTED.test(file))
    ? [{ command: 'npx', args: ['eslint', '--max-warnings=0', ...staged.filter((file) => LINTED.test(file))] }]
    : []),
];

for (const check of checks) {
  if ((await runCommand({ ...check, cwd: 'frontend' })) !== 0) process.exit(1);
}
