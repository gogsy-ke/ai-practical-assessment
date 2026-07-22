// The ticket status state machine.
//
// This is the only place in the codebase that decides whether a status change
// is allowed. Route handlers and services ask this module; they never decide
// for themselves. See design-notes.md for why it is built this way.
//
//   Open         -> In Progress, Cancelled
//   In Progress  -> Resolved, Cancelled
//   Resolved     -> Closed
//   Closed       -> (final)
//   Cancelled    -> (final)

const TRANSITIONS = Object.freeze({
  'Open':        Object.freeze(['In Progress', 'Cancelled']),
  'In Progress': Object.freeze(['Resolved', 'Cancelled']),
  'Resolved':    Object.freeze(['Closed']),
  'Closed':      Object.freeze([]),
  'Cancelled':   Object.freeze([]),
});

export const STATUSES = Object.freeze(Object.keys(TRANSITIONS));

/**
 * Is this a real status?
 *
 * Separate from canTransition on purpose. A status that does not exist is
 * malformed input and answers with 400. A real status that cannot be reached
 * from here is a conflict with the ticket's current state and answers with
 * 409. The caller needs to tell those apart.
 *
 * Comparison is exact. 'open' and ' Open' are rejected rather than corrected,
 * because guessing what the caller meant hides a bug in the caller.
 */
export function isValidStatus(status) {
  // The string check is not redundant. Property lookup coerces its key, so
  // Object.hasOwn(TRANSITIONS, ['Open']) is true — the array becomes the
  // string 'Open'. Without this, a JSON array reaches the transition check
  // and is rejected for the wrong reason, with a message that reads as if a
  // plain string had been sent.
  return typeof status === 'string' && Object.hasOwn(TRANSITIONS, status);
}

/**
 * The statuses a ticket can move to from here.
 *
 * Returns a copy, so a caller cannot change the rule for everyone else by
 * mutating what it was handed. This list is sent to the frontend on the
 * ticket detail response, which is how the UI knows which buttons to show.
 *
 * An unknown status returns an empty list rather than throwing. Callers use
 * this to build an error message, and that path should not need its own
 * error handling.
 */
export function allowedTransitions(from) {
  return isValidStatus(from) ? [...TRANSITIONS[from]] : [];
}

/**
 * Can a ticket move from one status to another?
 *
 * Rejects anything not written in the map above, which covers:
 *   - skipping a step, e.g. Open -> Closed
 *   - going backwards, e.g. Resolved -> In Progress
 *   - any move out of Closed or Cancelled, which are final
 *   - moving to the status the ticket already has, usually a double click
 *   - a value that is not a status at all
 */
export function canTransition(from, to) {
  return isValidStatus(from) && TRANSITIONS[from].includes(to);
}

/**
 * The message shown when a move is rejected.
 *
 * It names what was allowed instead. An error that only says "invalid
 * transition" leaves the user with no idea what to do next.
 */
export function transitionErrorMessage(from, to) {
  const allowed = allowedTransitions(from);
  return allowed.length === 0
    ? `Cannot change status. A ${from} ticket is final.`
    : `Cannot move from ${from} to ${to}. Allowed from ${from}: ${allowed.join(', ')}`;
}
