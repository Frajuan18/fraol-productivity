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
    const url = new URL(request.url);
    const date = url.searchParams.get('date') ?? new Date().toISOString().split('T')[0];
    const goal = await repo.getDailyGoal(userId, date);
    return NextResponse.json({ ok: true, data: goal });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Failed to load goal.',
        code: 'GOAL_ERROR',
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
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
    const body = await request.json();
    const { date, targetMinutes } = body;
    if (!date || typeof targetMinutes !== 'number' || targetMinutes < 5) {
      return NextResponse.json(
        { ok: false, error: 'Invalid date or targetMinutes.', code: 'INVALID_INPUT' },
        { status: 400 },
      );
    }
    const existing = await repo.getDailyGoal(userId, date);
    if (existing) {
      return NextResponse.json(
        { ok: false, error: 'Goal already set for this day. It cannot be changed.', code: 'GOAL_EXISTS' },
        { status: 409 },
      );
    }
    const success = await repo.setDailyGoal(userId, date, targetMinutes);
    if (!success) {
      return NextResponse.json({ ok: false, error: 'Failed to set goal.', code: 'SET_FAILED' }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Failed to set goal.',
        code: 'GOAL_ERROR',
      },
      { status: 500 },
    );
  }
}
