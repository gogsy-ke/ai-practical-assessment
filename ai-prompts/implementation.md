# AI Prompts — Implementation

Tool: Claude Code.

## 1. Database setup and seed data

**Prompt**
Set up the database. I need a schema script and a seed script that run from one
npm command on a clean machine. Seed 4 users with different roles, 6 tickets
spread across all five statuses, and comments on two of them. Make the seed
data realistic enough to demo search and filter properly, not just placeholder
text. Enable foreign keys explicitly.

**AI response (summary)**
`schema.sql` with three tables, CHECK constraints on `status`, `priority` and
`role`, and indexes on `tickets(status)` and `comments(ticketId)`. `seed.sql`
with the requested rows. `src/db.js` for the connection and `src/db-setup.js`
to run both files. Set `PRAGMA foreign_keys = ON` in the connection module.

**What I accepted**

The `PRAGMA foreign_keys = ON` line, and where it was put. SQLite ignores
`REFERENCES` unless that pragma is set, and it has to be set per connection
rather than once in the schema file. Putting it in `src/db.js` means every
connection gets it, including the one the tests open. Without it a ticket
could be created pointing at a user id that does not exist and nothing would
complain.

The `CHECK` constraint on `status`. I asked whether it duplicated the state
machine, since the state machine already decides what a valid status is. It
does not: the state machine controls which *changes* are allowed, and the
CHECK stops a value that is not a status at all from reaching the table by any
route, including a direct SQL write. Different jobs. That reasoning is now a
comment in schema.sql.

**What I changed**

The first seed data used filler text — "Test ticket 1", "Sample issue". That
makes search impossible to demo, because every row matches every search term.
I rewrote all six with distinct realistic wording, so `printer`, `vpn`,
`login` and `invoice` each return exactly one ticket. Search is an acceptance
criterion, and it cannot be shown working against data that is all the same.

Timestamps were generated with `datetime('now')`. I changed them to fixed ISO
values so the seeded database is identical on every machine. Generated
timestamps would mean test expectations shift depending on when setup was run.

**What I rejected**

An `updatedAt` trigger that would set the timestamp automatically on every
write. It works, but it hides the update in the schema where nobody reading
the service code would see it. The service layer sets `updatedAt` explicitly.
One less piece of behaviour happening somewhere invisible.

**Bug found while checking, not suggested by AI**

Creating a ticket through the app after seeding fails with a primary key
error.

`AUTOINCREMENT` keeps its own counter in `sqlite_sequence`. The seed inserts
explicit ids 1 to 6, which does not move that counter, so it stays at 0 and
the first ticket created through the app tries to use id 1 — which is taken.

I found this by inserting a row after setup and checking what id came back. It
came back as 1. The fix is three `UPDATE sqlite_sequence` lines at the end of
`seed.sql`.

This is worth noting because nothing about the generated code looked wrong,
and the seed step itself ran with no error. It would have failed the first
time a reviewer clicked "create ticket". Reading the code would not have
caught it. Running it did.

**What I verified before moving on**

| Check | Result |
|-------|--------|
| All five statuses present | Pass |
| Search is case insensitive | Pass |
| New ticket gets id 7, not 1 | Pass, after the fix above |
| Ticket referencing user 999 | Rejected, `FOREIGN KEY constraint failed` |
| Ticket with status `Deleted` | Rejected, `CHECK constraint failed` |

The last two matter most. They prove the constraints are actually switched on
rather than just written down in the schema file.
