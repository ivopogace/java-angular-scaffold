# Changelog

Template changes and why. A project records the template version it started from in its initial
commit message (`Initial commit from scaffold vX.Y.Z`) and never links back; to port an improvement,
read the entries after that version here and apply them by hand. `TEMPLATE_VERSION` in
`scripts/init.mjs` equals the top entry.

## 0.2.0 — 2026-11-02

- Frontend: internationalised with Angular's compile-time `@angular/localize`
  (`docs/adr/0005-compile-time-i18n-with-angular-localize.md`). English stays the source text in
  the code (`sourceLocale` `en`); German is the default a user gets, translated in
  `frontend/src/locale/messages.de.xlf` (XLIFF 2: a format translation tools read, and one unit
  per line so `remove-sample` can drop the sample's units by their marker; JSON has no comments to
  carry one). Every template string has `i18n="@@id"`, every string in TypeScript (route titles,
  the document title, snackbars, validation messages) `` $localize`:@@id:…` ``; custom ids keep
  extraction from churning when wording changes. `npm run extract-i18n` writes the source units to
  `src/locale/messages.xlf` (not committed). Port: add `@angular/localize` at your Angular version,
  copy the `i18n` block, `localize`, `i18nMissingTranslation` / `i18nDuplicateTranslation`, the
  `@angular/localize/init` polyfill and the `extract-i18n` target from `angular.json`, the
  `@angular/localize` types in both `tsconfig`s, then mark your strings.
