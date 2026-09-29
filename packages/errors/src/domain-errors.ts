import { AppError, ErrorDetails } from './app-error.js';

export class ValidationError extends AppError {
  public readonly statusCode = 400;
  public readonly errorCode = 'VALIDATION_ERROR';

  constructor(message: string = 'Validation failed', details?: ErrorDetails) {
    super(message, details);
  }
}

export class AuthenticationError extends AppError {
  public readonly statusCode = 401;
  public readonly errorCode = 'AUTHENTICATION_REQUIRED';

  constructor(message: string = 'Authentication required', details?: ErrorDetails) {
    super(message, details);
  }
}

export class AuthorizationError extends AppError {
  public readonly statusCode = 403;
  public readonly errorCode = 'FORBIDDEN';

  constructor(message: string = 'You do not have permission to perform this action', details?: ErrorDetails) {
    super(message, details);
  }
}

export class NotFoundError extends AppError {
  public readonly statusCode = 404;
  public readonly errorCode = 'NOT_FOUND';

  constructor(resource: string = 'Resource', id?: string) {
    super(id ? `${resource} with id '${id}' was not found` : `${resource} was not found`);
  }
}

export class ConflictError extends AppError {
  public readonly statusCode = 409;
  public readonly errorCode = 'CONFLICT';

  constructor(message: string = 'Conflict detected with existing state', details?: ErrorDetails) {
    super(message, details);
  }
}
