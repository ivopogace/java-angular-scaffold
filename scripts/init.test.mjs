import assert from "node:assert/strict";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, test } from "node:test";
import { checkAgentDocs } from "./check-agent-docs.mjs";
import { TEMPLATE_VERSION, parseArgs, validate } from "./init.mjs";
import { normalizeEol, sha256Normalized } from "./lib/text.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const COMMIT_SUBJECT = `Initial commit from scaffold v${TEMPLATE_VERSION}`;
const TEST_IDENTITY = {
  GIT_AUTHOR_NAME: "Init Test",
  GIT_AUTHOR_EMAIL: "init-test@example.invalid",
  GIT_COMMITTER_NAME: "Init Test",
  GIT_COMMITTER_EMAIL: "init-test@example.invalid",
};
const VALID = [
  "--yes",
  "--skip-verify",
  "--name",
  "acme-orders",
  "--package",
  "com.acme.orders",
  "--display",
  "Acme Orders",
];
const TEMPLATE_ONLY = [
  ".github/workflows/template-ci.yml",
  "CHANGELOG.md",
  "CONTRIBUTING.md",
  "README.project.md",
  "docs/superpowers",
  "scripts/init.mjs",
  "scripts/init.test.mjs",
];

const vendoredSkillDirs = Object.keys(
  JSON.parse(readFileSync(join(repoRoot, "skills-lock.json"), "utf8")).skills,
).map((name) => `.claude/skills/${name}/`);

const git = (root, args, env = {}) =>
  execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, ...TEST_IDENTITY, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });

/**
 * A committed throwaway repository holding the template's tracked and
 * untracked-not-ignored files, optionally with CRLF text.
 */
async function copyRepo(t, { crlf = false } = {}) {
  const listed = execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    { cwd: repoRoot, maxBuffer: 64 * 1024 * 1024 },
  )
    .toString("utf8")
    .split("\0")
    .filter(Boolean);
  const root = mkdtempSync(join(tmpdir(), "init-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const rel of listed) {
    const from = join(repoRoot, rel);
    if (!existsSync(from)) continue;
    const to = join(root, rel);
    mkdirSync(dirname(to), { recursive: true });
    const bytes = readFileSync(from);
    writeFileSync(
      to,
      crlf && !bytes.includes(0)
        ? Buffer.from(
            normalizeEol(bytes.toString("utf8")).replaceAll("\n", "\r\n"),
          )
        : bytes,
    );
  }
  for (const args of [
    ["init", "-q", "-b", "main"],
    ["add", "-A"],
    ["commit", "-q", "--no-verify", "-m", "template"],
  ]) {
    const result = await run("git", args, { cwd: root });
    assert.equal(result.status, 0, result.stderr);
  }
  return root;
}

/**
 * Spawns without blocking, so the copy-based tests can run in parallel.
 *
 * @returns {Promise<{ status: number | null, stdout: string, stderr: string }>}
 */
function run(
  command,
  args,
  { cwd, env = { ...process.env, ...TEST_IDENTITY }, input = "" },
) {
  return new Promise((done, fail) => {
    const child = spawn(command, args, { cwd, env });
    const out = { stdout: "", stderr: "" };
    child.stdout.on("data", (chunk) => (out.stdout += chunk));
    child.stderr.on("data", (chunk) => (out.stderr += chunk));
    child.on("error", fail);
    child.on("close", (status) => done({ status, ...out }));
    child.stdin.end(input);
  });
}

const runInit = (root, args, options = {}) =>
  run(process.execPath, [join(root, "scripts", "init.mjs"), ...args], {
    cwd: root,
    ...options,
  });

/** Root-relative paths (forward slashes) of every file, skipping `.git`. */
function files(root, dir = root) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory())
      return entry.name === ".git" ? [] : files(root, full);
    return [relative(root, full).split(sep).join("/")];
  });
}

const dirs = (root, dir = root) =>
  readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== ".git")
    .flatMap((entry) => {
      const full = join(dir, entry.name);
      return [relative(root, full).split(sep).join("/"), ...dirs(root, full)];
    });

const snapshot = (root) =>
  Object.fromEntries(
    files(root)
      .sort()
      .map((file) => [
        file,
        createHash("sha256")
          .update(readFileSync(join(root, file)))
          .digest("hex"),
      ]),
  );

const outsideVendored = (file) =>
  !vendoredSkillDirs.some((dir) => file.startsWith(dir));

function placeholderHits(root) {
  return files(root)
    .filter(outsideVendored)
    .filter(
      (file) =>
        /scaffold/i.test(file) ||
        /scaffold/i.test(readFileSync(join(root, file), "latin1")),
    );
}

