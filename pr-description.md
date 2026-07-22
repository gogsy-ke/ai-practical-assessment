# PR Description

## Summary

Adds a support ticket management system: React frontend, Express API, SQLite
database, with a status lifecycle the backend enforces.

The signature piece is the status state machine. A ticket may only move along
five defined transitions; anything else is rejected by the backend with a 409
naming what was allowed instead. The rule lives in one module, and the
frontend holds no copy of it — it renders the `allowedTransitions` list the
API sends, so the two cannot disagree.

## Features Implemented

- Create, list, view and update tickets
- Reassign tickets, including unassigning
- Add comments; append only, allowed in any status
- Change status through the enforced state machine
- Keyword search across title and description, case insensitive
- Filter by status; combines with search
- Backend validation on every input
- Meaningful error states in the UI

## Technical Changes

**Backend**

| File | Purpose |
|------|---------|
| `src/stateMachine.js` | The transition rule. The only place it lives |
| `src/validation.js` | Input rules, each returning the cleaned value |
| `src/errors.js` | One error type, one handler, one response shape |
| `src/services/ticketService.js` | Business rules and their queries |
| `src/routes/` | HTTP only. No rules |

Two layers, not three. The design originally planned a separate `db/` layer;
building it showed every query was used by exactly one service function, so it
would have been one-line wrappers. `design-notes.md` was updated rather than
left describing a structure that does not exist.

**Frontend**

`web/src/api.js` is the only module that knows the backend error shape.
Components deal with a message and a field. No router and no state library —
two views and one `useState`.

## Database Changes

New SQLite database with three tables: `users`, `tickets`, `comments`.

- `CHECK` constraints on `status`, `priority` and `role`
- Indexes on `tickets(status)` and `comments(ticketId)`, matching the two
  access patterns that actually run
- Foreign keys enabled explicitly — SQLite ignores them otherwise, per
  connection, not per schema
- Seed data: 4 users, 6 tickets covering all five statuses, comments on two

`npm run db:setup` drops and rebuilds everything. Safe to re-run.

## Testing Done

```
Test Files  5 passed (5)
     Tests  157 passed (157)
```

| Module | Statements | Branches |
|--------|-----------|----------|
| `stateMachine.js` | 100% | 100% |
| `validation.js` | 100% | 100% |
| `src/routes/` | 100% | 100% |
| `ticketService.js` | 100% | 93% |

The state machine is tested at two levels on purpose. Unit tests prove the
rule is correct — including a grid over all 25 status pairs. Integration tests
prove the rule is *reached*: a perfect state machine that a route forgets to
call passes every unit test.

Also verified by hand and recorded in `test-results.md`: data survives a
restart, the UI works end to end in headless Chrome, and a fresh clone
installs, tests and runs.

## AI Usage Summary

Heavily AI-assisted. I directed the work, chose between options, rejected
suggestions and verified output; most code was generated rather than typed.
`ai-prompts/` has the history by activity, including what was rejected and
why.

Six real bugs are documented in `debugging-notes.md`. Three of them were
JavaScript coercing a type quietly — `Number(true) === 1`, `null` slipping
past a default parameter, an array passing as a property key. None looked
wrong when read; all were found by running something.

## Screenshots / Demo Notes

No screenshots. The UI was driven end to end in headless Chrome over the
DevTools protocol, and the transcript is in `test-results.md`:

```
list                  6 rows
click ticket       →  "Printer on 3rd floor is offline"
status buttons     →  Move to In Progress | Move to Cancelled
after In Progress  →  Move to Resolved | Move to Cancelled
add comment        →  renders with author and timestamp
walk to Closed     →  0 move buttons
```

The fourth line is the point: the buttons re-derive from the API response
after every change.

To see it: `npm run setup`, then `npm run dev:api` and `npm run dev:web`.

## Known Limitations

- **No authentication.** Optional in the brief. The "acting as" dropdown is
  not security — anyone can send any `createdBy`.
- **No frontend tests.** 0% coverage. The largest gap, stated as such in
  `test-strategy.md`.
- **No URL routing.** Tickets cannot be linked; browser back exits the app.
- **No pagination.** The list returns everything.
- **Status change is read-then-write.** Safe because `better-sqlite3` is
  synchronous and Node is single threaded. Would need a conditional update
  with two API processes.
- **Search does a full scan.** `LIKE '%term%'` cannot use an index.

## Future Improvements

1. Frontend component tests — the clearest gap
2. Conditional update on status change, removing the single-process assumption
3. Reopening `Closed` tickets — question 1 in `requirements-analysis.md`, still
   unanswered by a product owner
4. Role-based permissions; `role` is seeded and displayed but enforces nothing
5. FTS5 for search if the table ever grows
