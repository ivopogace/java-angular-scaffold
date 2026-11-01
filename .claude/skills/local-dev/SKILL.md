---
name: local-dev
description: >-
  How to build, run and test this project on a developer machine: what verify and verify --quick
  run, Docker for Testcontainers and the local Postgres, running the stack for the real-backend
  e2e, the pre-commit hook, removing the sample, and fixes for common local failures (no Docker,
  missing JDK 25, Gradle's "Unable to establish loopback connection" on Windows, missing
  Playwright browser, Prettier). Load BEFORE the session's first ./gradlew, npm or verify run, or
  when a local build, test or verify step fails for a reason that is not the code. What a failing
  architecture rule means is `backend-architecture`'s or `frontend-architecture`'s.
---

# Local development

The command list is in the root `AGENTS.md`; this is how the pieces fit and what to do when one
breaks for an environmental reason. Full worked example of a running feature: the `catalog`
sample, while it exists.

## Prerequisites

- JDK 25 installed where Gradle can find it (`JAVA_HOME`, or `java` on `PATH`); the build pins the
  toolchain to 25 and does not download one.
- Node per `.nvmrc`, npm as pinned by `frontend/package.json`'s `packageManager`.
- Docker running for the full verify, the Testcontainers ITs and `bootRun`'s Postgres.

## verify

`node scripts/verify.mjs` is the one check entry point; CI runs the same command. It fails fast,
in order: `npm ci` (only when `frontend/node_modules` is missing), backend `gradlew build`, frontend
lint (ESLint + Stylelint), Prettier check, the ESLint-rule and Stylelint-config suite, Vitest,
production build, e2e type check, then `playwright install chromium` and the mocked e2e, then the
`scripts/` tests and `check-agent-docs.mjs`.

`--quick` drops the Playwright install, the e2e and every test tagged `container`
(`-PexcludeTags=container`), so it needs no Docker — use it while iterating, then run the full
verify before calling the work done. Without Docker the full verify stops at once with
`Docker is required for the full verify; run with --quick to skip container tests and e2e.`

While iterating, run the narrowest thing first: `./gradlew test --tests "*ClassName*"` from
`backend/`, `npm test -- --watch=false` from `frontend/`.

## Running the stack

```bash
cd backend && ./gradlew :bootstrap:bootRun   # API + built SPA on :8080; starts Postgres from compose.yaml
cd frontend && npm start                    # dev server on :4200, proxies /api and /actuator to :8080
REAL_BACKEND=1 npm run test:e2e:real        # from frontend/, with both of the above running
```

`bootRun` brings up `compose.yaml`'s `postgres:17-alpine` on port 5432 through Spring Boot's
Docker Compose support; Flyway migrates on start. The real-backend specs skip unless
`REAL_BACKEND=1`.

## Hooks and formatting

- `.githooks/pre-commit` runs the frontend's own Prettier and ESLint on the staged content of
  staged `frontend/` files (a partially staged file is judged on what the commit holds). It needs
  `npm ci` in `frontend/` first and stops with that instruction otherwise. It is active once
  `git config core.hooksPath .githooks` is set; it is a speed-up — `verify` checks the same and
  more.
- `npm run format` (from `frontend/`) fixes what `format:check` reports; its scope is all of
  `frontend/` minus `.prettierignore`.
- `scripts/*.mjs` use Prettier's defaults: from the repo root run
  `frontend/node_modules/.bin/prettier --write scripts`. `verify` does not check them.

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
| `Unable to establish loopback connection` from `./gradlew` (on some Windows machines) | point `TMP` and `TEMP` at a short path such as `C:\tmp` for that shell; a JDK local-socket problem with long temp paths, not a Gradle or project bug |
| `Docker is required for the full verify…` | start Docker, or run `--quick` |
| Testcontainers `Could not find a valid Docker environment` | `docker info` must succeed for the same user; the ITs do not skip themselves, `-PexcludeTags=container` does |
| toolchain error naming Java 25 | install JDK 25 and point `JAVA_HOME` at it |
| Playwright: browser executable doesn't exist | `npx playwright install chromium` from `frontend/` (the full verify does this) |
| `bootRun` fails to bind 5432 | another Postgres holds the port; stop it |
| Prettier check fails | `npm run format` from `frontend/`, then review the diff |
| files show as fully changed with no visible edit | line endings: `.gitattributes` pins LF; `git ls-files --eol` shows which files differ |
