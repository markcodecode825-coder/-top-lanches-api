export type AppErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'PRODUCT_NOT_FOUND'
  | 'CATEGORY_NOT_FOUND'
  | 'ORDER_NOT_FOUND'
  | 'PRODUCT_UNAVAILABLE'
  | 'INVALID_PAYMENT_METHOD'
  | 'INVALID_SERVICE_MODE'
  | 'INVALID_ORDER_STATUS'
  | 'INVALID_STATUS_TRANSITION'
  | 'BUSINESS_CLOSED'
  | 'DUPLICATE_REQUEST'
  | 'RATE_LIMIT_EXCEEDED'
  | 'INTERNAL_SERVER_ERROR'
  | 'BUSINESS_NOT_FOUND'
  | 'ADMIN_NOT_FOUND'
  | 'CONFLICT'
  | 'NOT_FOUND'
  | 'WHATSAPP_NOT_CONFIGURED'
  | 'WHATSAPP_SIGNATURE_INVALID'
  | 'WHATSAPP_API_ERROR';

export class AppError extends Error {
  constructor(
    public readonly code: AppErrorCode,
    public readonly statusCode: number,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }
}
