import assert from "node:assert/strict";
import { test } from "node:test";
import { selectFiles } from "./pre-commit.mjs";

test("keeps staged frontend files of the checked kinds, relative to frontend/", () => {
  const { checked } = selectFiles([
    "frontend/src/app/app.ts",
    "frontend/src/app/app.html",
    "frontend/src/styles.scss",
    "frontend/tsconfig.json",
    "frontend/README.md",
    "frontend/public/favicon.ico",
    "backend/build.gradle.kts",
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
