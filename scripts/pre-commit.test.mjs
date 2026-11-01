import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  NO_NODE_MODULES_MESSAGE,
  runHook,
  selectFiles,
} from "./pre-commit.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const noFrontendInstall = !existsSync(
  join(repoRoot, "frontend", "node_modules", ".package-lock.json"),
);

test("keeps staged frontend files of the checked kinds, relative to frontend/", () => {
  const { checked } = selectFiles([
    "frontend/src/app/app.ts",
    "frontend/src/app/app.html",
    "frontend/src/styles.scss",
    "frontend/tsconfig.json",
    "frontend/README.md",
    "frontend/public/favicon.ico",
    "backend/build.gradle",
    "README.md",
    "scripts/verify.mjs",
    "",
  ]);
  assert.deepEqual(checked, [
    "src/app/app.ts",
    "src/app/app.html",
    "src/styles.scss",
    "tsconfig.json",
    "README.md",
  ]);
});

test("lints only ts and html", () => {
  const { linted } = selectFiles([
    "frontend/a.ts",
    "frontend/b.html",
    "frontend/c.scss",
    "frontend/d.json",
  ]);
  assert.deepEqual(linted, ["a.ts", "b.html"]);
});

test("nothing staged under frontend/ selects nothing", () => {
  assert.deepEqual(selectFiles(["backend/x.java"]), {
    checked: [],
    linted: [],
  });
});

/** Runs the hook with `staged` mapping repository-relative paths to their index content. */
async function hook(staged, root = repoRoot) {
  const output = [];
  const code = await runHook({
    stagedFiles: Object.keys(staged),
    repoRoot: root,
    readStaged: (path) => staged[path],
    log: (text) => output.push(text),
    error: (text) => output.push(text),
  });
  return { code, output: output.join("\n") };
}

test("without frontend/node_modules a frontend commit stops with the npm ci instruction", async (t) => {
  const root = mkdtempSync(join(tmpdir(), "pre-commit-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, "frontend"));

  const { code, output } = await hook({ "frontend/src/a.ts": "" }, root);

  assert.equal(code, 1);
  assert.equal(output, NO_NODE_MODULES_MESSAGE);
});

test("without frontend/node_modules a commit outside frontend/ passes", async (t) => {
  const root = mkdtempSync(join(tmpdir(), "pre-commit-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));

  assert.deepEqual(await hook({ "backend/x.java": "" }, root), {
    code: 0,
    output: "",
  });
});

test(
  "judges the staged content, not the working tree",
  { skip: noFrontendInstall && "needs npm ci in frontend/" },
  async () => {
    const { code, output } = await hook({
      "frontend/src/main.ts": "const   x =  1 ;\n",
    });

    assert.equal(code, 1);
    assert.match(output, /frontend\/src\/main\.ts/);
  },
);

test(
  "passes formatted, lint-clean staged content",
  { skip: noFrontendInstall && "needs npm ci in frontend/" },
  async () => {
    assert.deepEqual(
      await hook({
        "frontend/src/app/hook-probe.ts": "export const answer = 42;\n",
        "frontend/src/hook-probe.scss": ".x {\n  display: block;\n}\n",
      }),
      { code: 0, output: "" },
    );
  },
);

test(
  "reports ESLint problems in staged content",
  { skip: noFrontendInstall && "needs npm ci in frontend/" },
  async () => {
    const { code, output } = await hook({
      "frontend/src/app/hook-probe.ts": "debugger;\n",
    });

    assert.equal(code, 1);
    assert.match(output, /no-debugger/);
  },
);
