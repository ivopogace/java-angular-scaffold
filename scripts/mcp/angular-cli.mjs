/**
 * Launches the `angular-cli` MCP server for Claude Code (`.mcp.json`) and opencode (`opencode.json`).
 *
 * Prefers the repo-local CLI: spawning the installed binary needs no network, whereas `npx` resolves
 * the package against the registry on every start and can miss the tool's connect timeout. Before
 * `npm ci` has run it falls back to `npx` with the exact `@angular/cli` version `frontend/package.json`
 * pins. The install counts as complete only once npm has written `node_modules/.package-lock.json`,
 * so a half-finished install is not mistaken for a usable one.
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectDir = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * How to start the server. Pure: `exists` and `cliVersion` are injected so tests need no filesystem.
 *
 * @returns {{ command: string, args: string[], local: boolean }}
 */
export function resolveLauncher(
  root,
  {
    exists = existsSync,
    cliVersion = () => pinnedCliVersion(root),
    execPath = process.execPath,
  } = {},
) {
  const modules = join(root, "frontend", "node_modules");
  const cli = join(modules, "@angular", "cli", "bin", "ng.js");
  return exists(cli) && exists(join(modules, ".package-lock.json"))
    ? { command: execPath, args: [cli, "mcp"], local: true }
    : {
        command: "npx",
        args: ["-y", `@angular/cli@${cliVersion()}`, "mcp"],
        local: false,
      };
}

function pinnedCliVersion(root) {
  const manifest = JSON.parse(
    readFileSync(join(root, "frontend", "package.json"), "utf8"),
  );
  return manifest.devDependencies["@angular/cli"];
}

function main() {
  const { command, args, local } = resolveLauncher(projectDir);
  if (!local) {
    console.error(
      "angular-cli MCP: frontend dependencies not installed; starting through npx.",
    );
  }
  // npx is a .cmd shim on Windows, which spawn cannot run without a shell.
  const child = spawn(command, args, {
    stdio: "inherit",
    shell: !local && process.platform === "win32",
  });
  // The client stops this launcher by pid; forward so the real server does not outlive it.
  for (const signal of ["SIGTERM", "SIGINT", "SIGHUP"]) {
    process.on(signal, () => child.kill(signal));
  }
  child.on("error", (error) => {
    console.error(
      `angular-cli MCP: failed to start ${command}: ${error.message}`,
    );
    process.exit(1);
  });
  child.on("exit", (code, signal) => process.exit(signal ? 1 : (code ?? 1)));
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main();
}
