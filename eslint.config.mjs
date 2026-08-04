import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // Components render a Report; they never compute one and never touch I/O.
    // `server-only` was tried here first and verified useless: under Next 16 its
    // throw is stripped from the client bundle, so it guards nothing.
    files: ['components/**/*.ts', 'components/**/*.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/lib/providers/**', '**/providers/**'],
              message:
                'Components must not import providers — they read secrets and perform I/O. ' +
                'Fetch in a server component or route handler and pass the data down as props.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['lib/scoring/**/*.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: 'lib/scoring must be pure — no I/O.' },
        { name: 'Date', message: 'lib/scoring must be pure — no clock.' },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              // Both forms must be blocked. An alias-only pattern is trivially
              // bypassed by `import x from '../providers/overpass'`, which would
              // silently defeat the whole purity guarantee.
              group: ['@/lib/providers/**', '**/providers/**'],
              message: 'lib/scoring must not depend on I/O.',
            },
          ],
        },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'lib/scoring must be deterministic.' },
      ],
    },
  },
]);

export default eslintConfig;
