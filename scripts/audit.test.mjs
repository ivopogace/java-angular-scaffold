import assert from "node:assert/strict";
import { test } from "node:test";
import { blockingAdvisories, evaluate, invalidWaivers } from "./audit.mjs";

const advisory = (id, severity, name = "pkg") => ({
  source: 1,
  name,
  severity,
  title: `${id} title`,
  url: `https://github.com/advisories/${id}`,
});
const report = (...vias) => ({
  vulnerabilities: {
    pkg: { via: vias },
    dependent: { via: ["pkg"] },
  },
});
const waiver = (id, expires = "2026-12-31") => ({
  id,
  reason: "no patched version",
  expires,
});
const today = "2026-11-17";

test("only high and critical advisories block, each id once", () => {
  const r = report(
    advisory("GHSA-high-0000-0000", "high"),
    advisory("GHSA-crit-0000-0000", "critical"),
    advisory("GHSA-mode-0000-0000", "moderate"),
  );
  r.vulnerabilities.other = { via: [advisory("GHSA-high-0000-0000", "high")] };
  assert.deepEqual(
    blockingAdvisories(r).map((a) => a.id),
    ["GHSA-high-0000-0000", "GHSA-crit-0000-0000"],
  );
});

test("a clean report passes", () => {
  assert.deepEqual(evaluate(report(), [], today), {
    problems: [],
    waived: [],
  });
});

test("an unwaived high advisory fails", () => {
  const { problems } = evaluate(
    report(advisory("GHSA-high-0000-0000", "high")),
    [],
    today,
  );
  assert.equal(problems.length, 1);
  assert.match(problems[0], /GHSA-high-0000-0000/);
});

test("a waived advisory passes until its expiry date, inclusive", () => {
  const r = report(advisory("GHSA-high-0000-0000", "high"));
  const onTheDay = evaluate(r, [waiver("GHSA-high-0000-0000", today)], today);
  assert.deepEqual(onTheDay.problems, []);
  assert.equal(onTheDay.waived.length, 1);
  const after = evaluate(
    r,
    [waiver("GHSA-high-0000-0000", "2026-11-16")],
    today,
  );
  assert.match(after.problems[0], /expired on 2026-11-16/);
});

test("a waiver whose advisory is no longer reported fails as stale", () => {
  const { problems } = evaluate(
    report(),
    [waiver("GHSA-gone-0000-0000")],
    today,
  );
  assert.match(problems[0], /GHSA-gone-0000-0000 is stale/);
});

test("a waiver needs a GHSA id, a reason and an ISO expiry date", () => {
  assert.deepEqual(invalidWaivers([waiver("GHSA-ok-0000-0000")]), []);
  assert.equal(invalidWaivers({}).length, 1);
  assert.equal(
    invalidWaivers([{ id: "CVE-1", reason: " ", expires: "17.12.2026" }])
      .length,
    3,
  );
});
