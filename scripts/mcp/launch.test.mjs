import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";
import { resolveNpx } from "./launch.mjs";

const ARGS = ["-y", "some-package@1.0.0", "serve"];
const WIN_NODE = join("/nodejs", "node.exe");
const WIN_NPX = join("/nodejs", "node_modules", "npm", "bin", "npx-cli.js");
const UNIX_NODE = join("/usr", "bin", "node");
const UNIX_NPX = join(
  "/usr",
  "lib",
  "node_modules",
  "npm",
  "bin",
  "npx-cli.js",
);

const present =
  (...paths) =>
  (path) =>
    paths.includes(path);

test("runs npm's npx-cli.js with the running node when it sits beside node (Windows layout)", () => {
  assert.deepEqual(
    resolveNpx(ARGS, {
      execPath: WIN_NODE,
      exists: present(WIN_NPX),
      platform: "win32",
    }),
    { command: WIN_NODE, args: [WIN_NPX, ...ARGS], shell: false },
  );
});

test("finds npx-cli.js under lib/ beside bin/ (Unix layout)", () => {
  assert.deepEqual(
    resolveNpx(ARGS, {
      execPath: UNIX_NODE,
      exists: present(UNIX_NPX),
      platform: "linux",
    }),
    { command: UNIX_NODE, args: [UNIX_NPX, ...ARGS], shell: false },
  );
});

test("without npm beside node, runs the npx name directly off Windows", () => {
  assert.deepEqual(
    resolveNpx(ARGS, {
      execPath: UNIX_NODE,
      exists: present(),
      platform: "linux",
    }),
    { command: "npx", args: ARGS, shell: false },
  );
});

test("without npm beside node on Windows, one quoted command string and no args (DEP0190)", () => {
  const spaced = join("C:\\", "Program Files", "x", "chrome.exe");
  assert.deepEqual(
    resolveNpx([...ARGS, "--executable-path", spaced], {
      execPath: WIN_NODE,
      exists: present(),
      platform: "win32",
    }),
    {
      command: `npx -y some-package@1.0.0 serve --executable-path "${spaced}"`,
      args: [],
      shell: true,
    },
  );
});

test("the running node brings npm with it, so no launcher needs a shell here", () => {
  const { command, shell } = resolveNpx(ARGS);
  assert.equal(shell, false);
  assert.equal(command, process.execPath);
});
