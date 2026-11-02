import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { TEMPLATE_VERSION } from "./init.mjs";
import {
  REQUIRED_WORKFLOWS,
  changelogVersion,
  decide,
  parseArgs,
  versionProblem,
  workflowState,
} from "./release-tag.mjs";

const repoFile = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const SHA = "0123456789abcdef0123456789abcdef01234567";
const green = { status: "completed", conclusion: "success" };
const red = { status: "completed", conclusion: "failure" };
const running = { status: "in_progress", conclusion: null };
const allGreen = { "ci.yml": [green], "template-ci.yml": [green] };
const input = (overrides = {}) => ({
  changelogVersion: "0.2.0",
  templateVersion: "0.2.0",
  runs: allGreen,
  remoteTagSha: null,
  ...overrides,
});

test("parseArgs takes a full sha and nothing else", () => {
  assert.deepEqual(parseArgs(["--sha", SHA]), { sha: SHA });
  assert.ok("error" in parseArgs(["--sha", "abc1234"]));
  assert.ok("error" in parseArgs(["--sha"]));
  assert.ok("error" in parseArgs([]));
  assert.ok("error" in parseArgs(["--sha", SHA, "--trigger", "workflow_run"]));
  assert.ok("error" in parseArgs(["--force"]));
});

test("changelogVersion reads the top heading only", () => {
  assert.equal(
    changelogVersion(
      "# Changelog\n\n## 1.2.3 — 2026-11-02\n\n## 1.2.2 — 2026-10-01\n",
    ),
    "1.2.3",
  );
  assert.equal(
    changelogVersion("# Changelog\n\n## Unreleased\n\n## 1.2.2 — 2026-10-01\n"),
    null,
  );
  assert.equal(changelogVersion("## 1.2 — 2026-11-02\n"), null);
  assert.equal(changelogVersion("# Changelog\n"), null);
});

test("the shipped CHANGELOG.md heading parses to TEMPLATE_VERSION", () => {
  assert.equal(changelogVersion(repoFile("CHANGELOG.md")), TEMPLATE_VERSION);
  assert.equal(
    versionProblem(
      changelogVersion(repoFile("CHANGELOG.md")),
      TEMPLATE_VERSION,
    ),
    null,
  );
});

test("versionProblem names both versions on a mismatch", () => {
  assert.equal(versionProblem("0.2.0", "0.2.0"), null);
  assert.match(versionProblem("0.3.0", "0.2.0"), /0\.3\.0.*0\.2\.0/);
  assert.match(versionProblem(null, "0.2.0"), /X\.Y\.Z/);
});

test("workflowState: any success wins, then unfinished or absent is pending", () => {
  assert.equal(workflowState([red, green]), "success");
  assert.equal(workflowState([]), "pending");
  assert.equal(workflowState([red, running]), "pending");
  assert.equal(workflowState([red]), "failed");
});

test("decide tags when both workflows are green and the tag is absent", () => {
  assert.deepEqual(decide(input()), {
    action: "tag",
    tag: "v0.2.0",
    reason: "tagging v0.2.0",
  });
});

test("decide fails on a version mismatch before anything else", () => {
  const decision = decide(
    input({ changelogVersion: "0.3.0", remoteTagSha: SHA }),
  );
  assert.equal(decision.action, "fail");
  assert.match(decision.reason, /TEMPLATE_VERSION/);
  assert.equal(decide(input({ changelogVersion: null })).action, "fail");
});

test("decide never moves an existing tag", () => {
  const decision = decide(input({ remoteTagSha: SHA }));
  assert.equal(decision.action, "skip");
  assert.match(decision.reason, /already exists.*0123456/);
});

test("decide fails unless both workflows succeeded for the commit", () => {
  for (const runs of [
    { "ci.yml": [green], "template-ci.yml": [running] },
    { "ci.yml": [green] },
    { "ci.yml": [red], "template-ci.yml": [green] },
  ]) {
    const decision = decide(input({ runs }));
    assert.equal(decision.action, "fail");
    assert.match(decision.reason, /not tagging v0\.2\.0: /);
  }
});

test("the workflow runs only by hand, on main, and calls this script", () => {
  const workflow = repoFile(".github/workflows/release-tag.yml");
  for (const file of REQUIRED_WORKFLOWS) {
    assert.ok(repoFile(`.github/workflows/${file}`), `${file} exists`);
  }
  // A version's heading lands on main before its last entries, so nothing may tag on its own.
  assert.match(workflow, /^ {2}workflow_dispatch:$/m);
  assert.doesNotMatch(workflow, /workflow_run|^ {2}push:|schedule:/m);
  assert.match(workflow, /if: github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /node scripts\/release-tag\.mjs/);
  assert.match(workflow, /^permissions: \{\}$/m);
  assert.match(workflow, /contents: write/);
  assert.match(workflow, /actions: read/);
});
