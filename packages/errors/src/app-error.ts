export interface ErrorDetails {
  [key: string]: unknown;
}

export abstract class AppError extends Error {
  public abstract readonly statusCode: number;
  public abstract readonly errorCode: string;
  public readonly isOperational: boolean = true;
  public readonly details?: ErrorDetails;

  constructor(message: string, details?: ErrorDetails) {
    super(message);
    this.name = (this.constructor as { name?: string }).name || 'AppError';
    this.details = details;
    if (typeof (Error as unknown as { captureStackTrace?: (target: object, constructorOpt?: unknown) => void }).captureStackTrace === 'function') {
      (Error as unknown as { captureStackTrace: (target: object, constructorOpt?: unknown) => void }).captureStackTrace(this, this.constructor);
    }
  }

  public toJSON() {
    return {
      success: false,
      error: {
        code: this.errorCode,
        message: this.message,
        details: this.details,
      },
    };
  }
}
