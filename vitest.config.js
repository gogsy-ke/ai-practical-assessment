import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Set before any test file imports src/db.js, so the tests open their own
    // database file and never touch the development one.
    env: { DB_PATH: './test.db' },
    // The tests share one SQLite file and rebuild it between cases, so they
    // cannot run in parallel against each other.
    fileParallelism: false,
    coverage: {
      // Backend only. The frontend has no automated tests — that gap is
      // stated plainly in test-strategy.md rather than hidden by excluding
      // it from the count, but mixing 0% files into this report would only
      // obscure the numbers that mean something.
      include: ['src/**'],
      reporter: ['text', 'html'],
    },
  },
});
