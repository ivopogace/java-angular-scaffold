---
name: frontend-styling
description: >-
  How to style frontend/ with Angular Material 3 and SCSS: the one theme in src/styles.scss,
  --mat-sys-* tokens for colour, type, shape and elevation, Material's *-overrides mixins,
  changing brand colours with the theme-color schematic, light and dark, and what Stylelint
  rejects. Load BEFORE writing or changing any .scss under frontend/src, customising a Material
  component, or when Stylelint fails (color-no-hex, ::ng-deep, .mat-mdc-*). Which folder a
  component lives in is `frontend-architecture`'s.
---

# Frontend styling

Invariant #8: styling uses Material tokens and override mixins. The theme is defined once; every
component reads it through `--mat-sys-*` custom properties, so light, dark and a brand change
reach every screen without touching component files. Full worked example: the `catalog` sample,
while it exists.

## The theme

`frontend/src/styles.scss` is the only theme file:

```scss
html {
  color-scheme: light dark;
  @include mat.theme(
    (
      color: (
        primary: mat.$azure-palette,
        tertiary: mat.$blue-palette,
      ),
      typography: Roboto,
      density: 0,
    )
  );
}
```

`color-scheme: light dark` follows the OS; the mocked e2e runs its axe checks in both schemes, so
contrast is checked in each.

**Changing brand colours:** `npx ng generate @angular/material:theme-color` (from `frontend/`)
turns hex colours into `src/_theme-colors.scss` with `$primary-palette` and `$tertiary-palette`.
`@use` it from `styles.scss` and pass those palettes to `mat.theme`. The generated file holds hex
values, so add it to the `files` of the override in `frontend/.stylelintrc.json` next to
`src/styles.scss` — colour literals stay confined to theme files, never a component.

## Tokens in component `.scss`

| Need | Use |
|---|---|
| colour | `var(--mat-sys-primary)`, `--mat-sys-on-surface`, `--mat-sys-surface-container`, `--mat-sys-outline-variant` |
| type | `font: var(--mat-sys-headline-medium)` (also `title-large`, `body-medium`, `label-large`) |
| shape | `border-radius: var(--mat-sys-corner-medium)` |
| elevation | `box-shadow: var(--mat-sys-level2)` |

Pair every background with its `on-` token (`surface-container` with `on-surface`). Spacing and
layout are ordinary CSS (`gap: 16px`, flex, logical properties such as `margin-block-end`).

```scss
h1 {
  font: var(--mat-sys-headline-medium);
  margin: 0;
}
```

## Customising a Material component

Only through its `*-overrides` mixin, scoped to the host that needs it:

```scss
@use '@angular/material' as mat;

:host {
  @include mat.toolbar-overrides(
    (
      container-background-color: var(--mat-sys-primary-container),
      container-text-color: var(--mat-sys-on-primary-container),
    )
  );
}
```

Token names are the component's override keys (`toolbar-overrides`, `button-overrides`,
`table-overrides`, …); values are system tokens, not literals. Put an app-wide override in
`styles.scss` instead of repeating it per component.

## What Stylelint rejects (`npm run lint`)

| Rule | Instead |
|---|---|
| `::ng-deep` | an `*-overrides` mixin on the host |
| `.mdc-*`, `.mat-mdc-*` selectors | an `*-overrides` mixin; Material's internal classes change between releases |
| hex, named colours, `rgb()`/`rgba()`/`hsl()`/`hsla()` outside the theme files | a `--mat-sys-*` token |

The colour rules match those spellings only: `oklch()`, `lab()`, `hwb()` and other colour
functions slip past the linter and still break invariant #8 — use a token.
`npm run test:eslint-rules` covers the Stylelint config; a new rule gets a case in
`frontend/stylelint/stylelint-config.test.mjs`.
