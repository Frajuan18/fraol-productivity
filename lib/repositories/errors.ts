/**
 * Typed repository errors so the API gateway can map failures to the right HTTP status
 * and the UI can react to specific conditions (e.g. optimistic-concurrency conflicts).
 */
export class RepositoryError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(message: string, code = 'REPOSITORY_ERROR', status = 400) {
    super(message);
    this.name = 'RepositoryError';
    this.code = code;
    this.status = status;
  }
}

/** Raised when a compare-and-set (optimistic concurrency) check fails. */
export class ConflictError extends RepositoryError {
  constructor(message = 'This plan was changed by someone else. Reload and try again.') {
    super(message, 'CONFLICT', 409);
    this.name = 'ConflictError';
  }
}

export interface ErrorResponse {
  message: string;
  code: string;
  status: number;
}

export function toErrorResponse(error: unknown): ErrorResponse {
  if (error instanceof RepositoryError) {
    return { message: error.message, code: error.code, status: error.status };
  }
  const message = error instanceof Error ? error.message : 'Unknown error';
  return { message, code: 'REPOSITORY_ERROR', status: 500 };
}

export function getErrorCode(error: unknown): string | undefined {
  if (error instanceof RepositoryError) return error.code;
  if (typeof error === 'object' && error !== null && 'code' in error) {
    return (error as { code?: unknown }).code as string | undefined;
  }
  return undefined;
}
