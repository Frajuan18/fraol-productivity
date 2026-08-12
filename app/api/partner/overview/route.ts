import { NextResponse } from 'next/server';
import { getRequestUserId } from '@/lib/auth/session';
import { createMongoDbRepository } from '@/lib/repositories/mongodb/MongoDbProductivityRepository';

/**
 * Partner overview (MongoDB mode). The partner is derived entirely from the authenticated
 * session: the server verifies the signed-in user belongs to the configured two-user
 * partnership before returning any partner data. The client never supplies a partner/user id.
 */
export async function GET(request: Request) {
  const userId = await getRequestUserId(request);
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'Authentication required.', code: 'UNAUTHORIZED' }, { status: 401 });
  }
  const repo = createMongoDbRepository();
  if (!repo) {
    return NextResponse.json({ ok: false, error: 'MongoDB is not configured.', code: 'NOT_CONFIGURED' }, { status: 503 });
  }
  try {
    const overview = await repo.getPartnerOverview(userId);
    if (!overview) {
      return NextResponse.json(
        { ok: false, error: 'No configured partner for this account.', code: 'NO_PARTNER' },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true, data: overview });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Failed to load partner overview.',
        code: 'PARTNER_ERROR',
      },
      { status: 500 },
    );
  }
}
