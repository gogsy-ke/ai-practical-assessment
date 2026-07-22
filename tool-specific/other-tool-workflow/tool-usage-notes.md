# Tool Usage Notes

Tool: Claude (Claude Code), running in the terminal with read/write access to
the repository and the ability to run commands.

## Why that mattered

The tool executes what it writes. Three of the six bugs in
`debugging-notes.md` were found by running something and comparing the result
to what was expected — the seeded `AUTOINCREMENT` counter, the malformed-JSON
500, and the array-as-status case. A tool that only produces text would have
found none of them, because none of them look wrong on the line.

## How persistent context was set up

| File | Role |
|------|------|
| `project-context.md` | Stack, codebase rules, explicit out-of-scope list |
| `spec.md` | What is being built, and the state machine |
| `acceptance-criteria.md` | The checklist it is measured against |
| `tasks.md` | Progress, ticked when checked rather than when written |

Plus the design documents in the repository root, referred to by name in
prompts: `design-notes.md`, `api-contract.md`, `data-model.md`.

The rules in `project-context.md` are the part that earned its place. Writing
down "route handlers never decide whether a transition is legal" once meant it
was applied at every endpoint instead of being re-decided each time. The code
review confirmed it held: `canTransition` is called exactly once in the whole
codebase.

The **out-of-scope list** did more work than expected. Pagination, an audit
log, role permissions and blocking comments on closed tickets were all
suggested and all refused by pointing at it.

## Traceability: requirement → design → code → test

Following one rule the whole way through, as the brief asks:

| Stage | Artefact |
|-------|----------|
| Requirement | `requirements-analysis.md` — F5, and clarification 1 on reopening |
| Acceptance | `acceptance-criteria.md` — the State Machine section, 12 items |
| Design | `design-notes.md` — three options compared, transition map chosen |
| Contract | `api-contract.md` — `POST /tickets/:id/status`, 400 vs 409 |
| Code | `src/stateMachine.js`, called once from `ticketService.js:232` |
| Unit test | `tests/stateMachine.test.js` — 46 tests, all 25 pairs |
| Integration | `tests/api.status.test.js` — 25 tests |
| UI | `TicketDetail.jsx` renders `allowedTransitions`, holds no copy |
| Verified | `test-results.md` — headless Chrome transcript |

Every step names the one before it. Prompt 10 was "build the ticket endpoints
from api-contract.md", not "build some endpoints".

## Structured planning before implementation

Prompts 1-7 produced no application code. Requirements, acceptance criteria,
data model, state machine design and API contract were written first, and the
first line of implementation came at prompt 8.

The order inside implementation was deliberate too: schema and seed, then the
state machine **with its tests, before any endpoint existed to call it**, then
the endpoints, then validation. The hardest rule was settled while nothing
depended on it.

## How AI suggestions were validated

| Check | Example |
|-------|---------|
| Run it and inspect the result | `AUTOINCREMENT` — the id came back as 1 |
| Check the database, not the response | Status tests assert both |
| Watch stderr, not only status codes | The probe printed 34 lines: three bugs |
| Measure instead of trusting a feeling | Coverage found `GET /api/users` untested |
| Verify claims written in comments | One was wrong; checking took two minutes |
| Clone, do not just delete `node_modules` | Tests the repository, not the directory |

## Where the spec changed, and why

Documents were updated when building proved them wrong, rather than left
describing intentions.

**Three backend layers became two.** `design-notes.md` planned `routes/`,
`services/` and `db/`. Every query turned out to be used by exactly one
service function, so `db/` would have been a file of one-line wrappers. The
document now records the change and what would justify the third layer later.

**`GET /api/meta` was added during code review.** The frontend was keeping its
own copies of the status and priority lists. Serving them from the backend
applies a decision already made for `allowedTransitions`.

## Honest note on the working style

This project was built with heavy AI delegation. Direction, decisions,
rejections and verification were mine; most of the code was generated. The
prompt history shows where that line sat at each step, including the cases
where AI was wrong and how it was caught.
