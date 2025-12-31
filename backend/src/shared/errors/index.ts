export class StokvelError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'StokvelError';
  }
}

export class ValidationError extends StokvelError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', 400, details);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends StokvelError {
  constructor(message: string = 'Authentication required') {
    super(message, 'AUTHENTICATION_ERROR', 401);
    this.name = 'AuthenticationError';
  }
}

export class ForbiddenError extends StokvelError {
  constructor(message: string = 'Access denied') {
    super(message, 'FORBIDDEN', 403);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends StokvelError {
  constructor(resource: string, id?: string) {
    const message = id ? `${resource} with id ${id} not found` : `${resource} not found`;
    super(message, 'NOT_FOUND', 404);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends StokvelError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'CONFLICT', 409, details);
    this.name = 'ConflictError';
  }
}

export class BusinessRuleError extends StokvelError {
  constructor(message: string, code: string, details?: Record<string, unknown>) {
    super(message, code, 422, details);
    this.name = 'BusinessRuleError';
  }
}

// Common business rule errors
export const BusinessErrors = {
  INSUFFICIENT_BALANCE: (available: string, requested: string) =>
    new BusinessRuleError(
      `Insufficient balance. Available: ${available}, Requested: ${requested}`,
      'INSUFFICIENT_BALANCE',
      { available, requested }
    ),

  CHAIRMAN_LIMIT_EXCEEDED: (type: string) =>
    new BusinessRuleError(
      `You are already chairman of a ${type} stokvel`,
      'CHAIRMAN_LIMIT_EXCEEDED',
      { stokvelType: type }
    ),

  INSUFFICIENT_APPROVALS: (required: number, current: number) =>
    new BusinessRuleError(
      `Insufficient approvals. Required: ${required}, Current: ${current}`,
      'INSUFFICIENT_APPROVALS',
      { required, current }
    ),

  DUPLICATE_APPROVAL: () =>
    new BusinessRuleError(
      'You have already approved this request',
      'DUPLICATE_APPROVAL'
    ),

  APPROVAL_EXPIRED: () =>
    new BusinessRuleError(
      'The approval window has expired',
      'APPROVAL_EXPIRED'
    ),
};
