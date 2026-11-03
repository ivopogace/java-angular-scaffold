#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { pruneEmptyParents } from "./lib/fs.mjs";
import { normalizeEol, rewritePreservingEol } from "./lib/text.mjs";

// Loaded only when present, so a stray copy of this script still refuses cleanly in an initialized project.
const sample = existsSync(new URL("./remove-sample.mjs", import.meta.url))
  ? await import("./remove-sample.mjs")
  : null;

/** The template release this script ships with; release-tag.mjs tags it as v<version>. */
export const TEMPLATE_VERSION = "0.2.0";

const COMMIT_MESSAGE = `Initial commit from scaffold v${TEMPLATE_VERSION}`;
const MARKER_FILE = ".github/workflows/template-ci.yml";
const PLACEHOLDER_PACKAGE = "io.scaffold.starter";
const PLACEHOLDER_NAME = "scaffold-starter";
const PLACEHOLDER_DISPLAY = "Scaffold Starter";
/** Every spelling the template uses for its own name, paired with the answer that replaces it. */
const replacementsFor = (answers) => [
  [PLACEHOLDER_PACKAGE, answers.package],
  [
    PLACEHOLDER_PACKAGE.replaceAll(".", "/"),
    answers.package.replaceAll(".", "/"),
  ],
  [PLACEHOLDER_NAME, answers.name],
  [PLACEHOLDER_NAME.replaceAll("-", "_"), answers.name.replaceAll("-", "_")],
  [PLACEHOLDER_DISPLAY, answers.display],
];
const PLACEHOLDERS = replacementsFor({
  package: "",
  name: "",
  display: "",
}).map(([token]) => token);
const CI_WRAPPERS = {
  github: ".github/workflows/ci.yml",
  gitlab: ".gitlab-ci.yml",
  jenkins: "Jenkinsfile",
};
const DEFAULT_CI = ["github"];
const TEMPLATE_ONLY = [
  MARKER_FILE,
  "CONTRIBUTING.md",
  "README.md",
  "docs/superpowers",
  "scripts/init.mjs",
  "scripts/init.test.mjs",
  ".github/workflows/release-tag.yml",
  "scripts/release-tag.mjs",
  "scripts/release-tag.test.mjs",
];
const SAMPLE_SCRIPTS = [
  "scripts/remove-sample.mjs",
  "scripts/remove-sample.test.mjs",
];
const JAVA_ROOT =
  /^(backend\/(?:core|adapters|bootstrap)\/src\/(?:main|test)\/java\/)io\/scaffold\/starter\//;
const WHAT_THIS_IS =
  /(<!-- fill-in:what -->\n)[\s\S]*?(\n<!-- \/fill-in:what -->)/;
const WHAT_THIS_IS_BODY = "TODO: describe this project.";

