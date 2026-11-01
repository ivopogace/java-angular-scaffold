import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  appendFileSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { checkAgentDocs, refreshSkillsLock } from "./check-agent-docs.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const OWN_SKILL = `---
name: alpha
description: >-
  Alpha conventions. Load before touching alpha code.
---

# Alpha
`;

const VENDORED_SKILL = `---
name: beta
description: Beta from upstream, kept verbatim.
---

# Beta
`;

const VENDORED_NOTES = "# Notes\n\nMore beta, also from upstream.\n";

const sha256 = (text) => createHash("sha256").update(text).digest("hex");

/**
 * The lock hash of a skill folder, as `skills-lock.json` records it: the
 * SHA-256 of the `sha256sum`-style manifest of every file (one line
 * `<sha256 of the LF text>  <relative path>\n`, sorted by path), so a change
 * to any file in the folder changes it.
 */
const folderHash = (files) =>
  sha256(
    Object.keys(files)
      .sort()
      .map((path) => `${sha256(files[path])}  ${path}\n`)
      .join(""),
  );

const BETA_FILES = {
  "SKILL.md": VENDORED_SKILL,
  "references/notes.md": VENDORED_NOTES,
};

const ROOT_AGENTS = `# Project

See \`docs/guide.md\` and \`backend/\`; areas talk through \`port/in\`.
Run \`node scripts/verify.mjs --quick\` for the inner loop.

## Skills

| skill | load when |
|---|---|
| \`alpha\` | touching alpha code |
| \`beta\` (vendored) | anything beta |

## Way of working

Placeholders such as \`backend/<area>/\`, URL paths such as \`/api\` and
\`https://example.com/x\` are not repository paths.
`;

/** A tree that passes every check; each failing test overrides or removes one file. */
function passingFiles() {
  return {
    "AGENTS.md": ROOT_AGENTS,
    "CLAUDE.md": "@AGENTS.md\n",
    "docs/guide.md": "# Guide\n",
    "backend/AGENTS.md":
      "Run `./gradlew` here; see `src/main/` and `docs/guide.md`.\n",
    "backend/CLAUDE.md": "@AGENTS.md\n",
    "backend/gradlew": "",
    "backend/src/main/.keep": "",
    ".mcp.json": JSON.stringify({
      mcpServers: { one: { command: "node" }, two: { command: "node" } },
    }),
    ".claude/settings.json": JSON.stringify({
      permissions: { allow: ["Read", "Bash(git status*)"] },
    }),
    "opencode.json": JSON.stringify({
      mcp: {
        servers: {
          two: { type: "local", command: ["node"] },
          one: { type: "local", command: ["node"] },
        },
      },
      permissions: [
        { action: "bash", resource: "*", effect: "ask" },
        { action: "read", resource: "*", effect: "allow" },
        { action: "bash", resource: "git status*", effect: "allow" },
      ],
    }),
    ".claude/skills/alpha/SKILL.md": OWN_SKILL,
    ".claude/skills/beta/SKILL.md": VENDORED_SKILL,
    ".claude/skills/beta/references/notes.md": VENDORED_NOTES,
    "skills-lock.json": JSON.stringify({
      version: 1,
      skills: {
        beta: { source: "owner/repo", computedHash: folderHash(BETA_FILES) },
      },
    }),
  };
}

function tree(t, files, { crlf = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), "check-agent-docs-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const [path, content] of Object.entries(files)) {
    if (content === null) continue;
    const full = join(root, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, crlf ? content.replaceAll("\n", "\r\n") : content);
  }
  return root;
}

const check = (t, overrides = {}, options) =>
  checkAgentDocs(tree(t, { ...passingFiles(), ...overrides }, options));

/** Asserts exactly one problem, naming `file` and matching `pattern`. */
function assertOneProblem(problems, file, pattern) {
  assert.equal(problems.length, 1, problems.join("\n"));
  assert.ok(problems[0].startsWith(`${file}: `), problems[0]);
  assert.match(problems[0], pattern);
}

