# AGENTS.md

Rules and pointers for coding agents, never history. Side-specific rules: `backend/AGENTS.md`,
`frontend/AGENTS.md`.

## What this is

<!-- fill-in:what -->
A Java + Angular web app starter: a Spring Boot backend in DDD + hexagonal architecture whose
boundaries the build enforces, and an Angular Material frontend served same-origin by the backend.
It ships one removable sample business area (see *Business areas*).
<!-- /fill-in:what -->

## Commands

```bash
node scripts/verify.mjs            # everything CI runs; the CI wrappers call nothing else; needs Docker
node scripts/verify.mjs --quick    # inner loop: skips Testcontainers ITs, npm audit, e2e, image smoke
```

**Backend** (from `backend/`; structural-net command in `backend/AGENTS.md`):

```bash
./gradlew build                              # compile + all tests + structural net
./gradlew build -PexcludeTags=container      # same without Docker
./gradlew test --tests "*ClassName*"         # one test class
./gradlew :bootstrap:bootRun                 # API + SPA (/de/, /en/) on :8080, Postgres via compose
./gradlew :adapters:generateJooq             # after changing a migration: regenerate jOOQ classes; needs Docker
```

**Frontend** (from `frontend/`):

```bash
npm ci
npm start                    # dev server on :4200, source locale en only; proxies /api, /actuator
npm run lint                 # ESLint (incl. folder boundaries) + Stylelint
npm run format:check         # Prettier (`npm run format` applies)
npm test -- --watch=false    # Vitest in jsdom, incl. axe specs
npm run test:eslint-rules    # the repo's own ESLint rules, ESLint and Stylelint configs
npm run build                # de + en builds; fails on a missing de translation
npm run typecheck:e2e        # tsc over e2e/ (Playwright transpiles without checking)
npm run test:e2e             # Playwright, mocked API (CI-safe)
REAL_BACKEND=1 npm run test:e2e:real   # Playwright against the running stack (local only)
```

## Tool config

`.mcp.json` + `.claude/settings.json` (Claude Code) and `opencode.json` (opencode) declare the same
MCP servers and allow-list; change both sides together (`check-agent-docs.mjs` compares them).

## Business areas

One row per business area: a Spring Modulith module `<base>.<area>` spanning `application-core` and
`adapters`, plus its frontend feature folder. Add the row in the change that adds the area.

| Area | Owns | Backend | Frontend |
|---|---|---|---|
| `catalog` | sample: products and their draft → published → retired lifecycle; the full worked example of an area; delete with `node scripts/remove-sample.mjs` before a shared database applies its migration | `backend/application-core/src/main/java/io/scaffold/starter/catalog/` | `frontend/src/app/catalog/` | <!-- sample:catalog -->

## Invariants

Cited by number — **never renumber**; append new ones at the end.

1. Persistence through jOOQ over classes generated from the migrations; no JPA, Spring Data or
   `JdbcClient`.
2. Schema changes only via forward Flyway migrations.
3. Money is integer minor units + ISO currency.
4. Store UTC `Instant`; the business time zone is named in config, never the JVM default.
5. `application-core` has no Spring beyond Modulith's annotations; no `domain` class imports any
   framework.
6. Business areas talk only through `port/in`, `domain/id` and `domain/event`.
7. Frontend features never import each other.
8. Styling uses Material tokens and override mixins; no `::ng-deep`, no MDC internals.
9. Every rule that matters is enforced by the build (`verify`), not only by prose or a hook.

## Skills

Load a skill when its row's condition holds. Vendored skills are pinned in `skills-lock.json`:
never edit their files.

| skill | load when |
|---|---|
| `backend-architecture` | before adding or moving a class, package, port, event, area or Gradle dependency under `backend/`, or when the structural net fails |
| `java-conventions` | before writing or refactoring any Java: class, record, port, service, adapter, event or test |
| `frontend-architecture` | before adding a file, component, route, provider, user-facing string, cross-folder import or e2e spec under `frontend/` |
| `frontend-styling` | before writing or changing `.scss` or customising a Material component, or when Stylelint fails |
| `review-checklist` | reviewing any change here, your own included; adds items to a running review |
| `docs-freshness` | before finishing a change that renames, moves or removes something a doc states |
| `local-dev` | before the first build, test or verify run of a session, or when one fails for an environmental reason |
| `angular-developer` (vendored) | before writing or changing Angular code under `frontend/`: components, signals, forms, routing, DI, testing |
| `postgres` (vendored) | before writing a Flyway migration, table, index or query under `backend/` |
| `domain-modeling` (vendored) | when discussing domain terminology, editing the glossary, or recording an ADR |

## Way of working

- Tracker, VCS CLI, branch naming and merge rules: `docs/agents/workflow.md`.
- Run `node scripts/verify.mjs` (`--quick` while iterating) before calling a change done.
- An ADR in `docs/adr/` only for a decision that is hard to reverse, surprising without context and
  the result of a real trade-off.
