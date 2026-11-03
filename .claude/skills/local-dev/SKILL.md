---
name: local-dev
description: >-
  How to build, run and test this project on a developer machine: what verify and verify --quick
  run, Docker for Testcontainers and the local Postgres, running the stack for the real-backend
  e2e, building, running and smoke-testing the production image, the pre-commit hook, removing the
  sample, and fixes for common local failures (no Docker, missing JDK 25, Gradle's "Unable to
  establish loopback connection" on Windows, missing Playwright browser, Docker Hub or Maven
  Central rate limits, a TLS-inspecting proxy in the image build, Prettier). Load BEFORE the session's first ./gradlew, npm or verify run, or
  when a local build, test or verify step fails for a reason that is not the code. What a failing
  architecture rule means is `backend-architecture`'s or `frontend-architecture`'s.
---

# Local development

The command list is in the root `AGENTS.md`; this is how the pieces fit and what to do when one
breaks for an environmental reason.

## Prerequisites

- JDK 25 installed where Gradle can find it (`JAVA_HOME`, or `java` on `PATH`); the build pins the
  toolchain to 25 and does not download one.
- Node per `.nvmrc`, npm as pinned by `frontend/package.json`'s `packageManager`.
- Docker running for the full verify, the Testcontainers ITs and `bootRun`'s Postgres.

## verify

`node scripts/verify.mjs` is the one check entry point; CI runs the same command. It fails fast, in
order: `npm ci` (only when `frontend/node_modules` is missing), `npm audit --audit-level=high` in
`frontend/`, backend `gradlew build`, frontend lint (ESLint + Stylelint), Prettier check of
`frontend/` and of `scripts/`, the ESLint-rule and Stylelint-config suite, Vitest, production build,
e2e type check, then `playwright install chromium` and the mocked e2e, then the image smoke test
(`scripts/smoke-image.mjs`, below), then the `scripts/` tests and
`check-agent-docs.mjs`.

`--quick` drops the audit, the Playwright install, the e2e, the image smoke test, every test tagged `container`
and the jOOQ freshness check `checkJooqGenerated` (all via `-PexcludeTags=container`), so it needs no Docker — use it while iterating, then run the full
verify before calling the work done. The audit is left out because it asks the registry, whose
advisories change under an unchanged lockfile. Without Docker the full verify stops at once with
`Docker is required for the full verify; run with --quick to skip container tests and e2e.`

While iterating, run the narrowest thing first: `./gradlew test --tests "*ClassName*"` from
`backend/`, `npm test -- --watch=false` from `frontend/`.

## Running the stack

```bash
cd frontend && npm run build                # de + en builds, which bootRun packages into the SPA
cd backend && ./gradlew :bootstrap:bootRun   # API + built SPA on :8080; starts Postgres from compose.yaml
cd frontend && npm start                    # dev server on :4200, proxies /api and /actuator to :8080
REAL_BACKEND=1 npm run test:e2e:real        # from frontend/, with both of the above running
```

`bootRun` brings up `compose.yaml`'s `postgres:18-alpine` on port 5432 through Spring Boot's
Docker Compose support; Flyway migrates on start. It serves the SPA only if `frontend/dist/`
existed when it started: build first, and restart `bootRun` after a rebuild. The real-backend
specs skip unless `REAL_BACKEND=1`. The `dev-server` project runs against `npm start` (English
only); the `localized` project (`*.localized.real.e2e.ts`) runs against `:8080` and checks the
`de` / `en` builds as users get them — `-- --project localized` runs it alone (Playwright still
starts `npm start`, or reuses a running one). Its `beforeAll` fails with `Spring serves no /de/
build` when `bootRun` started without a build.

## The production image

```bash
docker build --tag scaffold-starter .   # from the root: frontend, jar and image, self-contained
node scripts/smoke-image.mjs            # from the root: docker build, run, check, tear down
```

The root `Dockerfile` (`docs/adr/0006-production-image-from-dockerfile.md`) needs neither
`frontend/dist/` nor a local JDK; its JDK stage runs `checkSpaPackaged`, which fails the build with
`The image would serve no SPA for …` when a locale build is missing. `.dockerignore` allow-lists
`backend/` and `frontend/` and drops build output. Each build runs in fresh containers, so the
first one downloads npm packages, the Gradle distribution and every Maven dependency. To run the
image by hand, start Postgres and pass `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME` and
`SPRING_DATASOURCE_PASSWORD` (the README lists every variable); the image has no Docker Compose
support. `smoke-image.mjs` first checks that the Dockerfile's Node and Temurin tags match `.nvmrc`
and the Gradle toolchain, names the image, its network and containers `smoke-<random>` (so it
never overwrites a real tag), always removes them, and prints the app's last 200 log lines on
failure; `docker ps -a --filter name=smoke-` and `docker images 'smoke-*'` show leftovers of a
killed run (`docker rm -f` and `docker rmi` them).

