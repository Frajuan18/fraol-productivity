import { NextResponse } from 'next/server';
import { isMongoConfigured, getCollection } from '@/lib/mongodb/connection';
import { COLLECTIONS } from '@/lib/mongodb/collections';
import type { UserDoc } from '@/lib/mongodb/types';
import { verifyPassword } from '@/lib/auth/password';
import { createSession, attachSessionCookie } from '@/lib/auth/session';
import { isValidEmail } from '@/lib/auth/validation';

interface LoginBody {
  email?: unknown;
  password?: unknown;
}

export async function POST(request: Request) {
  if (!isMongoConfigured()) {
    return NextResponse.json(
      { ok: false, error: 'MongoDB is not configured. Authentication is unavailable.', code: 'NOT_CONFIGURED' },
      { status: 503 },
    );
  }

  let body: LoginBody;
  try {
    body = (await request.json()) as LoginBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request body.', code: 'BAD_REQUEST' }, { status: 400 });
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!isValidEmail(email) || !password) {
    return NextResponse.json(
      { ok: false, error: 'Invalid email or password.', code: 'INVALID_CREDENTIALS' },
      { status: 401 },
    );
  }

  try {
    const users = await getCollection<UserDoc>(COLLECTIONS.USERS);
    const user = await users.findOne({ email });
    if (!user || !verifyPassword(password, user.passwordSalt, user.passwordHash)) {
      // Do not reveal whether the email exists.
      return NextResponse.json(
        { ok: false, error: 'Invalid email or password.', code: 'INVALID_CREDENTIALS' },
        { status: 401 },
      );
    }

    const { token, expiresAt } = await createSession(user._id);
    const response = NextResponse.json({
      ok: true,
      user: { id: user._id, email: user.email, displayName: user.displayName },
    });
    return attachSessionCookie(response, token, expiresAt);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Login failed.';
    return NextResponse.json({ ok: false, error: message, code: 'LOGIN_ERROR' }, { status: 500 });
  }
}