- Frontend: enforced by the build (invariant #9). `npm run build` fails on a unit without a `de`
  translation; `@angular-eslint/template/i18n` (scoped to component templates, with custom ids
  required) fails lint on unmarked template text or attributes; the ESLint config suite proves it.
- Frontend: `ng build` emits one app per locale (`browser/de/`, `browser/en/`), each with its
  `<html lang>`, `<base href>` and `LOCALE_ID`. `formatMoney` takes the locale as a required
  argument and `injectFormatMoney()` binds the active `LOCALE_ID`, instead of a hard-coded
  `en-US`; the catalog list formats prices in the user's locale. Replace your `formatMoney` calls
  in components with `injectFormatMoney()`.
- Frontend: `npm start` (the `development` configuration) serves the source locale `en` only, and
  the mocked and real-backend Playwright suites assert English text with the browser locale pinned
  to `en-US`. The unused `nav-link` class is gone from the toolbar link.
- Backend: `SpaWebConfig` serves `/de/…` and `/en/…` from their builds, each falling back to its
  own `index.html` for client routes. A GET or HEAD that no controller or resource answers, outside
  `/api` and `/actuator`, is redirected (302, `Vary: Accept-Language`) to the same path and query
  under `de`, or `en` when `Accept-Language` prefers it, by a lowest-precedence handler mapping, so
  a later `/login` or API-docs endpoint is never redirected. Boot's own static mappings are off
  (`spring.web.resources.add-mappings=false`). `SpaWebConfigTest` covers the routing and fails
  when `SpaWebConfig.LOCALES` and `angular.json`'s locales differ.
  `npm run watch` builds both locales (`--localize`) so the backend can serve its output. Port
  `SpaWebConfig` with its test fixtures under `static/de/` and `static/en/`.
- Frontend: `npm run test:coverage` runs the unit tests once with the unit-test builder's own
  `--coverage` (`@vitest/coverage-v8`, pinned to the `vitest` version) and prints a text summary;
  `lcov.info` and an HTML report land in `frontend/coverage/<project name>/` (git-ignored). Every
  `src/**/*.ts` counts, so a file no spec loads shows as 0 % instead of vanishing; `src/testing/`
  helpers are left out. It is a report, not a gate: no threshold, and `verify` does not run it.
  `scripts/readme-versions.test.mjs` fails when the two packages' versions differ. Copy the dev
  dependency, the script and that test; bump both packages together.
- Dependencies: `renovate.json` opens weekly update PRs for npm (`frontend/`), the Gradle version
  catalog and wrapper, GitHub Actions and `compose.yaml`, keeping exact pins and the Actions' major
  tags (`v7` stays `v7`: a `github-actions` rule sets `rangeStrategy: replace` against
  `:pinAllExceptPeerDependencies`, so only a new major such as `v8` opens a PR). The Angular
  packages, `angular-eslint` and TypeScript form one PR (a major one says to run `ng update` for the
  migrations); so do the Postgres image in `compose.yaml` and `TestcontainersConfiguration` (a regex
  manager reads the Java constant; `ignorePaths` drops `config:recommended`'s `**/test/**` so it is
  seen; a major one says to run `docker compose down -v`), and the Spring Boot plugin and BOM. A
  TypeScript major gets no PR: `@angular/compiler-cli` accepts one TypeScript major, so alone it
  fails `npm ci`; it comes with an Angular major through `ng update`. Regex managers also update the README *What's inside*
  rows, so a bump does not fail `readme-versions.test.mjs`, which also fails when a row other than
  the manual ones has no manager. The Java toolchain, npm (`packageManager`) and the `@types/node`
  major stay manual, since they move with the JDK and Node the CI wrappers install. Lock-file
  maintenance and OSV vulnerability PRs keep transitive dependencies current. Renovate works on
  GitHub and GitLab alike; enable the Renovate app (or a self-hosted runner) on your repository, and
  copy `renovate.json` with the README rows it names.
- `verify`: the full run fails on a high or critical `npm audit` advisory in `frontend/` (`frontend
  audit`, first after `npm ci`, as it needs only the lockfile). `--quick` skips it: it needs the
  registry, and its result changes with newly published advisories under an unchanged lockfile, so
  an inner-loop run would fail on news unrelated to the change; CI runs the full verify.
- Frontend: the real-backend Playwright suite gets a `localized` project that runs against Spring
  on `:8080` serving the production build, because the existing specs only ever saw the `en`
  dev server and nothing loaded the `de` / `en` builds through `SpaWebConfig`.
  `e2e/real-backend/shell.localized.real.e2e.ts` proves `/` redirects to `/de/` without a preference and
  to `/en/` for an English browser, the `de` build renders German text with `<html lang="de">`,
  and a client-route deep link under `/de/` loads the shell; `catalog.localized.real.e2e.ts`
  (sample) proves a catalog price is formatted in German. The former project is now `dev-server`.
  Local only like the rest of the suite: `npm run build`, then `bootRun`, then
  `REAL_BACKEND=1 npm run test:e2e:real`. Port: copy the two projects of
  `playwright.real.config.ts` and the shell spec, with your own German strings.
- `scripts/init.test.mjs`: the failing-commit test failed wherever the developer's git config
  signs with `gpg.format=ssh` (and a working `gpg.ssh.program`), as in some cloud containers: git
  then signs through that program and never runs the missing `gpg.program` the test forced, so the
  commit succeeded. The test now shuts out global and system config (`GIT_CONFIG_GLOBAL` on an
  empty file, `GIT_CONFIG_NOSYSTEM`) and pins `gpg.format=openpgp`, so the commit fails whatever
  the machine's config is. Template-only; nothing to port.
- Backend: a production container image. `./gradlew :bootstrap:bootBuildImage` builds
  `<project name>:<version>` with Spring Boot's Cloud Native Buildpacks support (Paketo
  `builder-noble-java-tiny`, `BP_JVM_VERSION` taken from the Gradle toolchain), no Dockerfile
  (`docs/adr/0006-container-image-with-buildpacks.md`): the buildpacks bring layering, a
  container-aware memory calculator, a non-root user and an SBOM we would otherwise maintain by
  hand. The name comes from `rootProject.name`, so `init` renames it. `checkSpaPackaged` fails the
  build unless every locale of `angular.json` was packaged into `static/`, because an image
  without the SPA starts and reports healthy while serving no page. Nothing deployment-specific is
  baked in: `SPRING_DATASOURCE_URL` / `USERNAME` / `PASSWORD` (and optionally
  `APP_BUSINESS_TIME_ZONE`, `SERVER_PORT`) come from the environment at runtime; Spring Boot's
  Docker Compose support stays `developmentOnly`, so it is not in the image. Port: copy the
  `checkSpaPackaged` and `bootBuildImage` blocks of `backend/bootstrap/build.gradle` and the README's
  *Production image* section.
