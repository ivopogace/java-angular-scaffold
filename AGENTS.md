# AGENTS.md

Project instructions for coding agents; Claude Code reads them through `CLAUDE.md`, opencode
natively. Canonical for the commands, the business areas and the numbered invariants the skills cite
("invariant #5" means the list below). Side-specific rules: `backend/AGENTS.md`,
`frontend/AGENTS.md`. Keep this file to rules and pointers, never history.

## What this is

<!-- fill-in:what -->
A Java + Angular web app starter: a Spring Boot backend in DDD + hexagonal architecture whose
boundaries the build enforces, and an Angular Material frontend served same-origin by the backend.
It ships one removable sample business area (see *Business areas*).
<!-- /fill-in:what -->

## Commands

Needs JDK 25, Node per `.nvmrc`, and Docker for the full verify and the Testcontainers ITs.

```bash
node scripts/verify.mjs            # everything CI runs; fails up front without Docker
node scripts/verify.mjs --quick    # inner loop: skips Testcontainers ITs and e2e
node scripts/check-agent-docs.mjs  # AGENTS.md / skills / MCP config consistency (part of verify)
```

**Backend** (from `backend/`):

```bash
./gradlew build                              # compile + all tests + structural net
./gradlew build -PexcludeTags=container      # same without Docker
./gradlew test --tests "*ClassName*"         # one test class
./gradlew :bootstrap:bootRun                 # API + built SPA on :8080, Postgres from compose.yaml
```

Structural-net command: `backend/AGENTS.md`.

**Frontend** (from `frontend/`):

```bash
npm ci
npm start                    # dev server on :4200, proxies /api and /actuator to :8080
npm run lint                 # ESLint (incl. folder boundaries) + Stylelint
npm run format:check         # Prettier (`npm run format` applies)
npm test -- --watch=false    # Vitest in jsdom, incl. axe specs
npm run test:eslint-rules    # the repo's own ESLint rules and Stylelint config
npm run build
npm run typecheck:e2e        # tsc over e2e/ (Playwright transpiles without checking)
npm run test:e2e             # Playwright, mocked API (CI-safe)
npm run test:e2e:real        # Playwright against a running backend (local only)
```

## Repo map

- `backend/` — Gradle build: `core` (domain + application, Spring-free), `adapters` (web, event
  listeners, persistence, gateways), `bootstrap` (`Application`, wiring, config, structural net).
  Flyway migrations: `backend/adapters/src/main/resources/db/migration/`.
- `frontend/` — Angular workspace; the build output is served by `bootstrap`.
- `scripts/` — `verify.mjs` (the one check entry point; CI wrappers call it and nothing else),
  `check-agent-docs.mjs`, `pre-commit.mjs` (run by `.githooks/pre-commit`), `mcp/` (MCP launchers).
- `docs/adr/` — decisions; `docs/agents/workflow.md` — tracker, CLI, branches, merge rules.
- Skills: `.claude/skills/<name>/SKILL.md`, read by both tools.
- Tool config, the only duplication — change both sides together: `.mcp.json` +
  `.claude/settings.json` (Claude Code) and `opencode.json` (opencode) declare the same MCP servers
  (`angular-cli`, `playwright`) and equivalent permissions.
- `compose.yaml` — local Postgres for `bootRun`. Glossary: `GLOSSARY.md` (`domain-modeling` creates
  it lazily when absent).

## Business areas

One row per business area: a Spring Modulith module `<base>.<area>` spanning `core` and `adapters`,
plus its frontend feature folder. Add the row in the change that adds the area.

| Area | Owns | Backend | Frontend |
|---|---|---|---|
| `catalog` | sample: products and their draft → published → retired lifecycle; the full worked example of an area; delete with `node scripts/remove-sample.mjs` before a shared database applies its migration | `backend/core/src/main/java/io/scaffold/starter/catalog/` | `frontend/src/app/catalog/` | <!-- sample:catalog -->

## Invariants

Cited by number — **never renumber**; append new ones at the end.

1. Persistence through `JdbcClient` only; no JPA.
2. Schema changes only via forward Flyway migrations.
3. Money is integer minor units + ISO currency.
4. Store UTC `Instant`; the business time zone is named in config, never the JVM default.
5. `core` has no Spring beyond Modulith's annotations; no `domain` class imports any framework.
6. Business areas talk only through `port/in`, `domain/id` and `domain/event`.
7. Frontend features never import each other.
8. Styling uses Material tokens and override mixins; no `::ng-deep`, no MDC internals.
9. Every rule that matters is enforced by the build (`verify`), not only by prose or a hook.

## Skills

Load a skill when its row's condition holds. Vendored rows are pinned in `skills-lock.json` and
stay verbatim.

| skill | load when |
|---|---|
| `backend-architecture` | before adding or moving a class, package, port, event, area or Gradle dependency under `backend/`, or when the structural net fails |
| `java-conventions` | before writing or refactoring any Java: class, record, port, service, adapter, event or test |
| `frontend-architecture` | before adding a file, component, route, provider, cross-folder import or e2e spec under `frontend/` |
| `frontend-styling` | before writing or changing `.scss` or customising a Material component, or when Stylelint fails |
| `review-checklist` | reviewing any change here, your own included; adds items to a running review |
| `docs-freshness` | before finishing a change that renames, moves or removes something a doc states |
| `local-dev` | before the first build, test or verify run of a session, or when one fails for an environmental reason |
| `angular-developer` (vendored) | before writing or changing Angular code under `frontend/`: components, signals, forms, routing, DI, testing |
| `postgres` (vendored) | before writing a Flyway migration, table, index or query under `backend/` |
| `domain-modeling` (vendored) | when discussing domain terminology, editing the glossary, or recording an ADR |
| `codebase-design` (vendored) | when designing or deepening a module interface or deciding where a seam goes |
| `grilling` (vendored) | when asked to stress-test a plan, decision or idea ("grill me") |

## Way of working

- Process (brainstorming, plans, TDD, review, finishing a branch) belongs to the Superpowers plugin;
  this repo adds only project knowledge.
- Tracker, VCS CLI, branch naming and merge rules: `docs/agents/workflow.md`.
- Check your work with `node scripts/verify.mjs` (`--quick` while iterating) before calling it done;
  CI runs the same command.
- A decision gets an ADR in `docs/adr/` only when it is hard to reverse, surprising without context
  and the result of a real trade-off (`domain-modeling` format); number it after the highest.
