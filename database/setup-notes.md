# Database Setup Notes

## Choice

SQLite, through the `better-sqlite3` driver.

The brief lists SQLite as an acceptable option. It was chosen because a
reviewer can clone the repository and run the project without installing a
database server. One of the failure modes named in the brief is broken setup
instructions, and every extra install step is another chance for setup to fail
on someone else's machine.

The trade-off: SQLite writes to a single file and has one writer at a time, so
it would not suit a real multi-user support desk. For an exercise reviewed on
one machine that limit never comes up.

## Files

| File | Purpose |
|------|---------|
| `database/schema.sql` | Tables, constraints and indexes |
| `database/seed.sql` | 4 users, 6 tickets, 4 comments |
| `src/db.js` | Connection. Turns foreign keys on |
| `src/db-setup.js` | Runs schema then seed |

## Running it

```bash
npm install
npm run db:setup
```

Expected output:

```
Database ready at .../tickets.db
  users: 4
  tickets: 6
  comments: 4
```

The database file is written to `tickets.db` in the project root. It is in
`.gitignore`, so it is never committed.

`db:setup` drops and rebuilds every table. It is safe to run again at any time
to get back to a known state.

## Environment variables

Only one, and it is optional:

| Variable | Default | Purpose |
|----------|---------|---------|
| `DB_PATH` | `./tickets.db` | Where the database file lives |

The tests set it so they run against their own file instead of the development
database.

There are no secrets, so there is no `.env` file to create.

## Seed data

| Ticket | Status | Assigned |
|--------|--------|----------|
| Printer on 3rd floor is offline | Open | Rahul Menon |
| Slow login on the internal portal | Open | *unassigned* |
| VPN disconnects every 10 minutes | In Progress | Aisha Khan |
| Request access to the analytics dashboard | Resolved | Rahul Menon |
| Laptop battery replacement | Closed | Aisha Khan |
| Duplicate invoice email sent to customers | Cancelled | *unassigned* |

All five statuses appear, so every state can be seen without changing anything
first. Two tickets are left unassigned because `assignedTo` is nullable and
that path needs to be visible.

Titles and descriptions use different words on purpose, so keyword search can
be demonstrated properly. Searching `printer`, `vpn`, `login` or `invoice`
each returns one ticket.

Timestamps are fixed values rather than `now()`, so the seeded database is
identical on every machine and test expectations stay stable.

## Two things that had to be handled

**Foreign keys are off by default.** SQLite ignores `REFERENCES` unless
`PRAGMA foreign_keys = ON` is set, and it must be set on every connection, not
once in the schema. Without it, a ticket can be created pointing at a user id
that does not exist and no error is raised. It is set in `src/db.js` so every
connection gets it.

**`AUTOINCREMENT` keeps its own counter.** Because the seed inserts explicit
ids, that counter stays at 0 and the first ticket created through the app
tries to reuse id 1, which fails on the primary key. The last lines of
`seed.sql` set the counter past the seeded ids.

## Checks run after setup

| Check | Result |
|-------|--------|
| All five statuses present in seed data | Pass |
| Search is case insensitive (`LOGIN` matches `login`) | Pass |
| A newly created ticket gets id 7, not 1 | Pass |
| A ticket referencing user 999 is rejected | Pass, `FOREIGN KEY constraint failed` |
| A ticket with status `Deleted` is rejected | Pass, `CHECK constraint failed` |
