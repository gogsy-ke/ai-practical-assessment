// Search, status filter, and comments.
//
// Seeded tickets these tests rely on (database/seed.sql):
//   1 Printer on 3rd floor is offline          Open
//   2 VPN disconnects every 10 minutes         In Progress
//   3 Request access to the analytics dashboard Resolved
//   4 Laptop battery replacement               Closed
//   5 Duplicate invoice email sent to customers Cancelled
//   6 Slow login on the internal portal        Open

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { setupDatabase } from '../src/db-setup.js';

const app = createApp();

const list = (query = '') => request(app).get(`/api/tickets${query}`);
const idsFrom = (res) => res.body.map((t) => t.id).sort((a, b) => a - b);

beforeEach(() => {
  setupDatabase();
});

describe('listing without filters', () => {
  it('returns every ticket', async () => {
    const res = await list();
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(6);
  });

  it('returns newest first', async () => {
    const dates = (await list()).body.map((t) => t.createdAt);
    expect([...dates].sort().reverse()).toEqual(dates);
  });
});

describe('keyword search', () => {
  it('matches on the title', async () => {
    expect(idsFrom(await list('?search=printer'))).toEqual([1]);
  });

  it('matches on the description', async () => {
    // "stairwell" appears only in ticket 1's description.
    expect(idsFrom(await list('?search=stairwell'))).toEqual([1]);
  });

  it('is case insensitive', async () => {
    expect(idsFrom(await list('?search=LOGIN'))).toEqual([6]);
    expect(idsFrom(await list('?search=login'))).toEqual([6]);
    expect(idsFrom(await list('?search=LoGiN'))).toEqual([6]);
  });

  it('matches partial words', async () => {
    expect(idsFrom(await list('?search=disconnect'))).toEqual([2]);
  });

  it('can match more than one ticket', async () => {
    // "the" appears in several descriptions.
    expect((await list('?search=the')).body.length).toBeGreaterThan(1);
  });

  it('returns an empty list when nothing matches, not an error', async () => {
    const res = await list('?search=zzzznothingmatchesthis');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('ignores an empty or whitespace search', async () => {
    expect((await list('?search=')).body).toHaveLength(6);
    expect((await list('?search=%20%20')).body).toHaveLength(6);
  });

  it('trims the search term', async () => {
    expect(idsFrom(await list('?search=%20%20printer%20%20'))).toEqual([1]);
  });
});

describe('search terms containing special characters', () => {
  const create = (title) =>
    request(app).post('/api/tickets').send({ title, createdBy: 1 });

  // Binding the term as a parameter stops it changing the SQL, but % and _
  // are still wildcards inside a LIKE pattern unless they are escaped.
  it('treats % as a literal, not a wildcard', async () => {
    await create('Disk usage at 95% on the build server');
    await create('Unrelated ticket about chairs');

    const res = await list('?search=95%25');
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toContain('95%');
  });

  it('does not let a bare % match everything', async () => {
    const res = await list('?search=%25');
    expect(res.body).toEqual([]);
  });

  it('does not let _ match any single character', async () => {
    // Without escaping, "l_gin" would match "login".
    expect(await list('?search=l_gin').then((r) => r.body)).toEqual([]);
  });

  it('treats a literal underscore as an underscore', async () => {
    await create('Rename user_id column');
    expect((await list('?search=user_id')).body).toHaveLength(1);
  });

  it('handles a quote without breaking the query', async () => {
    await create("Can't sign in to the VPN");
    const res = await list("?search=can't");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it('survives a classic injection attempt', async () => {
    const res = await list("?search='; DROP TABLE tickets; --");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
    // The table is still there.
    expect((await list()).body).toHaveLength(6);
  });
});

describe('status filter', () => {
  it('returns only tickets with that status', async () => {
    expect(idsFrom(await list('?status=Open'))).toEqual([1, 6]);
    expect(idsFrom(await list('?status=In%20Progress'))).toEqual([2]);
    expect(idsFrom(await list('?status=Cancelled'))).toEqual([5]);
  });

  it('rejects a status that does not exist rather than returning nothing', async () => {
    const res = await list('?status=Deleted');
    expect(res.status).toBe(400);
    expect(res.body.error.field).toBe('status');
  });

  it('ignores an empty status', async () => {
    expect((await list('?status=')).body).toHaveLength(6);
  });
});

describe('search and filter together', () => {
  it('narrows with both', async () => {
    // "internal" is in ticket 6 (Open) only.
    expect(idsFrom(await list('?search=internal&status=Open'))).toEqual([6]);
  });

  it('returns nothing when the two do not overlap', async () => {
    // Ticket 6 matches "login" but is Open, not Closed.
    const res = await list('?search=login&status=Closed');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe('comments', () => {
  const comment = (ticketId, body) =>
    request(app).post(`/api/tickets/${ticketId}/comments`).send(body);

  it('adds a comment', async () => {
    const res = await comment(1, { message: 'Looking into this now', createdBy: 2 });
    expect(res.status).toBe(201);
    expect(res.body.message).toBe('Looking into this now');
    expect(res.body.createdByName).toBe('Rahul Menon');
  });

  it('shows the comment on the ticket', async () => {
    await comment(1, { message: 'First note', createdBy: 2 });
    const res = await request(app).get('/api/tickets/1');
    expect(res.body.comments).toHaveLength(1);
  });

  it('returns comments oldest first', async () => {
    const res = await request(app).get('/api/tickets/2');
    const dates = res.body.comments.map((c) => c.createdAt);
    expect([...dates].sort()).toEqual(dates);
  });

  it('rejects an empty message', async () => {
    expect((await comment(1, { message: '', createdBy: 2 })).status).toBe(400);
  });

  it('rejects a message of only spaces', async () => {
    const res = await comment(1, { message: '    ', createdBy: 2 });
    expect(res.status).toBe(400);
    expect(res.body.error.field).toBe('message');
  });

  it('rejects a message over the limit', async () => {
    expect((await comment(1, { message: 'a'.repeat(2001), createdBy: 2 })).status).toBe(400);
  });

  it('rejects an author who does not exist', async () => {
    expect((await comment(1, { message: 'Hello', createdBy: 9999 })).status).toBe(400);
  });

  it('returns 404 for a ticket that does not exist', async () => {
    expect((await comment(9999, { message: 'Hello', createdBy: 1 })).status).toBe(404);
  });

  it('stores the trimmed message', async () => {
    const res = await comment(1, { message: '  padded  ', createdBy: 2 });
    expect(res.body.message).toBe('padded');
  });

  // Comments are deliberately allowed on final tickets. Blocking them would
  // hide context, and a comment does not change the ticket's state.
  it('allows a comment on a Closed ticket', async () => {
    expect((await comment(4, { message: 'For the record', createdBy: 1 })).status).toBe(201);
  });

  it('allows a comment on a Cancelled ticket', async () => {
    expect((await comment(5, { message: 'Raised in error', createdBy: 1 })).status).toBe(201);
  });
});
