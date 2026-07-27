import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getDefaultData } from '@/src/utils/defaults';
import { isValidAppData } from '@/src/validators';

const DATA_DIR = path.join(process.cwd(), 'storage');
const DATA_FILE = path.join(DATA_DIR, 'data.json');
const BACKUP_FILE = path.join(DATA_DIR, 'data.json.bak');
const TEMP_FILE = path.join(DATA_DIR, 'data.json.tmp');

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readJSON(filePath: string): unknown {
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw);
}

function writeJSONAtomic(filePath: string, tempPath: string, data: unknown): void {
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tempPath, filePath);
}

function createBackup(): void {
  if (fs.existsSync(DATA_FILE)) {
    fs.copyFileSync(DATA_FILE, BACKUP_FILE);
  }
}

function restoreFromBackup(): boolean {
  if (fs.existsSync(BACKUP_FILE)) {
    fs.copyFileSync(BACKUP_FILE, DATA_FILE);
    return true;
  }
  return false;
}

export async function GET() {
  ensureDir();

  try {
    if (!fs.existsSync(DATA_FILE)) {
      const defaults = getDefaultData();
      writeJSONAtomic(DATA_FILE, TEMP_FILE, defaults);
      return NextResponse.json(defaults);
    }

    let parsed: unknown;
    try {
      parsed = readJSON(DATA_FILE);
    } catch {
      if (restoreFromBackup()) {
        parsed = readJSON(DATA_FILE);
      } else {
        const defaults = getDefaultData();
        writeJSONAtomic(DATA_FILE, TEMP_FILE, defaults);
        return NextResponse.json(defaults);
      }
    }

    const data = isValidAppData(parsed) ? parsed : getDefaultData();
    return NextResponse.json(data);
  } catch (error) {
    console.error('GET /api/data failed:', error);
    return NextResponse.json({ error: 'Failed to read data', code: 'READ_ERROR' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  ensureDir();

  try {
    const body: unknown = await request.json();

    if (!isValidAppData(body)) {
      return NextResponse.json({ error: 'Invalid data payload', code: 'VALIDATION_ERROR' }, { status: 400 });
    }

    createBackup();
    writeJSONAtomic(DATA_FILE, TEMP_FILE, body);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('POST /api/data failed:', error);
    return NextResponse.json({ error: 'Failed to save data', code: 'WRITE_ERROR' }, { status: 500 });
  }
}

export async function DELETE() {
  ensureDir();

  try {
    const defaults = getDefaultData();
    createBackup();
    writeJSONAtomic(DATA_FILE, TEMP_FILE, defaults);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/data failed:', error);
    return NextResponse.json({ error: 'Failed to clear data', code: 'WRITE_ERROR' }, { status: 500 });
  }
}
