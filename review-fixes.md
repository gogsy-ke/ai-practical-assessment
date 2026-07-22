# Review Fixes

What changed after the review in code-review-notes.md, and what did not.

Tests before the review: **147 passing**
Tests after: **149 passing**

## Fix 1 and 2 — One source for the status and priority lists

**Problem:** the frontend kept its own copy of the status list
(`TicketList.jsx`) and the priority list (`CreateTicketForm.jsx` and
`TicketDetail.jsx`). Adding a value on the backend would leave the UI silently
missing it, with nothing to make the drift visible.

**Fix:** a `GET /api/meta` endpoint returning both lists, read once when the
app loads and passed down as props.

```js
metaRoutes.get('/', (req, res) => {
  res.json({ statuses: STATUSES, priorities: PRIORITIES });
});
```

`STATUSES` comes from `stateMachine.js` and `PRIORITIES` from `validation.js`,
so both lists are served from the module that already owns them.

**On adding an endpoint during a review that said "no new features":** this was
a real decision, not an accident. It is the same move already made for
`allowedTransitions` — the backend was already shipping the transition rule to
the frontend rather than letting it hold a copy. Extending that to the two
lists still being duplicated is applying an existing decision consistently, not
adding capability. The app does nothing it could not do before.

The alternative was importing the constants across package boundaries, which
needs Vite `fs.allow` configuration to reach outside its root, and would tie
the frontend build to the backend's file layout.

**Verification.** A test asserts the lists are served correctly, and a second
one checks the API agrees with itself: every advertised priority is accepted by
create, and every advertised status is accepted by the filter. That second test
is the one with value — it fails if the lists and the validators ever
disagree, which is the original bug in a new form.

```
$ grep -rn "'In Progress'\|<option>Low<" web/src
  none
```

## Fix 3 — Guard the error handler against sent headers

**Problem:** `errorHandler` wrote a response without checking whether one had
already started, so a late error could throw `ERR_HTTP_HEADERS_SENT` inside
the handler itself.

**Fix:** one line.

```js
if (res.headersSent) return next(err);
```

**Honest note:** no test covers this, because I could not construct a request
that triggers it — every current route sends its response in a single call.
Writing a test would mean building a fake route that exists only to be tested,
which proves the guard works in a situation the app cannot reach. The guard is
one line and standard practice, so it is in; a test asserting a scenario that
cannot occur is not.

## Fix 4 — One date formatter

**Problem:** `formatDateTime` written identically in two components,
`formatDate` in a third.

**Fix:** `web/src/formatDate.js`, imported by all three.

## Not fixed

### Finding 5 — no index on `createdAt`

Six rows. Adding an index would be guessing at a workload that does not exist.
`data-model.md` already states that indexes exist for the two access patterns
that actually run. Left as documented.

### Finding 6 — read-then-write in `changeStatus`

Safe today because `better-sqlite3` is synchronous and Node is single
threaded, so nothing can interleave between the check and the write. It would
stop being safe with two API processes on one database file, or an async
driver.

The fix would be `UPDATE ... WHERE id = ? AND status = ?` with a check on the
affected row count. Small, but it defends a deployment shape this project does
not have. Written down in code-review-notes.md so the assumption is visible
rather than accidental.

## What the review did not find

Worth recording, because it is the more useful half of the result.

The transition rule had not leaked. `canTransition` is called exactly once in
the whole codebase, and the frontend never computes a transition — it renders
the list the server sends. That was the design's central claim and it survived
contact with a full implementation.

Both remaining findings in the state machine area were about *duplicated
values*, not duplicated *logic*. The single-source-of-truth design held; what
slipped through were the constants around it, which I had not been watching
because I was watching the rule.
