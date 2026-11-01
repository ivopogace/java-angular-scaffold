import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runCommand } from "./verify.mjs";

const CHECKED = /\.(ts|html|scss|json|md)$/;
const LINTED = /\.(ts|html)$/;

/**
 * The staged frontend files the hook checks, and the subset ESLint also lints, as paths relative to `frontend/`.
 *
 * @param {string[]} stagedFiles repository-relative paths
 * @returns {{ checked: string[], linted: string[] }}
 */
export function selectFiles(stagedFiles) {
  const checked = stagedFiles
    .filter((file) => file.startsWith("frontend/") && CHECKED.test(file))
    .map((file) => file.slice("frontend/".length));
  return { checked, linted: checked.filter((file) => LINTED.test(file)) };
}

async function main() {
  const staged = execFileSync(
    "git",
    ["diff", "--cached", "--name-only", "--diff-filter=ACMR"],
    {
      encoding: "utf8",
    },
  ).split(/\r?\n/);
  const { checked, linted } = selectFiles(staged);
  if (checked.length === 0) return 0;

  const checks = [
    { command: "npx", args: ["prettier", "--check", ...checked] },
    ...(linted.length > 0
      ? [{ command: "npx", args: ["eslint", "--max-warnings=0", ...linted] }]
      : []),
  ];
  for (const check of checks) {
    if ((await runCommand({ ...check, cwd: "frontend" })) !== 0) return 1;
  }
  return 0;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  process.exitCode = await main();
}
