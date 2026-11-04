import assert from "node:assert/strict";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, test } from "node:test";
import { checkAgentDocs } from "./check-agent-docs.mjs";
import {
  TEMPLATE_VERSION,
  freshHistory,
  layoutJooqImports,
  nodeVersionProblem,
  parseArgs,
  replaceTokens,
  validate,
} from "./init.mjs";
import { normalizeEol, sha256Normalized } from "./lib/text.mjs";
import { SAMPLE_FILES } from "./remove-sample.mjs";

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
// The frontend's own Prettier; run from a copy's frontend/ it applies that copy's config and ignore file.
const PRETTIER = join(
  repoRoot,
  "frontend/node_modules/prettier/bin/prettier.cjs",
);
const TEMPLATE_ONLY = [
  ".github/workflows/template-ci.yml",
  "CONTRIBUTING.md",
  "README.project.md",
  "docs/superpowers",
  "scripts/init.mjs",
  "scripts/init.test.mjs",
  ".github/workflows/release-tag.yml",
  "scripts/release-tag.mjs",
  "scripts/release-tag.test.mjs",
];

const vendoredSkillDirs = Object.keys(
  JSON.parse(readFileSync(join(repoRoot, "skills-lock.json"), "utf8")).skills,
).map((name) => `.claude/skills/${name}/`);

// After remove-sample (the template CI skeleton job) the sample-specific assertions are skipped.
const sampleShipped = SAMPLE_FILES.some((f) =>
  existsSync(join(repoRoot, f.path)),
);

const git = (root, args, env = {}) =>
  execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, ...TEST_IDENTITY, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });

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
    // A background gc or maintenance run would still be writing into .git when init replaces it.
    ["config", "gc.auto", "0"],
    ["config", "maintenance.auto", "false"],
    ["add", "-A"],
    ["commit", "-q", "--no-verify", "-m", "template"],
  ]) {
    const result = await run("git", args, { cwd: root });
    assert.equal(result.status, 0, result.stderr);
  }
  return root;
}

/** Non-blocking, so the copy-based tests can run in parallel. */
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
    // A process that exits before reading stdin (a refusal) closes the pipe under the write.
    child.stdin.on("error", (error) => {
      if (error.code !== "EPIPE") fail(error);
    });
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

const TOKENS = /io[./]scaffold[./]starter|scaffold[-_]starter|Scaffold Starter/;

/** Files outside the vendored skills whose path or text still matches `pattern`. */
function tokenHits(root, pattern) {
  return files(root)
    .filter(outsideVendored)
    .filter(
      (file) =>
        pattern.test(file) ||
        pattern.test(readFileSync(join(root, file), "latin1")),
    );
}

/** Runs init on a fresh copy with `pkg` as the base package, keeping the sample. */
async function initWithPackage(t, pkg) {
  const root = await copyRepo(t);
  const args = [...VALID];
  args[args.indexOf("--package") + 1] = pkg;
  const result = await runInit(root, [
    ...args,
    "--sample",
    "keep",
    "--ci",
    "github",
  ]);
  assert.equal(result.status, 0, result.stderr);
  return root;
}

test("TEMPLATE_VERSION is X.Y.Z", () => {
  assert.match(TEMPLATE_VERSION, /^\d+\.\d+\.\d+$/);
});

test("layoutJooqImports leaves every committed generated jOOQ file as jOOQ wrote it", (t) => {
  const generated = "backend/adapters/src/generated/jooq";
  if (!existsSync(join(repoRoot, generated))) {
    t.skip("no area has tables");
    return;
  }
  const files = readdirSync(join(repoRoot, generated), {
    recursive: true,
  }).filter((file) => file.endsWith(".java"));
  for (const file of files) {
    const text = normalizeEol(
      readFileSync(join(repoRoot, generated, file), "utf8"),
    );
    assert.equal(layoutJooqImports(text), text, file);
  }
});

test("layoutJooqImports moves a renamed import into its top-level package's group", () => {
  const renamed = [
    "package org.acme.shop.catalog;",
    "",
    "",
    "import org.acme.shop.catalog.Other.OtherPath;",
    "",
    "import java.util.List;",
    "",
    "import org.jooq.Table;",
    "import org.jooq.impl.DSL;",
    "",
    "",
    "public class Shop {}",
  ].join("\n");
  assert.equal(
    layoutJooqImports(renamed),
    [
      "package org.acme.shop.catalog;",
      "",
      "",
      "import java.util.List;",
      "",
      "import org.acme.shop.catalog.Other.OtherPath;",
      "import org.jooq.Table;",
      "import org.jooq.impl.DSL;",
      "",
      "",
      "public class Shop {}",
    ].join("\n"),
  );
  assert.equal(
    layoutJooqImports("package a;\n\nclass A {}"),
    "package a;\n\nclass A {}",
  );
});

