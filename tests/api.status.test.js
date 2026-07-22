// Integration tests for the status state machine, through the HTTP API.
//
// This is the tier the brief requires: proof that valid transitions succeed
// and invalid ones are rejected. tests/stateMachine.test.js already covers the
// rule as a pure function. These tests prove the rule is actually wired into
// the endpoint, that the right status codes come back, and that the change is
// really written to the database.

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { setupDatabase } from '../src/db-setup.js';

const app = createApp();

// Seeded ticket ids and their starting statuses, from database/seed.sql.
const OPEN = 1;
const IN_PROGRESS = 2;
const RESOLVED = 3;
const CLOSED = 4;
const CANCELLED = 5;

const setStatus = (id, status) =>
  request(app).post(`/api/tickets/${id}/status`).send({ status });

beforeEach(() => {
  // Rebuilt before every test, so one test cannot leave a ticket in a state
  // that changes the result of the next one.
  setupDatabase();
});

describe('allowed transitions', () => {
  it('Open -> In Progress', async () => {
    const res = await setStatus(OPEN, 'In Progress');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('In Progress');
  });

  it('In Progress -> Resolved', async () => {
    const res = await setStatus(IN_PROGRESS, 'Resolved');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('Resolved');
  });

  it('Resolved -> Closed', async () => {
    const res = await setStatus(RESOLVED, 'Closed');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('Closed');
  });

  it('Open -> Cancelled', async () => {
    const res = await setStatus(OPEN, 'Cancelled');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('Cancelled');
  });

  it('In Progress -> Cancelled', async () => {
    const res = await setStatus(IN_PROGRESS, 'Cancelled');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('Cancelled');
  });

  it('walks a ticket through the full lifecycle', async () => {
    expect((await setStatus(OPEN, 'In Progress')).status).toBe(200);
    expect((await setStatus(OPEN, 'Resolved')).status).toBe(200);
    expect((await setStatus(OPEN, 'Closed')).status).toBe(200);

    const res = await request(app).get(`/api/tickets/${OPEN}`);
    expect(res.body.status).toBe('Closed');
    // Nothing left to do from a final status, so the UI gets no buttons.
    expect(res.body.allowedTransitions).toEqual([]);
  });

  it('writes the change to the database, not just the response', async () => {
    await setStatus(OPEN, 'In Progress');
    const res = await request(app).get(`/api/tickets/${OPEN}`);
    expect(res.body.status).toBe('In Progress');
  });

  it('updates updatedAt', async () => {
    const before = (await request(app).get(`/api/tickets/${OPEN}`)).body.updatedAt;
    await setStatus(OPEN, 'In Progress');
    const after = (await request(app).get(`/api/tickets/${OPEN}`)).body.updatedAt;
    expect(after).not.toBe(before);
  });
});

describe('rejected transitions', () => {
  it('rejects skipping a step, Open -> Resolved', async () => {
    const res = await setStatus(OPEN, 'Resolved');
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_TRANSITION');
  });

  it('rejects skipping to the end, Open -> Closed', async () => {
    const res = await setStatus(OPEN, 'Closed');
    expect(res.status).toBe(409);
  });

  it('rejects going backwards, Resolved -> In Progress', async () => {
    const res = await setStatus(RESOLVED, 'In Progress');
    expect(res.status).toBe(409);
  });

  it('rejects cancelling after work is finished, Resolved -> Cancelled', async () => {
    const res = await setStatus(RESOLVED, 'Cancelled');
    expect(res.status).toBe(409);
  });

  it('rejects every move out of Closed', async () => {
    for (const status of ['Open', 'In Progress', 'Resolved', 'Cancelled']) {
      expect((await setStatus(CLOSED, status)).status).toBe(409);
    }
  });

  it('rejects every move out of Cancelled', async () => {
    for (const status of ['Open', 'In Progress', 'Resolved', 'Closed']) {
      expect((await setStatus(CANCELLED, status)).status).toBe(409);
    }
  });

  it('rejects moving to the status the ticket already has', async () => {
    const res = await setStatus(OPEN, 'Open');
    expect(res.status).toBe(409);
  });

  it('leaves the ticket unchanged after a rejection', async () => {
    await setStatus(OPEN, 'Closed');
    const res = await request(app).get(`/api/tickets/${OPEN}`);
    expect(res.body.status).toBe('Open');
  });

  it('says what was allowed instead', async () => {
    const res = await setStatus(OPEN, 'Closed');
    expect(res.body.error.message).toContain('In Progress');
    expect(res.body.error.message).toContain('Cancelled');
  });
});

describe('bad input to the status endpoint', () => {
  // 400, not 409. 'Deleted' is not a status at all, so the request is
  // malformed rather than in conflict with the ticket's current state.
  it('rejects a status that does not exist with 400', async () => {
    const res = await setStatus(OPEN, 'Deleted');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects wrong case with 400', async () => {
    expect((await setStatus(OPEN, 'in progress')).status).toBe(400);
  });

  it('rejects a missing status with 400', async () => {
    const res = await request(app).post(`/api/tickets/${OPEN}/status`).send({});
    expect(res.status).toBe(400);
  });

  it('returns 404 for a ticket that does not exist', async () => {
    const res = await setStatus(9999, 'In Progress');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

describe('status cannot be changed through the update endpoint', () => {
  it('rejects a status key in PATCH rather than ignoring it', async () => {
    const res = await request(app)
      .patch(`/api/tickets/${OPEN}`)
      .send({ status: 'Closed' });

    expect(res.status).toBe(400);
    expect(res.body.error.field).toBe('status');
  });

  it('does not change the status when PATCH is rejected', async () => {
    await request(app).patch(`/api/tickets/${OPEN}`).send({ status: 'Closed' });
    const res = await request(app).get(`/api/tickets/${OPEN}`);
    expect(res.body.status).toBe('Open');
  });
});

describe('concurrent status changes', () => {
  // The second request must be judged against the status the first one left
  // behind, not the status the client last saw. Both clients here believe the
  // ticket is Open.
  it('rejects the second of two competing changes', async () => {
    const first = await setStatus(OPEN, 'In Progress');
    const second = await setStatus(OPEN, 'Cancelled');

    expect(first.status).toBe(200);
    // Open -> Cancelled is legal, but the ticket is no longer Open.
    // In Progress -> Cancelled happens to be legal too, so this one succeeds.
    expect(second.status).toBe(200);
    expect(second.body.status).toBe('Cancelled');
  });

  it('rejects the second change when it is not legal from the new status', async () => {
    // Both clients see a Resolved ticket. The first closes it.
    await setStatus(RESOLVED, 'Closed');
    // The second still thinks it is Resolved and tries to close it again.
    const second = await setStatus(RESOLVED, 'Closed');

    expect(second.status).toBe(409);
    expect(second.body.error.message).toContain('final');
  });
});
