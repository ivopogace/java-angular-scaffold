import assert from "node:assert/strict";
import { existsSync, globSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const README_SECTION = "## What's inside";

const read = (path) => readFileSync(join(root, path), "utf8");

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

function frontendPackage(name) {
  const pkg = JSON.parse(read("frontend/package.json"));
  const version = pkg.dependencies?.[name] ?? pkg.devDependencies?.[name];
  assert.ok(version, `frontend/package.json no longer pins ${name}`);
  return version;
}

const TESTCONTAINERS_CONFIG =
  "backend/bootstrap/src/test/java/**/TestcontainersConfiguration.java";

/** Each table row's component → the version its pinning file holds. */
const PINS = {
  "Java toolchain": () =>
    pinned(
      "backend/build-logic/src/main/kotlin/java-conventions.gradle.kts",
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

/** `{ component: version }` from the README's table: first cell, then the backticked second. */
function readmeVersions(text) {
  const start = text.indexOf(`\n${README_SECTION}\n`);
  assert.notEqual(start, -1, `no "${README_SECTION}" section`);
  const section = text
    .slice(start + README_SECTION.length + 2)
    .split(/\n## /)[0];
  const rows = section
    .split("\n")
    .filter((line) => line.startsWith("|"))
    .slice(2)
    .map((line) => line.split("|").map((cell) => cell.trim()));
  return Object.fromEntries(
    rows.map(([, component, version]) => [
      component,
      version.replace(/^`|`$/g, ""),
    ]),
  );
}

for (const readme of ["README.md", "README.project.md"]) {
  test(`${readme} names the versions the pinning files hold`, (t) => {
    if (!existsSync(join(root, readme))) {
      t.skip(`${readme} is not in this tree`);
      return;
    }
    const table = readmeVersions(read(readme));
    assert.deepEqual(Object.keys(table).sort(), Object.keys(PINS).sort());
    for (const [component, version] of Object.entries(table)) {
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
