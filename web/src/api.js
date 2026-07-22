// The only place that talks to the backend, and the only place that knows the
// shape of its errors. Components deal with a message and a field, never with
// a Response object or a status code.

const BASE = '/api';

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
    throw new ApiError({
      code: 'NETWORK_ERROR',
      message: 'Cannot reach the server. Is the API running on port 3001?',
    });
  }

  if (!response.ok) {
    // The API sends { error: { code, message, field } } for every failure.
    // A proxy or a crash before the handler could still return HTML, so the
    // parse is allowed to fail without hiding the real status code.
    const parsed = await response.json().catch(() => null);

    throw new ApiError(
      parsed?.error ?? {
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
