import { AppError, ErrorDetails } from './app-error.js';

export class ConflictError extends AppError {
  public readonly statusCode = 409;
  public readonly errorCode = 'CONFLICT';

  constructor(message: string = 'Conflict detected with existing state', details?: ErrorDetails) {
    super(message, details);
  }
}
