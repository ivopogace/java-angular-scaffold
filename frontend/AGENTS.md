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

## Translations

English source text in the code, German (`de`) the default build, translations in
`src/locale/messages.de.xlf`. Every user-facing string carries a stable custom id (`i18n="@@…"`,
`` $localize`:@@…:…` ``); locale-dependent formatting uses `LOCALE_ID`, never a literal locale.

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
  `ngStyle`.

## Tests

- Vitest specs next to the code. `Date` is frozen at `FROZEN_INSTANT`; a spec using full fake
  timers restores with `freezeClock()`, never `vi.useRealTimers()`.
- Wait for Angular (`await fixture.whenStable()`), never force a render; drive Material through
  its harnesses and routing through `RouterTestingHarness`.
- Every user-facing page gets an axe spec (`expectNoAxeViolations`).
