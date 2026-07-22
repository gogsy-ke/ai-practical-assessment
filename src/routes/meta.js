import { Router } from 'express';
import { STATUSES } from '../stateMachine.js';
import { PRIORITIES } from '../validation.js';

export const metaRoutes = Router();

// The lists the UI needs to build its dropdowns.
//
// Added during code review, after finding the frontend keeping its own copies
// of both. The backend already ships the transition rule to the frontend as
// `allowedTransitions`; this is the same decision applied to the two lists
// that were still duplicated. See code-review-notes.md, findings 1 and 2.
metaRoutes.get('/', (req, res) => {
  res.json({ statuses: STATUSES, priorities: PRIORITIES });
});
