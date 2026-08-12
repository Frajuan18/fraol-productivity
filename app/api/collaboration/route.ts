import { NextResponse } from 'next/server';
import { readCollabData, writeCollabData } from '@/lib/collaboration/localCollabStore';
import { getDefaultCollabData, isValidCollabData } from '@/src/validators/collaboration';

export async function GET() {
  try {
    const data = readCollabData();
    return NextResponse.json(data);
  } catch (error) {
    console.error('GET /api/collaboration failed:', error);
    return NextResponse.json({ error: 'Failed to read collaboration data', code: 'READ_ERROR' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    if (!isValidCollabData(body)) {
      return NextResponse.json(
        { error: 'Invalid collaboration data payload', code: 'VALIDATION_ERROR' },
        { status: 400 },
      );
    }
    writeCollabData(body);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('POST /api/collaboration failed:', error);
    return NextResponse.json({ error: 'Failed to save collaboration data', code: 'WRITE_ERROR' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const defaults = getDefaultCollabData();
    writeCollabData(defaults);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/collaboration failed:', error);
    return NextResponse.json({ error: 'Failed to clear collaboration data', code: 'WRITE_ERROR' }, { status: 500 });
  }
}
