import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { fixupConfigRules } from '@eslint/compat';
import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';
import simpleImportSort from 'eslint-plugin-simple-import-sort';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

export default [
  ...fixupConfigRules(
    compat.extends(
      'next/core-web-vitals',
      'plugin:unicorn/recommended',
      'plugin:import/recommended',
      'plugin:playwright/recommended',
    ),
  ),
  {
    plugins: {
      'simple-import-sort': simpleImportSort,
    },
    rules: {
      'simple-import-sort/exports': 'error',
      'simple-import-sort/imports': 'error',
      'unicorn/no-array-callback-reference': 'off',
      'unicorn/no-array-for-each': 'off',
      'unicorn/no-array-reduce': 'off',
      'unicorn/prevent-abbreviations': 'off',
      'unicorn/filename-case': 'off',
      'playwright/no-useless-await': 'off',
      'unicorn/no-nested-ternary': 'off',
      'unicorn/no-abusive-eslint-disable': 'off',
      'unicorn/no-null': 'off',
    },
  },
  {
    files: ['**/*.js'],

    rules: {
      'unicorn/prefer-module': 'off',
    },
  },
];