const withTableRows = (rows) =>
  ROOT_AGENTS.replace(
    /\| `alpha`[\s\S]*?\(vendored\) \| anything beta \|\n/,
    rows.map((row) => `| ${row} | x |\n`).join(""),
  );

test("a consistent tree passes", (t) => {
  assert.deepEqual(check(t), []);
});

test("a CRLF working copy passes like an LF one", (t) => {
  const files = passingFiles();
  const crlfSkill = VENDORED_SKILL.replaceAll("\n", "\r\n");
  assert.notEqual(sha256(crlfSkill), sha256(VENDORED_SKILL));
  assert.deepEqual(checkAgentDocs(tree(t, files, { crlf: true })), []);
});

test("zero skills, an empty Skills table and no skills-lock.json pass", (t) => {
  assert.deepEqual(
    check(t, {
      "AGENTS.md": withTableRows([]),
      ".claude/skills/alpha/SKILL.md": null,
      ".claude/skills/beta/SKILL.md": null,
      ".claude/skills/beta/references/notes.md": null,
      "skills-lock.json": null,
    }),
    [],
  );
});

test("a skill name that differs from its folder fails", (t) => {
  assertOneProblem(
    check(t, {
      ".claude/skills/alpha/SKILL.md": OWN_SKILL.replace(
        "name: alpha",
        "name: alfa",
      ),
    }),
    ".claude/skills/alpha/SKILL.md",
    /name "alfa" must equal the folder name "alpha"/,
  );
});

test("a skill name outside lowercase-hyphen form fails", (t) => {
  const skill = OWN_SKILL.replace("name: alpha", "name: Alpha_1");
  const problems = check(t, {
    "AGENTS.md": withTableRows(["`Alpha_1`", "`beta` (vendored)"]),
    ".claude/skills/alpha/SKILL.md": null,
    ".claude/skills/Alpha_1/SKILL.md": skill,
  });
  assertOneProblem(
    problems,
    ".claude/skills/Alpha_1/SKILL.md",
    /lowercase letters, digits and single hyphens/,
  );
});

test("a skill name over 64 characters fails", (t) => {
  const long = `a${"-b".repeat(32)}`;
  assert.equal(long.length, 65);
  const problems = check(t, {
    "AGENTS.md": withTableRows([`\`${long}\``, "`beta` (vendored)"]),
    ".claude/skills/alpha/SKILL.md": null,
    [`.claude/skills/${long}/SKILL.md`]: OWN_SKILL.replace(
      "name: alpha",
      `name: ${long}`,
    ),
  });
  assertOneProblem(
    problems,
    `.claude/skills/${long}/SKILL.md`,
    /at most 64 characters/,
  );
});

test("a skill folder without SKILL.md fails", (t) => {
  assertOneProblem(
    check(t, {
      ".claude/skills/alpha/SKILL.md": null,
      ".claude/skills/alpha/notes.md": "x\n",
    }),
    ".claude/skills/alpha/SKILL.md",
    /missing/,
  );
});

test("a SKILL.md without frontmatter fails", (t) => {
  assertOneProblem(
    check(t, { ".claude/skills/alpha/SKILL.md": "# Alpha\n" }),
    ".claude/skills/alpha/SKILL.md",
    /frontmatter/,
  );
});

test("an own skill whose description is not a >- block scalar fails", (t) => {
  assertOneProblem(
    check(t, {
      ".claude/skills/alpha/SKILL.md": OWN_SKILL.replace(
        ">-\n  Alpha conventions.",
        "Alpha conventions.",
      ),
    }),
    ".claude/skills/alpha/SKILL.md",
    /description must be a >- block scalar/,
  );
});

test("a vendored skill may keep a plain-scalar description", (t) => {
  assert.deepEqual(check(t), []);
});

