# AI Prompts — Testing

Tool: Claude Code.

Test tiers and coverage decisions are in test-strategy.md; actual output is in
test-results.md. This file records how AI was used for testing.

## 1. Tests before implementation

**Prompt** (prompt 9 in the roadmap)
Build the state machine module and its tests now, before any endpoints. The
tests must cover every allowed transition, every rejected one, a status value
that is not in the list at all, and a move to the current status. Show me the
tests failing first so I know they are actually testing something.

**What I accepted**
Writing a stub first so the tests could run against something that does
nothing. It is the only way to tell a test that checks behaviour from one that
happens to agree with whatever was written.

**What the failing run actually showed**
14 failed, 32 passed. The 32 passed because the stub returns `false` and most
of those tests assert a rejection — they were satisfied by a broken
implementation.

I left the suite as it was rather than contriving to make all 46 fail, but I
now know which half is load-bearing. Recorded in test-results.md rather than
presenting "we saw them fail" as if all 46 had.

## 2. Structural tests, not just behavioural

**Prompt**
These tests check the transitions that exist today. What happens when someone
adds a transition to the map in six months and forgets to write a test for it?

**AI response (summary)**
Two suggestions: a grid test over all 25 status pairs against a copy of the
rule written separately in the test file, and a count assertion tying the size
of the map to the number of tested moves.

**What I accepted**
Both. They are the only tests in the suite that catch a mistake nobody has
made yet. Everything else checks behaviour that exists; these check that the
tests and the rule stay in step.

**Why the grid test works**
The rule is written twice — once in `stateMachine.js`, once in the test file.
Duplication is normally the thing to remove, but here it is the mechanism:
if the two disagree, something changed in one place only.

## 3. Asking for the cases I would not think of

**Prompt**
Here is my edge case list from requirements-analysis.md. What is missing that
would actually break this — not more of the same, but categories I have not
considered?

**What I accepted**
Testing exactly at the boundary as well as past it. I had a test for a
201-character title but not for exactly 200, so nothing proved the limit was
in the right place rather than one character off.

Testing that a partial update applies nothing when one field is invalid. I had
tested that bad input is rejected, but not that the good half of the same
request was not written.

**What I added**
`true` and `[]` to the list of bad user ids. Booleans and empty arrays are the
values that behave oddly under coercion in JavaScript, and that addition is
what found bug 2 — `Number(true)` is `1`, so `createdBy: true` was creating
tickets owned by a real user.

## 4. Measuring instead of guessing

**Prompt**
The suite feels complete, which probably means I have stopped seeing the gaps.
Set up coverage and tell me which paths the app actually uses that no test
touches.

**Why this prompt exists**
"Feels complete" is the point at which reading the suite stops being useful.
Every test in it was written by someone who already believed the code worked.

**What it found**

| Gap | Why it mattered |
|-----|-----------------|
| `GET /api/users` untested | The frontend depends on it for two dropdowns |
| Reassign to a missing user | Only tested on create; update reaches it separately |
| `optionalText` bad-type branches | Only ever given valid text or nothing |

Eight tests added. `validation.js` and `src/routes/` went to 100%.

**What I rejected**
Setting a coverage threshold in the config to fail the build below a number.
It would turn a gap-finder into a target, and the honest answer here is that
the frontend sits at 0% for a reason stated in test-strategy.md. A threshold
would either have to be set below what the backend already achieves, which
proves nothing, or it would fail every run.

**What I was careful about**
Not writing tests to raise the number. The `INTERNAL_ERROR` branch in
`errors.js` is reachable only by adding a route that exists to throw. That
test would prove the handler works in a situation the app cannot produce, and
would move coverage without adding confidence. Left uncovered and explained.

## 5. Writing the test documents

**Prompt**
Write test-strategy.md and test-results.md from the tests that actually exist,
with the real output. In "Tests Not Covered", be honest about what was skipped
and why, rather than listing things that sound good.

**What I changed**
The first draft of "Tests Not Covered" listed load testing, security testing
and browser compatibility — all true, all things nobody expected in a project
this size, and none of them the real gap.

The real gap is that the frontend has **no automated tests at all**. I moved it
to the top of the section, said it is the largest gap, and said that with
another day it is where the time would go. Burying it under three items that
cost nothing to admit would have been the more comfortable version and the
less useful one.
