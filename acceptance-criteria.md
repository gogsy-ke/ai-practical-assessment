# Acceptance Criteria

Each item is checked off only when it has been run and seen working, not when
the code was written.

## Core

- [ ] A user can create a ticket from the UI
- [ ] A user can see all tickets from the database in a list
- [ ] A user can open one ticket and see its detail view
- [ ] A user can update a ticket's title, description, and priority
- [ ] A user can reassign a ticket to a different user
- [ ] A user can add a comment to a ticket
- [ ] Comments show the author and the time they were added
- [ ] Status changes only along the allowed transitions
- [ ] Keyword search returns matching tickets
- [ ] Status filter returns only tickets with that status
- [ ] Search and status filter work together
- [ ] Data is still there after the server restarts

## State Machine

These are listed separately because they are the core rule of the project.

- [ ] Open to In Progress is allowed
- [ ] In Progress to Resolved is allowed
- [ ] Resolved to Closed is allowed
- [ ] Open to Cancelled is allowed
- [ ] In Progress to Cancelled is allowed
- [ ] Open to Closed is rejected
- [ ] Open to Resolved is rejected
- [ ] Resolved to In Progress is rejected
- [ ] Closed to any other status is rejected
- [ ] Cancelled to any other status is rejected
- [ ] A status value that is not in the list is rejected
- [ ] The rejection comes from the backend, not just the UI

## Validation

- [ ] A ticket with an empty title is rejected
- [ ] A title of only spaces is rejected
- [ ] A title over the length limit is rejected
- [ ] A priority outside the allowed list is rejected
- [ ] An assignee id that does not exist is rejected
- [ ] An empty comment message is rejected
- [ ] Validation runs on the backend, so it holds even if the UI is bypassed

## Error Handling

- [ ] Every API error returns the same JSON shape
- [ ] A missing ticket returns 404, not 500
- [ ] A validation failure returns 400 with a message naming the field
- [ ] An invalid transition returns 409 with a message saying what was allowed
- [ ] The UI shows the backend's message, not a generic "something went wrong"
- [ ] The UI does not get stuck in a loading state when a request fails

## Testing

- [ ] Integration tests cover every allowed transition
- [ ] Integration tests cover the rejected transitions listed above
- [ ] Tests run against a fresh database each time
- [ ] `npm test` passes from a clean checkout

## Documentation

- [ ] README setup steps work on a clean machine
- [ ] Database setup and seed steps are written down
- [ ] The API contract lists every endpoint with its errors
- [ ] No secrets are committed
- [ ] `.env.example` exists if any environment variables are used
