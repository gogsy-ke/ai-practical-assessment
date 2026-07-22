import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Set before any test file imports src/db.js, so the tests open their own
    // database file and never touch the development one.
    env: { DB_PATH: './test.db' },
    // The tests share one SQLite file and rebuild it between cases, so they
    // cannot run in parallel against each other.
    fileParallelism: false,
  },
});
