# Tool Workflow

Primary AI tool: **Claude (Claude Code)**.

This describes how AI was actually used on this project, with pointers to
where each claim can be checked.

## 1. Primary AI tool used

Claude Code, in the terminal. It reads and writes files in the repository and
runs commands, so it can execute the code it produces rather than only
suggesting it.

That mattered more than anything else about the tool. Three of the six bugs in
`debugging-notes.md` were found by running something, not by reading it. A
tool that only produces text would have found none of them.

## 2. How I provide project context

Three layers, from most permanent to most immediate.

**Standing context** — `tool-specific/other-tool-workflow/project-context.md`
holds the stack, the rules this codebase follows, and an explicit list of what
is out of scope. The rules are the useful part: "route handlers never decide
whether a transition is legal" is written down once and applied every time,
instead of being re-decided per endpoint.

**Written decisions** — `design-notes.md`, `api-contract.md` and
`data-model.md` were written before the code and then referred to by name.
Prompt 10 was "build the ticket endpoints from api-contract.md", not "build
some endpoints". The contract is the spec; the prompt is a pointer to it.

**Immediate context** — the failing output, the actual error, the file being
changed.

The list of what is *not* being built turned out to be as valuable as the list
of what is. Several suggestions were rejected by pointing at it — pagination,
role permissions, an audit log table.

## 3. How I use AI for requirement analysis

By asking it to attack the brief, not summarise it.

> Do not summarise it back to me. Tell me the gaps and ambiguities I have
> missed, the questions I should be asking a product owner, and the edge cases
> my tests will need to cover.

A summary tells me what I already read. The gaps are what I cannot see, because
not noticing them is what makes them gaps.

This produced the reopening question — the state machine has no path out of
`Closed` or `Cancelled`, which is unusual for a real support tool and worth
raising rather than silently implementing. It is question 1 in
`requirements-analysis.md`, answered as an assumption and flagged.

I rejected some of what came back. An audit log for status changes is real
value in production and is not in Core, so it went on the "not building" list.

## 4. How I use AI for planning and design

By asking for options with trade-offs, then choosing myself and recording why.

> Give me two or three ways to structure it with the trade-offs, then
> recommend one.

For the state machine that produced conditionals in the route handler, a
transition map, or XState. I picked the map, and the deciding reason was
testability: a pure function is tested with direct calls, no server and no
database, so the tests check the rule rather than the plumbing around it.

Asking for one answer gets an answer. Asking for three and a recommendation
gets the reasoning, which is the part I need in order to own the decision
later.

**Design documents are not final.** `design-notes.md` planned three backend
layers. Building it showed two were enough — every query was used by exactly
one service function, so a `db/` layer would have been one-line wrappers. I
updated the document and recorded why. A design document corrected by contact
with the code is more honest than one that was never revisited.

## 5. How I use AI for code generation

In small pieces, against a written contract, one at a time.

Each prompt in `ai-prompts/implementation.md` produced one coherent piece:
the schema and seed, then the state machine with its tests, then the
endpoints, then validation. Never several files at once, because I cannot
review several files at once with any real attention.

The order was deliberate: the state machine first, before any endpoint could
call it. The hardest rule gets settled while it still has nothing depending
on it.

## 6. How I validate AI-generated code

Running it is the check. Reading it is the filter.

Reading catches the obvious. It does not catch:

- the seeded `AUTOINCREMENT` counter, where the schema and seed were both
  correct and setup reported success (issue 1)
- `Number(true) === 1`, where the guard had two conditions and both were right
  (issue 2)
- an array passing a status check because property lookup coerces its key
  (issue 6)

None of those look wrong on the line. Each was found by executing something
and comparing the result against what I expected.

Concretely, that means: run it, check the value that comes back rather than
whether it threw, and check the database rather than only the response.
Several tests assert both — that a change is reflected in the response *and*
that reading it back gives the same answer.

**And check claims in comments.** I wrote a comment stating a reason, did not
verify it, and it was wrong (issue 3). An unchecked claim in a comment is
worse than no comment, because the next reader has no reason to doubt it.

## 7. How I use AI for testing

Three ways, in increasing order of value.

**Generating cases from a written list.** I gave it the edge cases from
`requirements-analysis.md` and asked for tests. Mechanical, and it saves time.

**Asking what a list is missing.** "What categories have I not considered —
not more of the same." This produced boundary testing at exactly 200
characters, not just past it, and a test that a partial update applies nothing
when one field is invalid.

