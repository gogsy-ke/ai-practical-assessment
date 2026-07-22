# Implementation Plan

## Overview

Build the backend before the frontend, and the state machine before the rest
of the backend. The state machine is the hardest rule in the project, so it is
settled first and everything else is built around it.

## Task Breakdown

| Order | Task | Why here |
|-------|------|----------|
| 1 | Schema and seed data | Nothing can be tested without data |
| 2 | State machine module and its tests | The core rule. Pure function, fast to test |
| 3 | Ticket endpoints | Now they can call a rule that already works |
| 4 | Validation and error handler | Applied across all endpoints at once |
| 5 | Comments, search, filter | Smaller features, lower risk |
| 6 | API client | One place that understands the error shape |
| 7 | List, search, create | Proves the API end to end |
| 8 | Detail view and status controls | The visible half of the state machine |
| 9 | Review, README, clean setup test | Catches what was missed |

## Milestones

| Milestone | Done when |
|-----------|-----------|
| M1 Data | `npm run db:setup` produces a seeded database |
| M2 Rule | State machine tests pass, including every rejection case |
| M3 API | All endpoints work against the contract |
| M4 UI | Every acceptance criterion can be done from the browser |
| M5 Ship | Clean checkout runs from the README and tests pass |

## AI Usage Plan

| Stage | How AI is used | How it is checked |
|-------|----------------|-------------------|
| Requirements | Find gaps and edge cases I missed | Each one accepted or rejected with a reason |
| Design | Compare options and argue trade-offs | I pick, and record why |
| Implementation | Generate code against the written contract | Run it, and test the edge cases |
| Testing | Generate cases from the edge case list | Confirm tests fail before they pass |
| Debugging | Suggest causes from real errors | Verify the cause before applying a fix |
| Review | Critique the finished code | Judge each finding, reject the ones that do not apply |

## Risks

| Risk | Mitigation |
|------|------------|
| Scope creep into Stretch features | Spec lists what is not being built. Check against it before adding anything |
| Documents left to the last day | Each one written in the phase it belongs to |
| Tests that pass without proving anything | Every state machine test is seen failing first |
| Setup works only on my machine | Delete node_modules and the db file, then follow the README as written |
| Accepting AI code I cannot explain | Small chunks, run each one, no batch generation of many files |
| Transition rule leaking into route handlers | One module owns it. Review checks for copies |
