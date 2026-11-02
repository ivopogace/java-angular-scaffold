#!/usr/bin/env node
// Template-only release automation: init deletes this file, its test and .github/workflows/release-tag.yml.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { TEMPLATE_VERSION } from "./init.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** The workflows that must both have succeeded for a push of the commit to main, by file name. */
export const REQUIRED_WORKFLOWS = ["ci.yml", "template-ci.yml"];
const BOT = {
  name: "github-actions[bot]",
  email: "41898282+github-actions[bot]@users.noreply.github.com",
};

export const USAGE = `Usage: node scripts/release-tag.mjs --sha <commit>

Tags <commit> as v<version> (the top CHANGELOG.md heading) if ${REQUIRED_WORKFLOWS.join(" and ")}
have both succeeded for a push of it to main, and pushes the tag. Needs gh with
GH_TOKEN (the workflow passes GITHUB_TOKEN) and GITHUB_REPOSITORY; never moves an
existing tag.`;

/**
 * @param {string[]} argv the arguments after the script name
 * @returns {{ sha: string } | { error: string }}
 */
export function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 2) {
    const [flag, value] = [argv[i], argv[i + 1]];
    if (flag !== "--sha") {
      return { error: `unknown argument ${flag}` };
    }
    if (value === undefined || value.startsWith("--")) {
      return { error: `${flag} needs a value` };
    }
    options[flag.slice(2)] = value;
  }
  if (!/^[0-9a-f]{40}$/.test(options.sha ?? "")) {
    return { error: "--sha must be a full 40-character commit hash" };
  }
  return { sha: options.sha };
}

/**
 * The version of the top `## X.Y.Z — YYYY-MM-DD` heading, or null when the
 * first `## ` heading has another shape.
 */
export function changelogVersion(changelog) {
  const top = /^## (.*)$/m.exec(changelog)?.[1];
  return /^(\d+\.\d+\.\d+) — \d{4}-\d{2}-\d{2}$/.exec(top ?? "")?.[1] ?? null;
}

/** A problem when the changelog and TEMPLATE_VERSION disagree, else null. */
export function versionProblem(fromChangelog, templateVersion) {
  if (fromChangelog === null) {
    return "the top CHANGELOG.md heading is not `## X.Y.Z — YYYY-MM-DD`";
  }
  if (fromChangelog !== templateVersion) {
    return `CHANGELOG.md is at ${fromChangelog} but TEMPLATE_VERSION in scripts/init.mjs is ${templateVersion}`;
  }
  return null;
}

/** "success" when any run succeeded, "pending" while none did and one is unfinished or none exists, else "failed". */
export function workflowState(runs) {
  if (runs.some((run) => run.conclusion === "success")) return "success";
  if (runs.length === 0 || runs.some((run) => run.status !== "completed")) {
    return "pending";
  }
  return "failed";
}

/**
 * What to do for one commit. Pure: every input is read by {@link main}.
 *
 * @param {object} input
 * @param {string|null} input.changelogVersion see {@link changelogVersion}
 * @param {string} input.templateVersion TEMPLATE_VERSION
 * @param {Record<string, {status: string, conclusion: string|null}[]>} input.runs
 *   push runs on main for the commit, by workflow file name
 * @param {string|null} input.remoteTagSha the commit the tag names on the remote, null when absent
 * @returns {{ action: "tag"|"skip"|"fail", tag?: string, reason: string }}
 */
export function decide({
  changelogVersion: version,
  templateVersion,
  runs,
  remoteTagSha,
}) {
  const problem = versionProblem(version, templateVersion);
  if (problem) return { action: "fail", reason: problem };
  const tag = `v${version}`;
  const notGreen = REQUIRED_WORKFLOWS.map((workflow) => [
    workflow,
    workflowState(runs[workflow] ?? []),
  ]).filter(([, state]) => state !== "success");
  if (notGreen.length > 0) {
    const list = notGreen.map(([w, state]) => `${w} ${state}`).join(", ");
    return { action: "fail", tag, reason: `not tagging ${tag}: ${list}` };
  }
  if (remoteTagSha !== null) {
    return {
      action: "skip",
      tag,
      reason: `${tag} already exists on the remote (at ${remoteTagSha}); leaving it`,
    };
  }
  return { action: "tag", tag, reason: `tagging ${tag}` };
}

const run = (command, args) =>
  execFileSync(command, args, { cwd: root, encoding: "utf8" });

function pushRuns(repository, workflow, sha) {
  const out = run("gh", [
    "api",
    "-X",
    "GET",
    `repos/${repository}/actions/workflows/${workflow}/runs`,
    "-f",
    `head_sha=${sha}`,
    "-f",
    "event=push",
    "-f",
    "branch=main",
    "--jq",
    "[.workflow_runs[] | {status, conclusion}]",
  ]);
  return JSON.parse(out);
}

/** The commit `tag` names on origin (peeled for an annotated tag), or null. */
function remoteTagSha(tag) {
  const lines = run("git", [
    "ls-remote",
    "--tags",
    "origin",
    `refs/tags/${tag}`,
    `refs/tags/${tag}^{}`,
  ])
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => line.split("\t"));
  if (lines.length === 0) return null;
  return (lines.find(([, ref]) => ref.endsWith("^{}")) ?? lines[0])[0];
}

export async function main(argv) {
  const args = parseArgs(argv);
  if ("error" in args) {
    console.error(`${args.error}\n\n${USAGE}`);
    return 2;
  }
  const repository = process.env.GITHUB_REPOSITORY;
  if (!repository) {
    console.error("GITHUB_REPOSITORY is not set");
    return 2;
  }
  const version = changelogVersion(
    readFileSync(join(root, "CHANGELOG.md"), "utf8"),
  );
  const runs = Object.fromEntries(
    REQUIRED_WORKFLOWS.map((w) => [w, pushRuns(repository, w, args.sha)]),
  );
  const decision = decide({
    changelogVersion: version,
    templateVersion: TEMPLATE_VERSION,
    runs,
    remoteTagSha: version ? remoteTagSha(`v${version}`) : null,
  });
  if (decision.action === "fail") {
    console.error(`✘ release tag: ${decision.reason}`);
    return 1;
  }
  console.log(`release tag: ${decision.reason}`);
  if (decision.action === "skip") return 0;
  const { tag } = decision;
  run("git", [
    "-c",
    `user.name=${BOT.name}`,
    "-c",
    `user.email=${BOT.email}`,
    "tag",
    "-a",
    tag,
    "-m",
    tag,
    args.sha,
  ]);
  // A plain push of a new ref: the remote rejects it if the tag appeared meanwhile.
  run("git", ["push", "origin", `refs/tags/${tag}`]);
  console.log(`✔ pushed ${tag} at ${args.sha}`);
  return 0;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  process.exitCode = await main(process.argv.slice(2));
}
