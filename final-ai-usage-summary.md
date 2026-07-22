# Final AI Usage Summary

Tool: Claude (Claude Code). Full history in `ai-prompts/`.

## Honest summary of the split

Most of the code was AI-generated. My contribution was direction, choosing
between options, refusing suggestions, and verifying output — and the
verification is where nearly all the defects were caught.

| I did | AI did |
|-------|--------|
| Chose the stack, scope and what not to build | Produced options with trade-offs |
| Wrote the contracts and rules to build against | Generated code against them |
| Decided which suggestions to refuse | Suggested more than was needed |
| Ran everything and checked the results | Explained causes when I described symptoms |
| Added the test cases that found the bugs | Wrote most of the surrounding tests |

## Where AI was used, by stage

| Stage | Prompt file | Outcome |
|-------|-------------|---------|
| Planning | `planning.md` | Approach, stack, requirement gaps |
| Design | `design.md` | Data model, state machine options, API contract |
| Implementation | `implementation.md` | Schema, state machine, endpoints, UI |
| Testing | `testing.md` | Test tiers, structural tests, coverage gaps |
| Debugging | `debugging.md` | Six bugs, causes and verification |
| Code review | `code-review.md` | Six findings, four fixed |
| Documentation | `documentation.md` | README and the clean-clone walkthrough |

## What AI got wrong

Six bugs in `debugging-notes.md`. Three shared a cause: JavaScript coercing a
type quietly.

| # | Bug | Found by |
|---|-----|----------|
| 1 | New tickets reuse id 1 after seeding | Running it, checking the id |
| 2 | `createdBy: true` accepted as user 1 | A test case I added |
| 3 | A comment of mine stated an unverified reason | Checking my own claim |
| 4 | Malformed JSON returned 500 | Probing, watching stderr |
| 5 | `null` body crashed the service | Probing |
| 6 | Array status rejected for the wrong reason | Reading the error message |

The one worth naming is bug 2. The guard was AI-written, had two conditions,
both correct, and was more careful than most hand-written versions. It was also
wrong, and nothing on the line looked it.

## Suggestions rejected

Each recorded with reasoning where it was made.

| Rejected | Reason |
|----------|--------|
| XState | Five states and five transitions do not justify a dependency |
| Zod / Joi | Six fields fit in one file with no dependency |
| React Router | Two views and one `useState` |
| `concurrently` | Two npm scripts and a README line |
| A `useApi` hook | Three call sites, each differing; options for each would read worse |
| Removing the `CHECK` on `status` | Different guarantee, different layer |
| An audit log table | Real value, not in Core |
| Pagination | Stretch, not in the acceptance criteria |
| Blocking comments on Closed tickets | Contradicts a recorded decision |
| Escaping HTML on input | React escapes on render; this corrupts real titles |
| A `postinstall` running `db:setup` | Install would silently write, and re-install would wipe |
| Docker | Moves the setup problem rather than removing it |
| A transaction around one `UPDATE` | Already atomic. Ceremony |
| A coverage threshold | Turns a gap-finder into a target |
| An index that already exists | It already exists |

## The most useful things I learned

**Running beats reading.** Reading caught none of the six bugs.

**Ask for causes, not fixes.** A fix leaves working code I cannot explain. A
cause leaves an explanation I can check.

**Go looking once it works.** Three bugs came from deliberately sending bad
input after 130 tests were passing. Every test was written by someone who
already believed the code worked.

**Watch stderr, not only status codes.** Bug 6 returned a plausible 409 and
printed nothing. It was caught because the message named a status the caller
never sent.

**Verifying what you decided to protect is not the same as looking.** In review
I confirmed the transition rule had not leaked. It had not. What had leaked
were the constants around it, because I was watching the rule.
