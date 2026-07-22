// The only place that talks to the backend, and the only place that knows the
// shape of its errors. Components deal with a message and a field, never with
// a Response object or a status code.

const BASE = '/api';

// Shown whenever the backend cannot be reached, by either of the two routes
// that can happen: fetch failing outright, or the dev proxy answering 5xx
// because it could not reach the backend itself.
const UNREACHABLE =
  'Cannot reach the API server. Start it with: npm run dev:api';

export class ApiError extends Error {
  constructor({ code, message, field = null }, status = 0) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.field = field;
    this.status = status;
  }
}

async function request(path, { method = 'GET', body } = {}) {
  let response;

  // fetch only rejects when the request could not be made at all — a 400 or a
  // 500 is a normal resolved promise. Without this, a backend that is not
  // running shows up as an unhandled TypeError with no useful message.
  try {
    response = await fetch(`${BASE}${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError({ code: 'NETWORK_ERROR', message: UNREACHABLE });
  }

  if (!response.ok) {
    // The API sends { error: { code, message, field } } for every failure.
    // A proxy or a crash before the handler could still return something
    // else, so the parse is allowed to fail without hiding the status code.
    const parsed = await response.json().catch(() => null);

    if (parsed?.error) throw new ApiError(parsed.error, response.status);

    // No error body means this did not come from the API — the API always
    // sends one. A 5xx from the dev proxy means the proxy could not reach the
    // backend at all, which is the same situation as the fetch below failing.
    //
    // The catch on fetch does not cover this, because the proxy *does*
    // answer. It answers 500 with an empty text/plain body, so fetch succeeds
    // and the useful message was being skipped for "Request failed with
    // status 500". See debugging-notes.md, issue 7.
    if (response.status >= 500) {
      throw new ApiError(
        { code: 'NETWORK_ERROR', message: UNREACHABLE },
        response.status,
      );
    }

    throw new ApiError(
      {
        code: 'UNEXPECTED_ERROR',
        message: `Request failed with status ${response.status}`,
      },
      response.status,
    );
  }

  return response.json();
}

const query = (params) => {
  // Empty values are dropped so the URL does not carry ?search=&status=,
  // which the backend would have to special case.
  const search = new URLSearchParams(
    Object.entries(params).filter(([, value]) => value != null && value !== ''),
  ).toString();

  return search ? `?${search}` : '';
};

export const api = {
  getMeta: () => request('/meta'),

  listUsers: () => request('/users'),

  listTickets: ({ search, status } = {}) => request(`/tickets${query({ search, status })}`),

  getTicket: (id) => request(`/tickets/${id}`),

  createTicket: (ticket) => request('/tickets', { method: 'POST', body: ticket }),

  updateTicket: (id, changes) => request(`/tickets/${id}`, { method: 'PATCH', body: changes }),

  changeStatus: (id, status) =>
    request(`/tickets/${id}/status`, { method: 'POST', body: { status } }),

  addComment: (id, comment) =>
    request(`/tickets/${id}/comments`, { method: 'POST', body: comment }),
};
