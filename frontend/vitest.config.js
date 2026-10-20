import { defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{js,jsx}'],
    environmentMatchGlobs: [
      // Anything that touches the DOM (Leaflet, Radix, Testing Library) needs jsdom.
      ['src/**/*.dom.test.{js,jsx}', 'jsdom'],
      ['src/pages/operator.test.jsx', 'jsdom'],
      ['src/a11y.test.jsx', 'jsdom'],
    ],
  },
});
