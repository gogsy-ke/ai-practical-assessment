# Reflection

## What I Built

A support ticket system: React frontend, Express API, SQLite database. Create,
list, view, edit and comment on tickets, search and filter them, and move them
through a status lifecycle the backend enforces.

157 tests. The three modules holding the rules are at 100% statement and
branch coverage. Setup runs from a fresh clone with one command.

The application is small on purpose. The brief scopes it at 8-12 hours and
says a clean Core is a strong result, so the effort went into the lifecycle
documents and into actually checking things rather than into more features.

## How I Used AI (across the lifecycle)

Full detail in `tool-workflow.md` and `ai-prompts/`. In short:

| Stage | How |
|-------|-----|
| Requirements | Asked it to attack the brief, not summarise it |
| Design | Asked for options with trade-offs, chose myself, recorded why |
| Implementation | Small pieces against a written contract, one at a time |
| Testing | Generated cases from a list, then asked what the list was missing |
| Debugging | Described symptoms, asked for causes, never for fixes |
| Review | Named the risk areas, ruled out features, checked every finding |

The work was heavily AI-assisted. I directed it, chose between options,
rejected suggestions, and verified output — but most of the code was
generated rather than typed. Being straight about that is more useful than
implying otherwise, and the prompt history shows exactly where the line was.

## What AI Helped With Most

**Removing the blank page.** The value was not in typing speed. It was that
the first version of everything existed in minutes, so the time went into
judging it — which is the part I am actually adding.

**Options I would not have weighed.** For the state machine it gave three
structures with trade-offs. Left alone I would have written conditionals in
the route handler, which works and is exactly the thing that leaks.

**Explaining what I was seeing.** For the `AUTOINCREMENT` bug I had a symptom
and no idea where to look. It named `sqlite_sequence` immediately, and I could
verify it in one query. That is the strongest use: a fast hypothesis I can
check, not a fix I have to trust.

**Finding my blind spots on request.** "What is missing from this list — not
more of the same" produced the boundary test at exactly 200 characters, and
the grid test that catches a transition added without a test.

## What AI Got Wrong

Six real bugs are in `debugging-notes.md`. The pattern across them matters more
than any one.

**Code that looks more careful than it is.** The user id guard was
`!Number.isInteger(Number(value)) || Number(value) <= 0`. Two conditions, both
correct, more thorough than most hand-written versions. `Number(true)` is `1`,
so `createdBy: true` created tickets owned by a real person. There is nothing
wrong on the line. Reviewing by reading would never have caught it.

**Answering the question asked, not the problem.** I asked that a search term
"cannot change the query", and got parameter binding — correct, and it stops
SQL injection. It does not stop `%` and `_` being wildcards, because those are
part of the LIKE pattern, not the SQL. A user searching "95%" would get
unrelated results. Nothing was wrong; I asked about half the problem.

**Confident recommendations for things already done.** The code review told me
to add an index that already exists and is named in `data-model.md`. A finding
list is a starting point for checking, not a list of work.

**Three of six bugs were JavaScript coercing a type quietly** — `Number(true)`,
`null` slipping past a default parameter, an array passing as a property key.
That is a pattern, and it is what I would look for first on the next JS
project.

**And one wrong thing that was mine.** I wrote a comment stating a reason I
had not verified. It was wrong. Checking took two minutes.

## How I Validated AI Output

**Running it, not reading it.** Reading caught none of the six bugs. Each was
found by executing something and comparing the result to what I expected.

**Checking the effect, not the response.** Several tests assert both that a
change appears in the response and that reading it back from the database
gives the same answer.

**Watching stderr, not just status codes.** The probe run printed 34 lines,
each meaning a request reached the branch for cases I had not anticipated.
Status codes alone would have found two of the three bugs.

**Measuring instead of trusting the feeling of completeness.** Coverage found
`GET /api/users` had no test at all.

**Verifying claims in comments.** A comment that states a reason is a claim.

**Cloning instead of deleting `node_modules`.** My first clean-setup test was
wrong — deleting `node_modules` tests the working directory, not the
repository. Cloning to a temp directory is the real check. I got that right on
the second attempt.

## What I Would Improve Next

**Frontend tests.** The largest gap, at 0%. The UI was driven end to end in
headless Chrome, which proved it works but does not run in CI and will not
catch a regression. With another day this is where it goes.

**Coverage earlier.** Run at the end, it immediately found an endpoint with no
test. At the halfway point it would have found the same gaps cheaper.

**Probing earlier.** Three bugs came from deliberately sending bad input, done
after the app was finished. Nothing about that required the app to be
finished.

**A conditional update for status changes.** Safe today only because
`better-sqlite3` is synchronous and Node is single threaded. That is an
assumption about deployment shape sitting inside a correctness guarantee.

**The blind spot I would watch for.** In review I verified the transition rule
had not leaked — and it had not. What had leaked were the *values* around it:
the status list and priority list, duplicated into the frontend. I checked the
thing I had decided to protect and stopped looking. Deciding what to protect
also decides what you stop seeing.

## Reusable Workflow (prompts, rules, specs, templates)

What I would carry to the next project:

**A standing context file** with the stack, the rules this codebase follows,
and an explicit out-of-scope list. The out-of-scope list did more work than
expected — several suggestions were refused by pointing at it.

**Four prompt shapes** that did the heavy lifting:

| Shape | Use |
|-------|-----|
| "Do not summarise. Tell me what I have missed." | Requirements |
| "Two or three options with trade-offs, then recommend one." | Design |
| "Here is the symptom. What would cause it?" | Debugging |
| "What breaks when someone changes this in six months?" | Tests |

**The probe script**, as a template. Malformed bodies, wrong types, boundary
values, repeated query parameters — reusable against any HTTP API.

**A language-trap checklist**, starting with JavaScript coercion.

**The habit of logging rejections with reasons.** The rejected suggestions —
XState, Zod, React Router, `concurrently`, a `useApi` hook, removing the CHECK
constraint — are where the judgment actually is. Accepting good output is not
a skill. Knowing which good-looking output to refuse is.
