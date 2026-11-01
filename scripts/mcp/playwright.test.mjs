import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";
import { PACKAGE, resolveArgs, resolveChromium } from "./playwright.mjs";

const SANDBOX_CHROMIUM = join("/opt/pw-browsers", "chromium");

const present =
  (...paths) =>
  (path) =>
    paths.includes(path);

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
  const base = ["-y", PACKAGE, "--headless", "--no-sandbox", "--isolated"];
  assert.deepEqual(resolveArgs({}, present()), base);
  assert.deepEqual(resolveArgs({}, present(SANDBOX_CHROMIUM)), [
    ...base,
    "--executable-path",
    SANDBOX_CHROMIUM,
  ]);
});