**Asking what breaks in six months.** This was the most useful question I
asked about tests. It produced the grid test over all 25 status pairs and the
count assertion tying the map size to the number of tested moves. They are the
only tests in the suite that catch a mistake nobody has made yet.

I also insisted on seeing tests fail first, against a stub. That showed
something uncomfortable: 32 of 46 passed against a stub that does nothing,
because they assert rejections and the stub rejects everything. Recorded in
`test-results.md` rather than smoothed over.

**Coverage as a gap-finder, not a target.** Run once the suite felt complete,
which is exactly when reading it stops working. It found that `GET /api/users`
had no test at all despite the frontend depending on it.

## 8. How I use AI for debugging

**Describe the symptom, ask for the cause, never ask for the fix.**

Asking "how do I fix this" produces a patch that usually works and leaves me
with working code I do not understand. Asking "what would make this happen"
produces an explanation I can then verify.

Every fix in `debugging-notes.md` was applied only after confirming the
explanation against the running system. For the `AUTOINCREMENT` bug that meant
reading `sqlite_sequence` directly and seeing `seq = 0` against six rows.

The other half is **going looking**, rather than waiting. With the app
finished and 130 tests passing, I wrote a probe that sends the API things it
was never designed for, and watched stderr as well as status codes — anything
printed there means a request reached the branch for cases I did not
anticipate. It printed 34 lines. That was three bugs no test had caught.

## 9. How I use AI for code review

By naming the areas that carry risk and ruling out features.

> Review this as if you are trying to break it. Focus on the state machine,
> validation and error handling. Check whether the transition rule has leaked
> outside its module. Problems only, no new features.

An open "review my code" produces a list of improvements, most of them
features. Naming the risk areas keeps it to problems in code that exists.

**Every finding was checked against the code before being believed.** One was
simply wrong — it recommended an index that already exists. An AI review is a
list of things to check, not a list of work.

I rejected several suggestions, each recorded with a reason in
`code-review-notes.md`. The clearest was removing the `CHECK` constraint on
`status` as duplication. Grep cannot distinguish it from the real duplication,
but it is a different guarantee at a different layer, and it is the only thing
protecting the table from a direct SQL write.

## 10. What I avoid sharing unnecessarily

The rule I worked to: **share the problem, not the organisation around it.**

What I did share: the code, the schema, error output, the technical
requirements of the exercise. All of it either public knowledge or specific to
this throwaway project.

What I kept out:

- **Real data.** Every seeded user is invented, with `@example.com` addresses.
  A real support system's tickets would contain customer names, internal
  hostnames and account details. None of that is needed to test a state
  machine, so none of it should be pasted in.
- **Secrets.** There are none in this project, which is itself the point —
  `.env` and `*.db` are in `.gitignore` from the first commit, and
  `git ls-files` confirms neither is tracked.
- **Internal identifiers.** No real service names, hostnames, ticket numbers
  or team names.

On the exercise document itself: I shared the technical requirements. In a
real engagement I would treat an internal capability framework as
confidential and paraphrase the technical parts rather than pasting the whole
thing. Worth stating plainly, because "I was careful" means nothing without
saying where the line was.

**The general rule:** before pasting, ask whether it would matter if this
appeared in a training set or a leaked log. If the answer is anything other
than a clear no, paraphrase it.

## 11. How I would reuse this workflow in a real project

Directly. Most of it is not specific to this project or this tool.

**What transfers as-is:**

| Practice | Why |
|----------|-----|
| A standing context file with rules and an out-of-scope list | Stops re-deciding the same thing, and makes scope creep easy to refuse |
| Ask for options with trade-offs, not an answer | Leaves me owning the decision |
| Written contract before generated code | Turns "build some endpoints" into "build these endpoints" |
| Small pieces, run each one | Review attention does not scale to five files at once |
| Symptom in, cause out — never "fix this" | Working code I cannot explain is a liability |
| Log the rejections with reasons | The rejected suggestions are where the judgment is |
| Probe deliberately once it works | Tests are written by someone who believes the code works |

**What I would add:**

- A rules file the tool loads automatically, so the standing context is not
  re-supplied by hand.
- A checklist of language-specific coercion traps. Three of six bugs here were
  JavaScript quietly converting a type — `Number(true) === 1`, `null` past a
  default parameter, an array as a property key. That is a pattern, not three
  coincidences.
- The probe script as a template. Malformed bodies, wrong types, boundary
  values, repeated query parameters — the shape is reusable across any HTTP
  API.

**What I would do differently:** run coverage earlier. I ran it at the end and
it immediately found an endpoint with no test at all. At the halfway point it
would have found the same gaps while they were cheaper to close.
