import { defineConfig } from 'vitest/config';

// PDF.js and Angular/jsdom initialization can exhaust small CI workers when
// every test file starts in parallel. Keep the complete suite reproducible.
export default defineConfig({
  test: { pool: 'threads', maxWorkers: 1, fileParallelism: false },
});
