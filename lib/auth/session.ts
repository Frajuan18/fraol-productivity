import '@/lib/server-only';
import { NextResponse } from 'next/server';
import { getServerEnv } from '@/lib/configServer';
import { getCollection, isMongoConfigured } from '@/lib/mongodb/connection';
import { COLLECTIONS } from '@/lib/mongodb/collections';
import type { AuthSessionDoc, UserDoc } from '@/lib/mongodb/types';
import { generateSessionToken, hashToken } from '@/lib/auth/password';

const env = getServerEnv();

export interface SessionUser {
  userId: string;
  email: string;
  displayName: string;
}

export function getSessionCookieName(): string {
  return env.authSessionCookieName;
}

export function readSessionCookie(request: Request): string | null {
  const cookie = request.headers.get('cookie') ?? '';
  const prefix = `${getSessionCookieName()}=`;
  for (const part of cookie.split(';')) {
    const trimmed = part.trim();
    if (trimmed.startsWith(prefix)) return decodeURIComponent(trimmed.slice(prefix.length));
  }
  return null;
}

export async function createSession(userId: string): Promise<{ token: string; expiresAt: string }> {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + env.authSessionTtlSeconds * 1000).toISOString();
  if (isMongoConfigured()) {
    const sessions = await getCollection<AuthSessionDoc>(COLLECTIONS.AUTH_SESSIONS);
    await sessions.insertOne({
      _id: token,
      tokenHash: hashToken(token),
      userId,
      expiresAt,
      createdAt: new Date().toISOString(),
    } as never);
  }
  return { token, expiresAt };
}

export async function destroySession(token: string): Promise<void> {
  if (!isMongoConfigured() || !token) return;
  const sessions = await getCollection<AuthSessionDoc>(COLLECTIONS.AUTH_SESSIONS);
  await sessions.deleteOne({ tokenHash: hashToken(token) } as never);
}

export async function validateSessionToken(token: string): Promise<SessionUser | null> {
  if (!token || !isMongoConfigured()) return null;
  const sessions = await getCollection<AuthSessionDoc>(COLLECTIONS.AUTH_SESSIONS);
  const session = await sessions.findOne({ tokenHash: hashToken(token) } as never);
  if (!session) return null;
  if (new Date(session.expiresAt).getTime() < Date.now()) {
    await sessions.deleteOne({ tokenHash: hashToken(token) } as never);
    return null;
  }
  const users = await getCollection<UserDoc>(COLLECTIONS.USERS);
  const user = await users.findOne({ _id: session.userId } as never);
  if (!user) return null;
  return { userId: user._id, email: user.email, displayName: user.displayName };
}

/** Resolves the authenticated user id from the request session cookie (or null). */
export async function getRequestUserId(request: Request): Promise<string | null> {
  const token = readSessionCookie(request);
  if (!token) return null;
  const session = await validateSessionToken(token);
  return session ? session.userId : null;
}

export function attachSessionCookie(response: NextResponse, token: string, expiresAt: string): NextResponse {
  response.cookies.set(getSessionCookieName(), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: new Date(expiresAt),
  });
  return response;
}

export function clearSessionCookie(response: NextResponse): NextResponse {
  response.cookies.set(getSessionCookieName(), '', { httpOnly: true, path: '/', maxAge: 0 });
  return response;
}
