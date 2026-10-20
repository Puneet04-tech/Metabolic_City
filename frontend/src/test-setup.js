import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Testing Library does not auto-clean when vitest globals are off, so the
// rendered trees would otherwise leak between tests.
afterEach(() => {
  cleanup();
});
