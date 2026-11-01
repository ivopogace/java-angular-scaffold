import { spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export const NO_DOCKER_MESSAGE =
  "Docker is required for the full verify; run with --quick to skip container tests and e2e.";

/**
 * @typedef {{ name: string, cwd: string, command: string, args: string[] }} Step
 * `cwd` is relative to the repository root.
 */

function hasScriptTests() {
  return readdirSync(join(root, "scripts"), { recursive: true }).some((f) =>
    String(f).endsWith(".test.mjs"),
  );
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
    {
      name: "backend build",
      cwd: "backend",
      command: platform === "win32" ? "gradlew.bat" : "./gradlew",
      args: quick ? ["build", "-PexcludeTags=container"] : ["build"],
    },
    npm("frontend lint", "run", "lint"),
    npm("frontend format", "run", "format:check"),
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
        ]),
    ...(scriptTests
      ? [
          {
            name: "script tests",
            cwd: ".",
            command: "node",
            args: ["--test", "scripts/**/*.test.mjs"],
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

/** Quotes one argument for a Windows command line: backslashes before a quote (or the closing quote) are doubled. */
function quote(arg) {
  if (/^[\w@%+=:,./\\-]+$/.test(arg)) return arg;
  const escaped = arg.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\+)$/, "$1$1");
  return `"${escaped}"`;
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
      ? spawn([program, ...args].map(quote).join(" "), options)
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
  const quick = argv.includes("--quick");
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
