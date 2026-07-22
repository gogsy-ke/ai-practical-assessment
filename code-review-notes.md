# Code Review Notes

Review done with the app finished and 147 tests passing. The brief for the AI
was: review this as if you are trying to break it, focus on the state machine,
validation and error handling, check whether the transition rule has leaked
outside its module, and list findings by severity. No new features — only
problems in what already exists.

## The check that mattered most: did the rule leak?

The whole design rests on one claim — that the transition rule lives in exactly
one place. So the first thing to test was whether that is still true, rather
than whether it was true when it was written.

```
$ grep -rn "canTransition\|allowedTransitions" src web/src
```

| Location | What it does |
|----------|--------------|
| `src/stateMachine.js` | Defines the rule |
| `src/services/ticketService.js:105` | Reads the list to send to the client |
| `src/services/ticketService.js:232` | The single enforcement point |
| `web/src/components/TicketDetail.jsx:178` | Renders whatever the server sent |

`canTransition` is called **once** in the entire codebase. The frontend never
computes a transition; it maps over a list it was given. So the claim holds.

One deliberate second copy exists: the `CHECK` constraint on `status` in
`schema.sql`. That is documented in the schema as a different job — the state
machine controls which *changes* are allowed, the CHECK stops a value that is
not a status at all from reaching the table by any route.

## AI-Assisted Review Summary

Six findings. Four fixed, two documented as accepted limitations.

| # | Severity | Finding | Outcome |
|---|----------|---------|---------|
| 1 | Medium | Status list duplicated in the frontend | Fixed |
| 2 | Medium | Priority list duplicated in two components | Fixed |
| 3 | Medium | Error handler can throw if headers are already sent | Fixed |
| 4 | Low | Date formatter written three times | Fixed |
| 5 | Low | `ORDER BY createdAt` with no index | Accepted, documented |
| 6 | Low | Status change is read-then-write | Accepted, documented |

## Finding 1 — Status list duplicated in the frontend (Medium)

`web/src/components/TicketList.jsx` had its own copy:

```js
const STATUSES = ['Open', 'In Progress', 'Resolved', 'Closed', 'Cancelled'];
```

This is not the transition rule, so the design claim above still held. But it
is the *status list*, and it is used to build the filter dropdown.

**Why it matters:** if a status were added to the backend, every test would
still pass, the API would accept it, tickets would be created with it — and
the filter dropdown would silently not offer it. There is nothing to make that
visible. The failure is a missing option, which looks like a UI oversight
rather than a copy that drifted.

**Why I did not spot it while building:** I checked that the *rule* was in one
place and stopped there. The list of valid values is a second piece of shared
knowledge, and it was never part of what I was watching.

## Finding 2 — Priority list duplicated in two components (Medium)

`PRIORITIES` is defined in `src/validation.js`, and the options were written
out by hand in both `CreateTicketForm.jsx` and `TicketDetail.jsx`. Three
copies of the same list, in three files, in two languages.

Same failure mode as finding 1, but worse — the two frontend copies could
drift from each other as well as from the backend.

## Finding 3 — Error handler can throw if headers are already sent (Medium)

```js
export function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.status).json(...);
```

If a response has already started when an error reaches the handler, the
status and headers are gone. Calling `res.status().json()` then throws
`ERR_HTTP_HEADERS_SENT` *inside the error handler*, turning one failure into a
crash whose stack points at the handler rather than at the real problem.

**Honest caveat:** I could not construct a request that triggers this in the
current code, because every route sends its response in one call. It is a
latent problem, not an active bug. It costs one line to remove and it is the
standard Express guard, so it is worth having before some future route streams
a response.

**Fix:** `if (res.headersSent) return next(err);` as the first line.

## Finding 4 — Date formatter written three times (Low)

`formatDateTime` appeared identically in `TicketDetail.jsx` and
`CommentSection.jsx`, and a `formatDate` variant in `TicketList.jsx`. Moved to
`web/src/formatDate.js`.

Straightforward duplication with no subtlety to it.

## Finding 5 — `ORDER BY createdAt` with no index (Low, accepted)

Every ticket list query sorts by `createdAt` and there is no index on it, so
SQLite sorts the whole result set each time.

**Not fixed, deliberately.** With six seeded rows this is unmeasurable. Adding
an index would be guessing at a workload the app does not have, and
`data-model.md` already states the position: indexes exist for the two access
patterns that actually run. Recorded here so the absence reads as a decision
rather than an oversight.

## Finding 6 — Status change is read-then-write (Low, accepted)

`changeStatus` reads the ticket, checks the transition, then writes:

```js
const ticket = findTicket(id);        // read
if (!canTransition(...)) throw ...    // check
db.prepare('UPDATE ...').run(...)     // write
```

There is a gap between the read and the write, which is the classic shape of a
time-of-check-to-time-of-use race.

**Why it is safe right now:** `better-sqlite3` is fully synchronous and Node
runs one thread, so no other request can execute between those lines. The
sequence is effectively atomic inside a single process, and the two
concurrency tests in `api.status.test.js` pass because of it.

**When it would stop being safe:** two API processes against the same database
file, or a switch to an async driver. Both could interleave and both requests
could pass the check before either writes.

**Not fixed, deliberately.** The fix is a conditional update
(`UPDATE ... WHERE id = ? AND status = ?`) and checking the affected row count.
That is a small change, but it defends against a deployment shape this project
does not have, and it would make the code harder to read for no benefit today.
It is written down so the assumption it relies on is visible.

## My Review Observations

Two things I noticed that the AI review did not raise.

**The two frontend copies were not the same kind of problem.** AI listed
findings 1 and 2 together as "duplicated constants". They differ: the status
list is shared between two *systems* that deploy separately, while the
priority list was also duplicated *within* the frontend. The second is a worse
smell because nothing external forces the two components to agree.

**The `CHECK` constraint is not a fourth copy.** AI flagged the status list in
`schema.sql` as duplication to be removed. I rejected that. It is a different
guarantee, at a different layer, and it is the only thing protecting the table
from a direct SQL write. Removing it would trade a real safety net for a
tidier grep result.

## Changes Made After Review

See review-fixes.md.

## Suggestions Rejected (and why)

**Remove the `CHECK` constraint on `status` as duplication.** Rejected, as
above. It defends a different route into the table than the state machine
does.

**Extract a `useApi` hook to remove the repeated loading/error/data pattern.**
The pattern appears in three components. Each one differs — the list has
debouncing and a race guard, the detail view has two separate error states,
the comment form has none of that. A hook covering all three would need
options for each difference, and would be harder to follow than the three
plain versions. Reconsider at five or six.

**Add a `status` column index alongside the transitions.** Already exists
(`idx_tickets_status`). The review suggested adding what was already there,
which is worth noting: an AI review will confidently recommend things the code
already does, so each finding has to be checked against the code rather than
accepted from the list.

**Wrap the status change in a transaction.** A single `UPDATE` is already
atomic in SQLite. A transaction around one statement adds ceremony and changes
nothing. The real concern is finding 6, and a transaction does not fix that
either — a conditional update would.

**Add JSDoc to every exported function.** The functions carrying real
decisions already have comments explaining why. Adding `@param {string} id` to
everything else would bulk out the files without adding anything a reader
could not see from the signature.