## Hooks and formatting

- `.githooks/pre-commit` runs the frontend's own Prettier and ESLint on the staged content of
  staged `frontend/` files (a partially staged file is judged on what the commit holds). It needs
  `npm ci` in `frontend/` first and stops with that instruction otherwise. It is active once
  `git config core.hooksPath .githooks` is set; it is a speed-up — `verify` checks the same and
  more.
- `npm run format` (from `frontend/`) fixes what `format:check` reports; its scope is all of
  `frontend/` minus `.prettierignore`.
- `scripts/` uses Prettier's defaults, checked by `verify`: from `frontend/` run
  `npx prettier --write ../scripts` to fix it.

## Removing the sample

While the sample exists, `node scripts/remove-sample.mjs` deletes its fixed file list and its
marker lines; `verify` must still pass afterwards. It refuses, deleting nothing, if a listed file
was edited (then remove the sample by hand); a listed file already gone is skipped, so an
interrupted run can be re-run; a second run prints `Sample already removed.` Once a shared
database has applied the sample migration, remove by hand and add a forward drop migration
(invariant #2).

## Common failures

| Symptom | Fix |
|---|---|
| `Unable to establish loopback connection` from `./gradlew` (on some Windows machines) | point `TMP` and `TEMP` at a short path such as `C:\tmp` for that shell |
| `Docker is required for the full verify…` | start Docker, or run `--quick` |
| Testcontainers `Could not find a valid Docker environment` | `docker info` must succeed for the same user; the ITs do not skip themselves, `-PexcludeTags=container` does |
| toolchain error naming Java 25 | install JDK 25 and point `JAVA_HOME` at it |
| Playwright: browser executable doesn't exist | `npx playwright install chromium` from `frontend/` (the full verify does this) |
| `checkJooqGenerated` fails: `The committed jOOQ classes do not match the migrations` | a migration changed without regenerating: `./gradlew :adapters:generateJooq` from `backend/` (needs Docker), commit `backend/adapters/src/generated/jooq/` |
| `bootRun` fails to bind 5432 | another Postgres holds the port; stop it |
| `bootRun`'s Postgres exits with "data in /var/lib/postgresql/data (unused mount/volume)" | the container was created by an older Postgres major; `docker compose down -v` from the repo root (drops the local database), then `bootRun` again |
| `frontend audit` fails | a high or critical advisory reached a dependency: take the patched version (`npm audit` names it; Renovate's lock-file maintenance and vulnerability PRs bring it too), never lower `--audit-level` |
| `frontend audit` fails with `ENOAUDIT` or a network error | the registry in `.npmrc` (a mirror such as Nexus or Artifactory) has no audit endpoint, or there is no network: audit against `https://registry.npmjs.org`, or run `--quick` until it is reachable |
| `docker build` or a `docker pull` fails with `429 Too Many Requests` or `toomanyrequests` | Docker Hub's anonymous pull limit: `docker login`, wait and retry; once the base and Postgres images are cached, later runs pull nothing |
| `docker build` fails at `npm ci` with `SELF_SIGNED_CERT_IN_CHAIN`, or at `./gradlew` with `PKIX path building failed` | a TLS-inspecting proxy the build containers do not trust: build with your CA added to the base images locally (an uncommitted image that extends the pinned tag), never by committing it to the `Dockerfile` |
| Gradle (or the Dockerfile's `bootJar` step) fails with `Received status code 429 from server` (Maven Central) | rate-limited: wait a minute and run again (resolved artifacts are cached, so each retry needs fewer); a persistent block needs a mirror through `~/.gradle/init.d/`, not a change to `settings.gradle` |
| an `image smoke test` step times out on `/actuator/health` | read the app log it prints: usually the database (`SPRING_DATASOURCE_*`) or a Flyway migration |
| Prettier check fails | `npm run format` (`frontend format`) or `npx prettier --write ../scripts` (`scripts format`), both from `frontend/`; then review the diff |
| files show as fully changed with no visible edit | line endings: `.gitattributes` pins LF; `git ls-files --eol` shows which files differ |
