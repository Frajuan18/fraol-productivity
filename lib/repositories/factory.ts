import { resolveRepositoryMode } from '@/lib/config';
import type { ProductivityRepository } from '@/lib/repositories/ProductivityRepository';
import { LocalJsonProductivityRepository } from '@/lib/repositories/local/LocalProductivityRepository';
import { createMongoDbRepository } from '@/lib/repositories/mongodb/MongoDbProductivityRepository';

let cachedRepository: ProductivityRepository | null = null;

/**
 * Creates the active repository.
 * - 'mongodb'  → MongoDbProductivityRepository (production source of truth; image
 *   binaries in the `chatSnapshots` GridFS bucket).
 * - 'local'    → LocalJsonProductivityRepository (development fallback; preserves the
 *   current JSON behaviour and keeps storage/data.json intact).
 * The app stays usable when MongoDB is not configured: the factory degrades to local.
 */
export function createRepository(): ProductivityRepository {
  if (cachedRepository) return cachedRepository;

  if (resolveRepositoryMode() === 'mongodb') {
    const mongo = createMongoRepository();
    if (mongo) {
      cachedRepository = mongo;
      return mongo;
    }
  }

  cachedRepository = new LocalJsonProductivityRepository();
  return cachedRepository;
}

function createMongoRepository(): ProductivityRepository | null {
  try {
    // The adapter is only constructable when MONGODB_URI is configured.
    return createMongoDbRepository();
  } catch (error) {
    console.warn('MongoDB repository unavailable, falling back to local JSON storage.', error);
    return null;
  }
}

export function resetRepositoryCache(): void {
  cachedRepository = null;
}
