// Business rules for tickets.
//
// Route handlers call this. This module decides what is allowed; it asks
// stateMachine.js about status changes and never duplicates that rule.

import { db } from '../db.js';
import {
  isValidStatus,
  canTransition,
  allowedTransitions,
  transitionErrorMessage,
} from '../stateMachine.js';
import { notFound, validationError, invalidTransition } from '../errors.js';
import {
  requiredText,
  optionalText,
  validatePriority,
  requiredId,
  optionalId,
  LIMITS,
} from '../validation.js';

const now = () => new Date().toISOString();

// Assignee and author names are joined in so the UI does not have to fetch
// every user just to render a list.
const TICKET_SELECT = `
  SELECT t.id, t.title, t.description, t.priority, t.status,
         t.assignedTo, a.name AS assignedToName,
         t.createdBy,  c.name AS createdByName,
         t.createdAt, t.updatedAt
  FROM tickets t
  LEFT JOIN users a ON a.id = t.assignedTo
  LEFT JOIN users c ON c.id = t.createdBy
`;

function userExists(id) {
  return db.prepare('SELECT 1 FROM users WHERE id = ?').get(id) !== undefined;
}

function findTicket(id) {
  return db.prepare(`${TICKET_SELECT} WHERE t.id = ?`).get(id);
}

export function listTickets() {
  return db.prepare(`${TICKET_SELECT} ORDER BY t.createdAt DESC`).all();
}

export function getTicket(id) {
  const ticket = findTicket(id);
  if (!ticket) throw notFound('Ticket');

  const comments = db
    .prepare(
      `SELECT c.id, c.message, c.createdBy, u.name AS createdByName, c.createdAt
       FROM comments c
       LEFT JOIN users u ON u.id = c.createdBy
       WHERE c.ticketId = ?
       ORDER BY c.createdAt ASC`,
    )
    .all(id);

  // Sent so the UI can build its status buttons from the same rule the
  // backend enforces, instead of keeping its own copy that could drift.
  return { ...ticket, allowedTransitions: allowedTransitions(ticket.status), comments };
}

export function createTicket(input = {}) {
  // Shape and type first, then existence. A bad type would otherwise reach the
  // database driver, which throws in a way that surfaces as a 500 rather than
  // as the 400 this really is.
  const title = requiredText(input.title, 'title', LIMITS.title);
  const description = optionalText(input.description, 'description', LIMITS.description);
  const priority = validatePriority(input.priority);
  const assignedTo = optionalId(input.assignedTo, 'assignedTo');
  const createdBy = requiredId(input.createdBy, 'createdBy');

  if (assignedTo != null && !userExists(assignedTo)) {
    throw validationError('Assigned user does not exist', 'assignedTo');
  }
  if (!userExists(createdBy)) {
    throw validationError('Creating user does not exist', 'createdBy');
  }

  const timestamp = now();
  // Status is not accepted here. Every ticket starts at Open, and the only
  // way it moves is changeStatus below.
  const result = db
    .prepare(
      `INSERT INTO tickets
         (title, description, priority, status, assignedTo, createdBy, createdAt, updatedAt)
       VALUES (?, ?, ?, 'Open', ?, ?, ?, ?)`,
    )
    .run(title, description, priority, assignedTo, createdBy, timestamp, timestamp);

  return getTicket(result.lastInsertRowid);
}

// Each updatable field with the rule that cleans it. Keeping them in one map
// means an update runs exactly the same checks as a create — there is no
// second copy of the rules to fall out of step.
const UPDATABLE = {
  title: (v) => requiredText(v, 'title', LIMITS.title),
  description: (v) => optionalText(v, 'description', LIMITS.description),
  priority: (v) => validatePriority(v),
  assignedTo: (v) => optionalId(v, 'assignedTo'),
};

export function updateTicket(id, changes = {}) {
  if (!findTicket(id)) throw notFound('Ticket');

  // Rejected rather than ignored. A client that thinks it changed the status
  // should be told it did not, not handed back a 200 that looks like success.
  if ('status' in changes) {
    throw validationError('Status cannot be changed here. Use /status', 'status');
  }

  const fields = Object.keys(UPDATABLE).filter((f) => f in changes);
  if (fields.length === 0) throw validationError('No fields to update');

  // Validate everything before writing anything, so a request with one bad
  // field does not leave the other fields half applied.
  const cleaned = {};
  for (const field of fields) {
    cleaned[field] = UPDATABLE[field](changes[field]);
  }

  if (cleaned.assignedTo != null && !userExists(cleaned.assignedTo)) {
    throw validationError('Assigned user does not exist', 'assignedTo');
  }

  const assignments = fields.map((f) => `${f} = ?`).join(', ');
  const values = fields.map((f) => cleaned[f]);

  db.prepare(`UPDATE tickets SET ${assignments}, updatedAt = ? WHERE id = ?`)
    .run(...values, now(), id);

  return getTicket(id);
}

export function changeStatus(id, nextStatus) {
  const ticket = findTicket(id);
  if (!ticket) throw notFound('Ticket');

  // Not a status at all is malformed input, so 400. This is checked before
  // the transition rule so the caller gets the more specific answer.
  if (!isValidStatus(nextStatus)) {
    throw validationError(`'${nextStatus}' is not a valid status`, 'status');
  }

  // The check runs against the status stored in the database, never one sent
  // by the client. If two people press a button at the same time, the second
  // request is judged against the status the first one left behind.
  if (!canTransition(ticket.status, nextStatus)) {
    throw invalidTransition(transitionErrorMessage(ticket.status, nextStatus));
  }

  db.prepare('UPDATE tickets SET status = ?, updatedAt = ? WHERE id = ?')
    .run(nextStatus, now(), id);

  return getTicket(id);
}