test("an empty description fails", (t) => {
  assertOneProblem(
    check(t, {
      ".claude/skills/alpha/SKILL.md":
        "---\nname: alpha\ndescription: >-\n---\n",
    }),
    ".claude/skills/alpha/SKILL.md",
    /description must be 1–1024 characters \(is 0\)/,
  );
});

test("a description over 1024 characters fails, vendored or not", (t) => {
  const long = `---\nname: beta\ndescription: ${"x".repeat(1025)}\n---\n`;
  assertOneProblem(
    check(t, {
      ".claude/skills/beta/SKILL.md": long,
      "skills-lock.json": JSON.stringify({
        version: 1,
        skills: {
          beta: {
            computedHash: folderHash({ ...BETA_FILES, "SKILL.md": long }),
          },
        },
      }),
    }),
    ".claude/skills/beta/SKILL.md",
    /description must be 1–1024 characters \(is 1025\)/,
  );
});

test("a folded description is measured as one folded line", (t) => {
  const lines = Array.from({ length: 20 }, () => `  ${"w".repeat(50)}`).join(
    "\n",
  );
  const skill = `---\nname: alpha\ndescription: >-\n${lines}\n---\n`;
  // 20 × 50 characters + 19 folding spaces = 1019.
  assert.deepEqual(check(t, { ".claude/skills/alpha/SKILL.md": skill }), []);
});

test("an own skill missing from the Skills table fails", (t) => {
  assertOneProblem(
    check(t, { "AGENTS.md": withTableRows(["`beta` (vendored)"]) }),
    "AGENTS.md",
    /Skills table has no row for "alpha"/,
  );
});

test("a Skills table row without a skill folder fails", (t) => {
  assertOneProblem(
    check(t, {
      "AGENTS.md": withTableRows(["`alpha`", "`beta` (vendored)", "`gamma`"]),
    }),
    "AGENTS.md",
    /Skills table lists "gamma", which has no folder \.claude\/skills\/gamma\//,
  );
});

test("a vendored skill whose row is not marked (vendored) fails", (t) => {
  assertOneProblem(
    check(t, { "AGENTS.md": withTableRows(["`alpha`", "`beta`"]) }),
    "AGENTS.md",
    /"beta" is in skills-lock\.json; mark its row \(vendored\)/,
  );
});

test("an own skill whose row is marked (vendored) fails", (t) => {
  assertOneProblem(
    check(t, {
      "AGENTS.md": withTableRows(["`alpha` (vendored)", "`beta` (vendored)"]),
    }),
    "AGENTS.md",
    /"alpha" is marked \(vendored\) but has no skills-lock\.json entry/,
  );
});

test("a root AGENTS.md without a Skills section fails", (t) => {
  assertOneProblem(
    check(t, { "AGENTS.md": "# Project\n" }),
    "AGENTS.md",
    /no "## Skills" table/,
  );
});

test("a CLAUDE.md that is not exactly @AGENTS.md fails", (t) => {
  assertOneProblem(
    check(t, { "backend/CLAUDE.md": "@AGENTS.md\nAlso read this.\n" }),
    "backend/CLAUDE.md",
    /must be exactly "@AGENTS\.md\\n"/,
  );
});

test("a CLAUDE.md without the trailing newline fails", (t) => {
  assertOneProblem(
    check(t, { "CLAUDE.md": "@AGENTS.md" }),
    "CLAUDE.md",
    /must be exactly/,
  );
});

test("a backticked path that does not exist fails", (t) => {
  assertOneProblem(
    check(t, { "backend/AGENTS.md": "See `src/main/` and `src/test/`.\n" }),
    "backend/AGENTS.md",
    /`src\/test\/` does not exist/,
  );
});

test("each missing backticked path is reported once per file", (t) => {
  const problems = check(t, {
    "AGENTS.md": `${ROOT_AGENTS}\nAlso \`docs/gone.md\` and \`backend/nope/\`.\n`,
  });
  assert.deepEqual(problems, [
    "AGENTS.md: `docs/gone.md` does not exist",
    "AGENTS.md: `backend/nope/` does not exist",
  ]);
});

