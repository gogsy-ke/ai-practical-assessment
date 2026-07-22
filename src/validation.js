// Input validation.
//
// Every rule here runs before anything is written. The frontend does its own
// checks for convenience, but they are never the only guard — these run even
// if the API is called directly.
//
// Each function returns the cleaned value rather than just approving it, so
// callers cannot validate a trimmed string and then store the untrimmed one.

import { validationError } from './errors.js';

export const PRIORITIES = Object.freeze(['Low', 'Medium', 'High']);

export const LIMITS = Object.freeze({
  title: 200,
  description: 5000,
  message: 2000,
});

/**
 * A required piece of text.
 *
 * Trimming happens before the length check, so a title of five spaces fails as
 * empty rather than passing as five characters.
 */
export function requiredText(value, field, max) {
  if (typeof value !== 'string') {
    throw validationError(`${field} is required`, field);
  }

  const trimmed = value.trim();

  if (trimmed.length === 0) {
    throw validationError(`${field} cannot be empty`, field);
  }
  if (trimmed.length > max) {
    throw validationError(`${field} cannot be longer than ${max} characters`, field);
  }

  return trimmed;
}

/**
 * Optional text. Missing, null and empty all become null, so the column holds
 * one representation of "nothing" instead of both null and ''.
 */
export function optionalText(value, field, max) {
  if (value == null) return null;

  if (typeof value !== 'string') {
    throw validationError(`${field} must be text`, field);
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) return null;

  if (trimmed.length > max) {
    throw validationError(`${field} cannot be longer than ${max} characters`, field);
  }

  return trimmed;
}

export function validatePriority(value) {
  if (value == null) return 'Medium';

  if (!PRIORITIES.includes(value)) {
    throw validationError(
      `priority must be one of: ${PRIORITIES.join(', ')}`,
      'priority',
    );
  }

  return value;
}

/**
 * A user id.
 *
 * The type is checked here rather than left to the database lookup.
 *
 * I first assumed any bad type would make the driver throw and surface as a
 * 500. Checking that showed it is narrower than I thought. With better-sqlite3,
 * `undefined`, `'abc'` and `1.5` all bind without complaint, the lookup simply
 * finds no row, and the caller gets a clean 400 anyway. An object binds as
 * "too few parameter values" and throws, which is the case that would become
 * a 500 without this guard.
 *
 * The guard stays, because relying on a lookup returning nothing means the
 * error says "user does not exist" when the real problem is that the caller
 * sent the wrong type. Naming the actual problem is more useful.
 */
export function requiredId(value, field) {
  // The type is checked before converting. Number() is happy to turn things
  // that are not numbers into numbers: Number(true) is 1 and Number([]) is 0,
  // so a boolean would pass as the id of a real user. Only a number or a
  // string of digits is accepted.
  const looksNumeric =
    typeof value === 'number' ||
    (typeof value === 'string' && value.trim() !== '');

  const asNumber = looksNumeric ? Number(value) : NaN;

  if (!Number.isInteger(asNumber) || asNumber <= 0) {
    throw validationError(`${field} must be a valid user id`, field);
  }

  return asNumber;
}

/** Same, but null is allowed — used for unassigning a ticket. */
export function optionalId(value, field) {
  if (value == null) return null;
  return requiredId(value, field);
}