const NAME = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const PACKAGE_SEGMENT = /^[a-z][a-z0-9_]*$/;
const DISPLAY_FORBIDDEN = /["'\\<>`${}@]/;
const DISPLAY_MAX = 60;
const JAVA_RESERVED = new Set(
  (
    "abstract assert boolean break byte case catch char class const continue default do double " +
    "else enum extends final finally float for goto if implements import instanceof int interface " +
    "long native new package private protected public return short static strictfp super switch " +
    "synchronized this throw throws transient try void volatile while true false null"
  ).split(" "),
);

const HELP = `Turns this clone of the template into a new, independent project.

Usage: node scripts/init.mjs [options]

  --name <name>        project name, lowercase words joined by hyphens (acme-orders)
  --package <package>  base Java package, two or more segments (com.acme.orders)
  --display <text>     display name, 1-${DISPLAY_MAX} characters (Acme Orders)
  --sample keep|remove keep or delete the catalog sample (default: keep)
  --ci <list>          CI wrappers to keep: comma-separated github, gitlab, jenkins;
                       "" keeps none (default: github)
  --skip-verify        do not run node scripts/verify.mjs at the end
  --yes                non-interactive: no prompts, no confirmation

Missing answers are asked for interactively unless --yes is given. The script
rewrites the placeholder names, moves the Java packages, deletes the
template-only files, replaces .git with a fresh history of one commit and runs
verify. It refuses on a working tree with uncommitted changes.
`;

/** @throws {Error} on an unknown option or an option without its value */
export function parseArgs(argv) {
  const answers = { skipVerify: false, yes: false, help: false };
  const valued = {
    "--name": "name",
    "--package": "package",
    "--display": "display",
    "--sample": "sample",
    "--ci": "ci",
  };
  for (let i = 0; i < argv.length; i++) {
    const [flag, inline] =
      argv[i].startsWith("--") && argv[i].includes("=")
        ? [
            argv[i].slice(0, argv[i].indexOf("=")),
            argv[i].slice(argv[i].indexOf("=") + 1),
          ]
        : [argv[i], undefined];
    if (flag === "--skip-verify") answers.skipVerify = true;
    else if (flag === "--yes") answers.yes = true;
    else if (flag === "--help" || flag === "-h") answers.help = true;
    else if (flag in valued) {
      let value = inline;
      if (value === undefined) {
        const next = argv[i + 1];
        if (next === undefined || next.startsWith("--")) {
          throw new Error(`${flag} needs a value`);
        }
        value = next;
        i++;
      }
      answers[valued[flag]] = flag === "--ci" ? splitList(value) : value;
    } else {
      throw new Error(`Unknown option ${flag}`);
    }
  }
  return answers;
}

const splitList = (value) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

export function validate(answers) {
  const errors = [];
  const {
    name,
    package: pkg,
    display,
    sample = "keep",
    ci = DEFAULT_CI,
  } = answers;
  if (!name) errors.push("--name is required");
  else if (!NAME.test(name)) {
    errors.push(
      `--name "${name}" is invalid: use lowercase letters and digits in hyphen-separated words, starting with a letter (e.g. acme-orders)`,
    );
  } else errors.push(...placeholderErrors("--name", name));
  if (!pkg) errors.push("--package is required");
  else {
    const invalid = packageErrors(pkg);
    errors.push(
      ...(invalid.length > 0 ? invalid : placeholderErrors("--package", pkg)),
    );
  }
  if (display === undefined || display === "") {
    errors.push(
      display === undefined
        ? "--display is required"
        : `--display must be 1-${DISPLAY_MAX} characters`,
    );
  } else if (display.length > DISPLAY_MAX) {
    errors.push(
      `--display must be 1-${DISPLAY_MAX} characters (is ${display.length})`,
    );
  } else if (DISPLAY_FORBIDDEN.test(display) || /\p{Cc}/u.test(display)) {
    errors.push(
      `--display "${display}" is invalid: it may not contain " ' \\ < > \` $ { } @ or control characters`,
    );
  } else if (display !== display.trim()) {
    errors.push("--display may not start or end with a space");
  } else errors.push(...placeholderErrors("--display", display));
  if (sample !== "keep" && sample !== "remove") {
    errors.push(`--sample must be keep or remove (is "${sample}")`);
  }
  for (const wrapper of ci) {
    if (!Object.hasOwn(CI_WRAPPERS, wrapper)) {
      errors.push(
        `--ci "${wrapper}" is unknown; choose from ${Object.keys(CI_WRAPPERS).join(", ")}`,
      );
    }
  }
  return errors;
}

/** An answer holding a placeholder would survive the rewrite as the template's name. */
function placeholderErrors(flag, value) {
  const token = PLACEHOLDERS.find((candidate) => value.includes(candidate));
  return token
    ? [
        `${flag} "${value}" may not contain the template's placeholder "${token}"`,
      ]
    : [];
}

function packageErrors(pkg) {
  const segments = pkg.split(".");
  if (segments.length < 2) {
    return [
      `--package "${pkg}" needs at least two segments (e.g. com.acme.orders)`,
    ];
  }
  return segments.flatMap((segment) => {
    if (!PACKAGE_SEGMENT.test(segment)) {
      return [
        `--package "${pkg}": segment "${segment}" must start with a lowercase letter and hold only lowercase letters, digits and underscores`,
      ];
    }
    return JAVA_RESERVED.has(segment)
      ? [
          `--package "${pkg}": segment "${segment}" is a Java keyword or literal`,
        ]
      : [];
  });
}

/** Writes nothing. Sample removal comes first: its drift check hashes the files as shipped, and it can refuse. */
export function planChanges(root, answers) {
  const removing = answers.sample === "remove";
  const ci = answers.ci ?? DEFAULT_CI;
  const deleted = new Set([
    ...TEMPLATE_ONLY,
    ...(removing ? SAMPLE_SCRIPTS : []),
    ...Object.entries(CI_WRAPPERS)
      .filter(([wrapper]) => !ci.includes(wrapper))
      .map(([, path]) => path),
  ]);
  const sampleFiles = new Set(
    removing ? (sample?.SAMPLE_FILES ?? []).map((f) => f.path) : [],
  );
  const vendored = vendoredSkillDirs(root);
  const survivors = listFiles(root).filter(
    (file) =>
      !sampleFiles.has(file) &&
      ![...deleted].some(
        (path) => file === path || file.startsWith(`${path}/`),
      ),
  );
  const replacements = replacementsFor(answers);
  const rewrites = survivors
    .filter((file) => !vendored.some((dir) => file.startsWith(dir)))
    .filter((file) => {
      const bytes = readFileSync(join(root, file));
      return (
        !bytes.includes(0) &&
        replacements.some(([from]) => bytes.includes(from))
      );
    })
    .map((path) => ({ type: "rewrite", path, replacements }));
  const packagePath = `${answers.package.replaceAll(".", "/")}/`;
  const moves = survivors
    .filter((file) => JAVA_ROOT.test(file))
    .map((from) => ({
      type: "move",
      from,
      to: from.replace(JAVA_ROOT, `$1${packagePath}`),
    }));
  return [
    ...(removing ? [{ type: "removeSample" }] : []),
    ...rewrites,
    ...moves,
    ...(removing ? [] : [{ type: "refreshSampleHashes" }]),
    ...[...deleted]
      .filter((path) => existsSync(join(root, path)))
      .map((path) => ({ type: "delete", path })),
    { type: "rename", from: "README.project.md", to: "README.md" },
    { type: "fillIn", path: "AGENTS.md", body: WHAT_THIS_IS_BODY },
  ];
}

/** Tracked and untracked-not-ignored files under `root` that exist on disk. */
function listFiles(root) {
  return git(root, [
    "ls-files",
    "--cached",
    "--others",
    "--exclude-standard",
    "-z",
  ])
    .split("\0")
    .filter((file) => file && existsSync(join(root, file)));
}

function vendoredSkillDirs(root) {
  const lock = join(root, "skills-lock.json");
  if (!existsSync(lock)) return [];
  return Object.keys(JSON.parse(readFileSync(lock, "utf8")).skills ?? {}).map(
    (name) => `.claude/skills/${name}/`,
  );
}

/** @throws {Error} when the sample cannot be removed or a fill-in section is missing */
export async function applyChanges(root, changes) {
  for (const change of changes) {
    const at = (path) => join(root, path);
    switch (change.type) {
      case "removeSample":
        runRemoveSample(root);
        break;
      case "rewrite":
        rewritePreservingEol(at(change.path), (text) =>
          replaceTokens(text, change.replacements),
        );
        break;
      case "move":
        mkdirSync(dirname(at(change.to)), { recursive: true });
        renameSync(at(change.from), at(change.to));
        pruneEmptyParents(root, dirname(at(change.from)));
        break;
      case "refreshSampleHashes":
        await refreshSampleHashes(root);
        break;
      case "delete":
        rmSync(at(change.path), { recursive: true, force: true });
        pruneEmptyParents(root, dirname(at(change.path)));
        break;
      case "rename":
        renameSync(at(change.from), at(change.to));
        break;
      case "fillIn":
        if (
          !WHAT_THIS_IS.test(
            normalizeEol(readFileSync(at(change.path), "utf8")),
          )
        ) {
          throw new Error(
            `${change.path} has no <!-- fill-in:what --> section`,
          );
        }
        rewritePreservingEol(at(change.path), (text) =>
          text.replace(
            WHAT_THIS_IS,
            (_, open, close) => `${open}${change.body}${close}`,
          ),
        );
        break;
      default:
        throw new Error(`Unknown change ${change.type}`);
    }
  }
}

/** One pass, so a replacement's output is never rescanned; where tokens overlap, the longest wins. */
export function replaceTokens(text, replacements) {
  const byToken = new Map(replacements);
  if (byToken.size === 0) return text;
  const pattern = new RegExp(
    [...byToken.keys()]
      .sort((a, b) => b.length - a.length)
      .map((token) => RegExp.escape(token))
      .join("|"),
    "g",
  );
  return text.replace(pattern, (token) => byToken.get(token));
}

/** An error raised before anything under the root was changed. */
class Untouched extends Error {}

function runRemoveSample(root) {
  if (!sample) return;
  const result = sample.removeSample(root);
  if (result.drifted) {
    throw new Untouched(
      `Sample files were edited, so the sample cannot be removed safely. Run with --sample keep, or remove the sample by hand and commit, then re-run init. Edited:\n  ${result.drifted.join("\n  ")}`,
    );
  }
  if (result.markerProblems) {
    throw new Untouched(
      `A marked file no longer matches the shipped layout, so the sample cannot be removed safely:\n  ${result.markerProblems
        .map(({ file, line, text }) => `${file}:${line}: ${text}`)
        .join("\n  ")}`,
    );
  }
  if (result.failed) {
    throw new Error(`Sample removal stopped: ${result.failed.error.message}`);
  }
}

/** Re-records remove-sample's hashes, which the package rename changed, from the rewritten script itself. */
async function refreshSampleHashes(root) {
  const script = join(root, "scripts", "remove-sample.mjs");
  if (!existsSync(script)) return;
  const { refreshHashes } = await import(
    `${pathToFileURL(script).href}?initialized`
  );
  const result = refreshHashes(root, script);
  if (result.missing) {
    console.warn(
      `remove-sample.mjs hashes not refreshed; missing:\n  ${result.missing.join("\n  ")}`,
    );
  }
}

const git = (root, args) =>
  execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 64 * 1024 * 1024,
  });

