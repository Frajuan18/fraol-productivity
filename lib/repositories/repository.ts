import { resolveRepositoryMode } from '@/lib/config';
import type { ProductivityRepository } from '@/lib/repositories/ProductivityRepository';
import { LocalJsonProductivityRepository } from '@/lib/repositories/local/LocalProductivityRepository';
import { RepositoryClient } from '@/lib/repositories/client/RepositoryClient';

let cached: ProductivityRepository | null = null;

/**
 * Returns the active repository the UI talks to. In MongoDB mode it is an HTTP proxy to
 * the authenticated /api/repository gateway; otherwise the local JSON adapter preserves
 * the current behaviour. The repository contract is identical either way.
 */
export function getRepository(): ProductivityRepository {
  if (cached) return cached;
  cached = resolveRepositoryMode() === 'mongodb' ? new RepositoryClient() : new LocalJsonProductivityRepository();
  return cached;
}

export function resetRepository(): void {
  cached = null;
}
