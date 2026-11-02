# Scaffold Starter

TODO: describe this project.

A Spring Boot backend (`backend/`) in DDD + hexagonal architecture whose boundaries the build
enforces, and an Angular Material frontend (`frontend/`) the backend serves same-origin.

## Prerequisites

- JDK 25
- Node at the version in `.nvmrc`
- Docker, for the full `verify` (Testcontainers ITs and e2e) and for local Postgres

After cloning, run `git config core.hooksPath .githooks` once so the pre-commit hook runs.

## What's inside

The versions the repository pins; `scripts/readme-versions.test.mjs` (part of `verify`) fails when
a row no longer matches its file. Renovate (`renovate.json`) opens the bumps as weekly PRs that
update the row with its pin; the Java toolchain, Node, npm and Playwright MCP stay manual.

| Component | Version | Pinned in | To bump |
|---|---|---|---|
| Java toolchain | `25` | `backend/build-logic/src/main/groovy/java-conventions.gradle` | edit `JavaLanguageVersion.of(…)` and the JDK your CI wrapper installs |
| Gradle | `9.8.2` | `backend/gradle/wrapper/gradle-wrapper.properties` | `./gradlew wrapper --gradle-version <version>` from `backend/`, run twice |
| Spring Boot | `4.1.2` | `backend/gradle/libs.versions.toml` | edit `spring-boot` |
| Spring Modulith | `2.1.2` | `backend/gradle/libs.versions.toml` | edit `spring-modulith` |
| jMolecules BOM | `2025.0.2` | `backend/gradle/libs.versions.toml` | edit `jmolecules-bom` |
| ArchUnit | `1.5.1` | `backend/gradle/libs.versions.toml` | edit `archunit` |
| Postgres | `18-alpine` | `compose.yaml` | edit the image there and in `TestcontainersConfiguration` (the test keeps them equal); a new major needs `docker compose down -v` |
| Node | `26.13.0` | `.nvmrc` | edit `.nvmrc`, then set npm to the version that Node bundles |
| npm | `11.20.0` | `frontend/package.json` | edit `packageManager` |
| Angular | `22.2.4` | `frontend/package.json` | `npx ng update @angular/core @angular/cli` from `frontend/` |
| Angular Material | `22.2.5` | `frontend/package.json` | `npx ng update @angular/material` from `frontend/` |
| Angular CLI | `22.2.5` | `frontend/package.json` | with Angular, above |
| TypeScript | `6.0.3` | `frontend/package.json` | `npm install --save-exact typescript@<version>` within the range `@angular/compiler-cli` accepts |
| Vitest | `5.0.5` | `frontend/package.json` | `npm install --save-exact vitest@<version> @vitest/coverage-v8@<version>` from `frontend/` |
| Playwright | `1.64.1` | `frontend/package.json` | `npm install --save-exact @playwright/test@<version>` from `frontend/`, then `npx playwright install chromium` |
| ESLint | `10.14.0` | `frontend/package.json` | `npm install --save-exact eslint@<version>` from `frontend/` |
| Stylelint | `17.16.0` | `frontend/package.json` | `npm install --save-exact stylelint@<version>` from `frontend/` |
| Playwright MCP | `0.0.84` | `scripts/mcp/playwright.mjs` | edit `PACKAGE` |

## Commands

```bash
node scripts/verify.mjs             # everything CI runs
node scripts/verify.mjs --quick     # skips the Testcontainers ITs, npm audit and e2e
```

`./gradlew :bootstrap:bootRun` (from `backend/`) serves the API and the built SPA on `:8080`, with
Postgres started from `compose.yaml` by Spring Boot's Docker Compose support.
`spring.docker.compose.file` in `backend/bootstrap/src/main/resources/application.properties` is
relative to `backend/bootstrap`, `bootRun`'s working directory; change it if you move
`compose.yaml` or start the app from elsewhere. `npm start` (from `frontend/`) serves the SPA on
`:4200`, proxying `/api` to `:8080`.

`AGENTS.md` lists every command and the project's rules; `docs/adr/` holds its decisions.

## Licences

The vendored skills under `.claude/skills/` (listed in `skills-lock.json`) are MIT-licensed work of
their upstream authors; their licence texts are in `THIRD_PARTY_LICENSES.md`.
