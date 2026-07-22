# API Contract

Base path: `/api`
All request and response bodies are JSON.

## Error shape

Every failure returns this shape, whatever the status code.

```json
{ "error": { "code": "VALIDATION_ERROR",
             "message": "Title is required",
             "field": "title" } }
```

`field` is `null` when the error is not about one specific input.

| Code | HTTP | Meaning |
|------|------|---------|
| `VALIDATION_ERROR` | 400 | An input broke a rule |
| `NOT_FOUND` | 404 | The ticket or user does not exist |
| `INVALID_TRANSITION` | 409 | The status move is not allowed right now |
| `INTERNAL_ERROR` | 500 | Unexpected failure |

---

## GET /api/users

Lists seeded users. Needed to populate the assignee dropdown and the
"acting as" selector.

**Response 200**
```json
[ { "id": 1, "name": "Priya Nair", "email": "priya@example.com", "role": "Agent" } ]
```

---

## GET /api/tickets

Lists tickets, newest first.

**Query parameters**

| Name | Required | Notes |
|------|----------|-------|
| `search` | no | Matches title or description, case insensitive |
| `status` | no | Must be a known status |

Both can be used together. They combine with AND.

**Response 200**
```json
[ { "id": 4, "title": "Printer offline", "priority": "High",
    "status": "Open", "assignedTo": 2, "assignedToName": "Rahul Menon",
    "createdBy": 1, "createdAt": "2026-07-20T09:14:00.000Z",
    "updatedAt": "2026-07-20T09:14:00.000Z" } ]
```

A search with no matches returns `[]` with status 200. An empty result is not
an error.

**Errors**

| Case | Code | HTTP |
|------|------|------|
| `status` is not a known status | `VALIDATION_ERROR` | 400 |

---

## POST /api/tickets

Creates a ticket. New tickets always start at `Open`; status cannot be set here.

**Request**
```json
{ "title": "Printer offline", "description": "Third floor",
  "priority": "High", "assignedTo": 2, "createdBy": 1 }
```

**Validation**

| Field | Rule |
|-------|------|
| `title` | Required. Trimmed. 1 to 200 characters |
| `description` | Optional. Up to 5000 characters |
| `priority` | Optional. `Low`, `Medium` or `High`. Defaults to `Medium` |
| `assignedTo` | Optional. Must be an existing user id |
| `createdBy` | Required. Must be an existing user id |

**Response 201** — the created ticket.

**Errors**

| Case | Code | HTTP |
|------|------|------|
| Title missing, empty or only spaces | `VALIDATION_ERROR` | 400 |
| Title over 200 characters | `VALIDATION_ERROR` | 400 |
| Priority not in the list | `VALIDATION_ERROR` | 400 |
| `assignedTo` or `createdBy` user does not exist | `VALIDATION_ERROR` | 400 |

---

## GET /api/tickets/:id

One ticket with its comments, oldest comment first.

**Response 200**
```json
{ "id": 4, "title": "Printer offline", "description": "Third floor",
  "priority": "High", "status": "Open",
  "assignedTo": 2, "assignedToName": "Rahul Menon",
  "createdBy": 1, "createdByName": "Priya Nair",
  "createdAt": "2026-07-20T09:14:00.000Z",
  "updatedAt": "2026-07-20T09:14:00.000Z",
  "allowedTransitions": ["In Progress", "Cancelled"],
  "comments": [ { "id": 9, "message": "Looking into it",
                  "createdBy": 2, "createdByName": "Rahul Menon",
                  "createdAt": "2026-07-20T10:02:00.000Z" } ] }
```

`allowedTransitions` comes from the same map the backend checks against, so
the UI cannot offer a button the backend would reject.

**Errors**

| Case | Code | HTTP |
|------|------|------|
| No ticket with that id | `NOT_FOUND` | 404 |

---

## PATCH /api/tickets/:id

Updates ticket fields. **Status cannot be changed here.**

**Request** — any subset of:
```json
{ "title": "Printer offline on 3rd floor",
  "description": "...", "priority": "Medium", "assignedTo": 3 }
```

`assignedTo` may be `null` to unassign.

Validation rules match POST. A `status` key in the body is rejected rather
than ignored, so a client cannot quietly assume it worked.

**Response 200** — the updated ticket.

**Errors**

| Case | Code | HTTP |
|------|------|------|
| No ticket with that id | `NOT_FOUND` | 404 |
| Any field fails validation | `VALIDATION_ERROR` | 400 |
| Body contains `status` | `VALIDATION_ERROR` | 400 |
| Body is empty | `VALIDATION_ERROR` | 400 |

---

## POST /api/tickets/:id/status

Changes status. This is the only way status ever changes.

**Request**
```json
{ "status": "In Progress" }
```

The current status is read from the database and the move is checked against
that. A status sent by the client is never trusted as the starting point.

**Response 200** — the updated ticket.

**Errors**

| Case | Code | HTTP |
|------|------|------|
| No ticket with that id | `NOT_FOUND` | 404 |
| `status` missing | `VALIDATION_ERROR` | 400 |
| `status` is not a known status, e.g. `"Deleted"` | `VALIDATION_ERROR` | 400 |
| Known status but not a legal move, e.g. `Open` to `Closed` | `INVALID_TRANSITION` | 409 |
| Same status as current, e.g. `Open` to `Open` | `INVALID_TRANSITION` | 409 |
| Ticket is `Closed` or `Cancelled` | `INVALID_TRANSITION` | 409 |

Example 409 body:
```json
{ "error": { "code": "INVALID_TRANSITION",
             "message": "Cannot move from Open to Closed. Allowed from Open: In Progress, Cancelled",
             "field": "status" } }
```

The difference between 400 and 409 here is deliberate. `"Deleted"` is not a
status at all, so it is malformed input. `"Closed"` is a real status that is
simply not reachable from `Open` right now, so it is a conflict with current
state.

---

## POST /api/tickets/:id/comments

Adds a comment. Comments cannot be edited or deleted.

**Request**
```json
{ "message": "Replaced the toner", "createdBy": 2 }
```

**Validation**

| Field | Rule |
|-------|------|
| `message` | Required. Trimmed. 1 to 2000 characters |
| `createdBy` | Required. Must be an existing user id |

**Response 201** — the created comment.

Comments are allowed on tickets in any status, including `Closed` and
`Cancelled`. Blocking them would hide useful context, and a comment does not
change the ticket's state.

**Errors**

| Case | Code | HTTP |
|------|------|------|
| No ticket with that id | `NOT_FOUND` | 404 |
| Message missing, empty or only spaces | `VALIDATION_ERROR` | 400 |
| `createdBy` user does not exist | `VALIDATION_ERROR` | 400 |
