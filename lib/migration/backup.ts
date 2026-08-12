import '@/lib/server-only';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { STORAGE_PATHS } from '@/lib/config';
import type { AppData } from '@/src/types';
import { getDefaultData } from '@/src/utils/defaults';
import { isValidAppData } from '@/src/validators';

export function readDataJson(): AppData {
  const file = path.join(process.cwd(), STORAGE_PATHS.data);
  if (!fs.existsSync(file)) return getDefaultData();
  const parsed: unknown = JSON.parse(fs.readFileSync(file, 'utf-8'));
  return isValidAppData(parsed) ? parsed : getDefaultData();
}

export function checksumFile(filePath: string): string {
  const raw = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export function ensureBackupsDir(): string {
  const dir = path.join(process.cwd(), STORAGE_PATHS.backupsDir);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function ensureMigrationDir(): string {
  const dir = path.join(process.cwd(), STORAGE_PATHS.migrationDir);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Creates a point-in-time snapshot of data.json. Never overwrites an existing snapshot. */
export function createBackupSnapshot(): { path: string; checksum: string } {
  const dir = ensureBackupsDir();
  const source = path.join(process.cwd(), STORAGE_PATHS.data);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const target = path.join(dir, `data-before-mongodb-migration-${timestamp}.json`);
  fs.copyFileSync(source, target);
  return { path: target, checksum: checksumFile(target) };
}

export interface Assessment {
  valid: boolean;
  counts: { plans: number; sessions: number; plansWithFiles: number };
  checksum: string;
  backupPath: string | null;
}
