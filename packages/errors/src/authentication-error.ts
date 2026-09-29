import { AppError, ErrorDetails } from './app-error.js';

export class AuthenticationError extends AppError {
  public readonly statusCode = 401;
  public readonly errorCode = 'AUTHENTICATION_REQUIRED';

  constructor(message: string = 'Authentication required', details?: ErrorDetails) {
    super(message, details);
  }
}