const gitSucceeds = (root, args) =>
  spawnSync("git", args, { cwd: root, stdio: "ignore" }).status === 0;

export function nodeVersionProblem(running, required) {
  const major = (version) => Number(version.replace(/^v/, "").split(".")[0]);
  return major(running) < major(required)
    ? `init needs Node ${required} (.nvmrc); this is Node ${running}. Nothing was changed.`
    : null;
}

function refusal(root) {
  if (!existsSync(join(root, MARKER_FILE))) return "Already initialized.";
  const nvmrc = join(root, ".nvmrc");
  const tooOld =
    existsSync(nvmrc) &&
    nodeVersionProblem(
      process.versions.node,
      readFileSync(nvmrc, "utf8").trim(),
    );
  if (tooOld) return tooOld;
  let status;
  try {
    status = git(root, ["status", "--porcelain"]);
  } catch {
    return "Not a git checkout; clone the template with git, then run init.";
  }
  return status.trim()
    ? `The working tree has uncommitted changes; commit or stash them, then run init:\n${status}`
    : null;
}

/** One line iterator for all questions, so piped input survives; after EOF every answer is `fallback`. */
async function prompter() {
  const { createInterface } = await import("node:readline");
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const lines = rl[Symbol.asyncIterator]();
  const question = async (text, fallback = "") => {
    process.stdout.write(fallback ? `${text} [${fallback}]: ` : `${text}: `);
    const { value, done } = await lines.next();
    return (done ? "" : value).trim() || fallback;
  };
  return { question, close: () => rl.close() };
}

