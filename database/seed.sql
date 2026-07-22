-- Support Ticket System — seed data
-- Run by: npm run db:setup, after schema.sql
--
-- Timestamps are fixed rather than generated so the seeded database is the
-- same on every machine. That keeps test expectations stable.

INSERT INTO users (id, name, email, role) VALUES
  (1, 'Priya Nair',  'priya.nair@example.com',  'Admin'),
  (2, 'Rahul Menon', 'rahul.menon@example.com', 'Agent'),
  (3, 'Aisha Khan',  'aisha.khan@example.com',  'Agent'),
  (4, 'Vikram Rao',  'vikram.rao@example.com',  'Requester');

-- Six tickets covering all five statuses, so every state can be demonstrated
-- without changing anything first. Two are Open because that is the state
-- most screens are exercised from.
INSERT INTO tickets
  (id, title, description, priority, status, assignedTo, createdBy, createdAt, updatedAt) VALUES

  (1, 'Printer on 3rd floor is offline',
      'The shared printer near the east stairwell does not appear for anyone on the third floor. Power light is on.',
      'High', 'Open', 2, 4, '2026-07-14T09:12:00.000Z', '2026-07-14T09:12:00.000Z'),

  (2, 'VPN disconnects every 10 minutes',
      'Connection drops roughly every ten minutes and has to be started again. Started after the client update on Monday.',
      'High', 'In Progress', 3, 4, '2026-07-15T11:40:00.000Z', '2026-07-16T08:05:00.000Z'),

  (3, 'Request access to the analytics dashboard',
      'Need read access to the analytics dashboard for the quarterly report.',
      'Low', 'Resolved', 2, 4, '2026-07-10T15:22:00.000Z', '2026-07-13T10:31:00.000Z'),

  (4, 'Laptop battery replacement',
      'Battery holds charge for about twenty minutes. Laptop is two years old.',
      'Medium', 'Closed', 3, 1, '2026-07-02T08:55:00.000Z', '2026-07-09T16:44:00.000Z'),

  (5, 'Duplicate invoice email sent to customers',
      'A batch of invoice emails went out twice. Raised in error, the mail service had already been fixed.',
      'Low', 'Cancelled', NULL, 4, '2026-07-11T13:05:00.000Z', '2026-07-11T17:20:00.000Z'),

  (6, 'Slow login on the internal portal',
      'Signing in to the internal portal takes around thirty seconds. Other pages load normally once signed in.',
      'Medium', 'Open', NULL, 1, '2026-07-17T10:03:00.000Z', '2026-07-17T10:03:00.000Z');

-- Comments on two tickets, so the detail view has something to show and the
-- ordering can be checked.
INSERT INTO comments (id, ticketId, message, createdBy, createdAt) VALUES
  (1, 2, 'Reproduced on my machine. Looks like it started with the client update.', 3, '2026-07-15T14:10:00.000Z'),
  (2, 2, 'Rolled back the client on one laptop to confirm. Stayed connected for an hour.', 3, '2026-07-16T08:05:00.000Z'),
  (3, 3, 'Access granted. Please confirm you can see the dashboard.', 2, '2026-07-13T09:58:00.000Z'),
  (4, 3, 'Confirmed, it loads for me now. Thanks.', 4, '2026-07-13T10:31:00.000Z');

-- AUTOINCREMENT keeps its own counter, so it has to be told where the seeded
-- ids stopped. Without this the first inserted row reuses id 1 and the insert
-- fails on the primary key.
UPDATE sqlite_sequence SET seq = 4 WHERE name = 'users';
UPDATE sqlite_sequence SET seq = 6 WHERE name = 'tickets';
UPDATE sqlite_sequence SET seq = 4 WHERE name = 'comments';
