// @vitest-environment node
import { describe, it, expect } from 'vitest';
import type { SharedActivityItem } from '@/src/types/collaboration';
import { activityBeforeCursor, buildActivityPage, sortActivityNewestFirst } from '@/lib/repositories/activityMath';
import { buildPlanPage, planBeforeCursor, sortPlansNewestFirst } from '@/lib/repositories/planPaging';
import type { Plan } from '@/src/types';

function activity(id: string, createdAt: string): SharedActivityItem {
  return { id, type: 'shared_focus', title: 'Focus', subtitle: '', minutes: 25, status: 'ended', createdAt };
}

describe('activityMath', () => {
  it('sorts newest-first and pages with a cursor', () => {
    const items = [activity('a', '2026-01-01T00:00:00.000Z'), activity('b', '2026-01-03T00:00:00.000Z'), activity('c', '2026-01-02T00:00:00.000Z')];
    const sorted = sortActivityNewestFirst(items);
    expect(sorted.map((i) => i.id)).toEqual(['b', 'c', 'a']);
    const page = buildActivityPage(sorted, 2);
    expect(page.items.map((i) => i.id)).toEqual(['b', 'c']);
    expect(page.hasMore).toBe(true);
    expect(page.nextCursor).toBe('2026-01-02T00:00:00.000Z');
    expect(activityBeforeCursor(activity('x', '2026-01-01T00:00:00.000Z'), '2026-01-02T00:00:00.000Z')).toBe(true);
  });

  it('exhausts the feed', () => {
    const page = buildActivityPage([activity('a', '2026-01-01T00:00:00.000Z')], 2);
    expect(page.hasMore).toBe(false);
    expect(page.nextCursor).toBeNull();
  });
});

function plan(id: number, updatedAt: string): Plan {
  return {
    id,
    title: `p${id}`,
    description: '',
    type: 'weekly',
    status: 'not-started',
    date: '2026-01-01',
    priority: 'medium',
    category: '',
    updatedAt,
  } as Plan;
}

describe('planPaging', () => {
  it('sorts by updatedAt newest-first and pages', () => {
    const plans = [plan(1, '2026-01-01T00:00:00.000Z'), plan(2, '2026-01-03T00:00:00.000Z'), plan(3, '2026-01-02T00:00:00.000Z')];
    const sorted = sortPlansNewestFirst(plans);
    expect(sorted.map((p) => p.id)).toEqual([2, 3, 1]);
    const page = buildPlanPage(sorted, 2);
    expect(page.items.map((p) => p.id)).toEqual([2, 3]);
    expect(page.hasMore).toBe(true);
    expect(page.nextCursor).toBe('2026-01-02T00:00:00.000Z');
    expect(planBeforeCursor(plan(1, '2026-01-01T00:00:00.000Z'), '2026-01-02T00:00:00.000Z')).toBe(true);
  });

  it('exhausts plan history', () => {
    const page = buildPlanPage([plan(1, '2026-01-01T00:00:00.000Z')], 2);
    expect(page.hasMore).toBe(false);
  });
});
