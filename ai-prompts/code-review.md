# AI Prompts — Code Review

Tool: Claude Code.

Findings and outcomes are in code-review-notes.md and review-fixes.md. This
file records how AI was used for the review itself.

## 1. The review prompt

**Prompt**
Review this codebase critically, as if you are a reviewer trying to break it.
Focus on the state machine, input validation and error handling. Check whether
the transition rule has leaked anywhere outside its module. List what you find
by severity. Do not suggest new features — I only want problems in what
already exists.

**Why it is worded that way**
An open "review my code" prompt produces a list of improvements, most of them
features. Naming the three areas that carry the risk, and explicitly ruling out
new features, keeps the answer to problems in code that exists. The leak
question is there because it is the one claim the whole design rests on.

**AI response (summary)**
Six findings by severity: two about duplicated constants, one about the error
handler, one about a repeated date formatter, and two about performance and
concurrency.

## 2. What I checked before believing any of it

The review is a set of claims about the code, so each one was checked against
the code rather than accepted from the list.

The leak question first, because it matters most:

```
$ grep -rn "canTransition\|allowedTransitions" src web/src
```

`canTransition` is called once, in `ticketService.js`. The frontend maps over a
list it was given and never computes anything. The claim held.

**One suggestion was simply wrong.** The review recommended adding an index on
`tickets(status)`. That index already exists in `schema.sql` and is named in
`data-model.md`. Worth recording: an AI review will confidently recommend
things the code already does, so a finding list is a starting point for
checking, not a list of work.

## 3. What I rejected

**Removing the `CHECK` constraint on `status` as duplication.** It looks like a
fourth copy of the status list, and grep cannot tell it apart from the real
duplication in findings 1 and 2. It is a different guarantee at a different
layer: the state machine controls which *changes* are allowed, the CHECK stops
a value that is not a status at all from reaching the table by any route,
including a direct SQL write. Removing it would trade a real safety net for a
tidier grep result.

**Extracting a `useApi` hook.** The loading/error/data pattern appears in three
components, and each differs — the list has debouncing and a race guard, the
detail view has two separate error states, the comment form has neither. A
hook covering all three needs an option for each difference and ends up harder
to read than the three plain versions.

**Wrapping the status change in a transaction.** A single `UPDATE` is already
atomic in SQLite. A transaction around one statement is ceremony. The real
concern is the read-then-write gap, and a transaction does not close that
either — a conditional update would.

**JSDoc on every export.** The functions carrying real decisions already
explain why. Adding `@param {string} id` elsewhere adds bulk, not information.

## 4. Where I disagreed with the grouping

AI listed the duplicated status list and the duplicated priority list together
as one kind of problem. They are not the same.

The status list is shared between two systems that deploy independently, so
drift is expected unless something prevents it. The priority list was also
duplicated *within* the frontend, across two components with nothing forcing
them to agree. The second is the worse smell, and merging them into one finding
hides that.

## 5. The most useful thing to come out of it

Both real findings were about duplicated **values**, not duplicated **logic**.

The design claim — one rule, one place — survived. What slipped past me were
the constants around the rule, because I had been watching the rule. That is a
blind spot worth naming: I verified the thing I had decided to protect, and
stopped looking.
