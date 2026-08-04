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
            { group: ['@/lib/providers/*'], message: 'lib/scoring must not depend on I/O.' },
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
