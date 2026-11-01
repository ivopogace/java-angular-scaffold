/**
 * Launches the `playwright` MCP server for Claude Code (`.mcp.json`) and opencode (`opencode.json`).
 *
 * The package version is pinned here, not `@latest`: an exact version can start from the npx cache
 * without asking the registry, and the server does not change between sessions. Bump `PACKAGE` by
 * hand. `@playwright/mcp` is not a frontend dependency because it pins its own `playwright-core`,
 * which would sit next to the one `@playwright/test` brings.
 *
 * When `PLAYWRIGHT_BROWSERS_PATH` (or `/opt/pw-browsers`, the layout of some hosted agent sandboxes)
 * holds a `chromium` entry, it is passed as `--executable-path`, because the server's own
 * `playwright-core` may expect a browser revision that is not installed there. Otherwise Playwright
 * resolves its own browser.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export const PACKAGE = "@playwright/mcp@0.0.84";

const SERVER_ARGS = ["--headless", "--no-sandbox", "--isolated"];
const DEFAULT_BROWSERS_ROOT = "/opt/pw-browsers";

/**
 * The chromium to drive, or null to let Playwright resolve its own. Pure: `env` and `exists` are
 * injected.
 */
export function resolveChromium(env, exists = existsSync) {
  const root = env.PLAYWRIGHT_BROWSERS_PATH;
  // `0` is Playwright's sentinel for "browsers live inside the package": there is no root to join.
  if (root === "0") return null;
  const chromium = join(root || DEFAULT_BROWSERS_ROOT, "chromium");
  return exists(chromium) ? chromium : null;
}

/** The full npx argument list, with `--executable-path` only where it resolves. */
export function resolveArgs(env, exists = existsSync) {
  const chromium = resolveChromium(env, exists);
  const args = ["-y", PACKAGE, ...SERVER_ARGS];
  return chromium ? [...args, "--executable-path", chromium] : args;
}

function main() {
  // npx is a .cmd shim on Windows, which spawn cannot run without a shell.
  const child = spawn("npx", resolveArgs(process.env), {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  // The client stops this launcher by pid; forward so the real server does not outlive it.
  for (const signal of ["SIGTERM", "SIGINT", "SIGHUP"]) {
    process.on(signal, () => child.kill(signal));
  }
  child.on("error", (error) => {
    console.error(`playwright MCP: failed to start npx: ${error.message}`);
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
