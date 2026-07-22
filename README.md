# Support Ticket Management System

A small support ticket system: create tickets, comment on them, search and
filter them, and move them through a status lifecycle that the backend
enforces.

Built for the AI capability exercise. The application is deliberately small;
the lifecycle documents beside it are the substance. See
[Documents](#documents) at the end.

---

## Requirements

| | |
|---|---|
| Node.js | 18 or newer. Developed and tested on **v24.13.1** |
| npm | Comes with Node |
| Database | None to install — SQLite writes to a local file |

`better-sqlite3` ships prebuilt binaries for common platforms. If none matches
yours, npm compiles it, which needs a C++ toolchain (`build-essential` on
Debian/Ubuntu, Xcode command line tools on macOS).

---

## Setup

From the project root:

```bash
npm run setup
```

That runs three things: installs backend packages, installs frontend packages,
and creates the database with seed data.

Expected final output:

```
Database ready at /path/to/ai-practical-assessment/tickets.db
  users: 4
  tickets: 6
  comments: 4
```

If you prefer to run the steps separately:

```bash
npm install              # backend
npm --prefix web install # frontend
npm run db:setup         # create and seed the database
```

---

## Running it

Two terminals, because two servers run.

**Terminal 1 — API**
```bash
npm run dev:api
```
```
API listening on http://localhost:3001
```

**Terminal 2 — web app**
```bash
npm run dev:web
```
```
Local:   http://localhost:5173/
```

Open **http://localhost:5173**.

The frontend proxies `/api` to port 3001, so both must be running. If the API
is not up, the page says so rather than failing silently.

> Two terminals rather than one command, so there is no extra dependency just
> to run two processes. See `ai-prompts/implementation.md` for the reasoning.

---

## Tests

```bash
npm test
```

```
Test Files  5 passed (5)
     Tests  149 passed (149)
```

Tests use their own database file (`test.db`), rebuilt before each test. They
never touch `tickets.db`, so you can run them while the app is running.

Breakdown and coverage decisions are in [test-strategy.md](test-strategy.md)
and [test-results.md](test-results.md).

---

## What it does

| Feature | Notes |
|---------|-------|
| Create a ticket | Always starts at `Open` |
| List tickets | Newest first |
| View a ticket | With comments and the statuses it can move to |
| Edit a ticket | Title, description, priority, assignee |
| Change status | Only along allowed transitions |
| Add comments | Append only; allowed in any status |
| Search | Title and description, case insensitive |
| Filter | By status; combines with search |

### The status state machine

```
Open        ──▶ In Progress ──▶ Resolved ──▶ Closed
  │                  │
  └──▶ Cancelled ◀───┘
```

`Closed` and `Cancelled` are final.

Any other move is rejected by the backend with **409**, and the message names
what was allowed instead:

```
Cannot move from Open to Closed. Allowed from Open: In Progress, Cancelled
```

The UI only shows buttons for legal moves, but it holds no copy of the rule —
it renders the `allowedTransitions` list the API sends. The backend is the
authority either way.

Reasoning and the options considered are in [design-notes.md](design-notes.md).

---

## Seeded data

Four users and six tickets covering all five statuses.

| Ticket | Status |
|--------|--------|
| Printer on 3rd floor is offline | Open |
| Slow login on the internal portal | Open |
| VPN disconnects every 10 minutes | In Progress |
| Request access to the analytics dashboard | Resolved |
| Laptop battery replacement | Closed |
| Duplicate invoice email sent to customers | Cancelled |

Search terms that each return one ticket: `printer`, `vpn`, `login`, `invoice`.

To reset at any time:

```bash
npm run db:setup
```

---

## API

Base path `/api`. Full contract in [api-contract.md](api-contract.md).

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/meta` | Status and priority lists for the UI |
| GET | `/users` | Seeded users |
| GET | `/tickets?search=&status=` | List, search, filter |
| POST | `/tickets` | Create |
| GET | `/tickets/:id` | Detail with comments |
| PATCH | `/tickets/:id` | Update fields. Not status |
| POST | `/tickets/:id/status` | Change status |
| POST | `/tickets/:id/comments` | Add a comment |

Every error has the same shape:

```json
{ "error": { "code": "INVALID_TRANSITION", "message": "…", "field": "status" } }
```

| Code | HTTP |
|------|------|
| `VALIDATION_ERROR` | 400 |
| `NOT_FOUND` | 404 |
| `INVALID_TRANSITION` | 409 |
| `INTERNAL_ERROR` | 500 |

---

## Project layout

```
src/
  stateMachine.js       the transition rule, and the only place it lives
  validation.js         input rules
  errors.js             one error type, one handler
  services/             business rules and their queries
  routes/               HTTP only, no rules
web/src/
  api.js                the only module that knows the backend error shape
  components/
database/
  schema.sql  seed.sql  setup-notes.md
tests/                  149 tests
```

---

## Environment variables

None are required. There is no `.env` file and no secrets in the repository.

| Variable | Default | Purpose |
|----------|---------|---------|
| `DB_PATH` | `./tickets.db` | Database file location |
| `PORT` | `3001` | API port |

---

## Known limitations

Written down rather than left to be discovered.

- **No authentication.** Optional in the brief and left out. The "acting as"
  dropdown picks who the API is told you are — it is not security, and anyone
  can send any `createdBy`.
- **No URL routing.** Tickets cannot be linked or bookmarked, and browser back
  leaves the app instead of returning to the list. The cost of not adding a
  router for two views.
- **No pagination.** The list returns every ticket.
- **Status change is read-then-write.** Safe here because `better-sqlite3` is
  synchronous and Node is single threaded. Would need a conditional update if
  two API processes shared one database file. See
  [code-review-notes.md](code-review-notes.md), finding 6.
- **Search does a full scan.** `LIKE '%term%'` cannot use an index. Fine at
  this size; FTS5 would be the fix at scale.

---

## Documents

| Document | What it covers |
|----------|----------------|
| [requirements-analysis.md](requirements-analysis.md) | Assumptions, open questions, edge cases |
| [acceptance-criteria.md](acceptance-criteria.md) | The checklist this is measured against |
| [implementation-plan.md](implementation-plan.md) | Task order, milestones, risks |
| [design-notes.md](design-notes.md) | Architecture and the state machine decision |
| [data-model.md](data-model.md) | Tables, types, indexes |
| [api-contract.md](api-contract.md) | Every endpoint and error |
| [test-strategy.md](test-strategy.md) | What is tested and what is not |
| [test-results.md](test-results.md) | Actual test output |
| [debugging-notes.md](debugging-notes.md) | Six real bugs, with investigation |
| [code-review-notes.md](code-review-notes.md) | Review findings by severity |
| [review-fixes.md](review-fixes.md) | What changed after review |
| [tool-workflow.md](tool-workflow.md) | How AI was used across the lifecycle |
| [reflection.md](reflection.md) | What worked, what AI got wrong |
| `ai-prompts/` | Prompt history by activity |
| `database/setup-notes.md` | Database choice and setup detail |
