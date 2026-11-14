import { defineConfig } from 'vitest/config';

// PDF.js and Angular/jsdom initialization can exhaust small CI workers when
// every test file starts in parallel. Isolated processes also avoid a native
// Windows thread-worker shutdown failure after the full suite completes.
export default defineConfig({
  test: { pool: 'forks', maxWorkers: 1, fileParallelism: false },
});
