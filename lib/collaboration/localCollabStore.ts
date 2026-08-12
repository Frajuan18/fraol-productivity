import fs from 'fs';
import path from 'path';
import { getDefaultCollabData, isValidCollabData } from '@/src/validators/collaboration';
import type { CollabData } from '@/src/types/collaboration';

const COLLAB_DIR = path.join(process.cwd(), 'storage');
const COLLAB_FILE = path.join(COLLAB_DIR, 'collaboration.json');
const BACKUP_FILE = path.join(COLLAB_DIR, 'collaboration.json.bak');
const TEMP_FILE = path.join(COLLAB_DIR, 'collaboration.json.tmp');

function ensureDir(): void {
  if (!fs.existsSync(COLLAB_DIR)) {
    fs.mkdirSync(COLLAB_DIR, { recursive: true });
  }
}

export function readCollabData(): CollabData {
  ensureDir();
  if (!fs.existsSync(COLLAB_FILE)) {
    const defaults = getDefaultCollabData();
    writeCollabData(defaults);
    return defaults;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(COLLAB_FILE, 'utf-8'));
  } catch {
    if (fs.existsSync(BACKUP_FILE)) {
      parsed = JSON.parse(fs.readFileSync(BACKUP_FILE, 'utf-8'));
    } else {
      const defaults = getDefaultCollabData();
      writeCollabData(defaults);
      return defaults;
    }
  }
  return isValidCollabData(parsed) ? parsed : getDefaultCollabData();
}

export function writeCollabData(data: CollabData): void {
  ensureDir();
  if (fs.existsSync(COLLAB_FILE)) {
    fs.copyFileSync(COLLAB_FILE, BACKUP_FILE);
  }
  fs.writeFileSync(TEMP_FILE, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(TEMP_FILE, COLLAB_FILE);
}
