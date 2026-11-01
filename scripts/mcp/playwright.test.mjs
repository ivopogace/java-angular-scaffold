import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";
import {
  needsNoSandbox,
  PACKAGE,
  resolveArgs,
  resolveChromium,
} from "./playwright.mjs";

const SANDBOX_CHROMIUM = join("/opt/pw-browsers", "chromium");
const BASE_ARGS = ["-y", PACKAGE, "--headless", "--isolated"];

const present =
  (...paths) =>
  (path) =>
    paths.includes(path);

/** A Linux developer machine: an ordinary user, no container markers unless listed. */
const linuxUser = (...paths) => ({
  exists: present(...paths),
  platform: "linux",
  uid: 1000,
});

test("pins an exact version, never a dist-tag", () => {
  assert.match(PACKAGE, /^@playwright\/mcp@\d+\.\d+\.\d+$/);
});

test("uses the sandbox chromium when no browsers root is configured", () => {
  assert.equal(
    resolveChromium({}, present(SANDBOX_CHROMIUM)),
    SANDBOX_CHROMIUM,
  );
});

test("honours PLAYWRIGHT_BROWSERS_PATH over the default root", () => {
  const chromium = join("/custom", "chromium");
  assert.equal(
    resolveChromium(
      { PLAYWRIGHT_BROWSERS_PATH: "/custom" },
      present(chromium, SANDBOX_CHROMIUM),
    ),
    chromium,
  );
});

test("treats PLAYWRIGHT_BROWSERS_PATH=0 as browsers inside the package", () => {
  assert.equal(
    resolveChromium(
      { PLAYWRIGHT_BROWSERS_PATH: "0" },
      present(SANDBOX_CHROMIUM),
    ),
    null,
  );
});

test("passes --executable-path only when chromium resolves", () => {
  assert.deepEqual(resolveArgs({}, linuxUser()), BASE_ARGS);
  assert.deepEqual(resolveArgs({}, linuxUser(SANDBOX_CHROMIUM)), [
    ...BASE_ARGS,
    "--executable-path",
    SANDBOX_CHROMIUM,
  ]);
});

test("Chromium stays sandboxed on a developer machine", () => {
  assert.equal(needsNoSandbox({}, linuxUser()), false);
  for (const [platform, uid] of [
    ["darwin", 501],
    ["win32", undefined],
  ]) {
    assert.equal(
      needsNoSandbox({}, { platform, uid, exists: present() }),
      false,
      platform,
    );
  }
});

test("--no-sandbox as root on Linux, where Chromium refuses to start without it", () => {
  assert.equal(
    needsNoSandbox({}, { platform: "linux", uid: 0, exists: present() }),
    true,
  );
  assert.equal(
    needsNoSandbox({}, { platform: "darwin", uid: 0, exists: present() }),
    false,
  );
});

test("--no-sandbox inside a container, found by its marker file", () => {
  assert.equal(needsNoSandbox({}, linuxUser("/.dockerenv")), true);
  assert.equal(needsNoSandbox({}, linuxUser("/run/.containerenv")), true);
  assert.equal(
    needsNoSandbox(
      {},
      { platform: "darwin", uid: 501, exists: present("/.dockerenv") },
    ),
    false,
  );
});

test("PLAYWRIGHT_MCP_NO_SANDBOX overrides the detection either way", () => {
  assert.equal(
    needsNoSandbox(
      { PLAYWRIGHT_MCP_NO_SANDBOX: "1" },
      { platform: "win32", uid: undefined, exists: present() },
    ),
    true,
  );
  assert.equal(
    needsNoSandbox(
      { PLAYWRIGHT_MCP_NO_SANDBOX: "0" },
      { platform: "linux", uid: 0, exists: present() },
    ),
    false,
  );
});

test("--no-sandbox follows the fixed flags and precedes --executable-path", () => {
  assert.deepEqual(
    resolveArgs(
      {},
      { exists: present(SANDBOX_CHROMIUM), platform: "linux", uid: 0 },
    ),
    [...BASE_ARGS, "--no-sandbox", "--executable-path", SANDBOX_CHROMIUM],
  );
});
