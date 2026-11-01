import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import stylelint from 'stylelint';

const config = JSON.parse(readFileSync(new URL('../.stylelintrc.json', import.meta.url), 'utf8'));

const configBasedir = fileURLToPath(new URL('..', import.meta.url));

const lint = async (code, codeFilename = 'src/app/x/x.scss') => {
  const { results } = await stylelint.lint({ code, codeFilename, config, configBasedir });
  return results[0].warnings.map((warning) => warning.rule);
};

describe('stylelint config', () => {
  it('flags ::ng-deep', async () => {
    assert.deepEqual(await lint('::ng-deep .x {}'), ['selector-pseudo-element-disallowed-list']);
  });

  it('flags Material MDC internals', async () => {
    assert.deepEqual(await lint('.mat-mdc-button {}'), ['selector-disallowed-list']);
    assert.deepEqual(await lint('.mdc-button {}'), ['selector-disallowed-list']);
  });

  it('flags hex colours', async () => {
    assert.deepEqual(await lint('.x { color: #fff }'), ['color-no-hex']);
  });

  it('flags colour functions', async () => {
    assert.deepEqual(await lint('.x { color: rgb(0 0 0) }'), ['function-disallowed-list']);
    assert.deepEqual(await lint('.x { color: hsla(0 0% 0% / 0.5) }'), ['function-disallowed-list']);
  });

  for (const literal of [
    'hwb(0 0% 0%)',
    'lab(50% 40 60)',
    'lch(50% 40 60)',
    'oklab(60% 0.1 0.1)',
    'oklch(70% 0.1 200)',
    'color(display-p3 1 0 0)',
  ]) {
    it(`flags ${literal.slice(0, literal.indexOf('('))}()`, async () => {
      assert.deepEqual(await lint(`.x { color: ${literal} }`), ['function-disallowed-list']);
    });
  }

  it('passes color-mix() over theme tokens', async () => {
    assert.deepEqual(
      await lint('.x { color: color-mix(in srgb, var(--mat-sys-primary) 50%, transparent) }'),
      [],
    );
  });

  it('flags named colours', async () => {
    assert.deepEqual(await lint('.x { color: red }'), ['color-named']);
  });

  it('passes theme tokens', async () => {
    assert.deepEqual(await lint('.x { color: var(--mat-sys-primary) }'), []);
  });

  it('flags colour literals passed to an *-overrides mixin', async () => {
    const include = (value) => `@include mat.button-overrides((filled-container-color: ${value}));`;
    assert.deepEqual(await lint(include('#ff0000')), ['local/overrides-no-color-literal']);
    assert.deepEqual(await lint(include('rgb(255 0 0)')), ['local/overrides-no-color-literal']);
    assert.deepEqual(await lint(include('red')), ['local/overrides-no-color-literal']);
  });

  it('passes tokens passed to an *-overrides mixin', async () => {
    assert.deepEqual(
      await lint(
        '@include mat.button-overrides((filled-container-color: var(--mat-sys-primary), filled-label-text-color: var(--mat-sys-on-primary)));',
      ),
      [],
    );
  });

  it('lets the global theme file hold colour literals but not the structural bans', async () => {
    assert.deepEqual(await lint('.x { color: #fff }', 'src/styles.scss'), []);
    assert.deepEqual(await lint('.x { color: oklch(70% 0.1 200) }', 'src/styles.scss'), []);
    assert.deepEqual(
      await lint('@include mat.theme-overrides((primary: #6750a4));', 'src/styles.scss'),
      [],
    );
    assert.deepEqual(await lint('::ng-deep .x {}', 'src/styles.scss'), [
      'selector-pseudo-element-disallowed-list',
    ]);
  });
});
