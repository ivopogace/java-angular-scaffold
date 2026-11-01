import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { resolveLauncher } from "./angular-cli.mjs";

const ROOT = join("/repo");
const MODULES = join(ROOT, "frontend", "node_modules");
const CLI = join(MODULES, "@angular", "cli", "bin", "ng.js");
const LOCKFILE = join(MODULES, ".package-lock.json");
const NODE = join("/usr", "bin", "node");

const present =
  (...paths) =>
  (path) =>
    paths.includes(path);

const launch = (exists) =>
  resolveLauncher(ROOT, { exists, cliVersion: () => "1.2.3", execPath: NODE });

test("uses the repo-local CLI once the install is complete", () => {
  assert.deepEqual(launch(present(CLI, LOCKFILE)), {
    command: NODE,
    args: [CLI, "mcp"],
    local: true,
  });
});

test("falls back to npx with the pinned version before npm ci", () => {
  assert.deepEqual(launch(present()), {
    command: "npx",
    args: ["-y", "@angular/cli@1.2.3", "mcp"],
    local: false,
  });
});

test("falls back to npx mid-install, when ng.js exists but npm has not finished", () => {
  assert.equal(launch(present(CLI)).local, false);
});

test("the fallback version is the exact one frontend/package.json pins", () => {
  const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
  const pinned = JSON.parse(
    readFileSync(join(repo, "frontend", "package.json"), "utf8"),
  ).devDependencies["@angular/cli"];
  const { args } = resolveLauncher(repo, { exists: present() });
  assert.match(pinned, /^\d+\.\d+\.\d+$/);
  assert.deepEqual(args, ["-y", `@angular/cli@${pinned}`, "mcp"]);
});
