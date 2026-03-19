import { HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { ApiProperty } from "@nestjs/swagger";

// Enhanced Standard Response with metadata
export class StandardResponse<T> {
  @ApiProperty()
  public success: boolean;

  @ApiProperty()
  public message: string;

  @ApiProperty()
  public status: HttpStatus;

  @ApiProperty({ required: false })
  public data?: T;

  @ApiProperty({ required: false })
  public errors?: any;

  @ApiProperty()
  public timestamp: string;

  @ApiProperty({ required: false })
  public metadata?: {
    page?: number;
    limit?: number;
    total?: number;
    pages?: number;
    hasNext?: boolean;
    hasPrev?: boolean;
    [key: string]: any;
  };

  constructor(
    success: boolean,
    message: string,
    status: HttpStatus,
    data?: T,
    errors?: any,
    metadata?: {
      page?: number;
      limit?: number;
      total?: number;
      pages?: number;
      hasNext?: boolean;
      hasPrev?: boolean;
      [key: string]: any;
    },
  ) {
    this.success = success;
    this.message = message;
    this.status = status;
    this.data = data;
    this.errors = errors;
    this.timestamp = new Date().toISOString();
    this.metadata = metadata;
  }
}

@Injectable()
export class ResponseService {
  /**
   * Create a standardized response
   */
  Response<T>(
    success: boolean,
    message: string,
    status: HttpStatus,
    data?: T,
    errors?: any,
    metadata?: {
      page?: number;
      limit?: number;
      total?: number;
      pages?: number;
      hasNext?: boolean;
      hasPrev?: boolean;
      [key: string]: any;
    },
  ): StandardResponse<T> {
    return new StandardResponse(
      success,
      message,
      status,
      data,
      errors,
      metadata,
    );
  }

  // ============ SUCCESS RESPONSES ============
  success<T>(message: string, payload?: T): StandardResponse<T> {
    return this.Response(true, message, HttpStatus.OK, payload);
  }

  successWithMetadata<T>(
    message: string,
    payload: T,
    metadata: {
      page: number;
      limit: number;
      total: number;
      [key: string]: any;
    },
  ): StandardResponse<T> {
    const pages = Math.ceil(metadata.total / metadata.limit);
    const hasNext = metadata.page < pages;
    const hasPrev = metadata.page > 1;

    return this.Response(true, message, HttpStatus.OK, payload, undefined, {
      ...metadata,
      pages,
      hasNext,
      hasPrev,
    });
  }

  created<T>(message: string, data?: T): StandardResponse<T> {
    return this.Response(true, message, HttpStatus.CREATED, data);
  }

  accepted<T>(message: string, data?: T): StandardResponse<T> {
    return this.Response(true, message, HttpStatus.ACCEPTED, data);
  }

  noContent(message: string = "No content"): StandardResponse<null> {
    return this.Response(true, message, HttpStatus.NO_CONTENT, null);
  }

  // ============ ERROR RESPONSES ============
  error<T>(
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    errors?: any,
  ): StandardResponse<T> {
    return this.Response(false, message, status, null as T, errors);
  }

  // 4xx Client Errors
  badRequest<T>(message: string, errors?: any): StandardResponse<T> {
    return this.error(message, HttpStatus.BAD_REQUEST, errors);
  }

  unauthorized<T>(message: string = "Unauthorized"): StandardResponse<T> {
    return this.error(message, HttpStatus.UNAUTHORIZED);
  }

  forbidden<T>(message: string = "Forbidden"): StandardResponse<T> {
    return this.error(message, HttpStatus.FORBIDDEN);
  }

  notFound<T>(message: string = "Resource not found"): StandardResponse<T> {
    return this.error(message, HttpStatus.NOT_FOUND);
  }

  methodNotAllowed<T>(
    message: string = "Method not allowed",
  ): StandardResponse<T> {
    return this.error(message, HttpStatus.METHOD_NOT_ALLOWED);
  }

  conflict<T>(message: string = "Resource conflict"): StandardResponse<T> {
    return this.error(message, HttpStatus.CONFLICT);
  }

  unprocessableEntity<T>(
    message: string = "Unprocessable entity",
    errors?: any,
  ): StandardResponse<T> {
    return this.error(message, HttpStatus.UNPROCESSABLE_ENTITY, errors);
  }

  tooManyRequests<T>(
    message: string = "Too many requests",
  ): StandardResponse<T> {
    return this.error(message, HttpStatus.TOO_MANY_REQUESTS);
  }

  // 5xx Server Errors
  internalServerError<T>(
    message: string = "Internal server error",
    error?: any,
  ): StandardResponse<T> {
    return this.error(message, HttpStatus.INTERNAL_SERVER_ERROR, error);
  }

  notImplemented<T>(message: string = "Not implemented"): StandardResponse<T> {
    return this.error(message, HttpStatus.NOT_IMPLEMENTED);
  }

  badGateway<T>(message: string = "Bad gateway"): StandardResponse<T> {
    return this.error(message, HttpStatus.BAD_GATEWAY);
  }

  serviceUnavailable<T>(
    message: string = "Service unavailable",
  ): StandardResponse<T> {
    return this.error(message, HttpStatus.SERVICE_UNAVAILABLE);
  }

  gatewayTimeout<T>(message: string = "Gateway timeout"): StandardResponse<T> {
    return this.error(message, HttpStatus.GATEWAY_TIMEOUT);
  }

  // ============ BUSINESS SPECIFIC ERRORS ============
  insufficientBalance<T>(
    amount: number,
    currentBalance: number,
  ): StandardResponse<T> {
    return this.error("Insufficient balance", HttpStatus.BAD_REQUEST, {
      required: amount,
      available: currentBalance,
      deficit: amount - currentBalance,
    });
  }

  invalidTransactionPin<T>(attempts?: number): StandardResponse<T> {
    return this.error("Invalid transaction PIN", HttpStatus.UNAUTHORIZED, {
      attempts,
      message:
        attempts && attempts >= 3
          ? "Too many attempts. Account temporarily locked."
          : undefined,
    });
  }

  accountLocked<T>(reason: string, unlockTime?: Date): StandardResponse<T> {
    return this.error("Account locked", HttpStatus.FORBIDDEN, {
      reason,
      unlockTime: unlockTime?.toISOString(),
    });
  }

  expiredToken<T>(tokenType: string = "access"): StandardResponse<T> {
    return this.error(`${tokenType} token expired`, HttpStatus.UNAUTHORIZED, {
      tokenType,
      action: "refresh",
    });
  }

  invalidToken<T>(tokenType: string = "access"): StandardResponse<T> {
    return this.error(`Invalid ${tokenType} token`, HttpStatus.UNAUTHORIZED, {
      tokenType,
      action: "reauthenticate",
    });
  }

  rateLimitExceeded<T>(limit: number, resetTime: Date): StandardResponse<T> {
    return this.error("Rate limit exceeded", HttpStatus.TOO_MANY_REQUESTS, {
      limit,
      resetTime: resetTime.toISOString(),
      retryAfter: Math.ceil((resetTime.getTime() - Date.now()) / 1000),
    });
  }

  validationError<T>(errors: any): StandardResponse<T> {
    return this.error("Validation failed", HttpStatus.BAD_REQUEST, errors);
  }

  duplicateResource<T>(
    resource: string,
    field: string,
    value: any,
  ): StandardResponse<T> {
    return this.error(`${resource} already exists`, HttpStatus.CONFLICT, {
      resource,
      field,
      value,
    });
  }

  paymentFailed<T>(reason: string, reference?: string): StandardResponse<T> {
    return this.error("Payment failed", HttpStatus.PAYMENT_REQUIRED, {
      reason,
      reference,
      action: "retry_or_contact_support",
    });
  }

  // ============ HELPER METHODS ============
  fromException<T>(exception: HttpException): StandardResponse<T> {
    const response = exception.getResponse();
    const status = exception.getStatus();

    if (typeof response === "string") {
      return this.Response(false, response, status, null as T);
    } else if (typeof response === "object") {
      const { message, ...errors } = response as any;
      return this.Response(
        false,
        message || "An error occurred",
        status,
        null as T,
        errors,
      );
    }

    return this.Response(false, "An error occurred", status, null as T);
  }

  /**
   * Wraps async operations with standardized error handling
   */
  async tryCatch<T>(
    operation: () => Promise<T>,
    successMessage: string,
    errorMessage?: string,
  ): Promise<StandardResponse<T>> {
    try {
      const result = await operation();

      // If result is already a StandardResponse, return it as is
      if (
        result &&
        typeof result === "object" &&
        "success" in result &&
        "status" in result
      ) {
        return result as unknown as StandardResponse<T>;
      }

      return this.success(successMessage, result);
    } catch (error) {
      console.error("Operation failed:", error);

      if (error instanceof HttpException) {
        return this.fromException(error);
      }

      return this.internalServerError(errorMessage || "Operation failed", {
        error: error.message,
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      });
    }
  }

  /**
   * Creates a paginated response
   */
  paginated<T>(
    data: T[],
    page: number,
    limit: number,
    total: number,
    message: string = "Data retrieved successfully",
  ): StandardResponse<T[]> {
    const pages = Math.ceil(total / limit);
    const hasNext = page < pages;
    const hasPrev = page > 1;

    return this.Response(true, message, HttpStatus.OK, data, undefined, {
      page,
      limit,
      total,
      pages,
      hasNext,
      hasPrev,
    });
  }
}
