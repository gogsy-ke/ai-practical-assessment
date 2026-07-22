# Requirement Analysis

## Selected Project Option

Support Ticket Management System (backend-heavy option).

I picked this option because the hardest part of it is the status state
machine. That is a backend rule, and it is a good place to show design
thinking rather than just wiring up forms.

## My Understanding (in my own words)

This is an internal tool for a support team. There is no public signup. All
users already exist in the system and are loaded as seed data.

A user creates a ticket when something needs attention. The ticket has a
title, a description, a priority, and a status. It is assigned to someone.
Other users add comments to discuss it.

The ticket moves through a lifecycle. It starts as Open. It becomes In
Progress when someone starts work. It becomes Resolved when the work is done,
and Closed once that is confirmed. At two points it can be Cancelled instead.

The important part is that the lifecycle is not free. You cannot jump from
Open straight to Closed. You cannot reopen a Closed ticket. The backend has
to enforce this, not the UI. The UI can hide invalid buttons to be helpful,
but the backend must still reject a bad request if one arrives.

## Functional Requirements

| # | Requirement |
|---|-------------|
| F1 | Create a ticket with title, description, priority, and assignee |
| F2 | List all tickets |
| F3 | View one ticket in detail, with its comments |
| F4 | Update a ticket's title, description, priority, and assignee |
| F5 | Change a ticket's status, but only along allowed transitions |
| F6 | Add a comment to a ticket |
| F7 | Search tickets by keyword and filter by status |
| F8 | Keep all data in a database so it survives a restart |
| F9 | Validate input on the backend and reject bad data |
| F10 | Show clear error messages in the UI when something fails |

## Non-Functional Requirements

| # | Requirement |
|---|-------------|
| N1 | The state machine rule lives in one place in the code, not scattered |
| N2 | Every API error returns a consistent shape the frontend can rely on |
| N3 | Setup runs from the README on a clean machine with no manual DB work |
| N4 | No secrets in the repository |
| N5 | Integration tests cover both valid and invalid status transitions |

## Assumptions

I made these assumptions instead of guessing at extra features. Each one
keeps the scope small on purpose.

1. **No authentication.** The spec says auth is optional. There is no login.
   The current user is picked from a dropdown in the UI and sent to the API.
   This is not secure, and I have noted it as a known limitation rather than
   pretending it is a real auth system.
2. **Users are seeded only.** There is no screen to add or edit users.
3. **One assignee per ticket.** Not a list.
4. **A ticket can be unassigned.** `assignedTo` is nullable, because a ticket
   often exists before anyone picks it up.
5. **Comments cannot be edited or deleted.** A comment is a record of what was
   said. Keeping it append-only avoids a lot of extra rules.
6. **Tickets are never deleted.** Cancelled is the way to remove a ticket from
   active work. This keeps history intact.
7. **Status changes go through their own endpoint**, not the general update
   endpoint. Mixing them would mean one endpoint has two very different sets
   of rules.
8. **Search covers title and description only.** Not comments.

## Clarifications (questions for a product owner)

These are real gaps in the spec. I picked an answer for each so I could keep
building, but I would ask before shipping this for real.

1. **Can a Cancelled or Closed ticket be reopened?**
   The state machine shows no way out of either. So both are final.
   *My assumption: they are final. This is worth confirming, because in most
   real support tools reopening a Closed ticket is a common request.*

2. **Can you comment on a Closed or Cancelled ticket?**
   The spec does not say.
   *My assumption: yes. Blocking it would hide useful context, and comments
   do not change the ticket state.*

3. **Can you edit fields on a Closed ticket?**
   *My assumption: yes for now, since the spec does not restrict it. In a real
   product I would expect Closed tickets to be read-only.*

4. **Who is allowed to change status?**
   The User entity has a `role` field, but Core has no role rules.
   *My assumption: anyone can. The role field is seeded and displayed but not
   enforced, since role-based access is listed as Stretch.*

5. **Should the assignee be notified?**
   *My assumption: out of scope. No email or notification system.*

## Edge Cases

These are the cases I want the tests and validation to actually handle.

**Status transitions**
- Moving to a status that is not reachable from the current one, for example
  Open to Closed.
- Moving a ticket to the status it already has.
- Sending a status value that is not in the list at all, like `"Deleted"`.
- Two people changing status at the same time. The second request should be
  checked against the current stored status, not the one the browser had.

**Validation**
- Empty or whitespace-only title.
- Title that is extremely long.
- A priority value outside the allowed list.
- `assignedTo` pointing at a user id that does not exist.
- An empty comment message.

**Not found**
- Fetching, updating, or commenting on a ticket id that does not exist.

**Search and filter**
- A search term with no matches, which should return an empty list and not an
  error.
- Search text containing SQL characters like `'` or `%`.
- Search and status filter used together.
- Search that differs only by upper and lower case.
