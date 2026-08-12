import '@/lib/server-only';
import { getMongoDb } from '@/lib/mongodb/connection';
import { COLLECTIONS } from '@/lib/mongodb/collections';
import type {
  DailyAnalyticsDoc,
  FocusSessionDoc,
  MonthlyAnalyticsDoc,
  PlanDoc,
  SharedFocusDoc,
  WeeklyAnalyticsDoc,
} from '@/lib/mongodb/types';
import {
  aggregateDay,
  groupByWeek,
  isAnalyzableDay,
  rollupMonth,
  rollupWeek,
} from '@/lib/analytics/aggregate';
import { addDays, monthKey, todayKey } from '@/lib/analytics/periods';
import { runGenerators } from '@/lib/analytics/insights';
import type { AnalyticsResult, InsightContext } from '@/lib/analytics/types';

/**
 * How long an aggregated summary is considered fresh. Reads that happen within this window
 * are served from the aggregated collections; after it, the raw sources are re-aggregated.
 * This is what makes the engine "periodic" without requiring a background scheduler: the
 * heavy full-recompute only happens once per window instead of on every request.
 */
export const ANALYTICS_TTL_MS = 15 * 60 * 1000;
/** Only the last 400 days of history are aggregated, so unbounded data never slows a scan. */
const MAX_DAYS = 400;
const CUTOFF = addDays(todayKey(), -MAX_DAYS);

async function freshEnough(collectionName: string, userId: string, now: number): Promise<boolean> {
  const db = await getMongoDb();
  const latest = await db
    .collection<DailyAnalyticsDoc>(collectionName)
    .find({ userId })
    .sort({ computedAt: -1 })
    .limit(1)
    .toArray();
  const doc = latest[0];
  if (!doc) return false;
  return now - Date.parse(doc.computedAt) < ANALYTICS_TTL_MS;
}

async function loadRaw(userId: string): Promise<{
  sessions: FocusSessionDoc[];
  plans: PlanDoc[];
  sharedByDay: Map<string, number>;
}> {
  const db = await getMongoDb();
  const [sessions, plans, memberships, sharedSessions] = await Promise.all([
    db.collection<FocusSessionDoc>(COLLECTIONS.FOCUS_SESSIONS).find({ userId, date: { $gte: CUTOFF } }).toArray(),
    db.collection<PlanDoc>(COLLECTIONS.PLANS).find({ planType: 'personal', ownerId: userId, date: { $gte: CUTOFF } }).toArray(),
    db
      .collection<{ _id: string; planId: number }>(COLLECTIONS.PLAN_MEMBERS)
      .find({ userId })
      .project<{ _id: string; planId: number }>({ planId: 1 })
      .toArray(),
    db
      .collection<SharedFocusDoc>(COLLECTIONS.SHARED_FOCUS_SESSIONS)
      .find({ status: 'ended', createdAt: { $gte: CUTOFF } })
      .toArray(),
  ]);

  const sharedByDay = new Map<string, number>();
  for (const shared of sharedSessions) {
    if (!shared.participants.some((p) => p.userId === userId)) continue;
    const day = shared.endsAt ?? shared.createdAt ?? '';
    if (!day) continue;
    sharedByDay.set(day.slice(0, 10), (sharedByDay.get(day.slice(0, 10)) ?? 0) + shared.durationMinutes);
  }

  const membershipPlanIds = memberships.map((m) => m.planId);
  let commonPlans: PlanDoc[] = [];
  if (membershipPlanIds.length > 0) {
    commonPlans = await db
      .collection<PlanDoc>(COLLECTIONS.PLANS)
      .find({ planType: 'common', _id: { $in: membershipPlanIds }, date: { $gte: CUTOFF } })
      .toArray();
  }

  return { sessions, plans: [...plans, ...commonPlans], sharedByDay };
}

async function persist(dailies: DailyAnalyticsDoc[], weeklies: WeeklyAnalyticsDoc[], monthlies: MonthlyAnalyticsDoc[]): Promise<void> {
  const db = await getMongoDb();
  await Promise.all([
    (async () => {
      for (const doc of dailies) {
        await db.collection<DailyAnalyticsDoc>(COLLECTIONS.DAILY_ANALYTICS).replaceOne({ _id: doc._id }, doc, { upsert: true });
      }
    })(),
    (async () => {
      for (const doc of weeklies) {
        await db.collection<WeeklyAnalyticsDoc>(COLLECTIONS.WEEKLY_ANALYTICS).replaceOne({ _id: doc._id }, doc, { upsert: true });
      }
    })(),
    (async () => {
      for (const doc of monthlies) {
        await db.collection<MonthlyAnalyticsDoc>(COLLECTIONS.MONTHLY_ANALYTICS).replaceOne({ _id: doc._id }, doc, { upsert: true });
      }
    })(),
  ]);
}

/**
 * Aggregates the user's raw history into daily/weekly/monthly summaries, persists them, and
 * returns both the summaries and the generated insights. Pure aggregation functions in
 * aggregate.ts keep the math unit-testable; this module only orchestrates storage.
 */
