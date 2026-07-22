// Validation and error handling, through the HTTP API.
//
// Every case here comes from the edge case list in requirements-analysis.md.
// The point is that the backend rejects bad input on its own, without help
// from the frontend.

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { setupDatabase } from '../src/db-setup.js';

const app = createApp();

const createTicket = (body) => request(app).post('/api/tickets').send(body);
const valid = { title: 'A real ticket', createdBy: 1 };

beforeEach(() => {
  setupDatabase();
});

describe('title', () => {
  it('accepts a normal title', async () => {
    const res = await createTicket(valid);
    expect(res.status).toBe(201);
  });

  it('rejects a missing title', async () => {
    const res = await createTicket({ createdBy: 1 });
    expect(res.status).toBe(400);
    expect(res.body.error.field).toBe('title');
  });

  it('rejects an empty title', async () => {
    expect((await createTicket({ ...valid, title: '' })).status).toBe(400);
  });

  // Trimming has to happen before the length check, or five spaces passes as
  // five characters.
  it('rejects a title of only spaces', async () => {
    const res = await createTicket({ ...valid, title: '     ' });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('empty');
  });

  it('rejects a title over 200 characters', async () => {
    const res = await createTicket({ ...valid, title: 'a'.repeat(201) });
    expect(res.status).toBe(400);
  });

  it('accepts a title of exactly 200 characters', async () => {
    expect((await createTicket({ ...valid, title: 'a'.repeat(200) })).status).toBe(201);
  });

  it('rejects a title that is not text', async () => {
    expect((await createTicket({ ...valid, title: 123 })).status).toBe(400);
    expect((await createTicket({ ...valid, title: null })).status).toBe(400);
    expect((await createTicket({ ...valid, title: { a: 1 } })).status).toBe(400);
  });

  it('stores the trimmed title, not the raw one', async () => {
    const res = await createTicket({ ...valid, title: '  Padded title  ' });
    expect(res.body.title).toBe('Padded title');
  });
});

describe('priority', () => {
  it('defaults to Medium when not given', async () => {
    const res = await createTicket(valid);
    expect(res.body.priority).toBe('Medium');
  });

  it('accepts every allowed value', async () => {
    for (const priority of ['Low', 'Medium', 'High']) {
      expect((await createTicket({ ...valid, priority })).status).toBe(201);
    }
  });

  it('rejects a value outside the list', async () => {
    const res = await createTicket({ ...valid, priority: 'Urgent' });
    expect(res.status).toBe(400);
    expect(res.body.error.field).toBe('priority');
  });

  it('rejects wrong case', async () => {
    expect((await createTicket({ ...valid, priority: 'high' })).status).toBe(400);
  });
});

describe('user references', () => {
  it('rejects a createdBy that does not exist', async () => {
    const res = await createTicket({ ...valid, createdBy: 9999 });
    expect(res.status).toBe(400);
    expect(res.body.error.field).toBe('createdBy');
  });

  it('rejects an assignedTo that does not exist', async () => {
    const res = await createTicket({ ...valid, assignedTo: 9999 });
    expect(res.status).toBe(400);
    expect(res.body.error.field).toBe('assignedTo');
  });

  it('allows a ticket with no assignee', async () => {
    const res = await createTicket({ ...valid, assignedTo: null });
    expect(res.status).toBe(201);
    expect(res.body.assignedTo).toBeNull();
  });

  it('rejects a missing createdBy', async () => {
    const res = await createTicket({ title: 'No author' });
    expect(res.status).toBe(400);
  });

  // An object is the case that matters most here. Bound straight to a query
  // it makes the driver throw, which would come back as a 500 for what is
  // really bad input. The others are caught by the lookup either way, but
  // the guard makes the message name the real problem.
  it('rejects a createdBy that is not a number with 400, not 500', async () => {
    for (const createdBy of ['abc', {}, 1.5, [], true]) {
      const res = await createTicket({ ...valid, createdBy });
      expect(res.status).toBe(400);
      expect(res.body.error.field).toBe('createdBy');
    }
  });
});

describe('update', () => {
  it('applies the same title rules as create', async () => {
    const res = await request(app).patch('/api/tickets/1').send({ title: '   ' });
    expect(res.status).toBe(400);
  });

  it('applies the same priority rules as create', async () => {
    const res = await request(app).patch('/api/tickets/1').send({ priority: 'Urgent' });
    expect(res.status).toBe(400);
  });

  it('rejects an empty body', async () => {
    const res = await request(app).patch('/api/tickets/1').send({});
    expect(res.status).toBe(400);
  });

  it('allows unassigning', async () => {
    const res = await request(app).patch('/api/tickets/1').send({ assignedTo: null });
    expect(res.status).toBe(200);
    expect(res.body.assignedTo).toBeNull();
  });

  // A request with one good field and one bad field must change nothing.
  // Validating everything before writing is what makes this hold.
  it('does not apply a partial update when one field is invalid', async () => {
    const before = (await request(app).get('/api/tickets/1')).body.title;

    const res = await request(app)
      .patch('/api/tickets/1')
      .send({ title: 'A perfectly good new title', priority: 'Urgent' });

    expect(res.status).toBe(400);
    expect((await request(app).get('/api/tickets/1')).body.title).toBe(before);
  });
});

describe('not found and unknown routes', () => {
  it('returns 404 for a ticket that does not exist', async () => {
    const res = await request(app).get('/api/tickets/9999');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 404 for a non-numeric ticket id, not 500', async () => {
    const res = await request(app).get('/api/tickets/abc');
    expect(res.status).toBe(404);
  });

  it('returns 404 for an unknown route in the same error shape', async () => {
    const res = await request(app).get('/api/nothing-here');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

describe('error shape', () => {
  it('is the same for every kind of failure', async () => {
    const responses = [
      await createTicket({}),
      await request(app).get('/api/tickets/9999'),
      await request(app).post('/api/tickets/1/status').send({ status: 'Closed' }),
    ];

    for (const res of responses) {
      expect(res.body).toHaveProperty('error.code');
      expect(res.body).toHaveProperty('error.message');
      expect(res.body).toHaveProperty('error.field');
      expect(typeof res.body.error.message).toBe('string');
    }
  });

  it('never leaks a stack trace to the client', async () => {
    const res = await createTicket({});
    expect(JSON.stringify(res.body)).not.toContain('at ');
  });
});
