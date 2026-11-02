import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  parseArgs,
  planSteps,
  preflight,
  runCommand,
  USAGE,
} from "./verify.mjs";

const base = {
  quick: false,
  platform: "linux",
  hasNodeModules: true,
  hasScriptTests: false,
  hasAgentDocsCheck: false,
  ci: false,
};
const names = (steps) => steps.map((s) => s.name);

test("linux runs ./gradlew, win32 runs gradlew.bat", () => {
  assert.equal(planSteps(base)[0].command, "./gradlew");
  assert.equal(
    planSteps({ ...base, platform: "win32" })[0].command,
    "gradlew.bat",
  );
  assert.equal(planSteps(base)[0].cwd, "backend");
});

test("full run builds the backend without a tag filter and runs the mocked e2e", () => {
  const steps = planSteps(base);
  assert.deepEqual(steps[0].args, ["build"]);
  assert.ok(names(steps).includes("frontend e2e"));
});

test("quick excludes container tests and e2e", () => {
  const steps = planSteps({ ...base, quick: true });
  assert.deepEqual(steps[0].args, ["build", "-PexcludeTags=container"]);
  assert.ok(!names(steps).includes("frontend e2e"));
  assert.ok(names(steps).includes("frontend build"));
});

test("npm ci runs first, and only without node_modules", () => {
  const without = planSteps({ ...base, hasNodeModules: false });
  assert.deepEqual(
    [without[0].command, without[0].args, without[0].cwd],
    ["npm", ["ci"], "frontend"],
  );
  assert.ok(!names(planSteps(base)).includes("npm ci"));
});

test("frontend steps run in order", () => {
  assert.deepEqual(names(planSteps(base)), [
    "backend build",
    "frontend lint",
    "frontend format",
    "scripts format",
    "frontend eslint rules",
    "frontend unit tests",
    "frontend build",
    "frontend e2e types",
    "frontend audit",
    "frontend playwright install",
    "frontend e2e",
  ]);
  const unit = planSteps(base).find((s) => s.name === "frontend unit tests");
  assert.deepEqual(unit.args, ["test", "--", "--watch=false"]);
});

test("scripts are checked with the frontend's Prettier", () => {
  const format = planSteps(base).find((s) => s.name === "scripts format");
  assert.deepEqual(
    [format.command, format.args, format.cwd],
    ["npx", ["prettier", "--check", "../scripts"], "frontend"],
  );
});

test("the full run audits the frontend's dependencies for high and critical advisories; quick does not", () => {
  const audit = (options) =>
    planSteps({ ...base, ...options }).find((s) => s.name === "frontend audit");
  assert.deepEqual(
    [audit({}).command, audit({}).args, audit({}).cwd],
    ["npm", ["audit", "--audit-level=high"], "frontend"],
  );
  assert.equal(audit({ quick: true }), undefined);
});

test("playwright browsers are installed in full runs only, with system deps only on CI", () => {
  const install = (options) =>
    planSteps({ ...base, ...options }).find(
      (s) => s.name === "frontend playwright install",
    );
  assert.deepEqual(
    [install({}).command, install({}).args, install({}).cwd],
    ["npx", ["playwright", "install", "chromium"], "frontend"],
  );
  assert.deepEqual(install({ ci: true }).args, [
    "playwright",
    "install",
    "chromium",
    "--with-deps",
  ]);
  assert.equal(install({ quick: true }), undefined);
  assert.equal(install({ quick: true, ci: true }), undefined);
});

test("playwright install comes after npm ci and before e2e", () => {
  const order = names(planSteps({ ...base, hasNodeModules: false }));
  assert.ok(
    order.indexOf("npm ci") < order.indexOf("frontend playwright install"),
  );
  assert.ok(
    order.indexOf("frontend playwright install") <
      order.indexOf("frontend e2e"),
  );
});

test("script tests and the agent-docs check are planned only when present", () => {
  const extra = planSteps({
    ...base,
    hasScriptTests: true,
    hasAgentDocsCheck: true,
  });
  const tests = extra.find((s) => s.name === "script tests");
  assert.deepEqual(
    [tests.command, tests.args, tests.cwd],
    ["node", ["--test", "scripts/**/*.test.mjs"], "."],
  );
  const docs = extra.find((s) => s.name === "agent docs check");
  assert.deepEqual(
    [docs.command, docs.args],
    ["node", ["scripts/check-agent-docs.mjs"]],
  );
  assert.ok(!names(planSteps(base)).includes("script tests"));
  assert.ok(!names(planSteps(base)).includes("agent docs check"));
});

test("full verify without Docker fails up front with the exact message", async () => {
  const message = await preflight({
    quick: false,
    dockerAvailable: async () => false,
  });
  assert.equal(
    message,
    "Docker is required for the full verify; run with --quick to skip container tests and e2e.",
  );
});

test("full verify with Docker, and quick without it, pass preflight", async () => {
  assert.equal(
    await preflight({ quick: false, dockerAvailable: async () => true }),
    null,
  );
  assert.equal(
    await preflight({ quick: true, dockerAvailable: async () => false }),
    null,
  );
});

const awkward = 'a "b" c';
const script = `process.exit(process.argv[1] === ${JSON.stringify(awkward)} ? 0 : 7)`;

for (const platform of ["linux", "win32"]) {
  test(`runCommand on ${platform} passes an argument with spaces and quotes through intact`, async () => {
    const options = { platform, stdio: "ignore" };
    assert.equal(
      await runCommand(
        { command: process.execPath, args: ["-e", script, awkward], cwd: "." },
        options,
      ),
      0,
    );
    assert.equal(
      await runCommand(
        { command: process.execPath, args: ["-e", script, "other"], cwd: "." },
        options,
      ),
      7,
    );
  });
}

test("runCommand reports a command that cannot start as exit code 1", async () => {
  const code = await runCommand(
    { command: "no-such-command-xyz", args: [], cwd: "." },
    { platform: "linux", stdio: "ignore" },
  );
  assert.equal(code, 1);
});

test("parseArgs accepts --quick and nothing else", () => {
  assert.deepEqual(parseArgs([]), { quick: false });
  assert.deepEqual(parseArgs(["--quick"]), { quick: true });
  assert.deepEqual(parseArgs(["--quik"]), {
    error: `Unknown argument: --quik\n${USAGE}`,
  });
});

test("an unknown argument exits 2 with the usage line before any step runs", () => {
  const result = spawnSync(
    process.execPath,
    [fileURLToPath(new URL("./verify.mjs", import.meta.url)), "--quik"],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 2);
  assert.equal(result.stderr, `Unknown argument: --quik\n${USAGE}\n`);
  assert.equal(result.stdout, "");
});
