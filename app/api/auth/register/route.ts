import { NextResponse } from 'next/server';
import { isMongoConfigured, getCollection } from '@/lib/mongodb/connection';
import { COLLECTIONS } from '@/lib/mongodb/collections';
import type { ProfileDoc, UserDoc } from '@/lib/mongodb/types';
import { generateUserId, hashPassword } from '@/lib/auth/password';
import { createSession, attachSessionCookie } from '@/lib/auth/session';
import { isValidEmail, isValidPassword, sanitizeDisplayName } from '@/lib/auth/validation';

interface RegisterBody {
  email?: unknown;
  password?: unknown;
  displayName?: unknown;
}

export async function POST(request: Request) {
  if (!isMongoConfigured()) {
    return NextResponse.json(
      { ok: false, error: 'MongoDB is not configured. Authentication is unavailable.', code: 'NOT_CONFIGURED' },
      { status: 503 },
    );
  }

  let body: RegisterBody;
  try {
    body = (await request.json()) as RegisterBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request body.', code: 'BAD_REQUEST' }, { status: 400 });
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const displayName = sanitizeDisplayName(typeof body.displayName === 'string' ? body.displayName : '');

  if (!isValidEmail(email)) {
    return NextResponse.json({ ok: false, error: 'Enter a valid email address.', code: 'INVALID_EMAIL' }, { status: 400 });
  }
  if (!isValidPassword(password)) {
    return NextResponse.json(
      { ok: false, error: 'Password must be at least 8 characters long.', code: 'INVALID_PASSWORD' },
      { status: 400 },
    );
  }
  if (!displayName) {
    return NextResponse.json({ ok: false, error: 'Display name is required.', code: 'INVALID_NAME' }, { status: 400 });
  }

  try {
    const users = await getCollection<UserDoc>(COLLECTIONS.USERS);
    const profiles = await getCollection<ProfileDoc>(COLLECTIONS.PROFILES);
    const existing = await users.findOne({ email });
    if (existing) {
      return NextResponse.json(
        { ok: false, error: 'An account with this email already exists.', code: 'EMAIL_TAKEN' },
        { status: 409 },
      );
    }

    const userId = generateUserId();
    const now = new Date().toISOString();
    const { hash, salt } = hashPassword(password);

    await users.insertOne({
      _id: userId,
      email,
      passwordHash: hash,
      passwordSalt: salt,
      displayName,
      createdAt: now,
      updatedAt: now,
    });
    await profiles.insertOne({
      _id: userId,
      userId,
      email,
      displayName,
      status: 'offline',
      lastSeenAt: now,
      createdAt: now,
    });

    const { token, expiresAt } = await createSession(userId);
    const response = NextResponse.json({
      ok: true,
      user: { id: userId, email, displayName },
    });
    return attachSessionCookie(response, token, expiresAt);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Registration failed.';
    return NextResponse.json({ ok: false, error: message, code: 'REGISTER_ERROR' }, { status: 500 });
  }
}
