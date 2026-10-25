export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new AppError(400, 'bad_request', message, details);
export const unauthorized = (message = 'Du behöver logga in för att fortsätta.') =>
  new AppError(401, 'unauthorized', message);
export const forbidden = (message = 'Du har inte behörighet att göra detta.') =>
  new AppError(403, 'forbidden', message);
export const notFound = (message = 'Hittades inte.') => new AppError(404, 'not_found', message);
export const conflict = (message: string, details?: unknown) => new AppError(409, 'conflict', message, details);
export const unprocessable = (message: string, details?: unknown) =>
  new AppError(422, 'validation_error', message, details);
export const tooManyRequests = (message = 'För många försök. Vänta en stund och försök igen.') =>
  new AppError(429, 'rate_limited', message);
