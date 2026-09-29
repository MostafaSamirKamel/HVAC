import { AppError, ErrorDetails } from './app-error.js';

export class AuthorizationError extends AppError {
  public readonly statusCode = 403;
  public readonly errorCode = 'FORBIDDEN';

  constructor(message: string = 'You do not have permission to perform this action', details?: ErrorDetails) {
    super(message, details);
  }
}
