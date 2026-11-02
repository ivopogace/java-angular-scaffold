# Frontend

Angular workspace: standalone components, signals, zoneless, Angular Material with Material 3
theming in SCSS. Run commands from here; the list is in the root `AGENTS.md`. Verify framework
behaviour with the `angular-cli` MCP server (`search_documentation`, `get_best_practices`), not
memory.

## Folders (`src/app/`)

| Folder       | Owns                                                                          | May import                                |
| ------------ | ----------------------------------------------------------------------------- | ----------------------------------------- |
| `core/`      | stateful app-wide singletons: interceptors, guards, error handling, app state | `shared/`                                 |
| `shared/`    | stateless utilities and presentational components, no `HttpClient`            | nothing app-internal                      |
| `pages/`     | routes no feature owns (home, not-found)                                      | `core/`, `shared/`                        |
| `<feature>/` | one business area: pages, components, models, HTTP service                    | `core/`, `shared/`, never another feature |

- Two features need the same thing → promote it: pure → `shared/`, stateful or HTTP → `core/`.
- `eslint-rules/folder-boundary.mjs` (`local/folder-boundary`) enforces the table, dynamic
  `import()` included (invariant #7).
- Every route lives in `src/app/app.routes.ts`: lazy `loadComponent`, with a `title`.
- Dev: `npm start` serves the source locale `en` only and proxies `/api` and `/actuator` to
  `:8080` (`proxy.conf.json`). The production build (`de` and `en`, one app each) is copied into
  `bootstrap` and served same-origin by Spring under `/de/` and `/en/`.

## Translations

- Compile-time `@angular/localize`: English source text in the code, German (`de`) the default
  build; translations in `src/locale/messages.de.xlf` (XLIFF 2, one unit per line). How to add a
  string: the `frontend-architecture` skill.
- Every user-facing string carries a stable custom id: `i18n="@@…"` / `i18n-<attr>="@@…"` in
  templates (`@angular-eslint/template/i18n` fails lint otherwise), `` $localize`:@@…:…` `` in
  TypeScript. `npm run build` fails on a missing `de` translation.
- Locale-dependent formatting uses `LOCALE_ID` (`injectFormatMoney()`), never a literal locale.

## Components

- One folder per component: `<name>/<name>.ts`, `.html`, `.scss`, `.spec.ts` (no `.component`
  suffix). Inline templates and styles fail lint (`component-max-inline-declarations` is 0; specs
  are exempt for throwaway test hosts).
- Selectors: elements `app-kebab-case`, attributes `appCamelCase`. The one exception is a directive
  that must share a Material microsyntax prefix (`shared/typed-cell-def/`), argued where it is
  declared.

## Angular idioms

- State in signals with `computed()` and `linkedSignal()`.
- Signal Forms (`@angular/forms/signals`) for new forms.
- No `standalone: true` and no `ChangeDetectionStrategy.OnPush` boilerplate.
- Lint fails on decorator inputs and outputs (use `input()`, `output()`, `model()`),
  `@HostBinding` / `@HostListener` (use `host`), a root `@Injectable` (use `@Service()`),
  constructor injection (use `inject()`), `*ngIf` / `*ngFor` (use `@if` / `@for`) and `ngClass` /
  `ngStyle`; `eslint-rules/eslint-config.test.mjs` proves each rule fires.

## Styling (invariant #8)

- The theme is defined once, with `mat.theme(...)` in `src/styles.scss` (light + dark via
  `color-scheme`).
- Component `.scss` uses `--mat-sys-*` tokens for colour, typography, shape and elevation; colour
  literals outside the theme file fail Stylelint, in declarations and in the arguments of an
  `*-overrides` mixin alike (`stylelint/overrides-no-color-literal.mjs`).
- Customise Material components only through their `*-overrides` mixins. `::ng-deep` and
  `.mdc-*` / `.mat-mdc-*` selectors fail Stylelint.

## Tests

- Vitest specs next to the code, in jsdom. `src/test-setup.ts` freezes `Date` at `FROZEN_INSTANT`
  (`src/testing/freeze-clock.ts`); a spec using full fake timers restores with `freezeClock()`,
  never `vi.useRealTimers()`.
- Wait for Angular, never force a render: `await fixture.whenStable()`, or `TestBed.tick()` while
  an `httpResource` load is unflushed (`whenStable()` waits for it; a plain `HttpClient` request
  does not count under `provideHttpClientTesting()`); lint rejects `detectChanges()` in specs.
  Material components are driven through their harnesses (`TestbedHarnessEnvironment`), inside
  `manualChangeDetection` while such a load is open; routing through `RouterTestingHarness`, never
  a mocked `Router`.
- User-facing pages get an axe spec via `expectNoAxeViolations` (`src/testing/axe.ts`); contrast is
  checked in Playwright, since jsdom has no layout.
- Playwright: `e2e/` stubs the API per spec and runs in CI; `e2e/real-backend/` runs locally only,
  against the running stack (backend on `:8080`, `npm start`):
  `REAL_BACKEND=1 npm run test:e2e:real` — without the variable every spec skips.
- The repo's own ESLint rules, the ESLint and Stylelint configs have their own suite
  (`npm run test:eslint-rules`).
