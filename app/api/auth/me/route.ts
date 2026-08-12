import { NextResponse } from 'next/server';
import { readSessionCookie, validateSessionToken } from '@/lib/auth/session';

export async function GET(request: Request) {
  const token = readSessionCookie(request);
  if (!token) return NextResponse.json({ ok: true, user: null });

  const session = await validateSessionToken(token);
  if (!session) return NextResponse.json({ ok: true, user: null });

  return NextResponse.json({
    ok: true,
    user: { id: session.userId, email: session.email, displayName: session.displayName },
  });
}
