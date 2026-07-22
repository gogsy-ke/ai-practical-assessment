# Project Context

This file is the standing context for the project. It is given to the AI tool
at the start of a work session so it does not have to be re-explained.

## What is being built

A support ticket system for an internal team. Users create tickets, comment on
them, and move them through a fixed status lifecycle.

## Stack

- Backend: Node.js with Express
- Frontend: React with Vite
- Database: SQLite through better-sqlite3
- Tests: Vitest with Supertest

## Rules for this codebase

1. **The state machine rule lives in one file.** Route handlers never decide
   whether a transition is legal. They call the state machine module.
2. **The backend is the authority.** The UI may hide buttons for transitions
   that are not allowed, but the backend must still reject the request if one
   arrives anyway.
3. **One error shape everywhere.** Every failure returns
   `{ error: { code, message, field } }`. The frontend relies on this.
4. **Validation happens on the backend.** Frontend checks are a convenience,
   never the only guard.
5. **No new dependencies without a reason.** If a few lines of plain code do
   the job, write the few lines.
6. **Keep the app small.** The scope is fixed by acceptance-criteria.md.
   Features outside it do not get added, even if they would be useful.

## Out of scope

Authentication, user management screens, notifications, file attachments,
audit logs, pagination, and roles. Some of these are listed as Stretch in the
brief. They are deliberately left out so the Core stays clean.

## Definitions

- **Transition** — a change of a ticket's status from one value to another.
- **Allowed transition** — one of the five pairs listed in design-notes.md.
  Everything else is rejected.
