// @ts-check
const eslint = require('@eslint/js');
const { defineConfig } = require('eslint/config');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');

const folderBoundary = require('./eslint-rules/folder-boundary.mjs').default;

module.exports = defineConfig([
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommended,
      tseslint.configs.stylistic,
      angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    plugins: { local: { rules: { 'folder-boundary': folderBoundary } } },
    rules: {
      'local/folder-boundary': 'error',
      '@angular-eslint/prefer-signals': 'error',
      '@angular-eslint/prefer-host-metadata-property': 'error',
      '@angular-eslint/prefer-service-decorator': 'error',
      '@angular-eslint/component-max-inline-declarations': [
        'error',
        { template: 0, styles: 0, animations: 0 },
      ],
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'app',
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: 'app',
          style: 'kebab-case',
        },
      ],
    },
  },
  {
    files: ['**/*.spec.ts'],
    rules: {
      // Throwaway stub components in specs are fixtures, not shipped components.
      '@angular-eslint/component-max-inline-declarations': 'off',
      // A forced render hides a component that changes state without notifying Angular.
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.property.name='detectChanges']",
          message:
            'Wait with `await fixture.whenStable()`, or `TestBed.tick()` while an `httpResource` load is unflushed; do not force a render.',
        },
      ],
    },
  },
  {
    files: ['**/*.html'],
    extends: [angular.configs.templateRecommended, angular.configs.templateAccessibility],
    rules: {
      '@angular-eslint/template/prefer-class-binding': 'error',
      '@angular-eslint/template/prefer-style-binding': 'error',
    },
  },
]);
