# Data Model

Three tables. SQLite.

## User

Seeded only. There is no screen to create or edit users.

| Field | Type | Null | Notes |
|-------|------|------|-------|
| id | INTEGER | no | Primary key |
| name | TEXT | no | Shown in the UI |
| email | TEXT | no | Unique |
| role | TEXT | no | `Admin`, `Agent` or `Requester` |

`role` is stored and displayed but no permission rules use it. Role-based
access is a Stretch item and is not implemented.

## Ticket

| Field | Type | Null | Notes |
|-------|------|------|-------|
| id | INTEGER | no | Primary key |
| title | TEXT | no | 1 to 200 characters after trimming |
| description | TEXT | yes | Optional |
| priority | TEXT | no | `Low`, `Medium` or `High`. Defaults to `Medium` |
| status | TEXT | no | Starts at `Open`. Only the state machine changes it |
| assignedTo | INTEGER | yes | References `User.id` |
| createdBy | INTEGER | no | References `User.id` |
| createdAt | TEXT | no | ISO timestamp |
| updatedAt | TEXT | no | ISO timestamp, updated on every write |

`assignedTo` is nullable on purpose. A ticket usually exists before anyone
picks it up. Forcing an assignee would mean inventing a fake default user.

`priority` values are not in the brief, so `Low` / `Medium` / `High` is an
assumption. Three levels are enough to demo filtering without adding noise.

## Comment

| Field | Type | Null | Notes |
|-------|------|------|-------|
| id | INTEGER | no | Primary key |
| ticketId | INTEGER | no | References `Ticket.id`, cascade on delete |
| message | TEXT | no | 1 to 2000 characters after trimming |
| createdBy | INTEGER | no | References `User.id` |
| createdAt | TEXT | no | ISO timestamp |

Comments are append-only. There is no update or delete. A comment is a record
of what was said, so editing it would change history.

## Indexes

| Index | Reason |
|-------|--------|
| `ticket(status)` | The status filter runs on almost every list request |
| `comment(ticketId)` | Every detail view loads the comments for one ticket |

Search runs on `title` and `description` with a `LIKE '%term%'` pattern. A
leading wildcard means an index cannot be used, so there is no index for it.
At this data size a full scan is fine. If the table grew large the fix would
be SQLite's FTS5 full-text search, not a normal index. That is noted here so
the limitation is a known decision rather than an oversight.

## Why status is TEXT and not an integer

Integers would be smaller, but reading the database directly during debugging
is much easier when the status says `In Progress` instead of `2`. The valid
values are enforced by the state machine and a `CHECK` constraint, so the
looser type does not let bad data in.

## Timestamps

Stored as ISO 8601 strings in UTC. SQLite has no real date type. Strings in
this format sort correctly as text, which is all the app needs.
