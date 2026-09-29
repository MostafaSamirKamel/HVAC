import { AppError } from './app-error.js';

export class NotFoundError extends AppError {
  public readonly statusCode = 404;
  public readonly errorCode = 'NOT_FOUND';

  constructor(resource: string = 'Resource', id?: string) {
    super(id ? `${resource} with identifier '${id}' was not found` : `${resource} was not found`);
  }
}
