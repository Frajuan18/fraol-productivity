import { NextResponse } from 'next/server';
import { readSessionCookie, destroySession, clearSessionCookie } from '@/lib/auth/session';

export async function POST(request: Request) {
  const token = readSessionCookie(request);
  if (token) {
    await destroySession(token);
  }
  return clearSessionCookie(NextResponse.json({ ok: true }));
}