test("TEMPLATE_VERSION equals the top CHANGELOG.md entry", () => {
  const changelog = readFileSync(join(repoRoot, "CHANGELOG.md"), "utf8");
  assert.equal(/^## (\S+)/m.exec(changelog)?.[1], TEMPLATE_VERSION);
});

test("parseArgs reads every flag, in both spellings", () => {
  assert.deepEqual(
    parseArgs([
      "--name",
      "acme-orders",
      "--package=com.acme.orders",
      "--display",
      "Acme Orders",
      "--sample",
      "remove",
      "--ci",
      "github, gitlab",
      "--skip-verify",
      "--yes",
    ]),
    {
      name: "acme-orders",
      package: "com.acme.orders",
      display: "Acme Orders",
      sample: "remove",
      ci: ["github", "gitlab"],
      skipVerify: true,
      yes: true,
      help: false,
    },
  );
  assert.deepEqual(parseArgs(["--ci", ""]).ci, []);
  assert.equal(parseArgs([]).ci, undefined);
  assert.throws(() => parseArgs(["--colour"]), /Unknown option --colour/);
  assert.throws(() => parseArgs(["--name"]), /--name needs a value/);
});

test("validate accepts good answers and names each bad one", () => {
  const good = {
    name: "acme-orders",
    package: "com.acme.orders",
    display: "Acme Orders",
    sample: "keep",
    ci: ["github"],
  };
  assert.deepEqual(validate(good), []);
  const errors = (patch) => validate({ ...good, ...patch });
  assert.match(errors({ package: "com.acme.2orders" }).join(), /"2orders"/);
  assert.match(
    errors({ package: "com.new.app" }).join(),
    /"new" is a Java keyword/,
  );
  assert.match(errors({ package: "com.acme.null" }).join(), /"null"/);
  assert.match(errors({ package: "orders" }).join(), /at least two segments/);
  assert.match(errors({ name: "Acme-Orders" }).join(), /--name/);
  assert.match(errors({ name: "acme--orders" }).join(), /--name/);
  assert.match(errors({ display: 'Say "hi"' }).join(), /--display/);
  assert.match(errors({ display: "" }).join(), /--display/);
  assert.match(errors({ display: "x".repeat(61) }).join(), /--display/);
  assert.match(errors({ sample: "drop" }).join(), /--sample/);
  assert.match(errors({ ci: ["circle"] }).join(), /"circle"/);
  assert.match(errors({ ci: ["toString"] }).join(), /"toString"/);
  assert.match(errors({ name: undefined }).join(), /--name is required/);
});

// Each test works on its own copy, so they run in parallel.
describe("init on a throwaway copy", { concurrency: true }, () => {
  test("invalid answers are rejected before any file is touched", async (t) => {
    const root = await copyRepo(t);
    const before = snapshot(root);
    const head = git(root, ["rev-parse", "HEAD"]);
    for (const [flag, value, message] of [
      ["--package", "com.acme.2orders", /"2orders"/],
      ["--package", "com.new.app", /"new" is a Java keyword/],
      ["--name", "Acme-Orders", /--name/],
      ["--display", 'Say "hi"', /--display/],
    ]) {
      const args = [...VALID];
      args[args.indexOf(flag) + 1] = value;
      const result = await runInit(root, args);
      assert.equal(result.status, 1, `${flag} ${value}: ${result.stdout}`);
      assert.match(result.stderr, message);
      assert.match(result.stderr, /Nothing was changed/);
      assert.deepEqual(
        snapshot(root),
        before,
        `${flag} ${value} touched the tree`,
      );
    }
    assert.equal(git(root, ["rev-parse", "HEAD"]), head);
  });

  test("a dirty working tree is refused with nothing changed", async (t) => {
    const root = await copyRepo(t);
    writeFileSync(join(root, "notes.txt"), "work in progress\n");
    const before = snapshot(root);
    const result = await runInit(root, [
      ...VALID,
      "--sample",
      "keep",
      "--ci",
      "github",
    ]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /uncommitted changes/);
    assert.deepEqual(snapshot(root), before);
  });

  test("an edited sample file stops --sample remove with nothing changed", async (t) => {
    const root = await copyRepo(t);
    const product =
      "backend/core/src/main/java/io/scaffold/starter/catalog/domain/model/Product.java";
    writeFileSync(
      join(root, product),
      `${readFileSync(join(root, product), "utf8")}\n`,
    );
    git(root, ["commit", "-q", "--no-verify", "-am", "edit the sample"]);
    const before = snapshot(root);
    const result = await runInit(root, [
      ...VALID,
      "--sample",
      "remove",
      "--ci",
      "",
    ]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Sample files were edited/);
    assert.ok(result.stderr.includes(product));
    assert.match(result.stderr, /Nothing was changed/);
    assert.deepEqual(snapshot(root), before);
  });

  test("missing answers are asked on stdin, and a declined confirmation changes nothing", async (t) => {
    const root = await copyRepo(t);
    const before = snapshot(root);
    const prompted = (input, args = ["--skip-verify"]) =>
      runInit(root, args, { input });

    const declined = await prompted("acme-orders\ncom.acme.orders\n\n\n\nn\n");
    assert.equal(declined.status, 1, declined.stderr);
    assert.match(declined.stdout, /Display name \[Acme Orders\]/);
    assert.match(declined.stderr, /Cancelled\. Nothing was changed\./);
    assert.deepEqual(snapshot(root), before);

    const accepted = await prompted("\ny\n", [
      "--skip-verify",
      "--name",
      "acme-orders",
      "--package",
      "com.acme.orders",
      "--sample",
      "keep",
      "--ci",
      "jenkins",
    ]);
    assert.equal(accepted.status, 0, accepted.stderr);
    assert.match(
      readFileSync(join(root, "frontend/src/index.html"), "utf8"),
      /<title>Acme Orders<\/title>/,
    );
    assert.ok(existsSync(join(root, "Jenkinsfile")));
    assert.ok(!existsSync(join(root, ".gitlab-ci.yml")));
  });

  test("init keeping the sample renames everything and starts a fresh history", async (t) => {
    const root = await copyRepo(t);
    const result = await runInit(root, [
      ...VALID,
      "--sample",
      "keep",
      "--ci",
      "gitlab",
    ]);
    assert.equal(result.status, 0, result.stderr);

    assert.ok(
      existsSync(
        join(
          root,
          "backend/core/src/main/java/com/acme/orders/shared/UseCase.java",
        ),
      ),
    );
    assert.ok(
      existsSync(
        join(
          root,
          "backend/core/src/main/java/com/acme/orders/catalog/domain/model/Product.java",
        ),
      ),
    );
    assert.deepEqual(
      dirs(root).filter((d) => d.includes("io/scaffold")),
      [],
    );
    assert.deepEqual(
      dirs(root).filter((d) => d.endsWith("/java/io")),
      [],
    );
    assert.ok(existsSync(join(root, ".gitlab-ci.yml")));
    assert.ok(
      !existsSync(join(root, ".github")),
      ".github should be gone with both workflows",
    );
    assert.ok(!existsSync(join(root, "Jenkinsfile")));
    for (const path of TEMPLATE_ONLY) {
      assert.ok(!existsSync(join(root, path)), `${path} should be gone`);
    }
    assert.ok(existsSync(join(root, "THIRD_PARTY_LICENSES.md")));
    assert.ok(existsSync(join(root, "scripts/remove-sample.mjs")));

    const readme = readFileSync(join(root, "README.md"), "utf8");
    assert.equal(
      readme,
      readFileSync(join(repoRoot, "README.project.md"), "utf8").replaceAll(
        "Scaffold Starter",
        "Acme Orders",
      ),
    );
    assert.match(
      readFileSync(join(root, "AGENTS.md"), "utf8"),
      /<!-- fill-in:what -->\r?\nTODO: describe this project\.\r?\n<!-- \/fill-in:what -->/,
    );
    assert.match(
      readFileSync(join(root, "backend/settings.gradle.kts"), "utf8"),
      /rootProject\.name = "acme-orders"/,
    );
    assert.match(
      readFileSync(join(root, "compose.yaml"), "utf8"),
      /POSTGRES_DB: acme_orders/,
    );
    assert.match(
      readFileSync(
        join(
          root,
          "frontend/src/app/core/app-title-strategy/app-title-strategy.ts",
        ),
        "utf8",
      ),
      /'Acme Orders'/,
    );

    assert.equal(git(root, ["log", "--format=%s"]), `${COMMIT_SUBJECT}\n`);
    assert.equal(git(root, ["branch", "--show-current"]).trim(), "main");
    assert.equal(git(root, ["config", "core.hooksPath"]).trim(), ".githooks");
    assert.equal(git(root, ["status", "--porcelain"]), "");
    assert.equal(git(root, ["remote"]), "");

    assert.deepEqual(placeholderHits(root), []);
    assert.deepEqual(checkAgentDocs(root), []);

    const { SAMPLE_FILES } = await import(
      `${pathToFileURL(join(root, "scripts/remove-sample.mjs")).href}?t=${Date.now()}`
    );
    for (const { path, sha256 } of SAMPLE_FILES.filter((f) =>
      existsSync(join(root, f.path)),
    )) {
      assert.equal(
        sha256Normalized(join(root, path)),
        sha256,
        `${path} hash not refreshed`,
      );
    }
    assert.match(result.stdout, /git remote add origin/);
  });

  test("init removing the sample leaves no catalog path and no remove-sample script", async (t) => {
    const root = await copyRepo(t);
    const result = await runInit(root, [
      ...VALID,
      "--sample",
      "remove",
      "--ci",
      "",
    ]);
    assert.equal(result.status, 0, result.stderr);

    assert.deepEqual(
      [...files(root), ...dirs(root)].filter((p) => /catalog/i.test(p)),
      [],
    );
    assert.ok(!existsSync(join(root, "scripts/remove-sample.mjs")));
    assert.ok(!existsSync(join(root, "scripts/remove-sample.test.mjs")));
    assert.ok(
      existsSync(join(root, "scripts/lib/text.mjs")),
      "check-agent-docs still imports it",
    );
    assert.ok(!existsSync(join(root, "GLOSSARY.md")));
    for (const wrapper of [".github", ".gitlab-ci.yml", "Jenkinsfile"]) {
      assert.ok(!existsSync(join(root, wrapper)), `${wrapper} should be gone`);
    }
    assert.ok(
      existsSync(
        join(
          root,
          "backend/core/src/main/java/com/acme/orders/shared/UseCase.java",
        ),
      ),
    );
    assert.deepEqual(placeholderHits(root), []);
    assert.deepEqual(checkAgentDocs(root), []);
    assert.equal(git(root, ["log", "--format=%s"]), `${COMMIT_SUBJECT}\n`);
  });

  test("a second run prints Already initialized. and exits 1", async (t) => {
    const root = await copyRepo(t);
    assert.equal(
      (await runInit(root, [...VALID, "--sample", "remove", "--ci", "github"]))
        .status,
      0,
    );
    assert.ok(
      !existsSync(join(root, "scripts/init.mjs")),
      "init deletes itself",
    );
    writeFileSync(
      join(root, "scripts/init.mjs"),
      readFileSync(join(repoRoot, "scripts/init.mjs")),
    );
    const before = snapshot(root);
    const again = await runInit(root, [
      ...VALID,
      "--sample",
      "keep",
      "--ci",
      "github",
    ]);
    assert.equal(again.status, 1);
    assert.match(again.stderr, /Already initialized\./);
    assert.deepEqual(snapshot(root), before);
  });

  test("a CRLF working copy keeps CRLF endings in every rewritten file", async (t) => {
    const root = await copyRepo(t, { crlf: true });
    const result = await runInit(root, [
      ...VALID,
      "--sample",
      "keep",
      "--ci",
      "github",
    ]);
    assert.equal(result.status, 0, result.stderr);

    const rewritten = files(root).filter(
      (file) =>
        outsideVendored(file) &&
        /com[./]acme[./]orders|acme-orders|acme_orders|Acme Orders|TODO: describe this project/.test(
          readFileSync(join(root, file), "latin1"),
        ),
    );
    assert.ok(
      rewritten.length > 50,
      `only ${rewritten.length} rewritten files`,
    );
    for (const file of rewritten) {
      const text = readFileSync(join(root, file), "utf8");
      assert.ok(!/(^|[^\r])\n/.test(text), `${file} lost its CRLF endings`);
    }
    assert.ok(rewritten.includes("AGENTS.md"));
    assert.ok(rewritten.includes("scripts/remove-sample.mjs"));
    assert.deepEqual(placeholderHits(root), []);
  });

  test("a missing git identity stops before the commit with the command to finish", async (t) => {
    const root = await copyRepo(t);
    const emptyConfig = `${root}-gitconfig`;
    writeFileSync(emptyConfig, "");
    t.after(() => rmSync(emptyConfig, { force: true }));
    const env = Object.fromEntries(
      Object.entries(process.env).filter(
        ([key]) => !/^GIT_(AUTHOR|COMMITTER)_/.test(key),
      ),
    );
    const result = await runInit(
      root,
      [...VALID, "--sample", "keep", "--ci", "github"],
      {
        env: {
          ...env,
          GIT_CONFIG_GLOBAL: emptyConfig,
          GIT_CONFIG_NOSYSTEM: "1",
          GIT_CONFIG_COUNT: "1",
          GIT_CONFIG_KEY_0: "user.useConfigOnly",
          GIT_CONFIG_VALUE_0: "true",
        },
      },
    );
    assert.equal(result.status, 1);
    assert.ok(
      result.stderr.includes(
        `Set git user.name and user.email, then run: git add -A && git commit -m "${COMMIT_SUBJECT}"`,
      ),
      result.stderr,
    );
    assert.equal(git(root, ["config", "core.hooksPath"]).trim(), ".githooks");
    assert.equal(
      spawnSync("git", ["rev-parse", "HEAD"], { cwd: root }).status,
      128,
    );
  });
});
