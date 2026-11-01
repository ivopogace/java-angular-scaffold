# Scaffold — Java + Angular project template

A starter for web apps with a Spring Boot backend in DDD + hexagonal architecture, whose boundaries
the build enforces, and an Angular Material frontend the backend serves same-origin. It ships agent
instructions and skills for Claude Code and opencode, one check entry point (`verify`) with CI
wrappers, and a removable sample business area (`catalog`) that exercises every layer.

This README is the template's. `init` replaces it with `README.project.md`.

## Prerequisites

- JDK 25
- Node at the version in `.nvmrc`
- Docker, for the full `verify` (Testcontainers ITs and e2e) and for local Postgres
- git, with `user.name` and `user.email` set

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
   `CHANGELOG.md`, `CONTRIBUTING.md`, this README, `docs/superpowers/` and `init` itself — and makes
   `README.project.md` the `README.md`;
4. resets the *What this is* section of `AGENTS.md` to a TODO for you to fill in;
5. replaces `.git` with a fresh repository on `main`, sets `core.hooksPath` to `.githooks` and makes
   one commit, `Initial commit from scaffold v<version>`;
6. runs `node scripts/verify.mjs`.

The project keeps no remote, manifest, update script or build-time fetch pointing back here; it
builds offline from then on. The template version in its initial commit message is the only trace:
read `CHANGELOG.md` here from that version on to port an improvement by hand.

## Running it locally

`node scripts/verify.mjs` runs everything CI runs; `--quick` skips the Testcontainers ITs and e2e.
`./gradlew :bootstrap:bootRun` (from `backend/`) serves the API and the built SPA on `:8080`, with
Postgres started from `compose.yaml` by Spring Boot's Docker Compose support.
`spring.docker.compose.file` in `backend/bootstrap/src/main/resources/application.properties` is
relative to `backend/bootstrap`, `bootRun`'s working directory; change it if you move
`compose.yaml` or start the app from elsewhere. `npm start` (from `frontend/`) serves the SPA on
`:4200`, proxying `/api` to `:8080`. `AGENTS.md` lists every command.

## Credits

The vendored skills under `.claude/skills/` (listed in `skills-lock.json`) are MIT-licensed work of
their upstream authors, copied verbatim; their licence texts and copyright lines are in
`THIRD_PARTY_LICENSES.md`, which every project keeps.

## Maintaining the template

`CONTRIBUTING.md`: hook setup, the template CI's three jobs, the rules for template content, how
lessons from projects flow back, and how to release. `CHANGELOG.md`: what changed in each version
and why.