async function askMissing(answers, question) {
  const name =
    answers.name ?? (await question("Project name (e.g. acme-orders)"));
  return {
    ...answers,
    name,
    package:
      answers.package ??
      (await question("Base Java package (e.g. com.acme.orders)")),
    display:
      answers.display ?? (await question("Display name", titleCase(name))),
    sample:
      answers.sample ??
      (await question("Keep the catalog sample? keep/remove", "keep")),
    ci:
      answers.ci ??
      splitList(
        await question(
          "CI wrappers to keep (github,gitlab,jenkins; - for none)",
          DEFAULT_CI.join(","),
        ),
      ).filter((item) => item !== "-"),
  };
}

const titleCase = (name = "") =>
  name
    .split("-")
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");

/** The commands that finish {@link freshHistory} by hand; each is safe to re-run. */
const FINISH_HISTORY = [
  "git init",
  "git symbolic-ref HEAD refs/heads/main",
  "git config core.hooksPath .githooks",
  "git add -A",
  `git commit --no-verify -m "${COMMIT_MESSAGE}"`,
];

const HISTORY_ATTEMPTS = 3;
const HISTORY_RETRY_PAUSE_MS = 2000;

const pause = (ms) =>
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

/** Retries while a lingering git process writes the old history back; false when git has no identity. */
export function freshHistory(
  root,
  { pauseMs = HISTORY_RETRY_PAUSE_MS, afterInit = () => {} } = {},
) {
  for (let attempt = 1; attempt <= HISTORY_ATTEMPTS; attempt++) {
    if (attempt > 1) pause(pauseMs);
    rmSync(join(root, ".git"), { recursive: true, force: true });
    git(root, ["init", "-q"]);
    afterInit();
    git(root, ["symbolic-ref", "HEAD", "refs/heads/main"]);
    git(root, ["config", "core.hooksPath", ".githooks"]);
    git(root, ["add", "-A"]);
    if (
      !gitSucceeds(root, ["var", "GIT_AUTHOR_IDENT"]) ||
      !gitSucceeds(root, ["var", "GIT_COMMITTER_IDENT"])
    ) {
      return false;
    }
    // The hook needs the frontend toolchain, which a fresh clone has not installed; verify runs next.
    git(root, ["commit", "-q", "--no-verify", "-m", COMMIT_MESSAGE]);
    if (git(root, ["rev-list", "--count", "--all"]).trim() === "1") return true;
  }
  throw new Error(
    "Another git process kept writing the old history into .git (maintenance detached after the clone?). Wait for it to finish and delete .git first.",
  );
}