/** The passing opencode.json with top-level keys replaced. */
const opencodeWith = (overrides) =>
  JSON.stringify({
    ...JSON.parse(passingFiles()["opencode.json"]),
    ...overrides,
  });

const server = { type: "local", command: ["node"] };

test("MCP server names that differ between .mcp.json and opencode.json fail", (t) => {
  assertOneProblem(
    check(t, {
      "opencode.json": opencodeWith({ mcp: { servers: { one: server } } }),
    }),
    "opencode.json",
    /MCP servers \[one\] differ from \.mcp\.json's \[one, two\]/,
  );
});

test("per-name mcp entries, the deprecated opencode shape, fail", (t) => {
  assertOneProblem(
    check(t, {
      "opencode.json": opencodeWith({ mcp: { one: server, two: server } }),
    }),
    "opencode.json",
    /belong under "mcp\.servers"/,
  );
});

test("a top-level mcp.timeout is part of the current shape", (t) => {
  const { mcp } = JSON.parse(passingFiles()["opencode.json"]);
  assert.deepEqual(
    check(t, {
      "opencode.json": opencodeWith({
        mcp: { ...mcp, timeout: { startup: 60000 } },
      }),
    }),
    [],
  );
});

test("a permission object, the deprecated opencode shape, fails", (t) => {
  assertOneProblem(
    check(t, {
      "opencode.json": opencodeWith({ permission: { read: "allow" } }),
    }),
    "opencode.json",
    /"permission" is the deprecated shape/,
  );
});

test("a catch-all rule placed after narrower rules of its action fails", (t) => {
  const { permissions } = JSON.parse(passingFiles()["opencode.json"]);
  const catchAll = permissions.find(
    (rule) => rule.action === "bash" && rule.resource === "*",
  );
  assert.ok(catchAll);
  const reordered = [
    ...permissions.filter((rule) => rule !== catchAll),
    catchAll,
  ];
  assertOneProblem(
    check(t, {
      "opencode.json": JSON.stringify({
        ...JSON.parse(passingFiles()["opencode.json"]),
        permissions: reordered,
      }),
    }),
    "opencode.json",
    /catch-all "bash \*" rule comes after narrower "bash" rules/,
  );
});

test("an opencode.json without a permissions rule list fails", (t) => {
  const { permissions, ...rest } = JSON.parse(passingFiles()["opencode.json"]);
  assert.ok(permissions);
  assertOneProblem(
    check(t, { "opencode.json": JSON.stringify(rest) }),
    "opencode.json",
    /no "permissions" array/,
  );
});

test("a Claude Code allow without its opencode rule fails, naming the grant", (t) => {
  assertOneProblem(
    check(t, {
      ".claude/settings.json": JSON.stringify({
        permissions: { allow: ["Read", "Bash(git status*)", "Bash(npm test)"] },
      }),
    }),
    "opencode.json",
    /no allow rule for "bash npm test", which \.claude\/settings\.json allows/,
  );
});

test("an opencode allow without its Claude Code entry fails, naming the grant", (t) => {
  const { permissions } = JSON.parse(passingFiles()["opencode.json"]);
  assertOneProblem(
    check(t, {
      "opencode.json": opencodeWith({
        permissions: [
          ...permissions,
          { action: "glob", resource: "*", effect: "allow" },
        ],
      }),
    }),
    ".claude/settings.json",
    /no allow entry for "glob \*", which opencode\.json allows/,
  );
});

test("an opencode ask or deny rule needs no Claude Code counterpart", (t) => {
  const { permissions } = JSON.parse(passingFiles()["opencode.json"]);
  assert.deepEqual(
    check(t, {
      "opencode.json": opencodeWith({
        permissions: [
          ...permissions,
          { action: "bash", resource: "rm *", effect: "deny" },
        ],
      }),
    }),
    [],
  );
});

