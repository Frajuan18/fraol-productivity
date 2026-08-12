// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  ConflictError,
  RepositoryError,
  getErrorCode,
  toErrorResponse,
} from '@/lib/repositories/errors';
import { assertNotStale } from '@/lib/repositories/planConcurrency';

describe('RepositoryError', () => {
  it('defaults to REPOSITORY_ERROR with status 400', () => {
    const error = new RepositoryError('boom');
    expect(error.code).toBe('REPOSITORY_ERROR');
    expect(error.status).toBe(400);
    expect(error.message).toBe('boom');
    expect(error.name).toBe('RepositoryError');
  });

  it('carries a custom code and status', () => {
    const error = new RepositoryError('no partner', 'NO_PARTNER', 409);
    expect(error.code).toBe('NO_PARTNER');
    expect(error.status).toBe(409);
  });
});

describe('ConflictError', () => {
  it('is a RepositoryError with CONFLICT/409', () => {
    const error = new ConflictError('changed elsewhere');
    expect(error).toBeInstanceOf(RepositoryError);
    expect(error.code).toBe('CONFLICT');
    expect(error.status).toBe(409);
    expect(error.message).toBe('changed elsewhere');
  });

  it('provides a sensible default message', () => {
    expect(new ConflictError().message).toMatch(/changed by someone else/i);
  });
});

describe('toErrorResponse', () => {
  it('maps RepositoryError fields verbatim', () => {
    expect(toErrorResponse(new ConflictError('nope'))).toEqual({
      message: 'nope',
      code: 'CONFLICT',
      status: 409,
    });
  });

  it('maps unknown errors to a 500 REPOSITORY_ERROR', () => {
    expect(toErrorResponse(new Error('db down'))).toEqual({
      message: 'db down',
      code: 'REPOSITORY_ERROR',
      status: 500,
    });
  });

  it('handles non-Error throws', () => {
    expect(toErrorResponse('string failure')).toEqual({
      message: 'Unknown error',
      code: 'REPOSITORY_ERROR',
      status: 500,
    });
  });
});

describe('getErrorCode', () => {
  it('reads the code off a RepositoryError', () => {
    expect(getErrorCode(new ConflictError())).toBe('CONFLICT');
  });

  it('reads the code off a plain client-side thrown error that carries a code', () => {
    const error = new Error('stale') as Error & { code?: string };
    error.code = 'CONFLICT';
    expect(getErrorCode(error)).toBe('CONFLICT');
  });

  it('returns undefined when no code is present', () => {
    expect(getErrorCode(new Error('plain'))).toBeUndefined();
  });
});

describe('assertNotStale', () => {
  it('allows a write when no expected token is supplied (best-effort)', () => {
    expect(() => assertNotStale('2026-01-02T00:00:00.000Z', undefined)).not.toThrow();
  });

  it('allows a write when the tokens match', () => {
    expect(() =>
      assertNotStale('2026-01-02T00:00:00.000Z', '2026-01-02T00:00:00.000Z'),
    ).not.toThrow();
  });

  it('rejects a stale write with a CONFLICT error', () => {
    expect(() => assertNotStale('2026-01-03T00:00:00.000Z', '2026-01-02T00:00:00.000Z')).toThrow(
      ConflictError,
    );
  });

  it('rejects when the stored token is missing but one was expected', () => {
    expect(() => assertNotStale(undefined, '2026-01-02T00:00:00.000Z')).toThrow(ConflictError);
  });
});
