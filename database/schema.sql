-- Support Ticket System — schema
-- Run by: npm run db:setup

PRAGMA foreign_keys = ON;

DROP TABLE IF EXISTS comments;
DROP TABLE IF EXISTS tickets;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  name  TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role  TEXT NOT NULL CHECK (role IN ('Admin', 'Agent', 'Requester'))
);

CREATE TABLE tickets (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT NOT NULL,
  description TEXT,
  priority    TEXT NOT NULL DEFAULT 'Medium'
              CHECK (priority IN ('Low', 'Medium', 'High')),
  -- The state machine decides which status changes are allowed.
  -- This CHECK is a second line of defence: it stops a value that is not a
  -- status at all from ever reaching the table, even by a direct SQL write.
  status      TEXT NOT NULL DEFAULT 'Open'
              CHECK (status IN ('Open', 'In Progress', 'Resolved', 'Closed', 'Cancelled')),
  assignedTo  INTEGER REFERENCES users(id),
  createdBy   INTEGER NOT NULL REFERENCES users(id),
  createdAt   TEXT NOT NULL,
  updatedAt   TEXT NOT NULL
);

CREATE TABLE comments (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  ticketId  INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  message   TEXT NOT NULL,
  createdBy INTEGER NOT NULL REFERENCES users(id),
  createdAt TEXT NOT NULL
);

-- The status filter runs on nearly every list request.
CREATE INDEX idx_tickets_status ON tickets(status);

-- Every detail view loads the comments for one ticket.
CREATE INDEX idx_comments_ticketId ON comments(ticketId);

-- No index on title or description. Search uses LIKE '%term%', and a leading
-- wildcard means SQLite cannot use an index for it. See data-model.md.
