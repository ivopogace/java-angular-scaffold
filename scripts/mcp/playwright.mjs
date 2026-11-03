// `PACKAGE` is exact so npx starts it from its cache; bump it by hand. Not a frontend dependency.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { launch, resolveNpx } from "./launch.mjs";

export const PACKAGE = "@playwright/mcp@0.0.84";

const DEFAULT_BROWSERS_ROOT = "/opt/pw-browsers";
const CONTAINER_MARKERS = ["/.dockerenv", "/run/.containerenv"];

/** Passed as `--executable-path`: the server's `playwright-core` may expect a revision not installed there. */
export function resolveChromium(env, exists = existsSync) {
  const root = env.PLAYWRIGHT_BROWSERS_PATH;
  // `0` is Playwright's sentinel for "browsers live inside the package": there is no root to join.
  if (root === "0") return null;
  const chromium = join(root || DEFAULT_BROWSERS_ROOT, "chromium");
  return exists(chromium) ? chromium : null;
}

/** As root on Linux or in a container; `PLAYWRIGHT_MCP_NO_SANDBOX` forces it on (1/true) or off (0/false). */
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
