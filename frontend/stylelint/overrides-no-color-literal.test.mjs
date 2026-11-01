import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import stylelint from 'stylelint';

import plugin, { colorLiterals } from './overrides-no-color-literal.mjs';

const { ruleName } = plugin;

const lint = async (code) => {
  const { results } = await stylelint.lint({
    code,
    customSyntax: 'postcss-scss',
    config: { plugins: [plugin], rules: { [ruleName]: true } },
  });
  return results[0].warnings.map(({ rule, text, line, column }) => ({ rule, text, line, column }));
};

const include = (value) => `@include mat.button-overrides((filled-container-color: ${value}));`;

const rejected = (literal, mixin = 'mat.button-overrides') =>
  `Unexpected colour literal "${literal}" in ${mixin}(); pass a --mat-sys-* token (invariant #8) (${ruleName})`;

describe(ruleName, () => {
  it('flags a hex colour where it stands', async () => {
    assert.deepEqual(await lint(include('#ff0000')), [
      { rule: ruleName, text: rejected('#ff0000'), line: 1, column: 56 },
    ]);
  });

  it('flags a hex colour inside a nested multi-line include', async () => {
    const code = [
      ':host {',
      '  @include mat.toolbar-overrides(',
      '    (',
      '      container-background-color: var(--mat-sys-primary-container),',
      '      container-text-color: #fff,',
      '    )',
      '  );',
      '}',
    ].join('\n');
    assert.deepEqual(await lint(code), [
      { rule: ruleName, text: rejected('#fff', 'mat.toolbar-overrides'), line: 5, column: 29 },
    ]);
  });

  for (const literal of [
    'rgb(0 0 0)',
    'rgba(0, 0, 0, 0.5)',
    'hsl(0 0% 0%)',
    'hsla(0 0% 0% / 0.5)',
    'hwb(0 0% 0%)',
    'lab(50% 40 60)',
    'lch(50% 40 60)',
    'oklab(60% 0.1 0.1)',
    'oklch(70% 0.1 200)',
    'color(display-p3 1 0 0)',
  ]) {
    const name = literal.slice(0, literal.indexOf('('));
    it(`flags ${name}()`, async () => {
      assert.deepEqual(
        (await lint(include(literal))).map((w) => w.text),
        [rejected(`${name}()`)],
      );
    });
  }

  it('flags named colours in any case', async () => {
    assert.deepEqual(
      (await lint(include('red'))).map((w) => w.text),
      [rejected('red')],
    );
    assert.deepEqual(
      (await lint(include('RebeccaPurple'))).map((w) => w.text),
      [rejected('RebeccaPurple')],
    );
  });

  it('flags every literal in one include, in source order', async () => {
    const code =
      '@include mat.button-overrides((filled-container-color: red, filled-label-text-color: #fff, outlined-outline-color: rgb(0 0 0)));';
    assert.deepEqual(
      (await lint(code)).map((w) => w.text),
      [rejected('red'), rejected('#fff'), rejected('rgb()')],
    );
  });

  it('flags a mixin without a module prefix', async () => {
    assert.deepEqual(
      (await lint('@include button-overrides((filled-container-color: #fff));')).map((w) => w.text),
      [rejected('#fff', 'button-overrides')],
    );
  });

  for (const value of [
    'var(--mat-sys-primary)',
    'var(--mat-sys-red)',
    'color-mix(in srgb, var(--mat-sys-primary) 50%, transparent)',
    'transparent',
    'currentcolor',
    'inherit',
    '$red',
    'mat.$azure-palette',
    'color.adjust($brand, $lightness: 10%)',
    '#{$red}',
    'light-dark(var(--mat-sys-primary), var(--mat-sys-on-primary))',
  ]) {
    it(`passes ${value}`, async () => {
      assert.deepEqual(await lint(include(value)), []);
    });
  }

  it('ignores colours inside quoted strings and comments', async () => {
    const code = [
      '@include mat.button-overrides(',
      '  (',
      '    // was red, #fff',
      '    filled-container-color: var(--mat-sys-primary), /* not rgb(0 0 0) */',
      '    filled-label-text-font: "Red Hat Display",',
      '  )',
      ');',
    ].join('\n');
    assert.deepEqual(await lint(code), []);
  });

  it('leaves includes that are not an *-overrides mixin alone', async () => {
    assert.deepEqual(await lint('@include mat.theme((color: (primary: #6750a4)));'), []);
    assert.deepEqual(await lint('@include shadow(#000);'), []);
    assert.deepEqual(await lint('@include overrides-list(#000);'), []);
  });

  it('exposes the literal scanner', () => {
    assert.deepEqual(colorLiterals('(a: #fff, b: Red, c: rgb(0 0 0), d: var(--x))'), [
      { literal: '#fff', index: 4, length: 4 },
      { literal: 'Red', index: 13, length: 3 },
      { literal: 'rgb()', index: 21, length: 3 },
    ]);
  });
});
