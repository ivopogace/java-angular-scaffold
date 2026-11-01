import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import stylelint from 'stylelint';

const config = JSON.parse(readFileSync(new URL('../.stylelintrc.json', import.meta.url), 'utf8'));

const lint = async (code, codeFilename = 'src/app/x/x.scss') => {
  const { results } = await stylelint.lint({ code, codeFilename, config });
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

  it('flags named colours', async () => {
    assert.deepEqual(await lint('.x { color: red }'), ['color-named']);
  });

  it('passes theme tokens', async () => {
    assert.deepEqual(await lint('.x { color: var(--mat-sys-primary) }'), []);
  });

  it('lets the global theme file hold colour literals but not the structural bans', async () => {
    assert.deepEqual(await lint('.x { color: #fff }', 'src/styles.scss'), []);
    assert.deepEqual(await lint('::ng-deep .x {}', 'src/styles.scss'), [
      'selector-pseudo-element-disallowed-list',
    ]);
  });
});
