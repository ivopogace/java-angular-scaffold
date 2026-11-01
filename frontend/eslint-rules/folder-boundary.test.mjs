import { describe, it } from 'node:test';
import path from 'node:path';

import { RuleTester } from 'eslint';
import tseslint from 'typescript-eslint';

import rule from './folder-boundary.mjs';

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: { parser: tseslint.parser, sourceType: 'module' },
});

const file = (relative) => path.resolve('src/app', relative);

const forbidden = (from, to) => [{ messageId: 'forbidden', data: { from, to } }];

ruleTester.run('folder-boundary', rule, {
  valid: [
    {
      code: "import { Money } from '../../shared/money/money';",
      filename: file('catalog/list/list.ts'),
    },
    { code: "import { Api } from '../../core/api/api';", filename: file('catalog/list/list.ts') },
    { code: "import { Api } from '../../core/api/api';", filename: file('pages/home/home.ts') },
    { code: "import { Money } from '../../shared/money';", filename: file('core/api/api.ts') },
    { code: "import { Row } from '../row/row';", filename: file('catalog/list/list.ts') },
    { code: "import { Row } from './row';", filename: file('catalog/list/list.ts') },
    { code: "import { x } from './util';", filename: file('shared/util/other.ts') },
    { code: "import { Component } from '@angular/core';", filename: file('shared/util/util.ts') },
    { code: "import { Foo } from 'orders/x';", filename: file('catalog/list/list.ts') },
    {
      code: "import { stub } from '../../../testing/stub';",
      filename: file('shared/util/util.ts'),
    },
    { code: "import { Pg } from '../pages/home/home';", filename: file('app.routes.ts') },
    { code: "export { Money } from '../shared/money';", filename: file('catalog/index.ts') },
    {
      code: "const m = await import('../../shared/money');",
      filename: file('catalog/list/list.ts'),
    },
    { code: 'const m = await import(path);', filename: file('catalog/list/list.ts') },
    {
      code: "import { x } from '../orders/x';",
      filename: path.resolve('elsewhere/catalog/list.ts'),
    },
  ],
  invalid: [
    {
      code: "import { Order } from '../orders/order';",
      filename: file('catalog/list.ts'),
      errors: forbidden('catalog', 'orders'),
    },
    {
      code: "import { Api } from '../../core/api/api';",
      filename: file('shared/util/util.ts'),
      errors: forbidden('shared', 'core'),
    },
    {
      code: "import { Product } from '../../catalog/product';",
      filename: file('core/api/api.ts'),
      errors: forbidden('core', 'catalog'),
    },
    {
      code: "import { Product } from '../../catalog/product';",
      filename: file('pages/home/home.ts'),
      errors: forbidden('pages', 'catalog'),
    },
    {
      code: "const m = await import('../orders/x');",
      filename: file('catalog/list.ts'),
      errors: forbidden('catalog', 'orders'),
    },
    {
      code: "export * from '../orders/x';",
      filename: file('catalog/index.ts'),
      errors: forbidden('catalog', 'orders'),
    },
    {
      code: "export { Order } from '../orders/x';",
      filename: file('catalog/index.ts'),
      errors: forbidden('catalog', 'orders'),
    },
    {
      code: "import type { Order } from '../orders/x';",
      filename: file('catalog/list.ts'),
      errors: forbidden('catalog', 'orders'),
    },
    {
      code: "import { Pg } from '../../pages/home/home';",
      filename: file('core/api/api.ts'),
      errors: forbidden('core', 'pages'),
    },
    {
      code: "import { routes } from '../../app.routes';",
      filename: file('shared/util/util.ts'),
      errors: forbidden('shared', 'the app root'),
    },
    {
      code: "import { Money } from '../shared/money';\nimport { Order } from '../../orders/x';",
      filename: file('catalog/list/list.ts'),
      errors: forbidden('catalog', 'orders'),
    },
  ],
});
