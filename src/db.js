import Database from 'better-sqlite3';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

// Overridable so the tests can run against their own file instead of the
// development database.
export const DB_PATH = process.env.DB_PATH ?? join(projectRoot, 'tickets.db');

export const db = new Database(DB_PATH);

// SQLite ignores foreign keys unless this is switched on, and it has to be set
// per connection. Without it the REFERENCES clauses in schema.sql do nothing
// and orphaned rows appear with no error.
db.pragma('foreign_keys = ON');