test("an unreadable .claude/settings.json fails, naming the file", (t) => {
  assertOneProblem(
    check(t, { ".claude/settings.json": "{ nope" }),
    ".claude/settings.json",
    /not valid JSON/,
  );
});

test("an unreadable MCP config fails, naming the file", (t) => {
  assertOneProblem(
    check(t, { ".mcp.json": "{ nope" }),
    ".mcp.json",
    /not valid JSON/,
  );
});

test("a skills-lock.json entry without its folder fails", (t) => {
  const lock = JSON.parse(passingFiles()["skills-lock.json"]);
  lock.skills.delta = { computedHash: folderHash({ "SKILL.md": "x" }) };
  assertOneProblem(
    check(t, { "skills-lock.json": JSON.stringify(lock) }),
    "skills-lock.json",
    /"delta" has no folder \.claude\/skills\/delta\//,
  );
});

test("a skills-lock.json hash that does not match SKILL.md fails", (t) => {
  assertOneProblem(
    check(t, {
      ".claude/skills/beta/SKILL.md": VENDORED_SKILL.replace(
        "verbatim",
        "edited",
      ),
    }),
    "skills-lock.json",
    /"beta" computedHash does not match the files under \.claude\/skills\/beta\//,
  );
});

test("an edited file beside a vendored SKILL.md fails, naming the skill", (t) => {
  assertOneProblem(
    check(t, {
      ".claude/skills/beta/references/notes.md": VENDORED_NOTES + "edited\n",
    }),
    "skills-lock.json",
    /"beta" computedHash does not match the files under \.claude\/skills\/beta\//,
  );
});

test("a dotfile dropped into a vendored skill folder is not skill content", (t) => {
  assert.deepEqual(
    check(t, {
      ".claude/skills/beta/.DS_Store": "finder junk",
      ".claude/skills/beta/references/.notes.md.swp": "editor junk",
    }),
    [],
  );
});

test("a file added to a vendored skill folder fails, naming the skill", (t) => {
  assertOneProblem(
    check(t, { ".claude/skills/beta/references/extra.md": "# Extra\n" }),
    "skills-lock.json",
    /"beta" computedHash does not match/,
  );
});

test("a binary file in a vendored skill is hashed as-is, CRLF included", (t) => {
  const image = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0,
  ]);
  const lock = JSON.parse(passingFiles()["skills-lock.json"]);
  lock.skills.beta.computedHash = folderHash({
    ...BETA_FILES,
    "assets/pixel.png": image,
  });
  for (const crlf of [false, true]) {
    const root = tree(
      t,
      { ...passingFiles(), "skills-lock.json": JSON.stringify(lock) },
      { crlf },
    );
    mkdirSync(join(root, ".claude/skills/beta/assets"));
    writeFileSync(join(root, ".claude/skills/beta/assets/pixel.png"), image);
    assert.deepEqual(checkAgentDocs(root), [], `crlf=${crlf}`);
  }
});

/** The repository's vendored skills with files beside SKILL.md, and their lock entries. */
function vendoredSkillsWithReferences() {
  const lock = JSON.parse(
    readFileSync(join(repoRoot, "skills-lock.json"), "utf8"),
  ).skills;
  return Object.entries(lock).filter(([name]) =>
    readdirSync(join(repoRoot, ".claude/skills", name), {
      recursive: true,
      withFileTypes: true,
    }).some((entry) => entry.isFile() && entry.name !== "SKILL.md"),
  );
}

