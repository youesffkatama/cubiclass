/**
 * Custom Application Error Class
 * Provides structured error handling with HTTP status codes
 */

 export class AppError extends Error {
    public readonly statusCode: number;
    public readonly isOperational: boolean;
    public readonly code?: string;
    public readonly details?: any;
  
    constructor(
      message: string,
      statusCode: number = 500,
      isOperational: boolean = true,
      code?: string,
      details?: any
    ) {
      super(message);
      
      Object.setPrototypeOf(this, AppError.prototype);
      
      this.statusCode = statusCode;
      this.isOperational = isOperational;
      this.code = code;
      this.details = details;
      
      Error.captureStackTrace(this, this.constructor);
    }
  
    toJSON() {
      return {
        success: false,
        error: {
          message: this.message,
          code: this.code,
          statusCode: this.statusCode,
          ...(process.env.NODE_ENV === 'development' && {
            stack: this.stack,
            details: this.details
          })
        }
      };
    }
  }
  
  /**
   * Predefined error types for common scenarios
   */
  export class ValidationError extends AppError {
    constructor(message: string, details?: any) {
      super(message, 400, true, 'VALIDATION_ERROR', details);
    }
  }
  
  export class AuthenticationError extends AppError {
    constructor(message: string = 'Authentication required') {
      super(message, 401, true, 'AUTHENTICATION_ERROR');
    }
  }
  
  export class AuthorizationError extends AppError {
    constructor(message: string = 'Insufficient permissions') {
      super(message, 403, true, 'AUTHORIZATION_ERROR');
    }
  }
  
  export class NotFoundError extends AppError {
    constructor(resource: string = 'Resource') {
      super(`${resource} not found`, 404, true, 'NOT_FOUND');
    }
  }
  
  export class ConflictError extends AppError {
    constructor(message: string) {
      super(message, 409, true, 'CONFLICT_ERROR');
    }
  }
  
  export class RateLimitError extends AppError {
    constructor(message: string = 'Too many requests') {
      super(message, 429, true, 'RATE_LIMIT_EXCEEDED');
    }
  }
  
  export class ServiceUnavailableError extends AppError {
    constructor(service: string) {
      super(`${service} is temporarily unavailable`, 503, true, 'SERVICE_UNAVAILABLE');
    }
  }
  
  /**
   * Error handler utility for async routes
   */
  export const catchAsync = (fn: Function) => {
    return (req: any, res: any, next: any) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  };
  
  /**
   * Check if error is operational (expected) vs programming error
   */
  export const isOperationalError = (error: Error): boolean => {
    if (error instanceof AppError) {
      return error.isOperational;
    }
    return false;
  };