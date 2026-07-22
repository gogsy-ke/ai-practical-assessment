# AI Prompts — Design

Tool: Claude Code.

## 1. Project context files

**Prompt**
Write the project context files in `tool-specific/other-tool-workflow/`. Use
this as the standing context for the rest of the build.

**AI response (summary)**
Produced project-context.md, spec.md and tasks.md. Included a rules section
covering where the state machine lives, that the backend is the authority, and
one error shape everywhere.

**What I accepted**
The rules section. Writing "route handlers never decide whether a transition
is legal" down as a rule means it gets applied consistently instead of being
re-decided each time a new endpoint is written.

**What I changed**
Added an explicit "Not building" list. The first version only described what
to build. Naming what is out of scope is more useful, because scope creep is
the risk the brief warns about most.

## 2. Data model

**Prompt**
Write the data model for User, Ticket and Comment. Field types, what is
nullable, what needs an index, and why.

**AI response (summary)**
Three tables with types and constraints. Suggested indexes on `ticket(status)`
and `comment(ticketId)`.

**What I accepted**
`assignedTo` being nullable. The alternative is inventing a placeholder user
to assign unclaimed tickets to, which puts fake data in the table.

Storing status as TEXT rather than an integer code. Slightly larger, but
reading the database while debugging is much easier when the value says
`In Progress`.

**What I rejected**
A suggested index on `title` to speed up search. Search uses
`LIKE '%term%'`, and a leading wildcard means SQLite cannot use an index at
all. The index would take up space and never be read. I wrote the real
limitation into data-model.md instead, along with the fix if the table ever
grew: FTS5, not a plain index.

**What I changed**
Priority values were left undefined in the first version. The brief does not
specify them, so I fixed them at Low, Medium, High and recorded it as an
assumption rather than leaving it open.

## 3. State machine design

**Prompt**
Design the status state machine. Give me two or three ways to structure it
with trade-offs, and pick one. The rule must live in one place.

**AI response (summary)**
Three options: conditional checks in the route handler, a transition map with
a pure function, or a library such as XState. Recommended the transition map.

**What I accepted**
The transition map. The deciding reason was testability. A pure function is
tested with direct calls, no server and no database, so the tests are fast and
they test the rule rather than the plumbing around it.

The second reason is that the same map can be sent to the frontend, so the UI
and the backend cannot drift apart. If a transition is added later, both sides
learn about it from one edit.

**What I rejected**
XState. It exists for guards, side effects and nested states. This workflow is
five states and five transitions with none of that. It would be a dependency
whose docs cost more time than the code it replaces.

**What I added that was not suggested**
Two cases the first answer did not cover:

1. **Moving a ticket to its current status.** `Open -> Open` is not in the
   map, so it is rejected. Usually a double-clicked button. Accepting it
   silently would hide the bug.
2. **Two people changing status at once.** The check must run against the
   status stored in the database, not a status sent by the client. Otherwise
   the second request is validated against a stale value the browser is still
   holding and an illegal move gets through.

The second one is now written into design-notes.md and has its own test.

## 4. API contract

**Prompt**
Write the API contract. Every endpoint, every error case with its status code,
one consistent error shape.

**AI response (summary)**
Seven endpoints with request and response bodies and an error table. Used 400
for invalid transitions.

**What I changed**
Invalid transitions now return **409 Conflict**, not 400. The request is well
formed and the status value is real, so nothing about it is malformed. It
conflicts with the state the ticket is currently in.

This matters to the frontend. With both cases as 400, the UI cannot tell "you
sent something broken" apart from "that move is not legal right now", and
those need different messages. Sending `"Deleted"` is still a 400, because
that is not a status at all.

**What I also changed**
Error messages now say what was allowed instead:

> Cannot move from Open to Closed. Allowed from Open: In Progress, Cancelled

The first version returned "Invalid status transition", which tells the user
nothing about what to do next.

**What I accepted**
Returning `allowedTransitions` on the ticket detail response. I had planned to
duplicate the transition map in the frontend. Sending it from the backend
means there is one copy of the rule in the whole system.