/** A tree with one vendored skill folder copied from the repository and its lock entry. */
function treeWithRealSkill(t, name, entry, options) {
  const root = tree(
    t,
    {
      ...passingFiles(),
      "AGENTS.md": withTableRows([`\`${name}\` (vendored)`]),
      ".claude/skills/alpha/SKILL.md": null,
      ".claude/skills/beta/SKILL.md": null,
      ".claude/skills/beta/references/notes.md": null,
      "skills-lock.json": JSON.stringify({
        version: 1,
        skills: { [name]: entry },
      }),
    },
    options,
  );
  cpSync(
    join(repoRoot, ".claude/skills", name),
    join(root, ".claude/skills", name),
    { recursive: true },
  );
  return root;
}

const textFiles = (folder) =>
  readdirSync(folder, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(md|yaml)$/.test(entry.name))
    .map((entry) => join(entry.parentPath, entry.name));

const WITH_REFERENCES = vendoredSkillsWithReferences();
const needsReferences = {
  skip:
    WITH_REFERENCES.length === 0 &&
    "no vendored skill has files beside SKILL.md",
};

test(
  "the committed lock hashes match the vendored folders, LF or CRLF",
  needsReferences,
  (t) => {
    for (const [name, entry] of WITH_REFERENCES) {
      const root = treeWithRealSkill(t, name, entry);
      assert.deepEqual(checkAgentDocs(root), [], name);
      for (const path of textFiles(join(root, ".claude/skills", name))) {
        writeFileSync(
          path,
          readFileSync(path, "utf8")
            .replaceAll("\r\n", "\n")
            .replaceAll("\n", "\r\n"),
        );
      }
      assert.deepEqual(checkAgentDocs(root), [], `${name} with CRLF`);
    }
  },
);

test(
  "editing a real vendored skill's references file names the skill",
  needsReferences,
  (t) => {
    const [name, entry] = WITH_REFERENCES[0];
    const root = treeWithRealSkill(t, name, entry);
    const folder = join(root, ".claude/skills", name);
    const reference = textFiles(folder).find(
      (path) => !path.endsWith("SKILL.md"),
    );
    appendFileSync(reference, "\nedited locally\n");
    assertOneProblem(
      checkAgentDocs(root),
      "skills-lock.json",
      new RegExp(
        `"${name}" computedHash does not match the files under \\.claude/skills/${name}/ \\(`,
      ),
    );
  },
);

test("refreshSkillsLock re-records every hash, keeping keys and format", (t) => {
  const updatedNotes = VENDORED_NOTES + "updated upstream\n";
  const root = tree(t, {
    ...passingFiles(),
    ".claude/skills/beta/references/notes.md": updatedNotes,
  });
  assert.equal(checkAgentDocs(root).length, 1);
  assert.deepEqual(refreshSkillsLock(root), {
    refreshed: ["beta"],
    unchanged: [],
  });
  const text = readFileSync(join(root, "skills-lock.json"), "utf8");
  const lock = JSON.parse(text);
  assert.deepEqual(Object.keys(lock.skills.beta), ["source", "computedHash"]);
  assert.equal(lock.skills.beta.source, "owner/repo");
  assert.equal(
    lock.skills.beta.computedHash,
    folderHash({ ...BETA_FILES, "references/notes.md": updatedNotes }),
  );
  assert.match(text, /^\{\n  "version": 1,\n[\s\S]*\n\}\n$/);
  assert.deepEqual(checkAgentDocs(root), []);
  assert.deepEqual(refreshSkillsLock(root), {
    refreshed: [],
    unchanged: ["beta"],
  });
});

test("refreshSkillsLock refuses an entry without a folder, writing nothing", (t) => {
  const lock = JSON.parse(passingFiles()["skills-lock.json"]);
  lock.skills.delta = { source: "owner/repo", computedHash: "0" };
  const files = { ...passingFiles(), "skills-lock.json": JSON.stringify(lock) };
  const root = tree(t, files);
  assert.throws(
    () => refreshSkillsLock(root),
    /"delta" has no folder \.claude\/skills\/delta\//,
  );
  assert.equal(
    readFileSync(join(root, "skills-lock.json"), "utf8"),
    files["skills-lock.json"],
  );
});
