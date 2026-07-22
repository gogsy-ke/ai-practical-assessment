# Test Results

Real output, not a summary. Reproduce with `npm test` or `npm run test:coverage`.

Node v24.13.1 · Vitest 2.1.9 · run 22 July 2026

## Full run

```
$ npm run test:coverage

 ✓ tests/api.validation.test.js (35 tests) 4685ms
 ✓ tests/api.search.test.js     (32 tests) 4147ms
 ✓ tests/api.status.test.js     (25 tests) 3405ms
 ✓ tests/api.malformed.test.js  (19 tests) 2550ms
 ✓ tests/stateMachine.test.js   (46 tests)   12ms

 Test Files  5 passed (5)
      Tests  157 passed (157)
   Duration  18.62s
```

## Coverage

```
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|------------------
All files          |   91.36 |    92.96 |   93.75 |   91.36 |
 src               |   84.76 |    91.80 |   94.44 |   84.76 |
  app.js           |     100 |      100 |     100 |     100 |
  db-setup.js      |      56 |    66.66 |     100 |      56 | 24-36
  db.js            |     100 |        0 |     100 |     100 | 9
  errors.js        |   81.03 |       80 |     100 |   81.03 | 56-66
  server.js        |       0 |        0 |       0 |       0 | 1-24
  stateMachine.js  |     100 |      100 |     100 |     100 |
  validation.js    |     100 |      100 |     100 |     100 |
 src/routes        |     100 |      100 |     100 |     100 |
  meta.js          |     100 |      100 |     100 |     100 |
  tickets.js       |     100 |      100 |     100 |     100 |
  users.js         |     100 |      100 |     100 |     100 |
 src/services      |     100 |    93.22 |   92.85 |     100 |
  ticketService.js |     100 |    93.22 |   92.85 |     100 | 112,155-157,189
```

The three files carrying the rules — `stateMachine.js`, `validation.js` and
the routes — are at 100% statements and branches. What is uncovered is
explained in test-strategy.md and is `server.js`, the `db-setup` CLI block,
and the `INTERNAL_ERROR` branch.

## The state machine, seen failing first

The state machine was written as a stub so the tests could be run against
something that does nothing.

**Against the stub**
```
 Test Files  1 failed (1)
      Tests  14 failed | 32 passed (46)
```

**Against the real implementation**
```
 Test Files  1 passed (1)
      Tests  46 passed (46)
```

**32 tests passed against a stub, and that is worth being honest about.** The
stub returns `false`, and most of the tests assert a move is *rejected* — so
they passed for the wrong reason. Only the 14 asserting a move is *allowed*
proved anything on that run.

A test asserting `false` is weak on its own, because the simplest broken
implementation satisfies it. What makes the rejection tests meaningful is that
they sit beside the tests for allowed moves: an implementation has to get both
right, and no single wrong answer does that.

## Acceptance criteria, checked by test

Mapping from `acceptance-criteria.md` to what proves each one.

| Criterion | Proven by |
|-----------|-----------|
| Create a ticket | `api.validation.test.js` — accepts a normal title |
| List all tickets | `api.search.test.js` — returns every ticket |
| Open a ticket detail | `api.status.test.js` — writes reach the database |
| Update fields and reassign | `api.validation.test.js` — update group |
| Add comments | `api.search.test.js` — comments group |
| Only valid transitions | `api.status.test.js` — allowed and rejected groups |
| Keyword search and filter | `api.search.test.js` — search, filter, and both |
| Data survives restart | Checked by hand, see below |
| Backend validation | `api.validation.test.js` — 35 tests |
| No secrets committed | `git ls-files` shows no `.env` or `.db` |
| State machine tests pass | 46 unit + 25 integration |

## Checked by hand, not automated

Recorded so it is clear which results come from a test and which do not.

### Data survives a restart

```
create ticket → change status → kill server → restart

after restart, ticket count: 7
ticket 1 status:            "In Progress"
new ticket still there:     "Survives restart?"
```

### The UI, driven in headless Chrome

Clicked through the running app over the DevTools protocol:

```
list                  6 rows
click ticket       →  "Printer on 3rd floor is offline"
status buttons     →  Move to In Progress | Move to Cancelled
after In Progress  →  Move to Resolved | Move to Cancelled
add comment        →  renders with author and timestamp
walk to Closed     →  0 move buttons
                      "This ticket is Closed. No further status changes are possible."
```

The fourth line is the point: buttons re-derive from `allowedTransitions`
after every change, so the UI follows the state machine without holding a copy.

### Setup from a fresh clone

```
git clone <repo> /tmp/clone-test/repo
npm run setup   →  users: 4  tickets: 6  comments: 4
npm test        →  157 passed
dev:api/dev:web →  app renders, 409 on an invalid transition
```

### Error responses from a running server

```
409  Cannot move from In Progress to Closed.
     Allowed from In Progress: Resolved, Cancelled
400  'Deleted' is not a valid status
404  Ticket not found
```

## What testing found that review did not

Six bugs, in `debugging-notes.md`. Three came from the tests or from running
the code; three came from probing the API on purpose.

| # | Bug | Found by |
|---|-----|----------|
| 1 | New tickets reuse id 1 after seeding | Running it and checking the id |
| 2 | `createdBy: true` accepted as user 1 | A test case I added for booleans |
| 3 | A comment of mine stated a wrong reason | Checking a claim I had written |
| 4 | Malformed JSON returned 500 | Probing, watching stderr |
| 5 | A `null` body crashed the service | Probing |
| 6 | An array status rejected for the wrong reason | Probing, reading the message |

Bug 6 is the one worth pointing at. Nothing crashed, no data was corrupted,
and the request was correctly refused — but the message named a status the
caller never sent. Neither the status code nor the stderr flagged it.

Coverage then found three more untested paths, including `GET /api/users`,
which had no test at all despite the frontend depending on it.
