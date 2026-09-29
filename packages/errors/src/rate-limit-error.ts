import { AppError, ErrorDetails } from './app-error.js';

export class RateLimitExceededError extends AppError {
  public readonly statusCode = 429;
  public readonly errorCode = 'RATE_LIMIT_EXCEEDED';

  constructor(message: string = 'Too many requests. Please try again later.', details?: ErrorDetails) {
    super(message, details);
  }
}