export async function computeAnalyticsForUser(userId: string): Promise<AnalyticsResult> {
  const raw = await loadRaw(userId);
  const nowIso = new Date().toISOString();

  const byDay = new Map<string, { sessions: FocusSessionDoc[]; plans: PlanDoc[]; shared: number }>();
  for (const session of raw.sessions) {
    if (!isAnalyzableDay(session.date)) continue;
    const entry = byDay.get(session.date) ?? { sessions: [], plans: [], shared: 0 };
    entry.sessions.push(session);
    byDay.set(session.date, entry);
  }
  for (const plan of raw.plans) {
    if (!isAnalyzableDay(plan.date)) continue;
    const entry = byDay.get(plan.date) ?? { sessions: [], plans: [], shared: 0 };
    entry.plans.push(plan);
    byDay.set(plan.date, entry);
  }
  for (const [day, minutes] of raw.sharedByDay) {
    const entry = byDay.get(day) ?? { sessions: [], plans: [], shared: 0 };
    entry.shared += minutes;
    byDay.set(day, entry);
  }

  const dailies: DailyAnalyticsDoc[] = [...byDay.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, entry]) => {
      const base = aggregateDay(entry.sessions, entry.plans, entry.shared);
      return {
        _id: `${userId}:${date}`,
        userId,
        ...base,
        computedAt: nowIso,
      };
    });

  const weeklies: WeeklyAnalyticsDoc[] = [];
  for (const [, group] of groupByWeek(dailies)) {
    const rollup = rollupWeek(group);
    weeklies.push({ ...rollup, computedAt: nowIso });
  }

  const monthlies: MonthlyAnalyticsDoc[] = [];
  const weekGroups = new Map<string, WeeklyAnalyticsDoc[]>();
  for (const week of weeklies) {
    const month = monthKey(week.weekStart);
    const list = weekGroups.get(month) ?? [];
    list.push(week);
    weekGroups.set(month, list);
  }
  for (const [, group] of weekGroups) {
    monthlies.push({ ...rollupMonth(group), computedAt: nowIso });
  }

  await persist(dailies, weeklies, monthlies);

  const context: InsightContext = {
    userId,
    sampleDays: dailies.length,
    sampleWeeks: weeklies.length,
    sampleMonths: monthlies.length,
    todayFocusMinutes: dailies.find((d) => d.date === todayKey())?.focusMinutes ?? 0,
    dailies,
    weeklies,
    monthlies,
  };

  return {
    userId,
    computedAt: nowIso,
    daily: dailies,
    weekly: weeklies,
    monthly: monthlies,
    insights: runGenerators(context),
  };
}

/**
 * Read path used by the API. Serves the aggregated summaries from MongoDB when they are
 * still fresh and recomputes them in place when stale — so insight reads stay cheap.
 */
export async function computeAnalyticsIfStale(userId: string): Promise<AnalyticsResult> {
  const db = await getMongoDb();
  const now = Date.now();

  const dailyFresh = await freshEnough(COLLECTIONS.DAILY_ANALYTICS, userId, now);
  const weeklyFresh = await freshEnough(COLLECTIONS.WEEKLY_ANALYTICS, userId, now);
  const monthlyFresh = await freshEnough(COLLECTIONS.MONTHLY_ANALYTICS, userId, now);
  if (dailyFresh && weeklyFresh && monthlyFresh) {
    const [daily, weekly, monthly] = await Promise.all([
      db.collection<DailyAnalyticsDoc>(COLLECTIONS.DAILY_ANALYTICS).find({ userId }).sort({ date: 1 }).toArray(),
      db.collection<WeeklyAnalyticsDoc>(COLLECTIONS.WEEKLY_ANALYTICS).find({ userId }).sort({ weekStart: 1 }).toArray(),
      db.collection<MonthlyAnalyticsDoc>(COLLECTIONS.MONTHLY_ANALYTICS).find({ userId }).sort({ month: 1 }).toArray(),
    ]);
    return {
      userId,
      computedAt: daily[daily.length - 1]?.computedAt ?? new Date().toISOString(),
      daily,
      weekly,
      monthly,
      insights: runGenerators({
        userId,
        sampleDays: daily.length,
        sampleWeeks: weekly.length,
        sampleMonths: monthly.length,
        todayFocusMinutes: daily.find((d) => d.date === todayKey())?.focusMinutes ?? 0,
        dailies: daily,
        weeklies: weekly,
        monthlies: monthly,
      }),
    };
  }
  return computeAnalyticsForUser(userId);
}

/** Force a recompute regardless of freshness (used after writes and by the CLI script). */
export async function refreshAnalytics(userId: string): Promise<AnalyticsResult> {
  return computeAnalyticsForUser(userId);
}

/**
 * Recomputes analytics for every user that has any history. Intended for a scheduled job or
 * the `npm run analytics:compute` script; safe to run concurrently with normal reads.
 */
export async function recomputeAllAnalytics(): Promise<{ users: number }> {
  const db = await getMongoDb();
  const userIds = await db.collection<{ userId: string }>(COLLECTIONS.FOCUS_SESSIONS).distinct('userId');
  const planOwners = await db.collection<{ ownerId: string }>(COLLECTIONS.PLANS).distinct('ownerId');
  const all = Array.from(new Set([...userIds, ...planOwners]));
  for (const userId of all) {
    try {
      await computeAnalyticsForUser(userId);
    } catch (error) {
      console.error(`Analytics recompute failed for ${userId}:`, error);
    }
  }
  return { users: all.length };
}
