import '@/lib/server-only';
import fs from 'fs';
import path from 'path';
import { MIGRATION_NAME, MIGRATION_VERSION, STORAGE_PATHS } from '@/lib/config';
import type { MigrationRowCounts, MigrationStateRecord } from '@/src/types/collaboration';
import { ensureMigrationDir } from '@/lib/migration/backup';

function stateFile(): string {
  return path.join(process.cwd(), STORAGE_PATHS.migrationDir, 'migration-state.json');
}

export function readMigrationState(): MigrationStateRecord | null {
  const file = stateFile();
  if (!fs.existsSync(file)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf-8')) as MigrationStateRecord;
    if (parsed.migrationName === MIGRATION_NAME && typeof parsed.version === 'number') return parsed;
    return null;
  } catch {
    return null;
  }
}

export function isMigrationComplete(sourceChecksum: string): boolean {
  const state = readMigrationState();
  if (!state) return false;
  return state.migrationName === MIGRATION_NAME && state.version >= MIGRATION_VERSION && state.sourceChecksum === sourceChecksum;
}

export function recordMigration(checksum: string, rowCounts: MigrationRowCounts): MigrationStateRecord {
  ensureMigrationDir();
  const record: MigrationStateRecord = {
    migrationName: MIGRATION_NAME,
    version: MIGRATION_VERSION,
    sourceChecksum: checksum,
    completedAt: new Date().toISOString(),
    rowCounts,
  };
  fs.writeFileSync(stateFile(), JSON.stringify(record, null, 2), 'utf-8');
  return record;
}

export function resetMigrationState(): void {
  const file = stateFile();
  if (fs.existsSync(file)) fs.rmSync(file, { force: true });
}

export function buildReport(rowCounts: MigrationRowCounts, messages: string[]): string {
  const lines = [
    'Migration report',
    '===============',
    `Users migrated: ${rowCounts.users}`,
    `Plans migrated: ${rowCounts.plans}`,
    `Sessions migrated: ${rowCounts.sessions}`,
    `Files migrated: ${rowCounts.files}`,
    `Errors: ${messages.filter((m) => m.startsWith('ERROR')).length}`,
    ...messages,
  ];
  return lines.join('\n');
}
