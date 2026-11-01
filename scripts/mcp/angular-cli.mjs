/**
 * Launches the `angular-cli` MCP server for Claude Code (`.mcp.json`) and opencode (`opencode.json`).
 *
 * Prefers the repo-local CLI: spawning the installed binary needs no network, whereas `npx` resolves
 * the package against the registry on every start and can miss the tool's connect timeout. Before
 * `npm ci` has run it falls back to `npx` (run as `launch.mjs` describes) with the exact
 * `@angular/cli` version `frontend/package.json` pins. The install counts as complete only once npm
 * has written `node_modules/.package-lock.json`, so a half-finished install is not mistaken for a
 * usable one.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { launch, resolveNpx } from "./launch.mjs";

const projectDir = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * How to start the server. Pure: `exists`, `cliVersion`, `execPath` and `platform` are injected so
 * tests need no filesystem.
 *
 * @returns {{ command: string, args: string[], shell: boolean, local: boolean }}
 */
export function resolveLauncher(
  root,
  {
    exists = existsSync,
    cliVersion = () => pinnedCliVersion(root),
    execPath = process.execPath,
    platform = process.platform,
  } = {},
) {
  const modules = join(root, "frontend", "node_modules");
  const cli = join(modules, "@angular", "cli", "bin", "ng.js");
  if (exists(cli) && exists(join(modules, ".package-lock.json"))) {
    return { command: execPath, args: [cli, "mcp"], shell: false, local: true };
  }
  const npx = resolveNpx(["-y", `@angular/cli@${cliVersion()}`, "mcp"], {
    execPath,
    exists,
    platform,
  });
  return { ...npx, local: false };
}

function pinnedCliVersion(root) {
  const manifest = JSON.parse(
    readFileSync(join(root, "frontend", "package.json"), "utf8"),
  );
  return manifest.devDependencies["@angular/cli"];
}

function main() {
  const { local, ...spec } = resolveLauncher(projectDir);
  if (!local) {
    console.error(
      "angular-cli MCP: frontend dependencies not installed; starting through npx.",
    );
  }
  launch(spec, "angular-cli");
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main();
}
