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
