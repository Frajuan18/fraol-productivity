import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { fileStorage } from '@/lib/plans/fileStorage';
import { findPlan, setPlanFile, createPlan, clearPlanFile } from '@/lib/plans/store';
import {
  MAX_FILE_SIZE,
  detectMimeType,
  countPdfPages,
  getExtensionForMime,
  isAllowedFileType,
  isWithinSizeLimit,
  parsePlanId,
} from '@/lib/plans/files';
import { isPlanPriority, isPlanType, type Plan, type PlanTypeValue } from '@/src/types';

const VALID_STATUS = new Set(['pending', 'in-progress', 'completed', 'not-started']);

async function readForm(
  request: Request,
): Promise<{ ok: true; form: FormData; file: File } | { ok: false; error: string; status: number }> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return { ok: false, error: 'Invalid multipart form data', status: 400 };
  }
  const file = form.get('file');
  if (!(file instanceof File)) {
    return { ok: false, error: 'No file provided', status: 400 };
  }
  return { ok: true, form, file };
}

function buildPlan(id: number, form: FormData): Plan {
  const title = String(form.get('title') || '').trim() || 'Study plan';
  const description = String(form.get('description') || '').trim();
  const typeRaw = String(form.get('type') || '');
  const statusRaw = String(form.get('status') || '');
  const priorityRaw = String(form.get('priority') || '');
  const dateRaw = String(form.get('date') || '');

  const type: PlanTypeValue = isPlanType(typeRaw) ? typeRaw : 'weekly';
  const status = VALID_STATUS.has(statusRaw) ? (statusRaw as Plan['status']) : 'in-progress';
  const priority = isPlanPriority(priorityRaw) ? priorityRaw : 'medium';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(dateRaw) ? dateRaw : new Date().toISOString().split('T')[0];

  return {
    id,
    title,
    description,
    type,
    status,
    date,
    priority,
    category: String(form.get('category') || 'Study'),
    file: null,
  };
}

export async function POST(request: Request, { params }: { params: Promise<{ planId: string }> }) {
  const { planId: rawPlanId } = await params;
  const planId = parsePlanId(rawPlanId);
  if (planId === null) {
    return NextResponse.json({ error: 'Invalid plan id', code: 'INVALID_PLAN_ID' }, { status: 400 });
  }

  const result = await readForm(request);
  if (!result.ok) {
    return NextResponse.json({ error: result.error, code: 'FORM_ERROR' }, { status: result.status });
  }
  const { form, file } = result;

  const bytes = Buffer.from(await file.arrayBuffer());
  const detectedMime = detectMimeType(bytes);
  const mimeType = isAllowedFileType(file.type) ? file.type : isAllowedFileType(detectedMime) ? detectedMime : null;
  if (!mimeType) {
    return NextResponse.json(
      { error: 'Unsupported file type. Upload a PDF, Word document, or text file.', code: 'UNSUPPORTED_TYPE' },
      { status: 415 },
    );
  }
  if (!isWithinSizeLimit(bytes.length)) {
    return NextResponse.json(
      { error: `File exceeds the ${MAX_FILE_SIZE / (1024 * 1024)} MB limit.`, code: 'FILE_TOO_LARGE' },
      { status: 413 },
    );
  }

  const ext = getExtensionForMime(mimeType);
  const mismatchedPdf = ext === 'pdf' && detectedMime !== 'application/pdf';
  if (mismatchedPdf) {
    return NextResponse.json(
      { error: 'The file content does not match a PDF.', code: 'INVALID_CONTENT' },
      { status: 400 },
    );
  }

  const pageCount = ext === 'pdf' ? (countPdfPages(bytes) ?? undefined) : undefined;

  let stored;
  try {
    stored = await fileStorage.saveFile({
      planId,
      originalName: file.name,
      mimeType,
      data: bytes,
      pageCount,
    });
  } catch (error) {
    console.error('Failed to store plan file:', error);
    return NextResponse.json({ error: 'Failed to store the file.', code: 'STORE_ERROR' }, { status: 500 });
  }

  let plan = findPlan(planId);
  if (!plan) {
    plan = createPlan(buildPlan(planId, form));
  }
  const updated = setPlanFile(planId, stored);

  if (!updated) {
    await fileStorage.deletePlanDirectory(planId);
    return NextResponse.json(
      { error: 'Failed to attach the file to the plan.', code: 'ATTACH_ERROR' },
      { status: 500 },
    );
  }

  return NextResponse.json({ plan: updated }, { status: 201 });
}

export async function GET(request: Request, { params }: { params: Promise<{ planId: string }> }) {
  const { planId: rawPlanId } = await params;
  const planId = parsePlanId(rawPlanId);
  if (planId === null) {
    return NextResponse.json({ error: 'Invalid plan id', code: 'INVALID_PLAN_ID' }, { status: 400 });
  }

  const plan = findPlan(planId);
  if (!plan || !plan.file) {
    return NextResponse.json({ error: 'No file attached to this plan.', code: 'NO_FILE' }, { status: 404 });
  }

  const url = new URL(request.url);
  const action = url.searchParams.get('action');

  if (action === 'open' || action === 'download') {
    const buffer = await fileStorage.readFile(plan.file.storagePath);
    if (!buffer) {
      return NextResponse.json({ error: 'Stored file is missing.', code: 'FILE_MISSING' }, { status: 404 });
    }
    const body = Uint8Array.from(buffer).buffer;
    const contentLength = body.byteLength;

    const disposition = action === 'download' ? 'attachment' : 'inline';
    const headers: Record<string, string> = {
      'Content-Type': plan.file.mimeType,
      'Content-Length': String(contentLength),
      'Content-Disposition': `${disposition}; filename="${encodeURIComponent(plan.file.originalName)}"; filename*=UTF-8''${encodeURIComponent(plan.file.originalName)}`,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-store',
    };

    const range = request.headers.get('range');
    if (range) {
      const match = /bytes=(\d*)-(\d*)/.exec(range);
      if (match) {
        const start = match[1] ? parseInt(match[1], 10) : 0;
        const end = match[2] ? Math.min(parseInt(match[2], 10), contentLength - 1) : contentLength - 1;
        if (start <= end && start >= 0 && end < contentLength) {
          const chunk = body.slice(start, end + 1);
          headers['Content-Range'] = `bytes ${start}-${end}/${contentLength}`;
          headers['Content-Length'] = String(chunk.byteLength);
          return new NextResponse(chunk, { status: 206, headers });
        }
        return new NextResponse(null, { status: 416, headers: { 'Content-Range': `bytes */${contentLength}` } });
      }
    }

    return new NextResponse(body, { headers });
  }

  return NextResponse.json({ file: plan.file });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ planId: string }> }) {
  const { planId: rawPlanId } = await params;
  const planId = parsePlanId(rawPlanId);
  if (planId === null) {
    return NextResponse.json({ error: 'Invalid plan id', code: 'INVALID_PLAN_ID' }, { status: 400 });
  }

  const plan = findPlan(planId);
  if (!plan || !plan.file) {
    return NextResponse.json({ error: 'No file attached to this plan.', code: 'NO_FILE' }, { status: 404 });
  }

  await fileStorage.deleteFile(plan.file.storagePath);
  const dir = path.join(process.cwd(), 'storage', 'uploads', 'plans', String(planId));
  try {
    if (fs.existsSync(dir) && fs.readdirSync(dir).length === 0) {
      fs.rmdirSync(dir);
    }
  } catch {
    // best effort cleanup
  }

  clearPlanFile(planId);
  return NextResponse.json({ success: true });
}
