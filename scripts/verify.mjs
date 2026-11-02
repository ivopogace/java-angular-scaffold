import { spawn } from "node:child_process";
import { existsSync, globSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { quoteForCmd } from "./lib/shell.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export const NO_DOCKER_MESSAGE =
  "Docker is required for the full verify; run with --quick to skip container tests and e2e.";

export const USAGE = "Usage: node scripts/verify.mjs [--quick]";

/**
 * @param {string[]} argv the arguments after the script name
 * @returns {{ quick: boolean } | { error: string }} the options, or why the arguments are rejected.
 */
export function parseArgs(argv) {
  const unknown = argv.filter((arg) => arg !== "--quick");
  if (unknown.length > 0) {
    return { error: `Unknown argument: ${unknown.join(" ")}\n${USAGE}` };
  }
  return { quick: argv.includes("--quick") };
}

/**
 * @typedef {{ name: string, cwd: string, command: string, args: string[] }} Step
 * `cwd` is relative to the repository root.
 */

const SCRIPT_TESTS = "scripts/**/*.test.mjs";

function hasScriptTests() {
  return globSync(SCRIPT_TESTS, { cwd: root }).length > 0;
}

function hasAgentDocsCheck() {
  return existsSync(join(root, "scripts", "check-agent-docs.mjs"));
}

/**
 * The ordered verification steps. Pure data: spawning is {@link runCommand}'s concern.
 *
 * @param {{ quick: boolean, platform: NodeJS.Platform, hasNodeModules: boolean,
 *           hasScriptTests?: boolean, hasAgentDocsCheck?: boolean, ci?: boolean }} options
 *        `hasScriptTests` and `hasAgentDocsCheck` default to what is on disk, `ci` to the CI environment variable.
 * @returns {Step[]}
 */
export function planSteps({
  quick,
  platform,
  hasNodeModules,
  hasScriptTests: scriptTests = hasScriptTests(),
  hasAgentDocsCheck: agentDocs = hasAgentDocsCheck(),
  ci = Boolean(process.env.CI),
}) {
  const npm = (name, ...args) => ({
    name,
    cwd: "frontend",
    command: "npm",
    args,
  });
  return [
    ...(hasNodeModules ? [] : [npm("npm ci", "ci")]),
    // First, as it needs only the lockfile. npm audit asks the registry, whose advisories change
    // under an unchanged lockfile, so --quick leaves it out; the full verify, which CI runs, fails on
    // a high or critical advisory.
    ...(quick ? [] : [npm("frontend audit", "audit", "--audit-level=high")]),
    {
      name: "backend build",
      cwd: "backend",
      command: platform === "win32" ? "gradlew.bat" : "./gradlew",
      args: quick ? ["build", "-PexcludeTags=container"] : ["build"],
    },
    npm("frontend lint", "run", "lint"),
    npm("frontend format", "run", "format:check"),
    {
      name: "scripts format",
      cwd: "frontend",
      command: "npx",
      args: ["prettier", "--check", "../scripts"],
    },
    npm("frontend eslint rules", "run", "test:eslint-rules"),
    npm("frontend unit tests", "test", "--", "--watch=false"),
    npm("frontend build", "run", "build"),
    npm("frontend e2e types", "run", "typecheck:e2e"),
    ...(quick
      ? []
      : [
          {
            name: "frontend playwright install",
            cwd: "frontend",
            command: "npx",
            args: [
              "playwright",
              "install",
              "chromium",
              ...(ci ? ["--with-deps"] : []),
            ],
          },
          npm("frontend e2e", "run", "test:e2e"),
          // The production image both ways, against Postgres: health, the locale redirect and
          // both builds. Buildpacks (bootBuildImage) packages the frontend build above; the
          // Dockerfile, which source-building hosts such as Render use, builds its own. Both need
          // Docker and registry access, so --quick leaves them out.
          {
            name: "image smoke test (buildpacks)",
            cwd: ".",
            command: "node",
            args: [
              "scripts/smoke-image.mjs",
              "--builder",
              "buildpacks",
              "--skip-frontend-build",
            ],
          },
          {
            name: "image smoke test (dockerfile)",
            cwd: ".",
            command: "node",
            args: ["scripts/smoke-image.mjs", "--builder", "dockerfile"],
          },
        ]),
    ...(scriptTests
      ? [
          {
            name: "script tests",
            cwd: ".",
            command: "node",
            args: ["--test", SCRIPT_TESTS],
          },
        ]
      : []),
    ...(agentDocs
      ? [
          {
            name: "agent docs check",
            cwd: ".",
            command: "node",
            args: ["scripts/check-agent-docs.mjs"],
          },
        ]
      : []),
  ];
}

/**
 * @param {{ quick: boolean, dockerAvailable: () => Promise<boolean> }} options
 * @returns {Promise<string | null>} the reason the run cannot start, or null.
 */
export async function preflight({ quick, dockerAvailable }) {
  if (quick) return null;
  return (await dockerAvailable()) ? null : NO_DOCKER_MESSAGE;
}

/**
 * Runs a command with inherited stdio. On Windows everything except `node` goes through the shell, since
 * `npm`, `npx` and `gradlew.bat` are batch shims that cannot be spawned directly.
 *
 * @returns {Promise<number>} the exit code (1 when the process could not start).
 */
export function runCommand(
  { command, args, cwd },
  { platform = process.platform, stdio = "inherit" } = {},
) {
  const shell = platform === "win32" && command !== "node";
  return new Promise((done) => {
    const dir = resolve(root, cwd);
    const options = { cwd: dir, stdio, shell };
    // cmd.exe does not look in the working directory for a bare name such as gradlew.bat.
    const program =
      shell && existsSync(join(dir, command)) ? `.\\${command}` : command;
    const child = shell
      ? spawn([program, ...args].map(quoteForCmd).join(" "), options)
      : spawn(command, args, options);
    child.on("error", () => done(1));
    child.on("close", (code) => done(code ?? 1));
  });
}

async function dockerAvailable() {
  return (
    (await runCommand(
      { command: "docker", args: ["info"], cwd: "." },
      { stdio: "ignore" },
    )) === 0
  );
}

async function main(argv) {
  const args = parseArgs(argv);
  if ("error" in args) {
    console.error(args.error);
    return 2;
  }
  const { quick } = args;
  const problem = await preflight({ quick, dockerAvailable });
  if (problem) {
    console.error(problem);
    return 1;
  }
  const steps = planSteps({
    quick,
    platform: process.platform,
    hasNodeModules: existsSync(join(root, "frontend", "node_modules")),
  });
  for (const step of steps) {
    console.log(
      `\n> ${step.name}: ${step.command} ${step.args.join(" ")}  (${step.cwd})`,
    );
    if ((await runCommand(step)) !== 0) {
      console.error(`✘ ${step.name}`);
      return 1;
    }
    console.log(`✔ ${step.name}`);
  }
  return 0;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  process.exitCode = await main(process.argv.slice(2));
}
