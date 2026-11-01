#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeEol, sha256Normalized } from "./lib/text.mjs";

const SKILLS_DIR = ".claude/skills";
const CLAUDE_MD = "@AGENTS.md\n";
const SKILL_NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MAX_NAME_LENGTH = 64;
const MAX_DESCRIPTION_LENGTH = 1024;
const VENDORED = "(vendored)";
/** Directories never searched for AGENTS.md / CLAUDE.md: build output, dependencies, tool state. */
const SKIPPED_DIRS = new Set([
  ".git",
  ".gradle",
  ".angular",
  ".superpowers",
  "node_modules",
  "build",
  "dist",
  "coverage",
  "test-results",
  "playwright-report",
]);

/**
 * Checks the agent instructions and tool config under `root` for consistency.
 *
 * @returns {string[]} one `<file>: <problem>` line per problem (root-relative,
 *   forward slashes); empty when everything holds.
 */
export function checkAgentDocs(root) {
  const lock = readLock(root);
  const skills = skillFolders(root);
  const vendored = new Set(Object.keys(lock.skills));
  const instructionFiles = findFiles(
    root,
    ["AGENTS.md", "CLAUDE.md"],
    [...vendored].map((name) => `${SKILLS_DIR}/${name}`),
  );
  return [
    ...lock.problems,
    ...skills.flatMap((name) => checkSkill(root, name, vendored.has(name))),
    ...checkSkillsTable(root, skills, vendored),
    ...instructionFiles
      .filter((file) => file.endsWith("CLAUDE.md"))
      .flatMap((file) => checkClaudeMd(root, file)),
    ...instructionFiles
      .filter((file) => file.endsWith("AGENTS.md"))
      .flatMap((file) => checkPaths(root, file)),
    ...checkMcpServers(root),
    ...checkPermissions(root),
    ...checkLockEntries(root, lock.skills),
  ];
}

const read = (root, file) =>
  normalizeEol(readFileSync(join(root, file), "utf8"));

function readJson(root, file) {
  try {
    return { json: JSON.parse(read(root, file)) };
  } catch (error) {
    return { problem: `${file}: not valid JSON (${error.message})` };
  }
}

function readLock(root) {
  if (!existsSync(join(root, "skills-lock.json"))) {
    return { skills: {}, problems: [] };
  }
  const { json, problem } = readJson(root, "skills-lock.json");
  if (problem) return { skills: {}, problems: [problem] };
  const skills = json?.skills;
  return skills && typeof skills === "object"
    ? { skills, problems: [] }
    : { skills: {}, problems: ['skills-lock.json: no "skills" object'] };
}

