import { HttpException, HttpStatus } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';

// Custom Exception Types for better error categorization
export class BusinessException extends HttpException {
  constructor(message: string, status: HttpStatus = HttpStatus.BAD_REQUEST) {
    super({ message, timestamp: new Date().toISOString() }, status);
  }
}

export class ValidationException extends HttpException {
  constructor(errors: any, message: string = 'Validation failed') {
    super(
      { message, errors, timestamp: new Date().toISOString() },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class AuthenticationException extends HttpException {
  constructor(message: string = 'Authentication failed') {
    super(
      { message, timestamp: new Date().toISOString() },
      HttpStatus.UNAUTHORIZED,
    );
  }
}

export class AuthorizationException extends HttpException {
  constructor(message: string = 'Insufficient permissions') {
    super(
      { message, timestamp: new Date().toISOString() },
      HttpStatus.FORBIDDEN,
    );
  }
}

export class ResourceNotFoundException extends HttpException {
  constructor(resource: string, id?: string) {
    const message = id
      ? `${resource} with ID ${id} not found`
      : `${resource} not found`;
    super(
      { message, timestamp: new Date().toISOString() },
      HttpStatus.NOT_FOUND,
    );
  }
}

export class ConflictException extends HttpException {
  constructor(message: string = 'Resource conflict') {
    super(
      { message, timestamp: new Date().toISOString() },
      HttpStatus.CONFLICT,
    );
  }
}

export class RateLimitException extends HttpException {
  constructor(message: string = 'Too many requests') {
    super(
      { message, timestamp: new Date().toISOString() },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

export class ExternalServiceException extends HttpException {
  constructor(service: string, error: any) {
    super(
      {
        message: `${service} service unavailable`,
        error: error.message || 'Service error',
        timestamp: new Date().toISOString(),
      },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}

export class DatabaseException extends HttpException {
  constructor(error: any) {
    super(
      {
        message: 'Database operation failed',
        error: error.message || 'Database error',
        timestamp: new Date().toISOString(),
      },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}

export class PaymentException extends HttpException {
  constructor(message: string, code?: string) {
    super(
      {
        message,
        code,
        timestamp: new Date().toISOString(),
      },
      HttpStatus.PAYMENT_REQUIRED,
    );
  }
}