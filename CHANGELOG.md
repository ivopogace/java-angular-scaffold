# Changelog

Template changes and why. A project records the template version it started from in its initial
commit message (`Initial commit from scaffold vX.Y.Z`) and never links back; to port an improvement,
read the entries after that version here and apply them by hand. `TEMPLATE_VERSION` in
`scripts/init.mjs` equals the top entry.

## 0.1.1 — 2026-11-01

- `skills-lock.json`: a vendored skill's `computedHash` covers its whole folder (every file under
  `.claude/skills/<name>/`, sorted by path, text normalised to LF, binaries as-is, dotfiles such as
  `.DS_Store` skipped), so an edit to a `references/*.md`, script or licence file fails
  `check-agent-docs` like an edit to `SKILL.md`.
  After replacing a vendored skill from a new upstream ref, re-pin it with
  `node scripts/check-agent-docs.mjs --refresh-hashes` in the same commit.
- Sample backend: `GET /api/catalog/products/{id}` exists, so the `Location` header of a create
  resolves; it is the worked example of a read-one use case (`FindProduct`, `Optional` view, 404
  problem). Port it if your area copied the create endpoint.
- Sample backend: the create request strips the name before validation, so a name of Unicode
  whitespace (which `@NotBlank` alone accepts and the domain rejects) is a 400, not a 500. Apply the
  same compact-constructor normalisation to any request whose domain rule strips.
- `init`: the placeholders are replaced in a single pass, so one answer can never be rewritten by
  another's token; an answer that contains a placeholder (`scaffold-starter-api`,
  `com.scaffold_starter.app`, `io.scaffold.starter.orders`) is rejected up front, while a prefix
  such as `io.scaffold` works; a failure while planning says "Nothing was changed" instead of
  claiming a partly initialized tree.
- Sample frontend: publish, retire and the create button are disabled while their request is in
  flight, so a double click sends one request; the product list is loaded by the list page
  (`CatalogService.loadProducts()`), so opening the form no longer requests the list;
  `formatMoney` shows a plain amount plus the code for a currency `Intl` rejects instead of
  throwing; table rows are typed through `shared/typed-cell-def/` (`*matCellDef="let product;
  typedBy: …"`). Port the directive and the in-flight pattern to any list page you copied.
- Agent config: `opencode.json` follows the current schema (`mcp.servers`, an ordered `permissions`
  rule list with the catch-all first; the `permission` object and per-name `mcp` entries are
  deprecated), and `check-agent-docs.mjs` fails when it and `.claude/settings.json` do not grant the
  same allows; `node --test "scripts/**/*.test.mjs"`, `npx playwright install` and
  `npx playwright install chromium` are allowed on both sides. The MCP launchers run npm's own
  `npx-cli.js` with the running node instead of the `npx` shell shim (no DEP0190 warning), and
  Chromium gets `--no-sandbox` only as root on Linux, in a container, or with
  `PLAYWRIGHT_MCP_NO_SANDBOX=1`.
- Frontend: Stylelint now rejects colour literals (hex, named, `rgb()` and the other banned
  colour functions) passed to a Material `*-overrides` mixin, through the repo's own rule
  `local/overrides-no-color-literal` (`frontend/stylelint/overrides-no-color-literal.mjs`), so
  invariant #8 holds in `@include` arguments as well as declarations; RC-FE-7 is retired as a
  review item. Copy the rule file and the `plugins` / `rules` entries of
  `frontend/.stylelintrc.json`.
- Backend: `/api` and `/actuator` themselves (and with a trailing slash) are no longer answered
  with the SPA shell but with a 404 problem like any unknown API path. The shell (`index.html`,
  the fallback, unhashed files) is served with `Cache-Control: no-cache`; scripts, styles and
  media whose name carries a content hash (`main-ABC123.js`, Angular's production
  `outputHashing`) are cached for a year as immutable. `Money` is a jMolecules
  `@ValueObject` and its overflow behaviour is tested. The structural rules no longer reserve a
  `config` package: wiring lives in the base package, so a `config` package is judged as an area.
