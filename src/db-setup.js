// Creates the database and loads seed data.
// Run with: npm run db:setup
//
// This drops and rebuilds every table, so it is safe to run again at any point
// to get back to a known state.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { db, DB_PATH } from './db.js';

const databaseDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'database');

const read = (file) => readFileSync(join(databaseDir, file), 'utf8');

export function setupDatabase({ seed = true } = {}) {
  db.exec(read('schema.sql'));
  if (seed) db.exec(read('seed.sql'));
}

// Only run when called directly, so importing this from a test does not
// rebuild the database as a side effect.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  setupDatabase();

  const counts = {
    users: db.prepare('SELECT COUNT(*) AS n FROM users').get().n,
    tickets: db.prepare('SELECT COUNT(*) AS n FROM tickets').get().n,
    comments: db.prepare('SELECT COUNT(*) AS n FROM comments').get().n,
  };

  console.log(`Database ready at ${DB_PATH}`);
  console.log(`  users: ${counts.users}`);
  console.log(`  tickets: ${counts.tickets}`);
  console.log(`  comments: ${counts.comments}`);
}
