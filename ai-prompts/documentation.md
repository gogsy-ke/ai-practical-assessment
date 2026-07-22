# AI Prompts — Documentation

Tool: Claude Code.

## 1. README, then a walkthrough as a stranger

**Prompt**
Write the README with setup steps. Then walk through it as if you are a
reviewer on a clean machine with an empty folder, and tell me every step that
would fail or is missing. After that we delete node_modules and the database
file and run it from scratch to check for real.

**Why it is in two halves**
Asking for a README produces a README that describes what the author already
has working. The second half asks a different question — what does someone
without my machine hit — and that is where the gaps are.

**AI response (summary)**
A README with requirements, setup, running, tests, API summary, project
layout, known limitations and a document index. Then a list of things that
could fail: Node version, native module compilation, ports already in use,
running only one of the two servers.

**What I accepted**

Naming the exact Node version it was developed on rather than only a minimum.
"Node 18+" is a claim about versions I have not tried; "developed and tested on
v24.13.1" is a fact. Both are useful and they answer different questions.

Documenting the `better-sqlite3` compile fallback. It is a native module, and
if no prebuilt binary matches the reviewer's platform, `npm install` starts
compiling and fails with a C++ error that has nothing obviously to do with
this project.

**What I added that was not suggested**

A "Known limitations" section listing what the app does not do — no auth, no
URL routing, no pagination, read-then-write status change, full-scan search.
Every one is a deliberate decision recorded elsewhere in the documents. A
reviewer will find all of them; the difference is whether they read as
decisions or as things nobody noticed.

## 2. The walkthrough, run for real

Reading the README critically produced a list of things that *might* fail.
Running it produced one that actually did.

**What I ran**

```
rm -rf node_modules web/node_modules tickets.db test.db
npm run setup
npm test
npm run dev:api / npm run dev:web
```

Everything worked, and the setup output matched what the README promised
exactly.

**Then I realised I had tested the wrong thing.** Deleting `node_modules`
tests the working directory, not the repository. Anything untracked by git
would still have been sitting there. So I cloned the repo into a temporary
directory and ran the same steps against the clone.

```
git clone <repo> /tmp/clone-test/repo
npm run setup      → users: 4, tickets: 6, comments: 4
npm test           → 149 passed
npm run dev:api / dev:web → app renders, 409 on an invalid transition
```

Both lockfiles are committed, and no `.env` or `.db` file is tracked.

**The real failure it found**

A port already in use printed a raw Node stack trace:

```
Error: listen EADDRINUSE: address already in use :::3001
    at emitErrorNT (node:net:1976:8)
```

To a reviewer meeting this project for the first time, that reads like the
project is broken. It is the most likely thing to go wrong, because the
obvious way to hit it is starting the API twice.

Now it says what happened, why, and what to do:

```
Port 3001 is already in use.

Something else is running there — most likely another copy of this API.
Stop it, or start this one on a different port:

  PORT=3002 npm run dev:api
```

I checked the suggested fix works rather than only writing it down —
`PORT=3002 npm run dev:api` starts and serves.

**What I rejected**

A suggestion to add a `postinstall` script running `db:setup` automatically.
It would make setup one step instead of two, but it also means `npm install`
silently writes a database file, and running install again would wipe data
without warning. Install and initialise are different actions and should be
asked for separately.

A suggestion to add Docker so setup is one command everywhere. Docker is on
the Stretch list, and it moves the problem rather than removing it — a
reviewer without Docker is worse off than one running two npm commands. The
whole reason for choosing SQLite was to keep setup to installing packages.

## 3. What the exercise taught me about READMEs

The README I wrote first was accurate and would still have wasted a
reviewer's time. Every gap it had was invisible from inside a working
environment, because the environment already had the answers.

Two of the three checks only worked because I ran them rather than reasoned
about them, and the third — cloning instead of deleting `node_modules` — I
only got right on the second attempt.
