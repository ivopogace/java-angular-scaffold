import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { MARKED_FILES, SAMPLE_FILES, removeSample } from "./remove-sample.mjs";
import {
  normalizeEol,
  rewritePreservingEol,
  sha256Normalized,
} from "./lib/text.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const MARKER = "sample:catalog";

// Once the sample is removed there is nothing to copy and remove; the helper
// tests below still run. Partial presence stays loud via the hash test.
const sampleShipped = SAMPLE_FILES.some((f) =>
  existsSync(join(repoRoot, f.path)),
);
const sampleTest = (name, fn) =>
  test(name, { skip: !sampleShipped && "sample already removed" }, fn);

/** A copy of tracked + untracked-not-ignored files, optionally with CRLF text. */
function copyRepo({ crlf = false } = {}) {
  const listed = execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    { cwd: repoRoot, maxBuffer: 64 * 1024 * 1024 },
  )
    .toString("utf8")
    .split("\0")
    .filter(Boolean);
  const root = mkdtempSync(join(tmpdir(), "remove-sample-"));
  for (const rel of listed) {
    const from = join(repoRoot, rel);
    if (!existsSync(from)) continue;
    const to = join(root, rel);
    mkdirSync(dirname(to), { recursive: true });
    const bytes = readFileSync(from);
    const isText = !bytes.includes(0);
    writeFileSync(
      to,
      crlf && isText
        ? Buffer.from(
            normalizeEol(bytes.toString("utf8")).replaceAll("\n", "\r\n"),
          )
        : bytes,
    );
  }
  return root;
}

function withCopy(t, options) {
  const root = copyRepo(options);
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

function walk(root, dir = root) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? [full, ...walk(root, full)] : [full];
  });
}

const emptyDirs = (root) =>
  walk(root).filter(
    (p) => statSync(p).isDirectory() && readdirSync(p).length === 0,
  );

sampleTest(
  "every sample file exists in the repo and its recorded hash matches",
  () => {
    for (const { path, sha256 } of SAMPLE_FILES) {
      assert.ok(existsSync(join(repoRoot, path)), `${path} is missing`);
      assert.equal(
        sha256Normalized(join(repoRoot, path)),
        sha256,
        `${path} changed: run node scripts/remove-sample.mjs --refresh-hashes`,
      );
    }
  },
);

sampleTest(
  "removal deletes every listed file, empty parents and marker lines, and leaves no catalog path",
  (t) => {
    const root = withCopy(t);
    const result = removeSample(root);
    assert.deepEqual(
      [...result.removed].sort(),
      SAMPLE_FILES.map((f) => f.path).sort(),
    );
    for (const { path } of SAMPLE_FILES) {
      assert.ok(!existsSync(join(root, path)), `${path} still exists`);
    }
    for (const marked of MARKED_FILES) {
      const text = readFileSync(join(root, marked), "utf8");
      assert.ok(!text.includes(MARKER), `${marked} still has a marker line`);
    }
    assert.match(
      readFileSync(join(root, "frontend/src/app/app.routes.ts"), "utf8"),
      /path: '\*\*'/,
    );
    assert.deepEqual(
      walk(root).filter((p) => /catalog/i.test(p.slice(root.length))),
      [],
    );
    assert.deepEqual(emptyDirs(root), []);
  },
);

sampleTest("a second run reports alreadyRemoved and changes nothing", (t) => {
  const root = withCopy(t);
  removeSample(root);
  const before = walk(root)
    .map((p) => p.slice(root.length))
    .sort();
  assert.deepEqual(removeSample(root), { alreadyRemoved: true });
  assert.deepEqual(
    walk(root)
      .map((p) => p.slice(root.length))
      .sort(),
    before,
  );
});

sampleTest(
  "an edited sample file is reported as drifted and every other file is untouched",
  (t) => {
    const root = withCopy(t);
    const edited = SAMPLE_FILES[0].path;
    writeFileSync(join(root, edited), "// local change\n", { flag: "a" });
    assert.deepEqual(removeSample(root), { drifted: [edited] });
    for (const { path, sha256 } of SAMPLE_FILES.slice(1)) {
      assert.ok(existsSync(join(root, path)), `${path} was deleted`);
      assert.equal(sha256Normalized(join(root, path)), sha256);
    }
    assert.ok(existsSync(join(root, edited)));
    for (const marked of MARKED_FILES) {
      assert.ok(readFileSync(join(root, marked), "utf8").includes(MARKER));
    }
  },
);

sampleTest(
  "a run interrupted after deleting some files is finished by the next run",
  (t) => {
    const root = withCopy(t);
    const half = SAMPLE_FILES.filter((_, i) => i % 2 === 0);
    for (const { path } of half) rmSync(join(root, path));
    const result = removeSample(root);
    assert.deepEqual(
      [...result.removed].sort(),
      SAMPLE_FILES.filter((_, i) => i % 2 === 1)
        .map((f) => f.path)
        .sort(),
    );
    assert.deepEqual(
      walk(root).filter((p) => /catalog/i.test(p.slice(root.length))),
      [],
    );
    for (const marked of MARKED_FILES) {
      assert.ok(!readFileSync(join(root, marked), "utf8").includes(MARKER));
    }
    assert.deepEqual(removeSample(root), { alreadyRemoved: true });
  },
);

