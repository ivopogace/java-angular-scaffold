# Scaffold Starter

TODO: describe this project.

A Spring Boot backend (`backend/`) in DDD + hexagonal architecture whose boundaries the build
enforces, and an Angular Material frontend (`frontend/`) the backend serves same-origin.

## Prerequisites

- JDK 25
- Node at the version in `.nvmrc`
- Docker, for the full `verify` (Testcontainers ITs, e2e and the image smoke test), for local
  Postgres and for building the production image

After cloning, run `git config core.hooksPath .githooks` once so the pre-commit hook runs.

## What's inside

The versions the repository pins; `scripts/readme-versions.test.mjs` (part of `verify`) fails when
a row no longer matches its file. Renovate (`renovate.json`) opens the bumps as weekly PRs that
update the row with its pin; the Java toolchain, Node, npm, Playwright MCP and a TypeScript major
stay manual.

| Component | Version | Pinned in | To bump |
|---|---|---|---|
| Java toolchain | `25` | `backend/build-logic/src/main/groovy/java-conventions.gradle` | edit `JavaLanguageVersion.of(…)` and the JDK your CI wrapper installs |
| Gradle | `9.9.1` | `backend/gradle/wrapper/gradle-wrapper.properties` | `./gradlew wrapper --gradle-version <version>` from `backend/`, run twice |
| Spring Boot | `4.1.2` | `backend/gradle/libs.versions.toml` | edit `spring-boot` |
| Spring Modulith | `2.1.2` | `backend/gradle/libs.versions.toml` | edit `spring-modulith` |
| jMolecules BOM | `2025.0.2` | `backend/gradle/libs.versions.toml` | edit `jmolecules-bom` |
| ArchUnit | `1.5.1` | `backend/gradle/libs.versions.toml` | edit `archunit` |
| Postgres | `18-alpine` | `compose.yaml` | edit the image there and in `TestcontainersConfiguration` (the test keeps them equal); a new major needs `docker compose down -v` |
| Node | `26.13.0` | `.nvmrc` | edit `.nvmrc`, then set npm to the version that Node bundles |
| npm | `11.20.0` | `frontend/package.json` | edit `packageManager` |
| Angular | `22.2.4` | `frontend/package.json` | `npx ng update @angular/core @angular/cli` from `frontend/` |
| Angular Material | `22.2.6` | `frontend/package.json` | `npx ng update @angular/material` from `frontend/` |
| Angular CLI | `22.2.6` | `frontend/package.json` | with Angular, above |
| TypeScript | `6.0.3` | `frontend/package.json` | `npm install --save-exact typescript@<version>` within the range `@angular/compiler-cli` accepts; a new major comes with an Angular major's `ng update` |
| Vitest | `5.1.0` | `frontend/package.json` | `npm install --save-exact vitest@<version> @vitest/coverage-v8@<version>` from `frontend/` |
| Playwright | `1.65.0` | `frontend/package.json` | `npm install --save-exact @playwright/test@<version>` from `frontend/`, then `npx playwright install chromium` |
| ESLint | `10.14.0` | `frontend/package.json` | `npm install --save-exact eslint@<version>` from `frontend/` |
| Stylelint | `18.0.0` | `frontend/package.json` | `npm install --save-exact stylelint@<version>` from `frontend/` |
| Playwright MCP | `0.0.84` | `scripts/mcp/playwright.mjs` | edit `PACKAGE` |

## Commands

```bash
node scripts/verify.mjs             # everything CI runs
node scripts/verify.mjs --quick     # skips the Testcontainers ITs, npm audit, e2e and image smoke
```

`./gradlew :bootstrap:bootRun` (from `backend/`) serves the API and the built SPA on `:8080`, with
Postgres started from `compose.yaml` by Spring Boot's Docker Compose support.
`spring.docker.compose.file` in `backend/bootstrap/src/main/resources/application.properties` is
relative to `backend/bootstrap`, `bootRun`'s working directory; change it if you move
`compose.yaml` or start the app from elsewhere. The SPA is built once per locale and served under
`/de/` and `/en/`; a page request no controller answers, outside `/api` and `/actuator`, redirects
to `/de/…`, or to `/en/…` when the browser's `Accept-Language` prefers English. `npm start` (from
`frontend/`) serves the English source locale only on `:4200`, proxying `/api` to `:8080`.

`AGENTS.md` lists the everyday commands and the project's rules; `docs/adr/` holds its decisions.

## Production image

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

### Deploy to Render

1. Create a PostgreSQL database on Render and note its host, port, database, user and password.
2. Create a **Web Service** from this repository with the **Docker** runtime; Render finds the
   `Dockerfile` at the root and builds it on every deploy. No build arguments are needed.
3. Set the environment variables: `SPRING_DATASOURCE_URL` as
   `jdbc:postgresql://<host>:5432/<database>`, built from the database's parts (Render's
   `postgres://user:password@host/db` connection string is not a JDBC URL),
   `SPRING_DATASOURCE_USERNAME`, `SPRING_DATASOURCE_PASSWORD`, and `PORT=8080`, the port Render
   routes to, which is the one the app listens on (set `SERVER_PORT` to the same value if you change
   it).
4. Set the health check path to `/actuator/health`.

## Licences

The vendored skills under `.claude/skills/` (listed in `skills-lock.json`) are MIT-licensed work of
their upstream authors; their licence texts are in `THIRD_PARTY_LICENSES.md`.
