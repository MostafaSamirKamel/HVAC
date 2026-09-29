import { AppError, ErrorDetails } from './app-error.js';

export class ValidationError extends AppError {
  public readonly statusCode = 400;
  public readonly errorCode = 'VALIDATION_ERROR';

  constructor(message: string = 'Validation failed', details?: ErrorDetails) {
    super(message, details);
  }
}
