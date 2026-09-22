const js = require('@eslint/js');
const tseslint = require('typescript-eslint');

module.exports = tseslint.config(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      'eslint.config.js',
      'prettier.config.js'
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: __dirname
      }
    },
    rules: {
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: false }
      ],
      '@typescript-eslint/consistent-type-imports': 'error',

      // Fastify AsyncPlugin callbacks are intentionally async even when
      // registration itself does not need an await expression.
      '@typescript-eslint/require-await': 'off',

      // Fastify decorators (for example app.authenticate) are designed to be
      // passed as callbacks and keep their framework-provided context.
      '@typescript-eslint/unbound-method': 'off'
    }
  },
  {
    files: ['tests/**/*.ts'],
    rules: {
      // Test assertions frequently narrow values only for readability and the
      // Vitest fetch doubles intentionally stringify RequestInit bodies.
      '@typescript-eslint/no-unnecessary-type-assertion': 'off',
      '@typescript-eslint/no-base-to-string': 'off'
    }
  }
);
