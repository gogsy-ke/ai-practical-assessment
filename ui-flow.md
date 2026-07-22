# UI Flow

Two views. `App.jsx` holds `openTicketId`; null means the list. That single
piece of state is the whole of the navigation, which is why there is no
router.

```
                    ┌──────────────────────┐
                    │   App loads          │
                    │   GET /users, /meta  │
                    └──────────┬───────────┘
                               ▼
    ┌────────────────────────────────────────────────┐
    │  LIST                                          │
    │  search box · status filter · ticket table     │
    │  [New ticket]                                  │
    └────┬──────────────────────────────┬────────────┘
         │ click a row                  │ [New ticket]
         ▼                              ▼
    ┌─────────────────────┐    ┌────────────────────────┐
    │  DETAIL             │    │  CREATE FORM (inline)  │
    │  fields, [Edit]     │    │  title, description,   │
    │  status buttons     │    │  priority, assignee    │
    │  comments + form    │    └───────────┬────────────┘
    │  [← Back to list]   │                │ on success
    └─────────────────────┘◀───────────────┘ opens the new ticket
```

## States every view handles

| State | Shown as |
|-------|----------|
| Loading | "Loading tickets…" — text, not a spinner component |
| Empty, no filters | "No tickets yet. Create the first one." |
| Empty, filtered | "No tickets match this search." + [Clear filters] |
| Load failed | Replaces the view, with [Retry] |
| Action failed | Message above a view that still works |

The two empty states are deliberately different. "No tickets yet" is wrong
when the database is full and the search simply matched nothing — it sends the
user looking for the wrong problem.

Load and action errors are separated for the same reason. A rejected status
change should not replace the ticket with an error screen and lose the page
the user was reading.

## Status controls

The buttons are built by mapping over `allowedTransitions` from the ticket
detail response. The frontend has no copy of the rule, so it cannot offer a
move the backend would refuse.

```
Open          →  [Move to In Progress]  [Move to Cancelled]
In Progress   →  [Move to Resolved]     [Move to Cancelled]
Resolved      →  [Move to Closed]
Closed        →  "This ticket is Closed. No further status changes are possible."
Cancelled     →  "This ticket is Cancelled. No further status changes are possible."
```

After every change the ticket is reloaded, so the buttons re-derive
themselves. If the backend rejects a change anyway, its message is shown
verbatim — it already names what was allowed instead.

## Search behaviour

Typing is debounced by 300ms. Responses that arrive out of order are
discarded, so a slow reply for an earlier keystroke cannot overwrite newer
results.

Search and status filter combine with AND. Clearing either is one button.
