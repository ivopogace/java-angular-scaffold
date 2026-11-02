---
name: review-checklist
description: >-
  This project's review items (RC-BE, RC-FE, RC-TEST, RC-DOC) to add to a code review of a diff,
  branch or merge request here. Load whenever reviewing a change in this repo, your own before
  handing it off included; it adds items to a running review, it does not run one — the review
  process itself (requesting, dispatching, receiving) belongs to Superpowers' review skills.
  Finding where code should live is `backend-architecture` / `frontend-architecture`.
---

# Review checklist

Items for a review already in progress; never a review on its own. Load the scope that matches
the diff: backend → RC-BE, frontend → RC-FE, any test → RC-TEST, any doc, skill or comment →
RC-DOC. Invariant numbers cite the root `AGENTS.md`. Full worked example of conforming code: the
`catalog` sample, while it exists.

**Not review items** — the build fails on them, so don't spend attention there: package shape,
crossing rules between areas, an aggregate in a `port.in` or `domain.event` type,
package-private `@UseCase` services, package-private adapters, an aggregate or `port.out` in a
controller or listener, a `rehydrate` call outside `adapter.out`, `@SpringBootTest` in an area,
Spring or JPA in `core`, JPA anywhere, cross-feature imports, inline templates, decorator inputs
and outputs, `@HostBinding` / `@HostListener`, a root `@Injectable`, constructor injection,
`*ngIf` / `*ngFor`, `ngClass` / `ngStyle`, `::ng-deep` / MDC selectors / colour literals in
declarations and in `*-overrides` mixin arguments, formatting under `frontend/` and `scripts/`
(Prettier). Review what no test can see; a change that *loosens* one of those checks is an item
(RC-FE-6, RC-TEST-7).

## Backend

- **RC-BE-1 Expected failure as an exception** — Major. A not-found, a conflict or a rejected
  transition is a sealed outcome returned from the use case, not a thrown exception mapped later.
- **RC-BE-2 Port or event** — Major. A synchronous `port.in` call only when the caller needs the
  answer now; announcing a state change is a `domain.event`. A new grant in `allowedDependencies`
  must be used by the diff.
- **RC-BE-3 Event shape and delivery** — Major. Payload is typed ids and immutable facts; the
  listener is idempotent (delivery is at-least-once: an incomplete publication is
  republished at the next startup); a renamed or moved event class
  or listener ships a forward migration or a fixed listener `id`.
- **RC-BE-4 Rule placement** — Major. A choice, calculation or lifecycle rule lives on the
  aggregate (`Product.checkPublish()`), not in a service or controller; a rule needing the time
  takes an `Instant` the service read from the `Clock`.
- **RC-BE-5 Domain types at the edge** — Major. The controller maps a view record to a DTO
  rather than returning the view (an aggregate cannot reach it: `drivingAdaptersGoThroughPortIn`).
- **RC-BE-6 Money and time** (#3, #4) — Major. `long` minor units + currency, no `double`; no
  `LocalDateTime.now()`, `ZoneId.systemDefault()` or JVM-zone arithmetic; instants stored as UTC.
- **RC-BE-7 Error contract** — Major if the wire shape changes. Problem bodies only; no
  controller `@ExceptionHandler`; `detail` never carries an exception message, secret or personal
  data; an existing `reason` value is never renamed or re-purposed.
- **RC-BE-8 SQL** — Blocker. Bound parameters only; user input never concatenated into SQL.
- **RC-BE-9 Migrations** (#2) — Blocker for an edited applied migration. Forward only; a rule
  the database can enforce (`check`, unique, foreign key) is in the migration, not only in Java.
- **RC-BE-10 Transactions** — Major. `jakarta.transaction.Transactional` on the use-case method
  that writes; no self-invocation expecting a new transaction; a change relying on rollback has a
  test that proves it.
- **RC-BE-11 Logging** — Major. Placeholders, no secret, token or personal data, `\r\n`
  neutralized in user text; one log per handled exception.

## Frontend

- **RC-FE-1 Angular idioms** — Minor (Major if the pattern spreads). State in signals with
  `computed()` / `linkedSignal()`, reads through `httpResource`, Signal Forms for a new form;
  nothing from `grep -rn "standalone: true\|ChangeDetectionStrategy.OnPush" frontend/src`. The
  decorator, injection and template idioms are lint's.
- **RC-FE-2 The server decides** — Major. Client validation is UX only; prices, states and
  permissions come from the API.
- **RC-FE-3 Money and dates from the wire** (#3) — Major. Minor units formatted at the view edge,
  no float arithmetic that feeds a request; dates shown without a time-zone shift.
- **RC-FE-4 Error branches** — Minor. On the problem body's `reason`, never on `detail` text.
- **RC-FE-5 Accessibility** — Major. Every action has an accessible name that says what it acts
  on (`Publish Poster`); a new page has an axe spec and an e2e axe check in both colour schemes.
- **RC-FE-6 Loosened guards** — Major. A widened `folder-boundary` table, a new Stylelint
  override `files` entry or a disabled lint rule is argued in the change, never slipped in.

## Tests

- **RC-TEST-1 Can this assertion fail?** — Major. For every assertion the diff adds to prove a
  fix or a rule: name the broken code that would make it fail. An assertion on the absence of
  something, a check that matches either way, or a wait that passes on timing alone is a finding.
- **RC-TEST-2 Does the regression test go red on the old code?** — Major. A bug fix's test must
  fail with the fix reverted; ask for that run when it is not shown. A test written after the fix
  that passes on the broken code proves nothing.
- **RC-TEST-3 Right kind of test** — Minor. Core logic in plain unit tests with in-memory fakes,
  not a Spring context; database behaviour in a Testcontainers IT; a fake that behaves like the
  real adapter (returns copies, enforces uniqueness the table enforces).
- **RC-TEST-4 Docker tag** — Major. A test needing Docker carries `@Tag("container")`, or
  `verify --quick` breaks on a machine without Docker.
- **RC-TEST-5 Clocks** — Minor. Backend: `Clock.fixed(...)`, not the wall clock. Frontend:
  `freezeClock()`, never `vi.useRealTimers()`.
- **RC-TEST-6 e2e in the right suite** — Major. Stubbed specs in `frontend/e2e/` (CI), real-API
  round-trips in `frontend/e2e/real-backend/`; role and label locators, web-first `expect`, no
  fixed sleeps, unique data against the real backend.
- **RC-TEST-7 Structural rules prove they fail** — Major. A new or tightened ArchUnit rule, ESLint
  rule or Stylelint rule ships a violating fixture or case in the same change.

## Docs

- **RC-DOC-1 Claims match the tree** — Major. Open every path, class, command and number a
  changed doc line names; grep `AGENTS.md`, `.claude/skills/`, `docs/` and `GLOSSARY.md` for any
  name the diff renamed or removed (`docs-freshness` has the procedure).
- **RC-DOC-2 Prose earns its place** — Minor. A comment, Javadoc, TSDoc or skill line stays only
  if a fresh reader would act differently; flag history, diff narration and restated code. Don't
  reflow untouched prose.

## Output

Each finding joins the host review's list with its id and severity (`RC-TEST-2 (Major): …`),
cited by file and line like the host's own findings. The scope's items are done when each is
checked; RC-TEST-1 and RC-TEST-2 on every changed test, RC-DOC-1 whenever a doc changes.