async function main(argv, root) {
  let answers;
  try {
    answers = parseArgs(argv);
  } catch (error) {
    console.error(`${error.message}\n\n${HELP}`);
    return 1;
  }
  if (answers.help) {
    console.log(HELP);
    return 0;
  }
  const refused = refusal(root);
  if (refused) {
    console.error(refused);
    return 1;
  }
  const prompt = answers.yes ? null : await prompter();
  try {
    if (prompt) answers = await askMissing(answers, prompt.question);
    answers = {
      ...answers,
      sample: answers.sample ?? "keep",
      ci: answers.ci ?? DEFAULT_CI,
    };
    const errors = validate(answers);
    if (errors.length > 0) {
      console.error(`${errors.join("\n")}\nNothing was changed.`);
      return 1;
    }
    const confirm = prompt
      ? await prompt.question(
          `Initialize ${answers.display} (${answers.name}, ${answers.package}), sample: ${answers.sample}, CI: ${answers.ci.join(", ") || "none"}? This replaces .git with a fresh history. y/N`,
        )
      : "yes";
    if (!/^y(es)?$/i.test(confirm)) {
      console.error("Cancelled. Nothing was changed.");
      return 1;
    }
  } finally {
    prompt?.close();
  }

  let changes;
  try {
    changes = planChanges(root, answers);
  } catch (error) {
    console.error(`${error.message}\nNothing was changed.`);
    return 1;
  }
  try {
    await applyChanges(root, changes);
  } catch (error) {
    console.error(
      error instanceof Untouched
        ? `${error.message}\nNothing was changed.`
        : `${error.message}\nThe tree is partly initialized; .git is untouched, so git reset --hard && git clean -fd restores it.`,
    );
    return 1;
  }
  let committed;
  try {
    committed = freshHistory(root);
  } catch (error) {
    console.error(
      [
        error.stderr?.trim() || error.message,
        "The files are initialized, but the fresh history in .git is unfinished.",
        "Fix the git problem above (for a signing failure, set up your signing key or run git config commit.gpgsign false), then run:",
        ...FINISH_HISTORY.map((command) => `  ${command}`),
      ].join("\n"),
    );
    return 1;
  }
  if (!committed) {
    console.error(
      `Set git user.name and user.email, then run: git add -A && git commit --no-verify -m "${COMMIT_MESSAGE}"`,
    );
    return 1;
  }
  console.log(
    `Initialized ${answers.display} (${answers.name}, ${answers.package}) with one commit on main.`,
  );
  if (!answers.skipVerify) {
    const verify = spawnSync(
      process.execPath,
      [join("scripts", "verify.mjs")],
      {
        cwd: root,
        stdio: "inherit",
      },
    );
    if (verify.status !== 0) {
      console.error(
        "verify failed; the project is initialized and committed, fix and re-run node scripts/verify.mjs.",
      );
      return verify.status ?? 1;
    }
  }
  console.log(
    "Next: create an empty repository on your host, then\n  git remote add origin <url>\n  git push -u origin main",
  );
  return 0;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  process.exitCode = await main(
    process.argv.slice(2),
    resolve(dirname(fileURLToPath(import.meta.url)), ".."),
  );
}