- `verify`: the full run smoke-tests the image (invariant #9), after the mocked e2e:
  `scripts/smoke-image.mjs` builds it (the frontend too, unless `--skip-frontend-build`, which
  `verify` passes as it has just built it), starts it with `compose.yaml`'s Postgres on a
  throwaway Docker network, waits for `/actuator/health` to be `UP`, checks that `GET /` is a 302
  to `/de/` and that `/de/` and `/en/` serve their `<html lang>`, prints the app log on failure and
  always removes what it started. It is in `verify` rather than opt-in because nothing else would
  notice a change that breaks the image before a deploy, and the full run already needs Docker and
  the network; it costs a builder pull (several hundred MB) on a cold Docker cache. `--quick`
  skips it. Under a TCP `DOCKER_HOST` (Docker-in-Docker, as in `.gitlab-ci.yml`) it calls the app
  on the daemon's host. Port: copy the script, its test and the `verify.mjs` step.
- A root `Dockerfile` for hosts that build images from source and take only a Dockerfile, Render
  in particular (`docs/adr/0007-dockerfile-for-source-builds.md`); `bootBuildImage` stays the
  primary image. Three stages: Node (the `.nvmrc` version) runs `npm ci` and `npm run build`;
  Temurin JDK 25 runs `checkSpaPackaged` and `bootJar`, so a build without both locales fails here
  too, and extracts the layered jar; a Temurin JRE 25 stage runs it as a non-root user (uid 10001)
  on `8080` with the heap at 75 % of the container's memory. `.dockerignore` allow-lists
  `backend/` and `frontend/` and drops build output, so no local file reaches the image. Base
  images are pinned to exact tags: Renovate's `dockerfile` manager bumps the Temurin patch versions
  (JDK and JRE as one PR, a regex versioning that reads `_8` as a build number); the Node tag and
  the Java major move by hand with `.nvmrc` and the Gradle toolchain. `README.project.md`'s
  *Production image* section describes both builds and a Render deploy (Docker web service,
  `jdbc:postgresql://` URL instead of Render's `postgres://` string, `PORT=8080`, health check
  `/actuator/health`); the template's README links the example app running on Render instead.
- `scripts/smoke-image.mjs --builder buildpacks|dockerfile` (buildpacks by default):
  `dockerfile` runs `docker build` from the root, tagged `<version>-dockerfile`, after checking that
  the Dockerfile's Node and Temurin tags match `.nvmrc` and the Gradle toolchain, then runs the same
  checks. The full `verify` runs both (`image smoke test (buildpacks)`, `image smoke test
  (dockerfile)`), since the Dockerfile is the path a Render deploy takes and would otherwise break
  unnoticed until one; it adds a second image build (npm, Angular and the Gradle dependencies again,
  in fresh containers) to the full run. `--quick` runs neither. Port: copy `Dockerfile`,
  `.dockerignore`, the script, its test, the `verify.mjs` steps and the `renovate.json` rules.
- Releasing: `.github/workflows/release-tag.yml` tags the template's releases in one click,
  replacing the manual `git tag` step (kept in `CONTRIBUTING.md` as a fallback). It runs only by
  hand on `main` (**Run workflow** in the Actions tab), never on a push, because a version's
  heading lands on `main` several PRs before the version is complete and an automatic trigger
  would tag it at the first of them. It fails unless `ci` and `template-ci` both succeeded for the
  push of `main`'s tip; `scripts/release-tag.mjs` then reads the version from the top
  `CHANGELOG.md` heading, fails if `TEMPLATE_VERSION` differs, skips when `vX.Y.Z` already exists
  on the remote, and otherwise pushes the annotated tag as `github-actions[bot]`. The decision is
  pure functions covered by `scripts/release-tag.test.mjs` (invariant #9), which also fails if the
  workflow gains an automatic trigger. Template-only: `init` deletes the workflow, the script and
  its test. Nothing to port.

## 0.1.1 — 2026-11-01

- `skills-lock.json`: a vendored skill's `computedHash` covers its whole folder (every file under
  `.claude/skills/<name>/`, sorted by path, text normalised to LF, binaries as-is, dotfiles such as
  `.DS_Store` skipped), so an edit to a `references/*.md`, script or licence file fails
  `check-agent-docs` like an edit to `SKILL.md`.
  After replacing a vendored skill from a new upstream ref, re-pin it with
  `node scripts/check-agent-docs.mjs --refresh-hashes` in the same commit.
- Skills: the vendored `grilling` and `codebase-design` skills are gone (generic process and design
  advice, cited by nothing here; process belongs to Superpowers). A vendored skill may now leave
  out files that do not apply, never edit them, and `THIRD_PARTY_LICENSES.md` lists what each one
  leaves out: `postgres` drops its PlanetScale-only `references/ps-*.md` and
  `references/pgbouncer-configuration.md`, `domain-modeling` drops the Codex `agents/openai.yaml`.
  Delete the same files and rows in your project, then re-pin with `--refresh-hashes`.
- Backend: three new ArchUnit rules keep domain logic out of driving adapters.
  `drivingAdaptersGoThroughPortIn` fails a class in an area's `adapter.in` packages that depends
  on `domain.model` or `application.port.out`, so a controller or listener cannot skip the use
  case or return an aggregate. `onlyDrivenAdaptersRehydrate` fails a call to, or method reference
  of, a `rehydrate` factory on a `domain.model` class from anywhere but `domain.model` and
  `adapter.out`, since `rehydrate` skips the creation rules. `publishedTypesAreDataOnly` fails a
  `port.in` or `domain.event` type that carries behaviour (a plain class, a `default` method, or a
  record or enum method that is not an accessor, `equals` / `hashCode` / `toString` or a static
  factory returning its own type), so a view cannot grow a `canRetire()` that controllers call
  instead of the use case; typed ids are value objects and may carry behaviour. Copy the rules with
  their fixtures; name your aggregates' load-from-storage factory `rehydrate` so the second one
  sees it.
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
- Backend: the Gradle build is written in the Groovy DSL instead of the Kotlin DSL, at the
  maintainer's request: `settings.gradle`, a `build.gradle` per module, and the convention plugin
  `build-logic/src/main/groovy/java-conventions.gradle`, built by `groovy-gradle-plugin` instead of
  `kotlin-dsl`. Tasks, resolved dependencies, test selection (`-PexcludeTags=container`),
  `checkCoreClasspath`, the frontend copy into `bootstrap` and `gradle/libs.versions.toml` are
  unchanged. Port it only if your project wants Groovy: rename the scripts, move the convention
  plugin to `src/main/groovy/`, swap the plugin and translate the syntax, then point the *What's
  inside* Java row and `scripts/readme-versions.test.mjs` at the new path.
- Backend tests: an area's integration tests are Spring Modulith's `@ApplicationModuleTest`, which
  starts that area, `shared` and the wiring in the base package, not the whole app; `Scenario`
  needs no `@EnableScenarios` there. `@SpringBootTest` stays for whole-app tests in the base
  package (`ApplicationIT`). The ArchUnit rule `areaTestsAreModuleTests`
  (`ArchitectureRules.testRules()`, checked over the test classes) rejects `@SpringBootTest` in an
  area. A test of the generic error body needs `extraIncludes = "web"` for `ApiErrorHandler`.
  Switch your area ITs and copy the rule with its fixtures.
- `init`: after the initial commit the new repository must hold that one commit alone; if a git
  process still running in the clone wrote the old history back, init rebuilds `.git` after a
  pause (three tries) and otherwise stops, telling you to delete `.git` and finish by hand, so a
  project never starts on top of the template's history. `init.test.mjs` disables gc and maintenance in its throwaway copies and tolerates a
  refusal that exits before reading stdin (EPIPE); both made the template CI fail intermittently.

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