function skillFolders(root) {
  const dir = join(root, SKILLS_DIR);
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function checkSkill(root, folder, isVendored) {
  const file = `${SKILLS_DIR}/${folder}/SKILL.md`;
  if (!existsSync(join(root, file))) return [`${file}: missing`];
  const frontmatter = parseFrontmatter(read(root, file));
  if (!frontmatter) {
    return [
      `${file}: no frontmatter (a leading --- block with name and description)`,
    ];
  }
  const problems = [];
  const { description } = frontmatter;
  const name = frontmatter.name?.text;
  if (name === undefined) {
    problems.push(`${file}: frontmatter has no name`);
  } else {
    if (name !== folder) {
      problems.push(
        `${file}: name "${name}" must equal the folder name "${folder}"`,
      );
    }
    if (!SKILL_NAME.test(name)) {
      problems.push(
        `${file}: name "${name}" must be lowercase letters, digits and single hyphens`,
      );
    }
    if (name.length > MAX_NAME_LENGTH) {
      problems.push(
        `${file}: name must be at most ${MAX_NAME_LENGTH} characters (is ${name.length})`,
      );
    }
  }
  if (description === undefined) {
    problems.push(`${file}: frontmatter has no description`);
    return problems;
  }
  if (!isVendored && description.style !== ">-") {
    problems.push(`${file}: description must be a >- block scalar`);
  }
  const length = description.text.length;
  if (length < 1 || length > MAX_DESCRIPTION_LENGTH) {
    problems.push(
      `${file}: description must be 1–${MAX_DESCRIPTION_LENGTH} characters (is ${length})`,
    );
  }
  return problems;
}

/**
 * Reads the top-level `key: value` pairs of a leading `---` block. Block
 * scalars (`>-`, `>`, `|`, …) and indented continuation lines are folded into
 * one line; `style` is the block indicator, or `plain` for an inline value.
 *
 * @returns {Record<string, { style: string, text: string }> | null}
 */
function parseFrontmatter(text) {
  const lines = text.split("\n");
  if (lines[0] !== "---") return null;
  const end = lines.indexOf("---", 1);
  if (end === -1) return null;
  const fields = {};
  let current = null;
  for (const line of lines.slice(1, end)) {
    const key = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (key) {
      const value = key[2].trim();
      const block = /^[>|][+-]?$/.test(value);
      current = {
        style: block ? value : "plain",
        parts: block || !value ? [] : [unquote(value)],
      };
      fields[key[1]] = current;
    } else if (current && /^\s+\S/.test(line)) {
      current.parts.push(line.trim());
    }
  }
  return Object.fromEntries(
    Object.entries(fields).map(([k, { style, parts }]) => [
      k,
      { style, text: parts.join(" ") },
    ]),
  );
}

const unquote = (value) =>
  /^(["']).*\1$/.test(value) ? value.slice(1, -1) : value;

/** The first cell of each `## Skills` table row: `{ name, vendored }`, or null without the section. */
function skillsTableRows(text) {
  const lines = text.split("\n");
  const start = lines.findIndex((line) => /^##\s+Skills\s*$/.test(line));
  if (start === -1) return null;
  const rows = [];
  let seenHeader = false;
  for (const line of lines.slice(start + 1)) {
    if (/^#{1,2}\s/.test(line)) break;
    if (!line.trimStart().startsWith("|")) continue;
    if (!seenHeader) {
      seenHeader = true;
      continue;
    }
    if (/^\s*\|[\s:|-]+\|\s*$/.test(line)) continue;
    const cell = line.trim().replace(/^\|/, "").split("|")[0];
    rows.push({
      name: cell.replace(VENDORED, "").replaceAll("`", "").trim(),
      vendored: cell.includes(VENDORED),
    });
  }
  return seenHeader ? rows : null;
}

function checkSkillsTable(root, folders, vendored) {
  const file = "AGENTS.md";
  if (!existsSync(join(root, file))) return [`${file}: missing`];
  const rows = skillsTableRows(read(root, file));
  if (!rows) return [`${file}: no "## Skills" table (| skill | load when |)`];
  const problems = [];
  const listed = new Set();
  for (const { name, vendored: marked } of rows) {
    if (listed.has(name)) {
      problems.push(`${file}: Skills table lists "${name}" twice`);
      continue;
    }
    listed.add(name);
    if (!folders.includes(name)) {
      problems.push(
        `${file}: Skills table lists "${name}", which has no folder ${SKILLS_DIR}/${name}/`,
      );
    } else if (vendored.has(name) && !marked) {
      problems.push(
        `${file}: "${name}" is in skills-lock.json; mark its row ${VENDORED}`,
      );
    } else if (!vendored.has(name) && marked) {
      problems.push(
        `${file}: "${name}" is marked ${VENDORED} but has no skills-lock.json entry`,
      );
    }
  }
  for (const name of folders) {
    if (!listed.has(name)) {
      problems.push(
        `${file}: Skills table has no row for "${name}" (${SKILLS_DIR}/${name}/)`,
      );
    }
  }
  return problems;
}

function checkClaudeMd(root, file) {
  const sibling = join(dirname(join(root, file)), "AGENTS.md");
  const problems = [];
  if (read(root, file) !== CLAUDE_MD) {
    problems.push(`${file}: must be exactly ${JSON.stringify(CLAUDE_MD)}`);
  }
  if (!existsSync(sibling)) {
    problems.push(`${file}: has no AGENTS.md next to it`);
  }
  return problems;
}

/**
 * A backticked span counts as a repository path when it contains a `/` but
 * does not start with one (`/api` is a URL path), has no whitespace or
 * placeholder characters, and its first segment names an entry in the
 * AGENTS.md's own directory or the repository root. That keeps package paths
 * such as `port/in` and commands such as `./gradlew build` out. The path
 * resolves against the AGENTS.md's directory first, then the root.
 */
function checkPaths(root, file) {
  const base = dirname(join(root, file));
  const seen = new Set();
  const problems = [];
  for (const [, span] of read(root, file).matchAll(/`([^`\n]+)`/g)) {
    const candidate =
      span.includes("/") &&
      !span.startsWith("/") &&
      !/[\s<>*{}$]|:\/\//.test(span);
    if (seen.has(span) || !candidate) continue;
    seen.add(span);
    const path = span.replace(/#.*$/, "");
    const first = path.split("/")[0];
    const bases = [base, root].filter((dir) => existsSync(join(dir, first)));
    if (bases.length === 0) continue;
    if (!bases.some((dir) => existsSync(join(dir, path)))) {
      problems.push(`${file}: \`${span}\` does not exist`);
    }
  }
  return problems;
}

const SETTINGS = ".claude/settings.json";
const OPENCODE = "opencode.json";
/** The keys opencode's current schema allows beside `mcp.servers`; any other means the deprecated per-name shape. */
const MCP_BLOCK_KEYS = new Set(["servers", "timeout"]);

/** `{ names }` from `pick(json)`, or `{ problem }` when the file is missing, unreadable or mis-shaped. */
function mcpServerNames(root, file, pick) {
  if (!existsSync(join(root, file))) return { problem: `${file}: missing` };
  const { json, problem } = readJson(root, file);
  if (problem) return { problem };
  return pick(json);
}

function checkMcpServers(root) {
  const hasEither = [".mcp.json", OPENCODE].some((f) =>
    existsSync(join(root, f)),
  );
  if (!hasEither) return [];
  const claude = mcpServerNames(root, ".mcp.json", (json) => ({
    names: Object.keys(json?.mcpServers ?? {}).sort(),
  }));
  const opencode = mcpServerNames(root, OPENCODE, (json) => {
    const mcp = json?.mcp ?? {};
    if (Object.keys(mcp).some((key) => !MCP_BLOCK_KEYS.has(key))) {
      return {
        problem: `${OPENCODE}: MCP servers belong under "mcp.servers" (per-name "mcp" entries are the deprecated shape)`,
      };
    }
    return { names: Object.keys(mcp.servers ?? {}).sort() };
  });
  const problems = [claude.problem, opencode.problem].filter(Boolean);
  if (problems.length > 0) return problems;
  if (claude.names.join() === opencode.names.join()) return [];
  const list = (names) => `[${names.join(", ")}]`;
  return [
    `${OPENCODE}: MCP servers ${list(opencode.names)} differ from .mcp.json's ${list(claude.names)}`,
  ];
}

/**
 * Claude Code and opencode must grant the same allows. A Claude Code entry `Tool` or `Tool(spec)`
 * (`permissions.allow` in `.claude/settings.json`) and an opencode rule `{ action, resource,
 * effect: "allow" }` (`permissions` in `opencode.json`) are both read as `<tool> <spec>`
 * (`read *`, `bash git status*`) and the two sets compared. A rule with another effect has no
 * Claude Code counterpart (Claude Code asks unless allowed) and is not compared.
 */
function checkPermissions(root) {
  if (![SETTINGS, OPENCODE].every((f) => existsSync(join(root, f)))) return [];
  const settings = readJson(root, SETTINGS);
  const opencode = readJson(root, OPENCODE);
  if (settings.problem) return [settings.problem];
  // An unreadable opencode.json is checkMcpServers' report.
  if (opencode.problem) return [];
  const problems = [];
  if ("permission" in (opencode.json ?? {})) {
    problems.push(
      `${OPENCODE}: "permission" is the deprecated shape; use the "permissions" rule list`,
    );
  }
  const allow = settings.json?.permissions?.allow;
  if (!Array.isArray(allow)) {
    return [...problems, `${SETTINGS}: no permissions.allow array`];
  }
  const rules = opencode.json?.permissions;
  if (!Array.isArray(rules)) {
    return [
      ...problems,
      `${OPENCODE}: no "permissions" array of { action, resource, effect } rules`,
    ];
  }
  problems.push(...catchAllOrderProblems(rules));
  const claude = new Set(allow.map(claudeGrant));
  const open = new Set(
    rules
      .filter((rule) => rule?.effect === "allow")
      .map((rule) => `${rule.action} ${rule.resource}`),
  );
  for (const grant of claude) {
    if (!open.has(grant)) {
      problems.push(
        `${OPENCODE}: no allow rule for "${grant}", which ${SETTINGS} allows`,
      );
    }
  }
  for (const grant of open) {
    if (!claude.has(grant)) {
      problems.push(
        `${SETTINGS}: no allow entry for "${grant}", which ${OPENCODE} allows`,
      );
    }
  }
  return problems;
}

/**
 * opencode applies the last matching rule, so an action's catch-all `*` must come before its
 * narrower rules; placed after them it would silently override every allow it covers.
 */
function catchAllOrderProblems(rules) {
  const narrowerSeen = new Set();
  const problems = [];
  for (const rule of rules) {
    if (!rule?.action) continue;
    if (rule.resource === "*") {
      if (narrowerSeen.has(rule.action)) {
        problems.push(
          `${OPENCODE}: the catch-all "${rule.action} *" rule comes after narrower "${rule.action}" rules; opencode applies the last matching rule, so put the catch-all first`,
        );
      }
    } else {
      narrowerSeen.add(rule.action);
    }
  }
  return problems;
}

/** `Bash(git status*)` → `bash git status*`; a bare `Read` → `read *`. */
function claudeGrant(entry) {
  const match = /^([A-Za-z_]+)(?:\((.*)\))?$/s.exec(entry);
  if (!match) return entry;
  const [, tool, spec] = match;
  return `${tool.toLowerCase()} ${spec ?? "*"}`;
}

function checkLockEntries(root, skills) {
  return Object.entries(skills).flatMap(([name, entry]) => {
    const folder = `${SKILLS_DIR}/${name}`;
    const skillFile = join(root, folder, "SKILL.md");
    if (!existsSync(join(root, folder))) {
      return [`skills-lock.json: "${name}" has no folder ${folder}/`];
    }
    if (
      !existsSync(skillFile) ||
      sha256Normalized(skillFile) !== entry?.computedHash
    ) {
      return [
        `skills-lock.json: "${name}" computedHash does not match ${folder}/SKILL.md`,
      ];
    }
    return [];
  });
}

/** Root-relative paths (forward slashes) of files named one of `names`, skipping `excluded` directories. */
function findFiles(root, names, excluded) {
  const skip = new Set(excluded);
  const found = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      const rel = relative(root, full).split(sep).join("/");
      if (entry.isDirectory()) {
        if (!SKIPPED_DIRS.has(entry.name) && !skip.has(rel)) walk(full);
      } else if (names.includes(entry.name) && statSync(full).isFile()) {
        found.push(rel);
      }
    }
  };
  walk(root);
  return found.sort();
}

function main(root) {
  const problems = checkAgentDocs(root);
  if (problems.length === 0) {
    console.log("Agent docs are consistent.");
    return 0;
  }
  for (const problem of problems) console.error(problem);
  return 1;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  process.exitCode = main(
    resolve(dirname(fileURLToPath(import.meta.url)), ".."),
  );
}
