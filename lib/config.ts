export type StorageMode = 'local' | 'mongodb' | 'migration';

/**
 * Shared configuration safe to import from both server and client bundles.
 * Only NEXT_PUBLIC_* values are exposed to the browser. Database credentials are read
 * exclusively through `lib/configServer.ts` on the server and never reach the frontend.
 */
export const PUBLIC_FLAGS = {
  CHAT_ENABLED: process.env.NEXT_PUBLIC_CHAT_ENABLED !== 'false',
  ARCHIVE_ENABLED: process.env.NEXT_PUBLIC_ARCHIVE_ENABLED === 'true',
} as const;

export const MIGRATION_NAME = 'local-json-to-mongodb';
export const MIGRATION_VERSION = 1;

export const STORAGE_PATHS = {
  data: 'storage/data.json',
  dataBackup: 'storage/data.json.bak',
  backupsDir: 'storage/backups',
  migrationDir: 'storage/migrations',
  uploadsDir: 'storage/uploads/plans',
  collab: 'storage/collaboration.json',
} as const;

export function getPublicCloudEnabled(): boolean {
  return process.env.NEXT_PUBLIC_MONGODB_ENABLED === 'true';
}

export function resolveRepositoryMode(): StorageMode {
  if (getPublicCloudEnabled()) return 'mongodb';
  return 'local';
}
