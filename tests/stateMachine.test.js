import { describe, it, expect } from 'vitest';
import {
  STATUSES,
  isValidStatus,
  allowedTransitions,
  canTransition,
} from '../src/stateMachine.js';

// The rule under test, from the brief:
//
//   Open         -> In Progress
//   In Progress  -> Resolved
//   Resolved     -> Closed
//   Open         -> Cancelled
//   In Progress  -> Cancelled
//
// Closed and Cancelled are final. Everything not listed is rejected.

describe('isValidStatus', () => {
  it('accepts every real status', () => {
    for (const status of STATUSES) {
      expect(isValidStatus(status)).toBe(true);
    }
  });

  it('rejects a value that is not a status at all', () => {
    expect(isValidStatus('Deleted')).toBe(false);
    expect(isValidStatus('')).toBe(false);
    expect(isValidStatus(null)).toBe(false);
    expect(isValidStatus(undefined)).toBe(false);
  });

  // Statuses are compared exactly. A near miss is not silently corrected,
  // because guessing what the caller meant hides a bug in the caller.
  it('is case sensitive and does not trim', () => {
    expect(isValidStatus('open')).toBe(false);
    expect(isValidStatus('OPEN')).toBe(false);
    expect(isValidStatus(' Open')).toBe(false);
    expect(isValidStatus('in progress')).toBe(false);
  });
});

describe('allowedTransitions', () => {
  it('returns the next statuses for each live status', () => {
    expect(allowedTransitions('Open')).toEqual(['In Progress', 'Cancelled']);
    expect(allowedTransitions('In Progress')).toEqual(['Resolved', 'Cancelled']);
    expect(allowedTransitions('Resolved')).toEqual(['Closed']);
  });

  it('returns nothing for the final statuses', () => {
    expect(allowedTransitions('Closed')).toEqual([]);
    expect(allowedTransitions('Cancelled')).toEqual([]);
  });

  it('returns nothing for an unknown status instead of throwing', () => {
    expect(allowedTransitions('Deleted')).toEqual([]);
  });

  // The list is handed to the frontend as allowedTransitions on the ticket
  // detail response. If a caller could mutate it, one request could change
  // the rule for every later request in the same process.
  it('cannot be mutated by the caller', () => {
    allowedTransitions('Open').push('Closed');
    expect(allowedTransitions('Open')).toEqual(['In Progress', 'Cancelled']);
  });
});

describe('canTransition — moves that are allowed', () => {
  const allowed = [
    ['Open', 'In Progress'],
    ['In Progress', 'Resolved'],
    ['Resolved', 'Closed'],
    ['Open', 'Cancelled'],
    ['In Progress', 'Cancelled'],
  ];

  it.each(allowed)('%s -> %s is allowed', (from, to) => {
    expect(canTransition(from, to)).toBe(true);
  });

  it('covers every allowed move in the rule', () => {
    const total = STATUSES.reduce(
      (n, status) => n + allowedTransitions(status).length,
      0,
    );
    // If someone adds a transition to the map without adding a test for it,
    // this count goes out of step and this test fails.
    expect(total).toBe(allowed.length);
  });
});

describe('canTransition — moves that are rejected', () => {
  it('rejects skipping a step forward', () => {
    expect(canTransition('Open', 'Resolved')).toBe(false);
    expect(canTransition('Open', 'Closed')).toBe(false);
    expect(canTransition('In Progress', 'Closed')).toBe(false);
  });

  it('rejects going backwards', () => {
    expect(canTransition('In Progress', 'Open')).toBe(false);
    expect(canTransition('Resolved', 'In Progress')).toBe(false);
    expect(canTransition('Resolved', 'Open')).toBe(false);
  });

  it('rejects every move out of Closed', () => {
    for (const to of STATUSES) {
      expect(canTransition('Closed', to)).toBe(false);
    }
  });

  it('rejects every move out of Cancelled', () => {
    for (const to of STATUSES) {
      expect(canTransition('Cancelled', to)).toBe(false);
    }
  });

  it('rejects cancelling once work is finished', () => {
    expect(canTransition('Resolved', 'Cancelled')).toBe(false);
    expect(canTransition('Closed', 'Cancelled')).toBe(false);
  });

  // Usually a double-clicked button. Accepting it silently would hide that,
  // and would bump updatedAt for a change that did not happen.
  it('rejects moving to the status the ticket already has', () => {
    for (const status of STATUSES) {
      expect(canTransition(status, status)).toBe(false);
    }
  });

  it('rejects a status that is not in the list at all', () => {
    expect(canTransition('Open', 'Deleted')).toBe(false);
    expect(canTransition('Deleted', 'Open')).toBe(false);
    expect(canTransition('Open', null)).toBe(false);
    expect(canTransition(undefined, 'Open')).toBe(false);
  });

  it('rejects a near miss on spelling or case', () => {
    expect(canTransition('Open', 'in progress')).toBe(false);
    expect(canTransition('Open', 'InProgress')).toBe(false);
    expect(canTransition('open', 'In Progress')).toBe(false);
  });
});

// Every pair of statuses is checked against the written rule, so a transition
// added to the map by mistake fails here even if no other test mentions it.
describe('canTransition — the whole grid', () => {
  const RULE = {
    'Open': ['In Progress', 'Cancelled'],
    'In Progress': ['Resolved', 'Cancelled'],
    'Resolved': ['Closed'],
    'Closed': [],
    'Cancelled': [],
  };

  for (const from of STATUSES) {
    for (const to of STATUSES) {
      const expected = RULE[from].includes(to);
      it(`${from} -> ${to} is ${expected ? 'allowed' : 'rejected'}`, () => {
        expect(canTransition(from, to)).toBe(expected);
      });
    }
  }
});
