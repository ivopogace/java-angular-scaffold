# Scaffold Starter

TODO: describe this project.

A Spring Boot backend (`backend/`) in DDD + hexagonal architecture whose boundaries the build
enforces, and an Angular Material frontend (`frontend/`) the backend serves same-origin.

## Prerequisites

- JDK 25
- Node at the version in `.nvmrc`
- Docker, for the full `verify` (Testcontainers ITs and e2e) and for local Postgres

After cloning, run `git config core.hooksPath .githooks` once so the pre-commit hook runs.

## Commands

```bash
node scripts/verify.mjs             # everything CI runs
node scripts/verify.mjs --quick     # skips the Testcontainers ITs and e2e
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
