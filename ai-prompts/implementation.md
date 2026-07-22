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

## 2. State machine module and its tests

**Prompt**
Build the state machine module and its tests now, before any endpoints. Follow
the design in design-notes.md. The tests must cover every allowed transition,
every rejected one, a status value that is not in the list at all, and a move
to the current status. Show me the tests failing first so I know they are
actually testing something.

**AI response (summary)**
A transition map with `isValidStatus`, `allowedTransitions` and
`canTransition`, plus a Vitest file covering the cases above. Wrote a stub
version first so the tests could be run and seen failing.

**Run against the stub**

```
Test Files  1 failed (1)
     Tests  14 failed | 32 passed (46)
```

**Run against the real implementation**

```
Test Files  1 passed (1)
     Tests  46 passed (46)
```

**What the failing run actually showed, and what it did not**

32 tests passed against a stub that does nothing. That is not a good sign, and
it is worth being honest about rather than presenting "we saw them fail" as if
all 46 failed.

The stub returns `false` from `canTransition`, and most of the tests check
that a move is rejected — so they pass for the wrong reason. Only the 14 that
assert something is *allowed* actually proved anything.

The lesson is that a test asserting `false` is weak on its own, because the
simplest broken implementation satisfies it. What makes the rejection tests
meaningful is that they sit next to the tests for allowed moves. An
implementation has to get both right, and no single wrong answer does that.

I left the test file as it is rather than trying to make every test fail
first, but I now know which half of the suite is load-bearing.

**What I accepted**

Splitting `isValidStatus` from `canTransition`. My first instinct was one
function returning true or false. Two are needed because the API has to answer
differently: `"Deleted"` is not a status at all and is a 400, while `Closed`
from `Open` is a real status that is not reachable right now and is a 409. One
function cannot tell the caller which case it hit.

`Object.freeze` on the map and returning a copy from `allowedTransitions`.
That list is sent to the frontend on every ticket detail response. If a caller
mutated the array it was handed, it would change the rule for every later
request in the same process. There is a test for this.

**What I added that was not suggested**

A grid test that loops over all 25 status pairs and checks each one against
the rule written out separately in the test file. The generated tests listed
cases individually, which is fine until someone adds a transition to the map
and forgets to test it. The grid catches that because the rule is stated twice
and both copies have to agree.

I also added a count test: the number of transitions in the map has to match
the number of allowed moves listed in the test. If someone adds one without a
test, the count goes out of step and it fails.

**What I rejected**

A suggestion to have `canTransition` throw on an invalid status instead of
returning `false`. It would mean every caller needs a try/catch just to ask a
yes or no question. The function answers the question; the service layer
decides what the answer means and which error to raise.

A suggestion to normalise case, so `'open'` would be treated as `'Open'`. It
looks forgiving, but the only way a lowercase status reaches this function is
a bug somewhere else. Quietly fixing it hides the bug and lets bad values
spread. There are tests asserting near misses are rejected.

**What I verified**

The `transitionErrorMessage` output, by reading it:

> Cannot move from Open to Closed. Allowed from Open: In Progress, Cancelled

and for a final status:

> Cannot change status. A Closed ticket is final.

The first version returned "Invalid status transition" for everything, which
tells the user nothing about what to do next.
