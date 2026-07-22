# Debugging Notes

Written as each problem came up, not collected at the end.

---

## Issue 1 — New tickets fail on the primary key after seeding

### Problem

`npm run db:setup` finished with no error and the seeded data looked right.
Creating a ticket through the API then failed:

```
UNIQUE constraint failed: tickets.id
```

Nothing in the setup output suggested a problem. The failure only appears the
first time someone creates a ticket, which in a demo would be the first thing
a reviewer clicks.

### How I investigated

I inserted a row straight after setup and printed the id that came back:

```js
const r = db.prepare("INSERT INTO tickets (...) VALUES (...)").run();
console.log('new id =', r.lastInsertRowid);   // → 1
```

It came back as **1**, and id 1 already exists in the seed data. So the
question was not why the insert failed, but why SQLite thought 1 was free.

### How AI helped

I described the symptom and asked what would make SQLite reuse an id that is
already taken, rather than asking for a fix.

The answer was `AUTOINCREMENT`. It keeps a separate counter in the internal
`sqlite_sequence` table, and that counter only moves when SQLite assigns an id
itself. The seed inserts explicit ids 1 to 6, so the counter never moved off 0
and the next generated id was 1.

### What I validated

I read `sqlite_sequence` directly to confirm the explanation rather than
trusting it:

```sql
SELECT * FROM sqlite_sequence;
```

The `tickets` row showed `seq = 0` against six existing rows. That matched the
explanation exactly.

### Final fix

Three lines at the end of `database/seed.sql`, setting the counter past the
seeded ids:

```sql
UPDATE sqlite_sequence SET seq = 6 WHERE name = 'tickets';
```

Confirmed by creating a ticket through the running API and checking the
response: it came back with **id 7**.

### What I took from it

Reading the code would not have caught this. The schema was correct, the seed
was correct, and the setup script reported success. It only appeared by
running the thing and looking at what came back.

---

## Issue 2 — `createdBy: true` creates a ticket owned by a real user

### Problem

Found by a test I had just written, not by a crash. I was checking that bad
types for `createdBy` are rejected:

```js
for (const createdBy of ['abc', {}, 1.5, [], true]) {
  expect((await createTicket({ ...valid, createdBy })).status).toBe(400);
}
```

```
AssertionError: expected 201 to be 400
```

Four of the five were rejected. `true` was accepted, and the ticket was
created and attributed to user 1 — a real person in the seed data.

### How I investigated

The guard looked right:

```js
if (!Number.isInteger(Number(value)) || Number(value) <= 0) throw ...
```

So I printed what `Number()` actually does to each test value:

| Value | `Number(v)` | Integer? | `> 0`? | Result |
|-------|-------------|----------|--------|--------|
| `'abc'` | `NaN` | no | no | rejected |
| `{}` | `NaN` | no | no | rejected |
| `1.5` | `1.5` | no | yes | rejected |
| `[]` | `0` | yes | no | rejected |
| `true` | **`1`** | **yes** | **yes** | **accepted** |

`Number(true)` is `1`. The check was correct about the *value* and never
looked at the *type*, so a boolean arrived as a valid user id.

### How AI helped

Barely, and that is worth recording. The guard was AI-written and looked
careful — it checks for an integer and for a positive value, which is more
than most hand-written versions do. It read as thorough, which is exactly why
I would not have questioned it.

The test caught it. AI wrote the guard and also wrote most of the test list; I
added `true` and `[]` to that list because booleans and empty arrays are the
values that behave oddly under coercion in JavaScript. That addition is what
found it.

### What I validated

That the fix rejects the bad types without breaking the good ones. Ids arrive
as strings from URL parameters, so `'3'` still has to be accepted:

| Input | Before | After |
|-------|--------|-------|
| `2` | accepted | accepted |
| `'3'` | accepted | accepted |
| `true` | **accepted** | rejected |
| `[]` | rejected | rejected |
| `1.5` | rejected | rejected |
| `'abc'` | rejected | rejected |

### Final fix

Check the type before converting, in `src/validation.js`:

```js
const looksNumeric =
  typeof value === 'number' ||
  (typeof value === 'string' && value.trim() !== '');

const asNumber = looksNumeric ? Number(value) : NaN;
```

### What I took from it

This is the clearest example in the project of AI-generated code that looks
more careful than it is. The guard had two conditions and both were right; the
gap was a check that was never there at all. Reviewing it by reading would not
have found it, because there is nothing wrong on the line.

It also changed how I write these tests. Listing bad inputs is not enough —
the list has to include the values that behave strangely in the language being
used, and in JavaScript that means booleans, empty arrays and empty strings.

---

## Issue 3 — A comment in my own code was wrong

### Problem

Not a bug in behaviour. While writing `requiredId` I left a comment claiming
that passing a bad type to a query "makes the driver throw, which would
surface as a 500". I had not checked that; I had assumed it.

### How I investigated

Bound each type directly and watched what `better-sqlite3` did:

| Bound value | Result |
|-------------|--------|
| `undefined` | no error, no row matched |
| `'abc'` | no error, no row matched |
| `1.5` | no error, no row matched |
| `{}` | throws `RangeError: Too few parameter values were provided` |

Only the object case throws. The others return nothing and would have produced
a clean 400 through the "user does not exist" path anyway.

### Final fix

Rewrote the comment to say what actually happens, and to give the real reason
the guard is worth keeping: without it the error says "user does not exist"
when the real problem is that the caller sent the wrong type, and naming the
actual problem is more useful.

