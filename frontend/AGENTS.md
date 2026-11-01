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
- Dev: `npm start` proxies `/api` and `/actuator` to `:8080` (`proxy.conf.json`). The production
  build is copied into `bootstrap` and served same-origin by Spring.

## Components

- One folder per component: `<name>/<name>.ts`, `.html`, `.scss`, `.spec.ts` (no `.component`
  suffix). Inline templates and styles fail lint (`component-max-inline-declarations` is 0; specs
  are exempt for throwaway test hosts).
- Selectors: elements `app-kebab-case`, attributes `appCamelCase`.

## Angular idioms

- `input()`, `output()`, `model()` — not the decorators.
- State in signals with `computed()` and `linkedSignal()`.
- Signal Forms (`@angular/forms/signals`) for new forms.
- Native control flow (`@if`, `@for`, `@switch`).
- `inject()`, not constructor parameters.
- No `standalone: true` and no `ChangeDetectionStrategy.OnPush` boilerplate.

## Styling (invariant #8)

- The theme is defined once, with `mat.theme(...)` in `src/styles.scss` (light + dark via
  `color-scheme`).
- Component `.scss` uses `--mat-sys-*` tokens for colour, typography, shape and elevation; colour
  literals in declarations outside the theme file fail Stylelint. Values passed to an
  `*-overrides` mixin are not linted; they are tokens too.
- Customise Material components only through their `*-overrides` mixins. `::ng-deep` and
  `.mdc-*` / `.mat-mdc-*` selectors fail Stylelint.

## Tests

- Vitest specs next to the code, in jsdom. `src/test-setup.ts` freezes `Date` at `FROZEN_INSTANT`
  (`src/testing/freeze-clock.ts`); a spec using full fake timers restores with `freezeClock()`,
  never `vi.useRealTimers()`.
- User-facing pages get an axe spec via `expectNoAxeViolations` (`src/testing/axe.ts`); contrast is
  checked in Playwright, since jsdom has no layout.
- Playwright: `e2e/` stubs the API per spec and runs in CI; `e2e/real-backend/` needs the backend
  on `:8080` and runs locally only.
- The repo's own ESLint rules and Stylelint config have their own suite
  (`npm run test:eslint-rules`).
