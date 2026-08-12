import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { normalizeLayout, createDefaultLayout } from '@/lib/dashboard/layout';
import type { DashboardLayout } from '@/lib/dashboard/types';

const DATA_DIR = path.join(process.cwd(), 'storage');
const LAYOUT_FILE = path.join(DATA_DIR, 'dashboard-layout.json');
const TEMP_FILE = path.join(DATA_DIR, 'dashboard-layout.json.tmp');

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function writeJSONAtomic(filePath: string, tempPath: string, data: unknown): void {
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tempPath, filePath);
}

export async function GET() {
  ensureDir();
  let layout: DashboardLayout;
  if (fs.existsSync(LAYOUT_FILE)) {
    try {
      const raw = JSON.parse(fs.readFileSync(LAYOUT_FILE, 'utf-8'));
      layout = normalizeLayout(raw);
    } catch {
      layout = createDefaultLayout();
    }
  } else {
    layout = createDefaultLayout();
  }
  return NextResponse.json(layout);
}

export async function POST(request: Request) {
  ensureDir();
  try {
    const body: unknown = await request.json();
    const normalized = normalizeLayout(body);
    writeJSONAtomic(LAYOUT_FILE, TEMP_FILE, normalized);
    return NextResponse.json({ success: true, layout: normalized });
  } catch (error) {
    console.error('POST /api/dashboard-layout failed:', error);
    return NextResponse.json({ error: 'Failed to save layout', code: 'WRITE_ERROR' }, { status: 500 });
  }
}

export async function DELETE() {
  ensureDir();
  const defaults = createDefaultLayout();
  writeJSONAtomic(LAYOUT_FILE, TEMP_FILE, defaults);
  return NextResponse.json({ success: true });
}