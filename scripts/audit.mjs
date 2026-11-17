import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const frontend = join(root, "frontend");
export const WAIVERS_FILE = "frontend/audit-waivers.json";

const BLOCKING = new Set(["high", "critical"]);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** The GHSA id of an advisory, from the URL `npm audit` reports for it. */
function advisoryId(via) {
  return via.url?.split("/").pop() ?? String(via.source);
}

/** High and critical advisories in an `npm audit --json` report, one entry per advisory id. */
export function blockingAdvisories(report) {
  const found = new Map();
  for (const vulnerability of Object.values(report.vulnerabilities ?? {})) {
    for (const via of vulnerability.via) {
      if (typeof via !== "object" || !BLOCKING.has(via.severity)) continue;
      const id = advisoryId(via);
      if (!found.has(id)) {
        found.set(id, {
          id,
          name: via.name,
          severity: via.severity,
          title: via.title,
          url: via.url,
        });
      }
    }
  }
  return [...found.values()];
}

/** Problems with the waiver file itself, before it is matched against a report. */
export function invalidWaivers(waivers) {
  if (!Array.isArray(waivers)) return [`${WAIVERS_FILE} must be a JSON array`];
  return waivers.flatMap((w, i) => {
    const where = `${WAIVERS_FILE}[${i}]`;
    const problems = [];
    if (!/^GHSA-[\w-]+$/.test(w?.id ?? ""))
      problems.push(`${where}: id must be a GHSA id`);
    if (!w?.reason?.trim()) problems.push(`${where}: reason is required`);
    if (!ISO_DATE.test(w?.expires ?? ""))
      problems.push(`${where}: expires must be YYYY-MM-DD`);
    return problems;
  });
}

/**
 * Fails on every high or critical advisory without a waiver, on every waiver past its expiry date
 * and on every waiver whose advisory the report no longer names, so a waiver cannot outlive its need.
 */
export function evaluate(report, waivers, today) {
  const invalid = invalidWaivers(waivers);
  if (invalid.length > 0) return { problems: invalid, waived: [] };
  const advisories = blockingAdvisories(report);
  const reported = new Set(advisories.map((a) => a.id));
  const byId = new Map(waivers.map((w) => [w.id, w]));
  const problems = [];
  const waived = [];
  for (const a of advisories) {
    const waiver = byId.get(a.id);
    if (!waiver) {
      problems.push(
        `${a.severity} ${a.id} in ${a.name}: ${a.title} (${a.url})`,
      );
    } else if (waiver.expires < today) {
      problems.push(
        `waiver for ${a.id} expired on ${waiver.expires}: take the patched version or renew it with a reason`,
      );
    } else {
      waived.push(
        `${a.id} in ${a.name} until ${waiver.expires}: ${waiver.reason}`,
      );
    }
  }
  for (const w of waivers) {
    if (!reported.has(w.id)) {
      problems.push(
        `waiver for ${w.id} is stale: npm audit no longer reports it; delete it`,
      );
    }
  }
  return { problems, waived };
}

function main() {
  const npm = spawnSync("npm", ["audit", "--json"], {
    cwd: frontend,
    encoding: "utf8",
    shell: process.platform === "win32",
    maxBuffer: 64 * 1024 * 1024,
  });
  let report;
  try {
    report = JSON.parse(npm.stdout);
  } catch {
    console.error(npm.stderr || npm.stdout || "npm audit produced no output");
    return 1;
  }
  if (report.error) {
    console.error(
      `npm audit failed: ${report.error.code ?? ""} ${report.error.summary ?? ""}`,
    );
    return 1;
  }
  const waivers = JSON.parse(readFileSync(join(root, WAIVERS_FILE), "utf8"));
  const today = new Date().toISOString().slice(0, 10);
  const { problems, waived } = evaluate(report, waivers, today);
  for (const line of waived) console.log(`waived: ${line}`);
  for (const line of problems) console.error(line);
  if (problems.length === 0)
    console.log("no unwaived high or critical advisories");
  return problems.length === 0 ? 0 : 1;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  process.exitCode = main();
}