### What I took from it

A comment that states a reason is a claim, and an unchecked claim in a comment
is worse than no comment — the next person has no reason to doubt it. This one
took two minutes to check and was wrong.

---

## How issues 4 to 6 were found

Issues 1 to 3 turned up while building. With the app finished and 130 tests
passing, I went looking on purpose instead of waiting for something to break.

The tests all send well-formed requests, because I wrote them alongside code
that expected well-formed requests. So I wrote a script that sends the API
things it was never designed for — broken JSON, wrong types, arrays where
strings belong, odd ids — and watched both the status codes and the server's
stderr.

The stderr was the useful part. Anything printed there means a request reached
the `INTERNAL_ERROR` branch, which is the branch for things I did not
anticipate. It printed **34 lines**. That is three separate bugs, none of which
any test caught.

---

## Issue 4 — Malformed JSON returns 500

### Problem

```
POST /api/tickets   body: {"title": "broken
→ 500  {"error":{"code":"INTERNAL_ERROR","message":"Something went wrong"}}
```

A client sending a broken request body is told the server broke. That is the
wrong party blamed, and a 500 tells the caller to retry when retrying will
never help.

### How I investigated

The stderr showed the real error:

```
SyntaxError: Unterminated string in JSON at position 17
    at JSON.parse (<anonymous>)
    at parse (.../body-parser/lib/types/json.js:96:19)
```

So the throw comes from `express.json()`, before any of my code runs. It
reaches `errorHandler`, is not an `AppError`, and falls through to the
catch-all 500.

### How AI helped

I asked how to tell a body-parser failure apart from a genuine server fault,
since both arrive at the same handler as a plain `Error`.

body-parser tags its errors: `err.type === 'entity.parse.failed'`, and it sets
`err.status` to 400. I checked that on a real thrown error rather than
trusting it.

### Final fix

A branch in `errorHandler` before the 500 catch-all, turning a parse failure
into a 400 with `code: VALIDATION_ERROR`.

### What I validated

The response is now a 400, and the parser's stack trace does not reach the
client. There is a test asserting the body contains neither `body-parser` nor
`at `.

---

## Issue 5 — A request body of `null` crashes the service

### Problem

```
POST /api/tickets   body: null
→ 500
```

### How I investigated

The guard looked like it covered this:

```js
export function createTicket(input = {}) {
  const title = requiredText(input.title, ...);
```

A default parameter looked like enough. It is not:

```js
f(undefined)  // default applies
f(null)       // TypeError: Cannot read properties of null
```

**Default parameters only fill in for `undefined`.** `null` is a value, so it
is passed through, and the first property read throws.

### Final fix

`const input = rawInput ?? {};` in `createTicket`, `updateTicket` and
`addComment`. `??` treats `null` and `undefined` the same way, which is what
was meant in the first place.

### Something I have to be honest about here

After fixing it I re-ran the probe, and the `null` body now returns 400 —
but with the message "Request body is not valid JSON", which is the *issue 4*
fix responding, not this one.

`express.json()` runs in strict mode by default and only accepts an object or
an array at the top level, so a body of `null` is rejected before my service
is ever called. Over HTTP, the `?? {}` guard is never reached.

So this fix does not change any behaviour a user can see. It is still worth
keeping — the service functions are exported and the guard is what makes them
safe to call directly — but I would be overstating it to list this as a bug
the API had. The real fix for the HTTP path was issue 4.

I found this out by re-running the probe rather than assuming my fix was the
reason the result changed.

---

## Issue 6 — An array as a status is rejected for the wrong reason

### Problem

```
POST /api/tickets/1/status   body: {"status": ["In Progress"]}
→ 409  "Cannot move from Open to Open. Allowed from Open: In Progress, Cancelled"
```

The request was correctly refused, so nothing broke. But the diagnosis is
wrong twice over: it is reported as a conflict with the ticket's state when it
is really malformed input, and the message says the caller sent `Open` when
they sent an array.

### How I investigated

`isValidStatus` was:

```js
return Object.hasOwn(TRANSITIONS, status);
```

Checked what that does with an array:

```js
Object.hasOwn({'Open': 1}, ['Open'])   // true
String(['Open'])                       // 'Open'
`${['Open']}`                          // 'Open'
```

**Property lookup coerces its key to a string.** A one-element array becomes
exactly that element's text, so `['Open']` passes as a real status. It then
failed `canTransition`, because `['In Progress'] !== 'In Progress'` inside
`includes`, which produced the 409. The same coercion in the template literal
is why the message read as if a plain string had been sent.

### Final fix

```js
return typeof status === 'string' && Object.hasOwn(TRANSITIONS, status);
```

Now a 400 saying the value is not a valid status, which is what it is.

### What I validated

That the ticket is genuinely unchanged afterwards, not merely that the status
code improved. The behaviour was already safe; only the diagnosis was wrong,
and a fix that changed the message while letting the write through would have
been much worse than the bug.

### What I took from it

This one would never have been reported. Nothing crashed, no data was
corrupted, and the request was refused. It would have surfaced as a support
ticket saying "the error message makes no sense", long after anyone could
connect it to a type check.

It is also the third bug in this project caused by JavaScript coercing a type
quietly — after `Number(true) === 1` in issue 2, and `null` slipping past a
default parameter in issue 5. That is a pattern rather than three
coincidences, and it is the thing I would look for first on the next
JavaScript project.