sampleTest(
  "a deletion error reports what is gone and what remains, and a re-run finishes",
  (t) => {
    const root = withCopy(t);
    let calls = 0;
    const rm = (path) => {
      if (++calls === 3) throw new Error("EPERM: operation not permitted");
      rmSync(path);
    };
    const result = removeSample(root, { rm });
    assert.match(result.failed.error.message, /EPERM/);
    assert.deepEqual(
      result.failed.removed,
      SAMPLE_FILES.slice(0, 2).map((f) => f.path),
    );
    assert.deepEqual(
      result.failed.remaining,
      SAMPLE_FILES.slice(2).map((f) => f.path),
    );
    for (const marked of MARKED_FILES) {
      assert.ok(readFileSync(join(root, marked), "utf8").includes(MARKER));
    }
    assert.equal(removeSample(root).removed?.length, SAMPLE_FILES.length - 2);
    assert.deepEqual(
      walk(root).filter((p) => /catalog/i.test(p.slice(root.length))),
      [],
    );
  },
);

sampleTest(
  "a reflowed marked route fails before anything is deleted or rewritten",
  (t) => {
    const root = withCopy(t);
    const routes = join(root, "frontend/src/app/app.routes.ts");
    const reflowed = readFileSync(routes, "utf8").replace(
      /^(.*)\/\/ sample:catalog\r?\n/m,
      (_, route) => `${route.trimEnd()}\n  // sample:catalog\n`,
    );
    assert.notEqual(reflowed, readFileSync(routes, "utf8"));
    writeFileSync(routes, reflowed);
    const before = Object.fromEntries(
      MARKED_FILES.map((f) => [f, readFileSync(join(root, f), "utf8")]),
    );

    const result = removeSample(root);
    assert.equal(result.markerProblems?.length, 1);
    assert.equal(
      result.markerProblems[0].file,
      "frontend/src/app/app.routes.ts",
    );
    assert.match(result.markerProblems[0].text, /\/catalog/);
    for (const { path } of SAMPLE_FILES) {
      assert.ok(existsSync(join(root, path)), `${path} was deleted`);
    }
    for (const f of MARKED_FILES) {
      assert.equal(readFileSync(join(root, f), "utf8"), before[f]);
    }
  },
);

sampleTest(
  "a CRLF working copy removes cleanly and keeps CRLF in the edited files",
  (t) => {
    const root = withCopy(t, { crlf: true });
    const result = removeSample(root);
    assert.equal(result.removed?.length, SAMPLE_FILES.length);
    for (const marked of MARKED_FILES) {
      const text = readFileSync(join(root, marked), "utf8");
      assert.ok(!text.includes(MARKER));
      assert.ok(text.includes("\r\n"));
      assert.ok(!/(?<!\r)\n/.test(text), `${marked} has a bare LF`);
    }
  },
);

sampleTest(
  "the CLI exits 1 with instructions on drift, and --refresh-hashes accepts the edit",
  (t) => {
    const root = withCopy(t);
    const edited = SAMPLE_FILES[0].path;
    writeFileSync(join(root, edited), "// local change\n", { flag: "a" });
    const run = (...args) =>
      spawnSync(
        process.execPath,
        [join(root, "scripts/remove-sample.mjs"), ...args],
        {
          encoding: "utf8",
        },
      );

    const drifted = run();
    assert.equal(drifted.status, 1);
    assert.ok(drifted.stderr.includes(edited));
    assert.match(drifted.stderr, /forward .*migration/i);
    assert.ok(existsSync(join(root, edited)));

    assert.equal(run("--refresh-hashes").status, 0);
    const removed = run();
    assert.equal(removed.status, 0, removed.stderr);
    assert.ok(!existsSync(join(root, edited)));
  },
);

sampleTest(
  "the CLI says so and exits 0 when the sample is already gone",
  (t) => {
    const root = withCopy(t);
    const run = () =>
      spawnSync(process.execPath, [join(root, "scripts/remove-sample.mjs")], {
        encoding: "utf8",
      });
    assert.equal(run().status, 0);
    const second = run();
    assert.equal(second.status, 0);
    assert.match(second.stdout, /Sample already removed\./);
  },
);

test("normalizeEol turns CRLF into LF and leaves LF alone", () => {
  assert.equal(normalizeEol("a\r\nb\nc\r\n"), "a\nb\nc\n");
});

test("rewritePreservingEol keeps each file's own line ending", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "text-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const edit = (text) => text.replace("b", "B");
  const crlf = join(dir, "crlf.txt");
  const lf = join(dir, "lf.txt");
  writeFileSync(crlf, "a\r\nb\r\n");
  writeFileSync(lf, "a\nb\n");
  rewritePreservingEol(crlf, edit);
  rewritePreservingEol(lf, edit);
  assert.equal(readFileSync(crlf, "utf8"), "a\r\nB\r\n");
  assert.equal(readFileSync(lf, "utf8"), "a\nB\n");
});

test("sha256Normalized is the same for LF and CRLF text", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "text-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, "a"), "x\ny\n");
  writeFileSync(join(dir, "b"), "x\r\ny\r\n");
  assert.equal(
    sha256Normalized(join(dir, "a")),
    sha256Normalized(join(dir, "b")),
  );
});
