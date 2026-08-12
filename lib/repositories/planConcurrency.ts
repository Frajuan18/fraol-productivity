import { ConflictError } from '@/lib/repositories/errors';

/**
 * Optimistic-concurrency guard for shared plan documents. Callers pass the `updatedAt`
 * token they last saw; if the stored token moved on, the write is stale and is rejected
 * so concurrent editors never silently overwrite each other.
 */
export function assertNotStale(currentUpdatedAt: string | undefined, expectedUpdatedAt: string | undefined): void {
  if (expectedUpdatedAt !== undefined && currentUpdatedAt !== expectedUpdatedAt) {
    throw new ConflictError();
  }
}
