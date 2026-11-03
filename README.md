# Scaffold — Java + Angular project template

## **Try the example app live: [scaffold-starter.onrender.com](https://scaffold-starter.onrender.com)**

**Free Render plan: after it has been idle, the first request takes about two minutes while it wakes
up.**

A starter for web apps with a Spring Boot backend in DDD + hexagonal architecture, whose boundaries
the build enforces, and an Angular Material frontend the backend serves same-origin. It ships agent
instructions and skills for Claude Code and opencode, one check entry point (`verify`) with CI
wrappers, and a removable sample business area (`catalog`) that exercises every layer.

This README is the template's. `init` replaces it with `README.project.md`.

## Prerequisites

- JDK 25
- Node at the version in `.nvmrc`
- Docker, for the full `verify` (Testcontainers ITs, e2e and the image smoke test), for local
  Postgres and for building the production image
- git, with `user.name` and `user.email` set

## What's inside

The versions the repository pins; `scripts/readme-versions.test.mjs` (part of `verify`) fails when
a row no longer matches its file. Renovate (`renovate.json`) opens the bumps as weekly PRs that
update the row with its pin; the Java toolchain, Node, npm, Playwright MCP and a TypeScript major
stay manual.

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
| TypeScript | `6.0.3` | `frontend/package.json` | `npm install --save-exact typescript@<version>` within the range `@angular/compiler-cli` accepts; a new major comes with an Angular major's `ng update` |
| Vitest | `5.1.0` | `frontend/package.json` | `npm install --save-exact vitest@<version> @vitest/coverage-v8@<version>` from `frontend/` |
| Playwright | `1.64.1` | `frontend/package.json` | `npm install --save-exact @playwright/test@<version>` from `frontend/`, then `npx playwright install chromium` |
| ESLint | `10.14.0` | `frontend/package.json` | `npm install --save-exact eslint@<version>` from `frontend/` |
| Stylelint | `17.16.0` | `frontend/package.json` | `npm install --save-exact stylelint@<version>` from `frontend/` |
| Playwright MCP | `0.0.84` | `scripts/mcp/playwright.mjs` | edit `PACKAGE` |

## Start a project

```bash
git clone <template-url> acme-orders
cd acme-orders
node scripts/init.mjs
git remote add origin <url>      # an empty repository on your host
git push -u origin main
```

`init` asks for the project name (`acme-orders`), the base Java package (`com.acme.orders`), the
display name (`Acme Orders`), whether to keep the `catalog` sample, and which CI wrappers to keep.
Without prompts:

```bash
node scripts/init.mjs --yes --name acme-orders --package com.acme.orders \
  --display "Acme Orders" --sample keep --ci github
```

`--ci` takes a comma-separated subset of `github`, `gitlab` and `jenkins` (`--ci ""` keeps none);
`--skip-verify` skips the final check. `node scripts/init.mjs --help` lists every option.

It refuses on a working tree with uncommitted changes and on a clone it already initialized; invalid
answers are rejected before any file is touched. Then it:

1. removes the sample if asked (it refuses, changing nothing, if a sample file was edited);
2. rewrites the placeholder names (`io.scaffold.starter`, `scaffold-starter`, `scaffold_starter`,
   `Scaffold Starter`) in the Gradle build, Spring config, `compose.yaml`, the Angular workspace,
   the specs and the agent docs, keeping each file's line endings, and moves the Java package folders;
3. deletes the CI wrappers you did not choose and the template-only files — `template-ci.yml`,
   `release-tag.yml` and its script, `CONTRIBUTING.md`, this README,
   `docs/superpowers/` and `init` itself — and makes `README.project.md` the `README.md`;
4. resets the *What this is* section of `AGENTS.md` to a TODO for you to fill in;
5. replaces `.git` with a fresh repository on `main`, sets `core.hooksPath` to `.githooks` and makes
   one commit, `Initial commit from scaffold v<version>`;
6. runs `node scripts/verify.mjs`.

The project keeps no remote, manifest, update script or build-time fetch pointing back here; it
builds offline from then on. The template version in its initial commit message is the only trace:
read the template's history here after the tag `v<version>` to port an improvement by hand.

## Running it locally

`node scripts/verify.mjs` runs everything CI runs; `--quick` skips the Testcontainers ITs, npm audit,
e2e and the image smoke test.
`./gradlew :bootstrap:bootRun` (from `backend/`) serves the API and the built SPA on `:8080`, with
Postgres started from `compose.yaml` by Spring Boot's Docker Compose support.
`spring.docker.compose.file` in `backend/bootstrap/src/main/resources/application.properties` is
relative to `backend/bootstrap`, `bootRun`'s working directory; change it if you move
`compose.yaml` or start the app from elsewhere. The SPA is built once per locale and served under
`/de/` and `/en/`; a page request no controller answers, outside `/api` and `/actuator`, redirects
to `/de/…`, or to `/en/…` when the browser's `Accept-Language` prefers English. `npm start` (from
`frontend/`) serves the English source locale only on `:4200`, proxying `/api` to `:8080`.
`AGENTS.md` lists every command.

### Production image

`docker build --tag scaffold-starter .` from the repository root builds the image, frontend and
jar included; it listens on `8080` (`docs/adr/0006-production-image-from-dockerfile.md`).

Flyway migrates on start, so the database user needs DDL rights. Nothing deployment-specific is
baked in; set at runtime:

| Variable | Required | Meaning |
|---|---|---|
| `SPRING_DATASOURCE_URL` | yes | `jdbc:postgresql://<host>:5432/<database>` |
| `SPRING_DATASOURCE_USERNAME` | yes | database user |
| `SPRING_DATASOURCE_PASSWORD` | yes | its password, from your secret store |
| `APP_BUSINESS_TIME_ZONE` | no | business time zone, default `UTC` |
| `SERVER_PORT` | no | listen port, default `8080` |
| `JAVA_TOOL_OPTIONS` | no | JVM flags, default `-XX:MaxRAMPercentage=75` (heap at 75 % of the container's memory); setting it replaces that default, so repeat the flag to keep it |

```bash
docker run --rm -p 8080:8080 \
  -e SPRING_DATASOURCE_URL=jdbc:postgresql://db.example:5432/scaffold_starter \
  -e SPRING_DATASOURCE_USERNAME=scaffold_starter -e SPRING_DATASOURCE_PASSWORD=… \
  scaffold-starter
```

Spring Boot's Docker Compose support is a `developmentOnly` dependency, so it is not in the image.
`/actuator/health` reports `UP` once the database answers. `node scripts/smoke-image.mjs` builds
the image, runs it against `compose.yaml`'s Postgres on a throwaway Docker network, checks health,
the `/` → `/de/` redirect and both locale builds, and removes what it started. The full `verify`
runs it, `--quick` does not.

The example app runs on Render: <https://scaffold-starter.onrender.com>. It is on the free plan,
so after it has been idle the first request takes about two minutes while it wakes up.

## Credits

The vendored skills under `.claude/skills/` (listed in `skills-lock.json`) are MIT-licensed work of
their upstream authors, copied verbatim; their licence texts and copyright lines are in
`THIRD_PARTY_LICENSES.md`, which every project keeps.

## Maintaining the template

`CONTRIBUTING.md`: hook setup, the template CI's three jobs, the rules for template content, how
lessons from projects flow back, and how to release.
