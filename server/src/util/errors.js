export class HttpError extends Error {
  constructor(status, message, details = null) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

// Centraliserad felhanterare. Döljer interna detaljer men vidarebefordrar valideringsdetaljer.
export function errorHandler(err, _req, res, _next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }
  if (err?.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    return res.status(409).json({ error: 'Resursen finns redan.' });
  }
  // eslint-disable-next-line no-console
  console.error('[fel]', err);
  res.status(500).json({ error: 'Ett internt fel uppstod. Försök igen.' });
}