/** `afterInit` writes the saved `.git` back over the fresh one `times` times, as a lingering git process would. */
async function copyWithReturningHistory(t, times) {
  const root = await copyRepo(t);
  const saved = mkdtempSync(join(tmpdir(), "init-git-"));
  t.after(() => rmSync(saved, { recursive: true, force: true }));
  cpSync(join(root, ".git"), saved, { recursive: true });
  // init has rewritten the tree by now, so a commit on top of the old history is not empty.
  writeFileSync(join(root, "PROJECT.md"), "# Project\n");
  let left = times;
  const afterInit = () => {
    if (left-- > 0)
      cpSync(saved, join(root, ".git"), {
        recursive: true,
        force: true,
        // Refs and objects come back; the index is the new repository's own.
        filter: (path) => basename(path) !== "index",
      });
  };
  for (const [name, value] of Object.entries(TEST_IDENTITY)) {
    const before = process.env[name];
    process.env[name] = value;
    t.after(() => {
      if (before === undefined) delete process.env[name];
      else process.env[name] = before;
    });
  }
  return { root, afterInit };
}

describe("freshHistory", () => {
  test("rebuilds .git when the old history comes back, ending with one commit", async (t) => {
    const { root, afterInit } = await copyWithReturningHistory(t, 1);
    assert.equal(freshHistory(root, { pauseMs: 0, afterInit }), true);
    assert.equal(git(root, ["rev-list", "--count", "--all"]), "1\n");
    assert.equal(git(root, ["log", "--format=%s"]), `${COMMIT_SUBJECT}\n`);
  });

  test("gives up when the old history keeps coming back", async (t) => {
    const { root, afterInit } = await copyWithReturningHistory(t, Infinity);
    assert.throws(
      () => freshHistory(root, { pauseMs: 0, afterInit }),
      /Another git process kept writing the old history into \.git/,
    );
  });
});

