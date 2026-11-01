---
name: frontend-architecture
description: >-
  Angular structure authority for frontend/: which folder a file lands in
  (core/shared/pages/features), the import direction local/folder-boundary enforces, one folder
  per component, routes, app.config providers, feature services, and the unit / axe / mocked e2e
  / real-backend e2e test split. Load BEFORE adding a file, folder, component, route, provider,
  cross-folder import or e2e spec under frontend/, or when local/folder-boundary or
  component-max-inline-declarations fails. Styling and .scss are `frontend-styling`'s; Angular
  API questions go to `angular-developer` and the angular-cli MCP.
---

# Frontend architecture

Owns the *where*. The folder table and the idioms list are in `frontend/AGENTS.md`; this is how
to apply them. Full worked example: the `catalog` sample, while it exists.

## Which folder

- It belongs to one business area → that feature folder (`src/app/<feature>/`), named like the
  backend area.
- A route no feature owns (home, not-found) → `pages/`.
- Stateful and app-wide (interceptor, guard, error handling, `TitleStrategy`) → `core/`
  (`core/app-title-strategy/` is the pattern).
- Pure and stateless: a formatter, a presentational component, a type mirroring a backend value
  → `shared/` (`shared/money/` mirrors the backend's `Money` and stays when a feature is removed).
- Two features need the same thing → promote it: pure → `shared/`, stateful or HTTP → `core/`.
  Never import it from the other feature.

`local/folder-boundary` (`frontend/eslint-rules/folder-boundary.mjs`) enforces the direction for
`import`, `export … from` and `import()`: `shared` imports nothing app-internal, `core` only
`shared`, `pages` only `core` and `shared`, a feature only `core` and `shared` — never another
feature or `pages`. `core`, `shared` and `pages` never import the `src/app/` root files
(`app.routes.ts`, `app.config.ts`). Widening the rule's tables is a design change, argued in the
change that needs it.

## Inside a feature

Flat: `<feature>.model.ts` (wire types), `<feature>.service.ts` (HTTP + shared state), and one
folder per component. `npx ng generate component <feature>/<name>` creates the four files
(`<name>.ts`, `.html`, `.scss`, `.spec.ts`, no `.component` suffix). Inline `template` or
`styles` fail lint; `*.spec.ts` is exempt, so a throwaway test host may be inline.

The service owns the API URLs and the shared state; components inject it:

```ts
@Service()
export class CatalogService {
  private readonly http = inject(HttpClient);

  readonly products = httpResource<Product[]>(() => PRODUCTS_URL);

  create(request: CreateProductRequest): Observable<Product> {
    return this.http.post<Product>(PRODUCTS_URL, request).pipe(tap(() => this.reload()));
  }
}
```

Wire types mirror the backend DTO exactly (`priceMinor: number | null`, `currency: string |
null`); format at the view edge (`formatMoney`) and branch on a problem body's `reason`, never on
`detail` text.

## Routes and providers

Every route is in `src/app/app.routes.ts`, lazy, with a `title` (`app.routes.spec.ts` resolves
every `loadComponent` and fails a route without a title):

```ts
{
  path: '',
  title: 'Home',
  loadComponent: () => import('./pages/home/home').then((m) => m.Home),
},
```

The file is `// prettier-ignore` (removable sample lines must stay one line each), so format a
new route by hand like the one above. The `**` route stays last. App-wide providers go in
`src/app/app.config.ts`; `AppTitleStrategy` turns a route title into `<title> · <app name>`.

## Tests

| What | Where | Proves |
|---|---|---|
| component, service, pure function | `<name>.spec.ts` next to it (Vitest, jsdom) | behaviour; HTTP via `provideHttpClientTesting` + `HttpTestingController` |
| user-facing page | an `expectNoAxeViolations` case in its spec (`src/testing/axe.ts`) | no axe violation (contrast excluded: jsdom has no layout) |
| user journey, contrast | `frontend/e2e/*.e2e.ts`, API stubbed with `page.route` | rendering in a browser, axe in both colour schemes; runs in CI |
| wiring against the real API | `frontend/e2e/real-backend/*.e2e.ts` | round-trip through Spring and Postgres; local only, skips unless `REAL_BACKEND=1` |

`Date` is frozen at `FROZEN_INSTANT` (`src/testing/freeze-clock.ts`) for every spec; a spec that
fakes timers restores with `freezeClock()`, never `vi.useRealTimers()`. e2e locators are roles and
labels (`getByRole('button', { name: 'Publish Poster' })`), with web-first `expect` and no fixed
waits; a real-backend spec makes its data unique (`` `E2E product ${Date.now()}` ``).

## Adding a feature

1. `src/app/<feature>/<feature>.model.ts` and `<feature>.service.ts` (`@Service()`, `inject()`).
2. Components with `ng generate component <feature>/<name>`; styling per `frontend-styling`.
3. Lazy routes with titles in `app.routes.ts`; a nav link in `src/app/app.html` if it is a
   top-level destination.
4. Specs, an axe case per page, a mocked e2e spec in `frontend/e2e/`, and a real-backend spec
   when the journey depends on the server.
5. `npm run lint` and `npm test -- --watch=false`, then `node scripts/verify.mjs --quick`.
