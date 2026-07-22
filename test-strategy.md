# Test Strategy

## Test Scope

The brief requires one meaningful tier: integration tests proving the state
machine rules. That is where most of the effort went, and everything else was
added because it protects something specific.

157 tests across two tiers.

| Tier | File | Tests | What it proves |
|------|------|-------|----------------|
| Unit | `stateMachine.test.js` | 46 | The rule itself is correct |
| Integration | `api.status.test.js` | 25 | The rule is wired into the endpoint |
| Integration | `api.validation.test.js` | 35 | Bad input is rejected before it is stored |
| Integration | `api.search.test.js` | 32 | Search, filter and comments |
| Integration | `api.malformed.test.js` | 19 | Regressions for bugs found by probing |

## Why the state machine is tested twice

`stateMachine.test.js` calls the functions directly. `api.status.test.js` goes
over HTTP. That looks like duplication and is not, because the two answer
different questions.

The unit tests prove the rule is right. They are pure function calls with no
database and no server, so all 46 run in 12ms and every one of the 25 status
pairs can be checked exhaustively.

The integration tests prove the rule is *reached*. A perfect state machine
that a route handler forgets to call passes every unit test. These check the
status code, that the change reached the database, that a rejected change left
the ticket alone, and that the message names what was allowed instead.

## Unit Tests — `stateMachine.test.js`

| Group | Covers |
|-------|--------|
| `isValidStatus` | Real statuses, unknown values, wrong case, non-strings |
| `allowedTransitions` | Each status, final statuses, the returned list cannot be mutated |
| Allowed moves | All five, plus a count check against the map |
| Rejected moves | Skipping, going backwards, leaving a final status, same-status |
| The whole grid | All 25 pairs against the rule written out separately |

Two of these are structural rather than behavioural, and are the ones most
likely to catch a future mistake:

**The grid test** loops over every status pair and checks it against a copy of
the rule written independently in the test file. If someone adds a transition
to the map and forgets to test it, the two copies disagree and it fails.

**The count test** asserts the number of transitions in the map matches the
number of allowed moves listed in the tests. A transition added without a test
breaks the count.

## Integration Tests

Run against the real Express app with `supertest` and a real SQLite database,
rebuilt before every test. No mocks anywhere.

Mocking the database would mean the tests pass or fail based on what the mock
was told to do. The value of these tests is that a status change genuinely
lands in a table, so a mock would remove the only thing being checked.

### What they cover beyond the happy path

- Every rejected transition, with the correct status code — 409 for an illegal
  move, 400 for a value that is not a status at all
- Concurrent changes: the second request judged against what the first left
- `PATCH` refusing a `status` key rather than ignoring it
- Validation on every field, including the boundary at exactly 200 characters
- A partial update failing without applying the valid half
- Search escaping `%` and `_` so they are not read as wildcards
- Malformed JSON, `null` bodies, arrays where strings belong
- Unusual but valid input: emoji, accented text, newlines, HTML as text

## Test Isolation

`setupDatabase()` in `beforeEach` drops and rebuilds every table, so tests
cannot leak state into each other and can run in any order.

The tests use their own file (`test.db` via `DB_PATH`), set in
`vitest.config.js` so it applies before any test imports the database module.
`fileParallelism: false` keeps the five files from writing to that one file at
once.

This costs about 15 seconds for a full run. Sharing one seeded database and
resetting only what changed would be faster and would introduce exactly the
kind of order dependency that makes a suite untrustworthy.

## Coverage

Measured with `npm run test:coverage`. Backend only.

| Area | Statements | Branches |
|------|-----------|----------|
| `stateMachine.js` | **100%** | **100%** |
| `validation.js` | **100%** | **100%** |
| `src/routes/` | **100%** | **100%** |
| `ticketService.js` | **100%** | 93% |
| Overall | 91% | 93% |

Coverage is a gap-finder here, not a target. It was run once the suite felt
complete, and it found three untested paths that mattered:

1. **`GET /api/users` had no test at all.** The frontend depends on it for both
   the assignee dropdown and the "acting as" selector, and nothing checked it.
2. **Reassigning to a user who does not exist was only tested on create.**
   Update reaches the same validator by a different path, so only one of the
   two was actually proven.
3. **`optionalText` was only ever given valid text or nothing.** Its
   wrong-type and over-length branches were never run.

All three now have tests. That is the argument for measuring: each one is a
path the app uses, and reading the suite would not have shown they were
missing.

## Tests Not Covered (and why)

Honest list. Each of these is a decision, not an oversight.

### Frontend component tests — 0% coverage

The largest gap. No React component has an automated test.

The brief requires one meaningful tier and names integration tests for the
state machine. Adding React Testing Library means a test renderer, a DOM
environment and mocked fetch, and the tests would mostly assert that a
component renders props it was handed.

The parts of the UI carrying real logic are tested elsewhere. The status
buttons come from `allowedTransitions`, which the API tests cover. The rule
they follow is in the state machine, which is at 100%.

Instead the UI was **driven end to end in headless Chrome** over the DevTools
protocol: clicking a ticket, moving it through statuses and watching the
buttons re-derive, adding a comment, walking to a final status. That is
recorded in `ai-prompts/implementation.md`, prompt 8. It is not automated and
does not run in CI, which is exactly the weakness of it.

**If I had another day, this is where it would go.**

### `server.js` — 0%

Six lines: read a port, listen, handle `EADDRINUSE`. Tests import `createApp`
directly, so nothing starts a real listener. Testing it means binding a port
in the suite to prove `listen` was called.

The `EADDRINUSE` message was checked by hand — starting the API twice, and
confirming `PORT=3002` works.

### The `INTERNAL_ERROR` branch in `errors.js`

The 500 path is only reached by an error nobody anticipated, which is hard to
trigger deliberately without a route that exists solely to throw.

The two known cases that used to land there — malformed JSON and a `null` body
— are now handled before it and both have tests. Reaching the branch would
mean adding a fake route, which proves the handler works in a situation the
app cannot produce.

Same reasoning for the `res.headersSent` guard added in review.

### The `db-setup.js` CLI block

Lines 24-36 only run when the file is executed directly, and print row counts.
Tests import `setupDatabase()` and call it. Verified by running
`npm run db:setup` on a clean clone.

### Load and performance

No timing or volume tests. Six seeded rows, one reviewer, one machine. Any
number produced would be about this laptop rather than the application.

### Security

No auth, so no authorisation tests. SQL injection is covered incidentally — a
search for `'; DROP TABLE tickets; --` returns an empty list and the table
survives — but that is one test, not a security review.

### Browser compatibility

Verified in headless Chrome only. No Firefox or Safari check.
