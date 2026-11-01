import assert from "node:assert/strict";
import { existsSync, globSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { normalizeEol } from "./lib/text.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const README_SECTION = "## What's inside";

const read = (path) => normalizeEol(readFileSync(join(root, path), "utf8"));

function pinned(path, pattern) {
  const found = pattern.exec(read(path));
  assert.ok(found, `${path} no longer matches ${pattern}`);
  return found[1];
}

const versionsToml = (key) =>
  pinned(
    "backend/gradle/libs.versions.toml",
    new RegExp(`^${RegExp.escape(key)} = "([^"]+)"$`, "m"),
  );

function frontendPackages() {
  const pkg = JSON.parse(read("frontend/package.json"));
  return { ...pkg.dependencies, ...pkg.devDependencies };
}

function frontendPackage(name) {
  const version = frontendPackages()[name];
  assert.ok(version, `frontend/package.json no longer pins ${name}`);
  return version;
}

const TESTCONTAINERS_CONFIG =
  "backend/bootstrap/src/test/java/**/TestcontainersConfiguration.java";

/** Each table row's component → the version its pinning file holds. */
const PINS = {
  "Java toolchain": () =>
    pinned(
      "backend/build-logic/src/main/groovy/java-conventions.gradle",
      /JavaLanguageVersion\.of\((\d+)\)/,
    ),
  Gradle: () =>
    pinned(
      "backend/gradle/wrapper/gradle-wrapper.properties",
      /gradle-([\d.]+)-bin\.zip/,
    ),
  "Spring Boot": () => versionsToml("spring-boot"),
  "Spring Modulith": () => versionsToml("spring-modulith"),
  "jMolecules BOM": () => versionsToml("jmolecules-bom"),
  ArchUnit: () => versionsToml("archunit"),
  Postgres: () => pinned("compose.yaml", /image: postgres:(\S+)/),
  Node: () => read(".nvmrc").trim(),
  npm: () => pinned("frontend/package.json", /"packageManager": "npm@([^"]+)"/),
  Angular: () => frontendPackage("@angular/core"),
  "Angular Material": () => frontendPackage("@angular/material"),
  "Angular CLI": () => frontendPackage("@angular/cli"),
  TypeScript: () => frontendPackage("typescript"),
  Vitest: () => frontendPackage("vitest"),
  Playwright: () => frontendPackage("@playwright/test"),
  ESLint: () => frontendPackage("eslint"),
  Stylelint: () => frontendPackage("stylelint"),
  "Playwright MCP": () =>
    pinned(
      "scripts/mcp/playwright.mjs",
      /PACKAGE = "@playwright\/mcp@([^"]+)"/,
    ),
};

/** `[component, version]` per row of the README's table: the first cell, the backticked second. */
function readmeRows(text) {
  const start = text.indexOf(`\n${README_SECTION}\n`);
  assert.notEqual(start, -1, `no "${README_SECTION}" section`);
  const section = text
    .slice(start + README_SECTION.length + 2)
    .split(/\n## /)[0];
  return section
    .split("\n")
    .filter((line) => line.startsWith("|"))
    .slice(2)
    .map((line) => line.split("|").map((cell) => cell.trim()))
    .map(([, component, version]) => [
      component,
      version.replace(/^`|`$/g, ""),
    ]);
}

for (const readme of ["README.md", "README.project.md"]) {
  test(`${readme} names the versions the pinning files hold`, (t) => {
    if (!existsSync(join(root, readme))) {
      t.skip(`${readme} is not in this tree`);
      return;
    }
    const rows = readmeRows(read(readme));
    assert.deepEqual(
      rows.map(([component]) => component).sort(),
      Object.keys(PINS).sort(),
      `${readme}: one row per pinned component`,
    );
    for (const [component, version] of rows) {
      assert.equal(version, PINS[component](), `${readme}: ${component}`);
    }
  });
}

test("the Testcontainers ITs run the Postgres image compose.yaml runs", () => {
  const [config] = globSync(TESTCONTAINERS_CONFIG, { cwd: root });
  assert.ok(config, `no ${TESTCONTAINERS_CONFIG}`);
  assert.equal(
    pinned(config, /new PostgreSQLContainer\("postgres:([^"]+)"\)/),
    PINS.Postgres(),
  );
});

/** Where else the JDK is named: CI wrappers, prerequisites, agent docs. Absent files are skipped. */
const JDK_MENTIONS = [
  [".github/workflows/*.yml", /java-version: '(\d+)'/g],
  [".gitlab-ci.yml", /eclipse-temurin:(\d+)-jdk/g],
  ["Jenkinsfile", /\bjdk(\d+)\b|\bJDK (\d+)\b/g],
  ["README.md", /\bJDK (\d+)\b/g],
  ["README.project.md", /\bJDK (\d+)\b/g],
  ["AGENTS.md", /\bJDK (\d+)\b/g],
  [".claude/skills/local-dev/SKILL.md", /\b(?:JDK|Java) (\d+)\b/g],
  [".claude/skills/java-conventions/SKILL.md", /\bJava (\d+)\b/g],
];

test("every JDK the CI wrappers and docs name is the toolchain's", () => {
  const toolchain = PINS["Java toolchain"]();
  const found = JDK_MENTIONS.flatMap(([pattern, regex]) =>
    globSync(pattern, { cwd: root }).flatMap((file) =>
      [...read(file).matchAll(regex)].map((match) => [
        file,
        match.slice(1).find(Boolean),
      ]),
    ),
  );
  assert.ok(found.length > 0, "no JDK mention found");
  assert.deepEqual(
    found.filter(([, version]) => version !== toolchain),
    [],
  );
});

test("the Angular packages move together", () => {
  const packages = Object.entries(frontendPackages()).filter(([name]) =>
    name.startsWith("@angular/"),
  );
  const group = (name) =>
    ["@angular/material", "@angular/cdk"].includes(name)
      ? "Angular Material"
      : ["@angular/cli", "@angular/build"].includes(name)
        ? "Angular CLI"
        : "Angular";
  assert.deepEqual(
    packages.filter(([name, version]) => version !== PINS[group(name)]()),
    [],
  );
});
