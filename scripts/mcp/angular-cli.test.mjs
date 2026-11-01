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
const NPX = join("/usr", "lib", "node_modules", "npm", "bin", "npx-cli.js");
const NPX_ARGS = ["-y", "@angular/cli@1.2.3", "mcp"];

const present =
  (...paths) =>
  (path) =>
    paths.includes(path);

const launch = (exists, platform = "linux") =>
  resolveLauncher(ROOT, {
    exists,
    cliVersion: () => "1.2.3",
    execPath: NODE,
    platform,
  });

test("uses the repo-local CLI once the install is complete", () => {
  assert.deepEqual(launch(present(CLI, LOCKFILE)), {
    command: NODE,
    args: [CLI, "mcp"],
    shell: false,
    local: true,
  });
});

test("falls back to npm's npx-cli.js with the pinned version before npm ci", () => {
  assert.deepEqual(launch(present(NPX)), {
    command: NODE,
    args: [NPX, ...NPX_ARGS],
    shell: false,
    local: false,
  });
});

test("falls back to npx mid-install, when ng.js exists but npm has not finished", () => {
  assert.equal(launch(present(CLI, NPX)).local, false);
});

test("without npm beside node: the npx name directly off Windows, one shell string on it", () => {
  assert.deepEqual(launch(present()), {
    command: "npx",
    args: NPX_ARGS,
    shell: false,
    local: false,
  });
  assert.deepEqual(launch(present(), "win32"), {
    command: "npx -y @angular/cli@1.2.3 mcp",
    args: [],
    shell: true,
    local: false,
  });
});

test("the fallback version is the exact one frontend/package.json pins", () => {
  const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
  const pinned = JSON.parse(
    readFileSync(join(repo, "frontend", "package.json"), "utf8"),
  ).devDependencies["@angular/cli"];
  const { args } = resolveLauncher(repo, {
    exists: present(),
    platform: "linux",
  });
  assert.match(pinned, /^\d+\.\d+\.\d+$/);
  assert.deepEqual(args, ["-y", `@angular/cli@${pinned}`, "mcp"]);
});
