# Design Notes

## Architecture Overview

```
React (Vite)  ->  Express API  ->  SQLite
     |               |
  api client     state machine
                 + validation
```

Three layers, one direction. The frontend never talks to the database. All
rules live in the backend.

Inside the backend:

```
routes/      HTTP only. Read the request, call a service, send the response.
services/    Business rules and the queries they need.
```

The reason for splitting services out is the state machine. If the transition
rule sits in a route handler, it can only be tested by making HTTP requests,
and a second route could easily be added later that forgets the rule.

### Changed during implementation: two layers, not three

This section originally planned a third layer, `db/`, holding the queries with
no rules in it. Building it showed that was not worth it.

The whole backend is about ten queries, and every one of them is used by
exactly one service function. A `db/` layer would have been a file of
one-line wrappers, each called from a single place. That is indirection with
nothing behind it: to follow a request you would read three files instead of
two, and the extra file would never contain a decision.

The rule the layering exists to protect is that the transition check lives in
`stateMachine.js` and nothing else decides it. That holds with two layers.
Splitting the queries out further protects nothing.

If the queries were shared across several services, or a second storage
backend appeared, this would be worth revisiting.

## The Status State Machine

This is the central rule of the project, so it gets the most attention.

### The rule

```
Open         -> In Progress
In Progress  -> Resolved
Resolved     -> Closed
Open         -> Cancelled
In Progress  -> Cancelled
```

`Closed` and `Cancelled` are final. Nothing leaves them.

### Options considered

**Option A — checks in the route handler**

```js
if (ticket.status === 'Open' && next === 'In Progress') { ... }
else if (...)
```

Rejected. The rule ends up spread across every place a status can change, and
adding a route later means remembering to copy it. It also cannot be tested
without going through HTTP.

**Option B — a transition map with one function**

```js
const TRANSITIONS = {
  'Open':        ['In Progress', 'Cancelled'],
  'In Progress': ['Resolved', 'Cancelled'],
  'Resolved':    ['Closed'],
  'Closed':      [],
  'Cancelled':   [],
};
```

Chosen. The whole rule is visible in one block, in the shape of the diagram in
the brief. Adding a transition is one edit in one place. The function next to
it is pure, so the tests are plain function calls with no database and no
server. The same map also tells the frontend which buttons to show, so the UI
and backend cannot drift apart.

**Option C — a state machine library such as XState**

Rejected. It handles guards, side effects and nested states, none of which are
needed here. Five states and five transitions do not justify a dependency and
the reading time that comes with it. If the workflow grew branches and
side effects, this would be worth revisiting.

### Where the check runs

The status endpoint reads the ticket's **current status from the database**,
then checks the requested move against it.

It does not trust a status sent by the client. If two people open the same
ticket and both press a button, the first request succeeds and the second is
checked against the new stored status, so it is correctly rejected. Trusting
the browser's copy would let the second one through.

### Moving to the current status

Treated as invalid. `Open -> Open` is not in the map, so it is rejected like
any other move that is not listed. It is almost always a double-clicked
button, and silently accepting it would hide that.

## Frontend Design

Three screens:

| Screen | Contents |
|--------|----------|
| List | Search box, status filter, ticket table, create button |
| Create | Title, description, priority, assignee |
| Detail | Fields, edit, reassign, status controls, comments |

No state management library. The app has a handful of screens and every one of
them loads its own data. Adding Redux or similar would be more setup than the
problem needs.

One API client module wraps `fetch`. It is the only place that knows about the
error shape, so components deal with plain messages.

Status buttons are built from the same transition map the backend uses, so the
UI only offers legal moves. This is a convenience, not a guard. The backend
still rejects an illegal request, and the UI shows that rejection if it
happens.

## Backend Design

Endpoints are listed in api-contract.md.

Two decisions worth writing down:

**Status changes get their own endpoint.** `PATCH /tickets/:id` handles normal
fields. `POST /tickets/:id/status` handles the transition. Putting status into
the general update would mean one endpoint with two very different rule sets,
and it would be easy for a status change to slip through the plain field path
without being checked.

**Comments are nested under the ticket.** A comment has no meaning on its own,
so `POST /tickets/:id/comments` matches how it is actually used.

## Database Design

See data-model.md.

SQLite was chosen so a reviewer can clone the repository and run it without
installing a database server. One of the failure modes called out in the brief
is broken setup instructions, and every extra install step is another chance
for setup to fail on someone else's machine.

Foreign keys are enabled explicitly. SQLite does not enforce them by default,
which is a common way for orphaned rows to appear without anyone noticing.

## Validation Strategy

Validation runs in the service layer, before anything is written.

| Field | Rule |
|-------|------|
| title | Required, trimmed, 1 to 200 characters |
| description | Optional, up to 5000 characters |
| priority | Must be `Low`, `Medium` or `High` |
| assignedTo | Optional, but if given must be a real user id |
| message | Required, trimmed, 1 to 2000 characters |
| status | Must be a known status and a legal transition |

Trimming happens before the length check, so a title of only spaces fails as
empty rather than passing as five characters.

All queries use bound parameters, so a search term containing a quote or a
percent sign is treated as text and cannot change the query.

## Error Handling Strategy

Every error returns the same shape:

```json
{ "error": { "code": "INVALID_TRANSITION",
             "message": "Cannot move from Resolved to In Progress. Allowed: Closed",
             "field": null } }
```

| Code | HTTP | When |
|------|------|------|
| `VALIDATION_ERROR` | 400 | Input failed a rule. `field` names the input |
| `NOT_FOUND` | 404 | The ticket or user does not exist |
| `INVALID_TRANSITION` | 409 | The move is not allowed from the current status |
| `INTERNAL_ERROR` | 500 | Anything unexpected |

An invalid transition returns **409 Conflict**, not 400. The request itself is
well formed and the status value is real. It conflicts with the state the
ticket is currently in. Keeping it separate from 400 lets the frontend tell
"you sent something malformed" apart from "that move is not legal right now",
and those need different messages.

The message names what was allowed instead. An error that only says "invalid
transition" leaves the user guessing at what to do next.

## Testing Strategy Link

See test-strategy.md. The required tier is integration tests proving the state
machine rules, which is where most of the test effort goes.
