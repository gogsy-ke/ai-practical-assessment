# Spec

The single source of truth for what gets built. If something is not in here or
in acceptance-criteria.md, it does not get built.

## Scope

A support ticket system with three entities and one enforced status lifecycle.

## Behaviour

| # | Behaviour | Detail |
|---|-----------|--------|
| S1 | Create ticket | Starts at `Open`. Status cannot be set at creation |
| S2 | List tickets | Newest first |
| S3 | View ticket | Includes comments and the allowed next statuses |
| S4 | Update ticket | Title, description, priority, assignee. Not status |
| S5 | Change status | Own endpoint. Checked against stored status |
| S6 | Add comment | Append only. Allowed in any status |
| S7 | Search and filter | Keyword on title and description, plus status. Combine with AND |
| S8 | Persistence | SQLite file. Survives restart |
| S9 | Validation | Backend rejects invalid input before writing |
| S10 | Error states | UI shows the backend message, not a generic one |

## The state machine

```
Open        -> In Progress, Cancelled
In Progress -> Resolved, Cancelled
Resolved    -> Closed
Closed      -> (final)
Cancelled   -> (final)
```

Anything else is rejected with 409. Reasoning and options considered are in
design-notes.md.

## Not building

Auth, user management screens, notifications, attachments, audit log,
pagination, roles, ticket deletion.

## Linked documents

| Document | Covers |
|----------|--------|
| requirements-analysis.md | Assumptions, open questions, edge cases |
| data-model.md | Tables, types, indexes |
| api-contract.md | Endpoints and error codes |
| design-notes.md | Architecture and state machine decision |
| acceptance-criteria.md | The checklist this is measured against |