test("nodeVersionProblem refuses an older major and accepts the same or a newer one", () => {
  assert.match(
    nodeVersionProblem("22.18.0", "26.13.0"),
    /init needs Node 26\.13\.0 \(\.nvmrc\); this is Node 22\.18\.0\. Nothing was changed\./,
  );
  assert.equal(nodeVersionProblem("26.0.0", "26.13.0"), null);
  assert.equal(nodeVersionProblem("27.1.0", "v26.13.0"), null);
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

test("validate rejects an answer that contains a placeholder token", () => {
  const good = {
    name: "acme-orders",
    package: "com.acme.orders",
    display: "Acme Orders",
  };
  const errors = (patch) => validate({ ...good, ...patch });
  for (const [patch, token] of [
    [{ name: "scaffold-starter-api" }, "scaffold-starter"],
    [{ name: "my-scaffold-starter" }, "scaffold-starter"],
    [{ package: "com.scaffold_starter.app" }, "scaffold_starter"],
    [{ package: "com.io.scaffold.starter" }, "io.scaffold.starter"],
    [{ package: "io.scaffold.starter.orders" }, "io.scaffold.starter"],
    [{ package: "io.scaffold.starterx" }, "io.scaffold.starter"],
    [{ display: "Scaffold Starter 2" }, "Scaffold Starter"],
    [{ display: "Built on scaffold-starter" }, "scaffold-starter"],
    [{ display: "io/scaffold/starter" }, "io/scaffold/starter"],
  ]) {
    const [flag, value] = Object.entries(patch)[0];
    const found = errors(patch);
    assert.equal(found.length, 1, `${flag}=${value}: ${found}`);
    assert.match(found[0], new RegExp(`^--${flag} `));
    assert.ok(found[0].includes(`"${token}"`), found[0]);
  }
  assert.deepEqual(errors({ package: "io.scaffold" }), []);
  assert.deepEqual(errors({ package: "io.scaffold.start" }), []);
  assert.deepEqual(errors({ display: "Scaffold starter" }), []);
});

test("replaceTokens substitutes every token in one pass and never rescans its output", () => {
  assert.equal(
    replaceTokens("io.scaffold.starter / scaffold_starter", [
      ["io.scaffold.starter", "x.scaffold_starter"],
      ["scaffold_starter", "y"],
    ]),
    "x.scaffold_starter / y",
  );
  assert.equal(
    replaceTokens("scaffold_starter / io.scaffold.starter", [
      ["scaffold_starter", "io.scaffold.starter"],
      ["io.scaffold.starter", "z"],
    ]),
    "io.scaffold.starter / z",
  );
  assert.equal(
    replaceTokens("a.b (a) [a.b.c]", [
      ["a", "1"],
      ["a.b", "2"],
      ["a.b.c", "3"],
    ]),
    "2 (1) [3]",
    "the longest token wins where tokens overlap",
  );
  assert.equal(replaceTokens("untouched", [["x", "y"]]), "untouched");
  assert.equal(replaceTokens("untouched", []), "untouched");
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
      ["--name", "scaffold-starter-api", /placeholder "scaffold-starter"/],
      ["--package", "io.scaffold.starter.orders", /placeholder/],
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

  test("a failure while planning is reported with nothing changed", async (t) => {
    const root = await copyRepo(t);
    writeFileSync(join(root, "skills-lock.json"), "{ not json\n");
    git(root, ["commit", "-q", "--no-verify", "-am", "break the lock file"]);
    const before = snapshot(root);
    const result = await runInit(root, [
      ...VALID,
      "--sample",
      "keep",
      "--ci",
      "github",
    ]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Nothing was changed/);
    assert.doesNotMatch(result.stderr, /partly initialized/);
    assert.deepEqual(snapshot(root), before);
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

  test(
    "an edited sample file stops --sample remove with nothing changed",
    { skip: !sampleShipped && "sample already removed" },
    async (t) => {
      const root = await copyRepo(t);
      const product =
        "backend/application-core/src/main/java/io/scaffold/starter/catalog/domain/model/Product.java";
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
    },
  );

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
          "backend/application-core/src/main/java/com/acme/orders/shared/UseCase.java",
        ),
      ),
    );
    assert.equal(
      existsSync(
        join(
          root,
          "backend/application-core/src/main/java/com/acme/orders/catalog/domain/model/Product.java",
        ),
      ),
      sampleShipped,
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
      readFileSync(join(repoRoot, "README.project.md"), "utf8")
        .replaceAll("Scaffold Starter", "Acme Orders")
        .replaceAll("scaffold-starter", "acme-orders")
        .replaceAll("scaffold_starter", "acme_orders"),
    );
    assert.match(
      readFileSync(join(root, "AGENTS.md"), "utf8"),
      /<!-- fill-in:what -->\r?\nTODO: describe this project\.\r?\n<!-- \/fill-in:what -->/,
    );
    assert.match(
      readFileSync(join(root, "backend/settings.gradle"), "utf8"),
      /rootProject\.name = 'acme-orders'/,
    );
    assert.match(
      readFileSync(join(root, "compose.yaml"), "utf8"),
      /POSTGRES_DB: acme_orders/,
    );
    assert.match(
      readFileSync(
        join(root, "frontend/src/app/shared/app-name/app-name.ts"),
        "utf8",
      ),
      /export const APP_NAME = 'Acme Orders';/,
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

  test("a package that is a prefix of the placeholder moves the tree up", async (t) => {
    const root = await initWithPackage(t, "io.scaffold");
    const useCase =
      "backend/application-core/src/main/java/io/scaffold/shared/UseCase.java";
    assert.ok(existsSync(join(root, useCase)));
    assert.match(
      readFileSync(join(root, useCase), "utf8"),
      /^package io\.scaffold\.shared;/m,
    );
    assert.equal(
      existsSync(
        join(
          root,
          "backend/application-core/src/main/java/io/scaffold/catalog/domain/model/Product.java",
        ),
      ),
      sampleShipped,
    );
    assert.deepEqual(
      dirs(root).filter((d) => d.includes("io/scaffold/starter")),
      [],
    );
    assert.deepEqual(tokenHits(root, TOKENS), []);
    assert.deepEqual(checkAgentDocs(root), []);
  });

  test(
    "a package sorting after java. regroups the generated jOOQ imports",
    { skip: !sampleShipped && "sample already removed" },
    async (t) => {
      const root = await initWithPackage(t, "org.acme.shop");
      const product = readFileSync(
        join(
          root,
          "backend/adapters/src/generated/jooq/org/acme/shop/catalog/adapter/out/persistence/jooq/CatalogProduct.java",
        ),
        "utf8",
      );
      assert.match(
        product,
        /import java\.util\.UUID;\r?\n\r?\nimport org\.acme\.shop\.catalog\.adapter\.out\.persistence\.jooq\.CatalogPublicationLog\.CatalogPublicationLogPath;\r?\nimport org\.jooq\.Check;/,
      );
    },
  );

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
          "backend/application-core/src/main/java/com/acme/orders/shared/UseCase.java",
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

  test(
    "the longest valid names leave the frontend formatted",
    { skip: !existsSync(PRETTIER) && "frontend dependencies not installed" },
    async (t) => {
      const name = "northwind-customer-self-service-portal-x";
      const display =
        "Northwind Customer Self-Service Portal for Regional Partners";
      assert.equal(name.length, 40);
      assert.equal(display.length, 60);
      assert.deepEqual(
        validate({ name, package: "com.northwind.portal", display }),
        [],
      );
      const root = await copyRepo(t);
      const result = await runInit(root, [
        "--yes",
        "--skip-verify",
        "--name",
        name,
        "--package",
        "com.northwind.portal",
        "--display",
        display,
        "--sample",
        "keep",
        "--ci",
        "github",
      ]);
      assert.equal(result.status, 0, result.stderr);
      const check = await run(process.execPath, [PRETTIER, "--check", "."], {
        cwd: join(root, "frontend"),
      });
      assert.equal(check.status, 0, check.stdout + check.stderr);
    },
  );

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
    for (const file of rewritten) {
      const text = readFileSync(join(root, file), "utf8");
      assert.ok(!/(^|[^\r])\n/.test(text), `${file} lost its CRLF endings`);
    }
    for (const file of [
      "AGENTS.md",
      "compose.yaml",
      "backend/application-core/src/main/java/com/acme/orders/shared/UseCase.java",
      "frontend/src/app/shared/app-name/app-name.ts",
      "scripts/remove-sample.mjs",
    ]) {
      assert.ok(rewritten.includes(file), `${file} was not rewritten`);
    }
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
        `Set git user.name and user.email, then run: git add -A && git commit --no-verify -m "${COMMIT_SUBJECT}"`,
      ),
      result.stderr,
    );
    assert.equal(git(root, ["config", "core.hooksPath"]).trim(), ".githooks");
    assert.equal(
      spawnSync("git", ["rev-parse", "HEAD"], { cwd: root }).status,
      128,
    );
  });

  test("a failing git commit prints the state and the commands that finish the history", async (t) => {
    const root = await copyRepo(t);
    // A missing gpg fails the commit; outside config is shut out so a `gpg.format=ssh` cannot sign instead.
    const emptyConfig = `${root}-gitconfig`;
    writeFileSync(emptyConfig, "");
    t.after(() => rmSync(emptyConfig, { force: true }));
    const isolated = {
      ...Object.fromEntries(
        Object.entries(process.env).filter(
          ([key]) => !/^GIT_CONFIG_/.test(key),
        ),
      ),
      ...TEST_IDENTITY,
      GIT_CONFIG_GLOBAL: emptyConfig,
      GIT_CONFIG_NOSYSTEM: "1",
    };
    const result = await runInit(
      root,
      [...VALID, "--sample", "keep", "--ci", "github"],
      {
        env: {
          ...isolated,
          GIT_CONFIG_COUNT: "3",
          GIT_CONFIG_KEY_0: "commit.gpgsign",
          GIT_CONFIG_VALUE_0: "true",
          GIT_CONFIG_KEY_1: "gpg.format",
          GIT_CONFIG_VALUE_1: "openpgp",
          GIT_CONFIG_KEY_2: "gpg.program",
          GIT_CONFIG_VALUE_2: join(root, "no-such-gpg"),
        },
      },
    );

    assert.equal(result.status, 1);
    assert.doesNotMatch(result.stderr, /\n\s+at /, "no stack trace");
    for (const line of [
      "The files are initialized, but the fresh history in .git is unfinished.",
      "  git init",
      "  git symbolic-ref HEAD refs/heads/main",
      "  git config core.hooksPath .githooks",
      "  git add -A",
      `  git commit --no-verify -m "${COMMIT_SUBJECT}"`,
    ]) {
      assert.ok(
        result.stderr.includes(line),
        `missing ${line}\n${result.stderr}`,
      );
    }
    assert.equal(git(root, ["symbolic-ref", "HEAD"]).trim(), "refs/heads/main");
    assert.equal(
      spawnSync("git", ["rev-parse", "HEAD"], { cwd: root }).status,
      128,
    );

    for (const args of [
      ["init"],
      ["symbolic-ref", "HEAD", "refs/heads/main"],
      ["config", "core.hooksPath", ".githooks"],
      ["add", "-A"],
      ["commit", "--no-verify", "-m", COMMIT_SUBJECT],
    ]) {
      // Not the `git` helper: it merges process.env back in, GIT_CONFIG_PARAMETERS included.
      execFileSync("git", args, { cwd: root, env: isolated, stdio: "pipe" });
    }
    assert.equal(git(root, ["log", "--format=%s"]).trim(), COMMIT_SUBJECT);
    assert.equal(git(root, ["status", "--porcelain"]), "");
  });
});
