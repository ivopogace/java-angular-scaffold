import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const CHECKED = /\.(ts|html|scss|json|md)$/;
const LINTED = /\.(ts|html)$/;

export const NO_NODE_MODULES_MESSAGE =
  "frontend/node_modules is missing or incomplete: run npm ci in frontend/ first.";

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

/** The staged (index) content of a repository-relative path, which is what the commit will hold. */
function readStagedBlob(repoRoot, path) {
  return execFileSync("git", ["show", `:${path}`], {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
}

async function unformattedFiles(prettier, frontendDir, files, readStaged) {
  const ignorePath = [".gitignore", ".prettierignore"].map((name) =>
    join(frontendDir, name),
  );
  const unformatted = [];
  for (const file of files) {
    const filepath = join(frontendDir, file);
    const info = await prettier.getFileInfo(filepath, { ignorePath });
    if (info.ignored || !info.inferredParser) continue;
    const options =
      (await prettier.resolveConfig(filepath, { editorconfig: true })) ?? {};
    const source = readStaged(`frontend/${file}`);
    if (!(await prettier.check(source, { ...options, filepath }))) {
      unformatted.push(file);
    }
  }
  return unformatted;
}

/**
 * Checks the staged content of the staged frontend files with the frontend's own Prettier and ESLint
 * (loaded from `frontend/node_modules`, never downloaded), so a partially staged file is judged on
 * what the commit will contain.
 *
 * @param {{ stagedFiles: string[], repoRoot?: string, readStaged?: (path: string) => string,
 *           log?: (text: string) => void, error?: (text: string) => void }} options
 *        `readStaged` returns the index content of a repository-relative path.
 * @returns {Promise<number>} the exit code
 */
export async function runHook({
  stagedFiles,
  repoRoot = root,
  readStaged = (path) => readStagedBlob(repoRoot, path),
  log = console.log,
  error = console.error,
}) {
  const { checked, linted } = selectFiles(stagedFiles);
  if (checked.length === 0) return 0;

  const frontendDir = join(repoRoot, "frontend");
  if (!existsSync(join(frontendDir, "node_modules", ".package-lock.json"))) {
    error(NO_NODE_MODULES_MESSAGE);
    return 1;
  }
  const requireFromFrontend = createRequire(join(frontendDir, "package.json"));
  const prettierModule = await import(
    pathToFileURL(requireFromFrontend.resolve("prettier")).href
  );
  const prettier = prettierModule.default ?? prettierModule;
  const { ESLint } = requireFromFrontend("eslint");

  const unformatted = await unformattedFiles(
    prettier,
    frontendDir,
    checked,
    readStaged,
  );
  if (unformatted.length > 0) {
    error(
      [
        "Staged files are not formatted (Prettier):",
        ...unformatted.map((file) => `  frontend/${file}`),
        "Run npm run format in frontend/, then stage the result.",
      ].join("\n"),
    );
    return 1;
  }

  const eslint = new ESLint({ cwd: frontendDir });
  const results = [];
  for (const file of linted) {
    results.push(
      ...(await eslint.lintText(readStaged(`frontend/${file}`), {
        filePath: join(frontendDir, file),
        warnIgnored: false,
      })),
    );
  }
  const problems = results.reduce(
    (sum, result) => sum + result.errorCount + result.warningCount,
    0,
  );
  if (problems > 0) {
    log((await eslint.loadFormatter("stylish")).format(results));
    return 1;
  }
  return 0;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const stagedFiles = execFileSync(
    "git",
    ["diff", "--cached", "--name-only", "--diff-filter=ACMR"],
    { cwd: root, encoding: "utf8" },
  ).split(/\r?\n/);
  process.exitCode = await runHook({ stagedFiles });
}
