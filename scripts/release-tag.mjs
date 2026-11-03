#!/usr/bin/env node
// Template-only release automation: init deletes this file, its test and .github/workflows/release-tag.yml.
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
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

Tags <commit> as v<TEMPLATE_VERSION> (scripts/init.mjs) if ${REQUIRED_WORKFLOWS.join(" and ")}
have both succeeded for a push of it to main, and pushes the tag. Needs gh with
GH_TOKEN (the workflow passes GITHUB_TOKEN) and GITHUB_REPOSITORY; never moves an
existing tag.`;

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

/** "success" when any run succeeded, "pending" while none did and one is unfinished or none exists, else "failed". */
export function workflowState(runs) {
  if (runs.some((run) => run.conclusion === "success")) return "success";
  if (runs.length === 0 || runs.some((run) => run.status !== "completed")) {
    return "pending";
  }
  return "failed";
}

/** `runs` are the commit's push runs on main by workflow file; `remoteTagSha` is null when no tag exists. */
export function decide({ version, runs, remoteTagSha }) {
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
  const version = TEMPLATE_VERSION;
  const runs = Object.fromEntries(
    REQUIRED_WORKFLOWS.map((w) => [w, pushRuns(repository, w, args.sha)]),
  );
  const decision = decide({
    version,
    runs,
    remoteTagSha: remoteTagSha(`v${version}`),
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