- Comments, Javadoc, TSDoc and skill lines that narrated history or restated the code are gone;
  what stays is contract. Two rules that only prose stated are now enforced: `verify` checks
  `scripts/` with the frontend's Prettier (`scripts format` step), and the ArchUnit rule
  `adaptersArePackagePrivate` fails a public top-level class in an area's `adapter` packages or
  in `web`. Copy the step and the rule (with its fixtures) if your project kept the prose.
- Versions: Node 26.13.0 (the first 26.x LTS) with npm 11.20.0, ESLint 10.14.0,
  typescript-eslint 8.72.1, Postgres 18 for `compose.yaml` and the Testcontainers ITs, and
  `actions/checkout` v7, `actions/setup-java` v6, `actions/setup-node` v7. Spring Boot 4.1.2,
  Spring Modulith 2.1.2, jMolecules 2025.0.2, ArchUnit 1.5.1, Gradle 9.8.2 and Angular 22.2 were
  already the latest stable releases; TypeScript stays on 6.0 because Angular 22 requires
  `>=6.0 <6.1`. Lint now fails on decorator inputs and outputs, `@HostBinding` / `@HostListener`,
  a root `@Injectable`, constructor injection, `*ngIf` / `*ngFor` and `ngClass` / `ngStyle`
  (`frontend/eslint.config.js`, proved by `frontend/eslint-rules/eslint-config.test.mjs`); copy
  both. Unused Java pattern and catch bindings are `_`; `init` escapes with `RegExp.escape` and
  refuses, changing nothing, on a Node major older than `.nvmrc`. A local Postgres container
  created by 17 does not start on 18: `docker compose down -v` (drops the local database).
- `README.md` and `README.project.md` have a *What's inside* table: each framework and toolchain
  version the repository pins, the file that pins it and how to bump it.
  `scripts/readme-versions.test.mjs` (run by `verify`) fails when a row no longer matches its
  file, when a component has no row or two, when the Testcontainers image differs from
  `compose.yaml`'s, when a CI wrapper or doc names another JDK than the toolchain, or when the
  `@angular/*` packages of one release train disagree. Copy the table and the test into your
  project's README and `scripts/`.

## 0.1.0 — 2026-11-01

First release.

- Backend: Java 25, Spring Boot 4.1, Spring Modulith 2.1, Gradle 9.8 with convention plugins in
  `backend/build-logic`; `core` (Spring-free domain and application), `adapters`, `bootstrap`.
  Business areas are Modulith modules; ArchUnit and jMolecules rules plus a `core` classpath check
  make the boundaries a build failure rather than a review comment.
- Persistence through `JdbcClient` and Flyway, no JPA; Testcontainers ITs; a transactional outbox
  via Modulith's event publication registry, republished on restart.
- Frontend: Angular 22 (standalone, signals, zoneless) with Angular Material M3; ESLint rules for
  folder boundaries and separate component files; Stylelint for Material styling rules; Vitest with
  axe specs; Playwright e2e against a mocked API, plus a local real-backend suite.
- A removable `catalog` sample area exercising every layer; `scripts/remove-sample.mjs` deletes it
  and refuses when a sample file was edited.
- `scripts/verify.mjs` as the single check entry point; GitHub, GitLab and Jenkins wrappers that
  call it and nothing else; a pre-commit hook in `.githooks/`.
- Agent setup: `AGENTS.md` at the root, `backend/` and `frontend/` (Claude Code reads them via
  `CLAUDE.md`), own skills plus pinned vendored skills under `.claude/skills/`, MCP config for
  Claude Code and opencode, four founding ADRs, `scripts/check-agent-docs.mjs`.
- `scripts/init.mjs`: one-time setup that renames the placeholders, optionally removes the sample,
  keeps the chosen CI wrappers, deletes the template-only files and starts a fresh history.
