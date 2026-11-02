# Compile-time i18n with `@angular/localize`, one build per locale

The frontend is translated at build time with Angular's own `@angular/localize`: templates carry
`i18n="@@id"`, TypeScript uses `` $localize`:@@id:…` ``, English is the source locale and German
(`frontend/src/locale/messages.de.xlf`) the default a user gets. `ng build` emits one complete app
per locale (`browser/de/`, `browser/en/`), each with its `<html lang>`, `<base href>` and
`LOCALE_ID` set, and the backend serves them under `/de/` and `/en/`, redirecting any other page
request no controller answers by `Accept-Language`. We took this over a runtime library such as
Transloco because it is first-party (it follows Angular's releases, no third-party major to wait
on), ships no translation loader, keys or lookup in the bundle, needs no translation pipe in
templates, and lets the build itself fail on a missing translation (`i18nMissingTranslation:
error`), which keeps invariant #9 cheap.

## Considered Options

- Transloco (or ngx-translate): one build, language switch without a reload, translations fetched
  as JSON at runtime. Rejected: every template string becomes a key lookup through a pipe or
  directive, a missing key surfaces only at runtime, and the library is one more dependency that
  must keep pace with Angular's majors.

## Consequences

- Changing the language is a full page load to the other locale's URL, never an in-place switch;
  a language picker is a link to `/en/…` or `/de/…`.
- Build time and the size of `dist/` grow with each locale; the dev server (`npm start`) serves
  only the source locale `en`, so German is seen in the production build.
- A user-facing string that cannot be known at build time (data from the API) is not translated by
  this mechanism; the backend sends stable codes (`reason`) the frontend maps to `$localize`d text.
- Adding a locale touches `angular.json`'s `i18n` block, a new `messages.<locale>.xlf`, and
  `SpaWebConfig.LOCALES` in `bootstrap`; `SpaWebConfigTest` fails until `LOCALES` matches
  `angular.json`.
