// Regression tests for bugs found by probing the running API, not by the
// test suite. Each one returned a 500 or the wrong diagnosis before the fix.
// See debugging-notes.md issues 4, 5 and 6.

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { setupDatabase } from '../src/db-setup.js';
import { isValidStatus } from '../src/stateMachine.js';

const app = createApp();

beforeEach(() => {
  setupDatabase();
});

describe('malformed request bodies', () => {
  // express.json() throws a SyntaxError, which reached the error handler as an
  // unexpected error and was reported as a 500 — blaming the server for a
  // request the client sent wrong.
  it('returns 400 for a body that is not valid JSON', async () => {
    const res = await request(app)
      .post('/api/tickets')
      .set('Content-Type', 'application/json')
      .send('{"title": "broken');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toContain('JSON');
  });

  it('does not leak a parser stack trace', async () => {
    const res = await request(app)
      .post('/api/tickets')
      .set('Content-Type', 'application/json')
      .send('{oops}');

    expect(JSON.stringify(res.body)).not.toContain('body-parser');
    expect(JSON.stringify(res.body)).not.toContain('at ');
  });

  // A default parameter only fills in for undefined. A body of `null` parses
  // to null, slipped past `input = {}`, and threw on the first property read.
  it('returns 400 for a body of null', async () => {
    const res = await request(app)
      .post('/api/tickets')
      .set('Content-Type', 'application/json')
      .send('null');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 for a null body on update', async () => {
    const res = await request(app)
      .patch('/api/tickets/1')
      .set('Content-Type', 'application/json')
      .send('null');

    expect(res.status).toBe(400);
  });

  it('returns 400 for a null body on comments', async () => {
    const res = await request(app)
      .post('/api/tickets/1/comments')
      .set('Content-Type', 'application/json')
      .send('null');

    expect(res.status).toBe(400);
  });

  it('handles a JSON array where an object was expected', async () => {
    const res = await request(app).post('/api/tickets').send([1, 2, 3]);
    expect(res.status).toBe(400);
  });
});

describe('status values that are not strings', () => {
  // Property lookup coerces its key, so Object.hasOwn(TRANSITIONS, ['Open'])
  // is true — the array becomes the string 'Open'. The array then failed the
  // transition check instead, producing a 409 whose message read
  // "Cannot move from Open to Open", as if a plain string had been sent.
  it('rejects an array as a status value', () => {
    expect(isValidStatus(['Open'])).toBe(false);
    expect(isValidStatus(['In Progress'])).toBe(false);
  });

  it('rejects other non-string types', () => {
    expect(isValidStatus(3)).toBe(false);
    expect(isValidStatus({})).toBe(false);
    expect(isValidStatus(true)).toBe(false);
  });

  it('returns 400 with the right diagnosis, not 409', async () => {
    const res = await request(app)
      .post('/api/tickets/1/status')
      .send({ status: ['In Progress'] });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('does not change the ticket', async () => {
    await request(app).post('/api/tickets/1/status').send({ status: ['In Progress'] });
    const res = await request(app).get('/api/tickets/1');
    expect(res.body.status).toBe('Open');
  });
});

describe('input that is unusual but legitimate', () => {
  const create = (body) => request(app).post('/api/tickets').send(body);

  it('accepts emoji', async () => {
    const res = await create({ title: 'Printer broken 🖨️ again', createdBy: 1 });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Printer broken 🖨️ again');
  });

  it('accepts accented and non-ASCII text', async () => {
    const res = await create({ title: 'Impresora rota — tercera vez', createdBy: 1 });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Impresora rota — tercera vez');
  });

  it('keeps newlines in a description', async () => {
    const res = await create({ title: 'Multi line', description: 'one\ntwo', createdBy: 1 });
    expect(res.body.description).toBe('one\ntwo');
  });

  // Stored exactly as sent. React escapes it on the way out, so it renders as
  // text rather than markup. Escaping on the way in would corrupt a title that
  // legitimately mentions a tag.
  it('stores HTML as text without altering it', async () => {
    const title = '<img src=x onerror=alert(1)>';
    const res = await create({ title, createdBy: 1 });
    expect(res.body.title).toBe(title);
  });
});

describe('unusual ids and query parameters', () => {
  it('returns 404 rather than 500 for odd ticket ids', async () => {
    for (const id of ['-1', '0', '1.5', '999999999999999999999', 'abc', '1%20OR%201=1']) {
      const res = await request(app).get(`/api/tickets/${id}`);
      expect(res.status).toBe(404);
    }
  });

  it('handles a repeated query parameter without crashing', async () => {
    // Express parses a repeated parameter into an array. Search ignores a
    // non-string; the status filter rejects it as an invalid status.
    expect((await request(app).get('/api/tickets?search=a&search=b')).status).toBe(200);
    expect((await request(app).get('/api/tickets?status=Open&status=Closed')).status).toBe(400);
  });

  it('handles a very long search term', async () => {
    const res = await request(app).get(`/api/tickets?search=${'a'.repeat(2000)}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});
