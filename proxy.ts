import { NextResponse, type NextRequest } from 'next/server';
import { isMongoConfigured } from '@/lib/mongodb/connection';
import { readSessionCookie, validateSessionToken } from '@/lib/auth/session';

// Paths that never require a session. Auth entry points are public; everything else in
// this matcher list must carry a valid mw_session cookie when MongoDB mode is enabled.
const PUBLIC_API_PREFIXES = ['/api/auth/login', '/api/auth/register', '/api/auth/logout'];

const PROTECTED_PREFIXES = [
  '/api/repository',
  '/api/auth/me',
  '/api/partner',
  '/api/conversations',
  '/api/messages',
  '/api/media',
  '/api/realtime',
  '/api/focus',
];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const isPublic = PUBLIC_API_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!isProtected || isPublic) return NextResponse.next();

  // Local JSON mode keeps working without MongoDB: sessions are not enforced there.
  if (!isMongoConfigured()) return NextResponse.next();

  const token = readSessionCookie(request);
  const session = token ? await validateSessionToken(token) : null;
  if (!session) {
    return NextResponse.json(
      { ok: false, error: 'Authentication required.', code: 'UNAUTHORIZED' },
      { status: 401 },
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*'],
};
