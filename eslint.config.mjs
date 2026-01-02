import { globalIgnores } from 'eslint/config';
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import playwright from 'eslint-plugin-playwright';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import unicornPluginUnicorn from 'eslint-plugin-unicorn';

const eslintConfig = [
  // Global ignores
  globalIgnores(['src/components/ui', 'src/components/kibo-ui']),

  // Native flat configs
  ...nextCoreWebVitals,
  unicornPluginUnicorn.configs.recommended,
  playwright.configs['flat/recommended'],

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

export default eslintConfig;
