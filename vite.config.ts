import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative base so the build works from a GitHub Pages project sub-path.
  base: './',
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
