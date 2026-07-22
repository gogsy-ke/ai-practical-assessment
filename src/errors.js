// One error type and one handler, so every failure leaves the API in the same
// shape. See api-contract.md.
//
//   { "error": { "code": "...", "message": "...", "field": "..." } }

export class AppError extends Error {
  constructor(code, message, { status, field = null }) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    this.field = field;
  }
}

export const notFound = (what) =>
  new AppError('NOT_FOUND', `${what} not found`, { status: 404 });

export const validationError = (message, field = null) =>
  new AppError('VALIDATION_ERROR', message, { status: 400, field });

// 409 rather than 400. The request is well formed and the status is real; it
// conflicts with the state the ticket is currently in. The frontend needs to
// tell those apart to show a useful message. See design-notes.md.
export const invalidTransition = (message) =>
  new AppError('INVALID_TRANSITION', message, { status: 409, field: 'status' });

// Must be registered last, after every route.
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({
      error: { code: err.code, message: err.message, field: err.field },
    });
  }

  // Anything reaching here was not anticipated. Log it in full, but do not
  // send internals to the client.
  console.error(err);
  return res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong',
      field: null,
    },
  });
}
