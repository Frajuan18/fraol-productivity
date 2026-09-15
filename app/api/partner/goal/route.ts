import { NextResponse } from 'next/server';
import { getRequestUserId } from '@/lib/auth/session';
import { createMongoDbRepository } from '@/lib/repositories/mongodb/MongoDbProductivityRepository';

export async function GET(request: Request) {
  const userId = await getRequestUserId(request);
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'Authentication required.', code: 'UNAUTHORIZED' }, { status: 401 });
  }
  const repo = createMongoDbRepository();
  if (!repo) {
    return NextResponse.json(
      { ok: false, error: 'MongoDB is not configured.', code: 'NOT_CONFIGURED' },
      { status: 503 },
    );
  }
  try {
    const progress = await repo.getPartnerGoalWithProgress(userId);
    if (!progress) {
      return NextResponse.json(
        { ok: false, error: 'No partner goal available.', code: 'NO_PARTNER_GOAL' },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true, data: progress });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Failed to load partner goal.',
        code: 'PARTNER_GOAL_ERROR',
      },
      { status: 500 },
    );
  }
}
