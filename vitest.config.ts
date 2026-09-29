import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      'apps/*',
      'packages/*',
      {
        test: {
          name: 'guardrails',
          include: ['tests/**/*.{test,spec}.ts'],
        },
      },
    ],
  },
});
