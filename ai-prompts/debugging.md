# AI Prompts — Debugging

Tool: Claude Code.

Full write-ups of each issue are in debugging-notes.md. This file records how
AI was used while debugging, and where it helped or did not.

## How I prompted for debugging

The pattern I settled on was to **describe the symptom and ask for the cause,
not the fix**. Asking "how do I fix this" produces a patch that usually works,
and I end up with working code and no idea why it was broken. Asking "what
would make this happen" produces an explanation I can then check myself.

Every fix in this project was applied only after I had confirmed the
explanation against the running system.

## 1. Primary key failure after seeding

**Prompt**
Creating a ticket after seeding fails with `UNIQUE constraint failed:
tickets.id`. The seed inserts explicit ids 1 to 6 and completes with no error.
What would make SQLite try to reuse an id that already exists?

**AI response (summary)**
`AUTOINCREMENT` keeps its own counter in `sqlite_sequence`, and that counter
only moves when SQLite assigns an id itself. Explicit ids in the seed leave it
at 0.

**What I validated**
Read `sqlite_sequence` directly. The `tickets` row showed `seq = 0` against
six rows, which matched the explanation exactly.

**What I accepted**
The three `UPDATE sqlite_sequence` lines. Confirmed by creating a ticket
through the API and checking it came back as id 7.

## 2. A test failure I did not expect

**Prompt**
This test fails: `createdBy: true` returns 201 instead of 400. The guard is
`if (!Number.isInteger(Number(value)) || Number(value) <= 0)`. Four other bad
types are rejected. Why does this one pass?

**AI response (summary)**
`Number(true)` is `1`, which is a positive integer, so the guard is satisfied.
The check tests the converted value and never the original type.

**What I accepted**
Checking `typeof` before converting.

**Worth recording about the AI's role**
The guard was AI-written and looked more careful than most hand-written
versions. AI also wrote most of the list of bad inputs for the test. I added
`true` and `[]` to that list, and that is what found it. So AI wrote both the
bug and most of the test that could have caught it — the missing piece was
knowing which values behave oddly under coercion in this specific language.

## 3. Checking a claim I had written myself

**Prompt**
I wrote a comment saying a bad type bound to a query makes better-sqlite3
throw, so it would surface as a 500. I have not verified that. What does it
actually do with `undefined`, a string, a float and an object?

**AI response (summary)**
Only an object throws. The others bind and simply match no row.

**What I validated**
Bound each one directly and watched. The answer was right, and my comment was
wrong.

**Why this prompt exists at all**
The comment would never have failed a test. I only checked it because it
stated a reason and I could not remember confirming it.

## 4. Going looking, with the app finished

**Prompt**
The app is done and 147 tests pass, but every test I wrote sends well-formed
requests. Give me a list of requests this API was never designed to receive —
broken JSON, wrong types, arrays where strings belong, odd ids — so I can see
what it does with them.

**AI response (summary)**
A probe script covering malformed bodies, unusual but legitimate input such as
emoji and newlines, id edge cases, and repeated query parameters.

**What I added to it**
Watching the server's stderr, not just the status codes. Anything printed
there means a request reached the `INTERNAL_ERROR` branch, which is by
definition a case I did not anticipate. It printed 34 lines, which turned out
to be three separate bugs. Reading status codes alone would have found the two
500s but not the third, which returned a plausible-looking 409.

**What came out of it**
Issues 4, 5 and 6 in debugging-notes.md, and 17 regression tests.

**The one I would have missed**
`{"status": ["In Progress"]}` returned a 409 with the message "Cannot move
from Open to Open". Nothing crashed and the request was correctly refused, so
neither the status code nor the stderr flagged it. I noticed because the
message named a status the caller had not sent.

The cause is that property lookup coerces its key, so
`Object.hasOwn(TRANSITIONS, ['Open'])` is `true`. That is the third bug in this
project caused by JavaScript coercing a type quietly.

**What I rejected**

A suggestion to escape HTML in titles on the way in, after the probe showed
`<img src=x onerror=alert(1)>` being stored as sent. React escapes on
render, so it displays as text. Escaping on input would corrupt a title that
legitimately mentions a tag, and would leave the database holding a mangled
version of what the user typed. There is a test asserting it is stored
unchanged.

A suggestion to add a request size limit and rate limiting. Both are real
production concerns and neither is in the acceptance criteria. Noted in
reflection.md as a gap rather than built.