/**
 * Launches the `playwright` MCP server for Claude Code (`.mcp.json`) and opencode (`opencode.json`).
 *
 * `PACKAGE` is an exact version, so npx can start it from its cache; bump it by hand. It is not a
 * frontend dependency: it pins its own `playwright-core` beside the one `@playwright/test` brings.
 *
 * A `chromium` entry under `PLAYWRIGHT_BROWSERS_PATH` (or `/opt/pw-browsers`) is passed as
 * `--executable-path`, since the server's `playwright-core` may expect a revision not installed there.
 *
 * `--no-sandbox` is passed only where Chromium's sandbox cannot run: as root on Linux, or inside a
 * container (`/.dockerenv`, `/run/.containerenv`). `PLAYWRIGHT_MCP_NO_SANDBOX=1` (or `true`) forces
 * it on, `=0` (or `false`) off; any other value is reported on stderr and ignored.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { launch, resolveNpx } from "./launch.mjs";

export const PACKAGE = "@playwright/mcp@0.0.84";

const DEFAULT_BROWSERS_ROOT = "/opt/pw-browsers";
const CONTAINER_MARKERS = ["/.dockerenv", "/run/.containerenv"];

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

/**
 * Whether Chromium needs `--no-sandbox` here (the header names the cases). Pure: `env`,
 * `platform`, `uid` and `exists` are injected; `uid` is undefined where the OS has none.
 */
export function needsNoSandbox(
  env,
  {
    platform = process.platform,
    uid = process.getuid?.(),
    exists = existsSync,
    warn = console.error,
  } = {},
) {
  const override = env.PLAYWRIGHT_MCP_NO_SANDBOX;
  if (override !== undefined && override !== "") {
    if (/^(1|true)$/i.test(override)) return true;
    if (/^(0|false)$/i.test(override)) return false;
    warn(
      `playwright MCP: PLAYWRIGHT_MCP_NO_SANDBOX=${override} is neither 1/true nor 0/false; ignored`,
    );
  }
  if (platform !== "linux") return false;
  return uid === 0 || CONTAINER_MARKERS.some((marker) => exists(marker));
}

/**
 * The full npx argument list: `--no-sandbox` only where {@link needsNoSandbox}, `--executable-path`
 * only where a chromium resolves. Pure: the same dependencies as the two resolvers are injected.
 */
export function resolveArgs(
  env,
  {
    exists = existsSync,
    platform = process.platform,
    uid = process.getuid?.(),
  } = {},
) {
  const args = ["-y", PACKAGE, "--headless", "--isolated"];
  if (needsNoSandbox(env, { platform, uid, exists })) args.push("--no-sandbox");
  const chromium = resolveChromium(env, exists);
  if (chromium) args.push("--executable-path", chromium);
  return args;
}

function main() {
  launch(resolveNpx(resolveArgs(process.env)), "playwright");
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main();
}
