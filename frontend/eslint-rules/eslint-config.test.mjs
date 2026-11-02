import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { ESLint } from 'eslint';

const eslint = new ESLint({ cwd: fileURLToPath(new URL('..', import.meta.url)) });

const lint = async (code, filePath) => {
  const [result] = await eslint.lintText(code, { filePath });
  return result.messages.map((message) => message.ruleId);
};

const lintTs = (code) => lint(code, 'src/app/x/x.ts');
const lintHtml = (code) => lint(code, 'src/app/x/x.html');
const lintSpec = (code) => lint(code, 'src/app/x/x.spec.ts');

const assertNone = (rules, ...ruleIds) =>
  assert.deepEqual(
    rules.filter((rule) => ruleIds.includes(rule)),
    [],
  );

describe('eslint config', () => {
  it('flags decorator inputs', async () => {
    const rules = await lintTs(`import { Directive, Input } from '@angular/core';

@Directive({ selector: '[appX]' })
export class X {
  @Input() value = '';
}
`);
    assert.ok(rules.includes('@angular-eslint/prefer-signals'), rules.join());
  });

  it('accepts signal inputs', async () => {
    assertNone(
      await lintTs(`import { Directive, input } from '@angular/core';

@Directive({ selector: '[appX]' })
export class X {
  readonly value = input('');
}
`),
      '@angular-eslint/prefer-signals',
    );
  });

  it('flags @HostListener', async () => {
    const rules = await lintTs(`import { Directive, HostListener } from '@angular/core';

@Directive({ selector: '[appX]' })
export class X {
  @HostListener('click')
  onClick(): void {}
}
`);
    assert.ok(rules.includes('@angular-eslint/prefer-host-metadata-property'), rules.join());
  });

  it('flags a root @Injectable', async () => {
    const rules = await lintTs(`import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class X {}
`);
    assert.ok(rules.includes('@angular-eslint/prefer-service-decorator'), rules.join());
  });

  it('accepts @Service()', async () => {
    assertNone(
      await lintTs(`import { Service } from '@angular/core';

@Service()
export class X {}
`),
      '@angular-eslint/prefer-service-decorator',
    );
  });

  it('flags constructor injection', async () => {
    const rules = await lintTs(`import { HttpClient } from '@angular/common/http';
import { Service } from '@angular/core';

@Service()
export class X {
  constructor(private readonly http: HttpClient) {}
}
`);
    assert.ok(rules.includes('@angular-eslint/prefer-inject'), rules.join());
  });

  it('flags structural control flow', async () => {
    const rules = await lintHtml('<p *ngIf="shown">x</p>\n');
    assert.ok(rules.includes('@angular-eslint/template/prefer-control-flow'), rules.join());
  });

  it('flags ngClass and ngStyle', async () => {
    const classRules = await lintHtml('<p [ngClass]="{ on: shown }">x</p>\n');
    assert.ok(
      classRules.includes('@angular-eslint/template/prefer-class-binding'),
      classRules.join(),
    );
    const styleRules = await lintHtml('<p [ngStyle]="{ width: size }">x</p>\n');
    assert.ok(
      styleRules.includes('@angular-eslint/template/prefer-style-binding'),
      styleRules.join(),
    );
  });

  it('accepts class and style bindings', async () => {
    assertNone(
      await lintHtml('<p [class.on]="shown" [style.width]="size">x</p>\n'),
      '@angular-eslint/template/prefer-class-binding',
      '@angular-eslint/template/prefer-style-binding',
    );
  });

  it('flags fixture.detectChanges() in a spec', async () => {
    const rules = await lintSpec(`import { TestBed } from '@angular/core/testing';

it('renders', () => {
  TestBed.createComponent(Object).detectChanges();
});
`);
    assert.ok(rules.includes('no-restricted-syntax'), rules.join());
  });

  it('accepts whenStable() and TestBed.tick() in a spec', async () => {
    assertNone(
      await lintSpec(`import { TestBed } from '@angular/core/testing';

it('renders', async () => {
  TestBed.tick();
  await TestBed.createComponent(Object).whenStable();
});
`),
      'no-restricted-syntax',
    );
  });
});
