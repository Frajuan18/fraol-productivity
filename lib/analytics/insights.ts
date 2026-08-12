import type { Insight, InsightContext, InsightGenerator } from '@/lib/analytics/types';
import { WEEKDAY_LABELS } from '@/lib/analytics/periods';

/** Rounds an hour index into a compact 24-hour label ("08:00"). */
function hourLabel(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}

/** Finds the contiguous 2-hour window with the most aggregate focus in an hourly array. */
function bestTwoHourWindow(hourly: number[]): { start: number; total: number } | null {
  let bestStart = -1;
  let bestTotal = 0;
  for (let h = 0; h <= 22; h += 1) {
    const total = (hourly[h] ?? 0) + (hourly[h + 1] ?? 0);
    if (total > bestTotal) {
      bestTotal = total;
      bestStart = h;
    }
  }
  return bestStart === -1 ? null : { start: bestStart, total: bestTotal };
}

const weeklyHoursSum = (ctx: InsightContext): number[] => {
  const out = new Array<number>(24).fill(0);
  for (const w of ctx.weeklies) {
    for (let h = 0; h < 24; h += 1) out[h] += w.hourlyMinutes[h] ?? 0;
  }
  return out;
};

const preferredHours: InsightGenerator = {
  id: 'preferred-hours',
  title: 'Preferred focus window',
  generate(ctx: InsightContext): Insight | null {
    if (ctx.weeklies.length < 2) return null;
    const window = bestTwoHourWindow(weeklyHoursSum(ctx));
    if (!window || window.total <= 0) return null;
    return {
      id: 'preferred-hours',
      severity: 'positive',
      scope: 'week',
      title: 'Your peak focus time',
      message: `You are consistently most productive between ${hourLabel(window.start)} and ${hourLabel(
        window.start + 2,
      )}. Schedule your hardest work here.`,
    };
  },
};

const bestWeeklyDay: InsightGenerator = {
  id: 'best-day',
  title: 'Most productive day',
  generate(ctx: InsightContext): Insight | null {
    const byDay = new Array<number>(7).fill(0);
    for (const w of ctx.weeklies) {
      if (w.bestDayIndex !== null) byDay[w.bestDayIndex] += 1;
    }
    let best = -1;
    let bestCount = 0;
    for (let i = 0; i < 7; i += 1) {
      if (byDay[i] > bestCount) {
        bestCount = byDay[i];
        best = i;
      }
    }
    if (best < 0 || bestCount < 2) return null;
    return {
      id: 'best-day',
      severity: 'positive',
      scope: 'week',
      title: 'Your most consistent day',
      message: `${WEEKDAY_LABELS[best]} has been your most productive day recently. Use it to lock in time for the things that matter most.`,
    };
  },
};

const focusTrend: InsightGenerator = {
  id: 'focus-trend',
  title: 'Weekly focus trend',
  generate(ctx: InsightContext): Insight | null {
    if (ctx.monthlies.length < 3) return null;
    const sorted = [...ctx.monthlies].sort((a, b) => a.month.localeCompare(b.month));
    const recent = Math.round(sorted[sorted.length - 1].focusMinutes);
    const prior = Math.round(sorted[sorted.length - 2].focusMinutes);
    if (recent === 0 && prior === 0) return null;
    const delta = prior === 0 ? 1 : (recent - prior) / prior;
    const up = recent >= prior;
    return {
      id: 'focus-trend',
      severity: up ? 'positive' : 'attention',
      scope: 'month',
      title: 'Focus momentum',
      message: up
        ? `Your focus minutes rose ${Math.round(Math.abs(delta) * 100)}% month over month — ${recent} minutes last month.`
        : `Your focus minutes dipped ${Math.round(Math.abs(delta) * 100)}% vs the prior month — ${recent} minutes. A shorter, focused session can rebuild momentum.`,
    };
  },
};

const planCompletion: InsightGenerator = {
  id: 'plan-completion',
  title: 'Plan completion rate',
  generate(ctx: InsightContext): Insight | null {
    const dailies = ctx.dailies.filter((d) => d.plansCompleted > 0 || d.plansPending > 0 || d.plansInProgress > 0);
    if (dailies.length < 3) return null;
    let rate = 0;
    for (const d of dailies) {
      rate += d.plansCompleted / Math.max(1, d.plansCompleted + d.plansPending + d.plansInProgress);
    }
    const pct = Math.round((rate / dailies.length) * 100);
    return {
      id: 'plan-completion',
      severity: pct >= 60 ? 'positive' : pct <= 30 ? 'attention' : 'neutral',
      scope: 'overall',
      title: 'Finishing your plans',
      message:
        pct >= 60
          ? `You complete about ${pct}% of your scheduled plans. Strong momentum — keep the bar realistic.`
          : `You complete about ${pct}% of scheduled plans. Breaking larger plans into smaller milestones can push this higher.`,
    };
  },
};

const streakCallout: InsightGenerator = {
  id: 'focus-streak',
  title: 'Focus streak',
  generate(ctx: InsightContext): Insight | null {
    const active = new Set(ctx.dailies.map((d) => d.date));
    if (active.size < 2) return null;
    let cursor = fromDate(new Date());
    let streak = 0;
    for (let steps = 0; steps < 400; steps += 1) {
      if (!active.has(cursor)) break;
      streak += 1;
      cursor = subtractDays(cursor, 1);
    }
    if (streak < 2) return null;
    return {
      id: 'focus-streak',
      severity: 'positive',
      scope: 'day',
      title: 'Focus streak',
      message: `You have recorded ${streak} consecutive day${streak === 1 ? '' : 's'} with focus. Consistency beats intensity — protect the habit.`,
    };
  },
};

const interruptionInsight: InsightGenerator = {
  id: 'interruptions',
  title: 'Flow interruptions',
  generate(ctx: InsightContext): Insight | null {
    const withSessions = ctx.dailies.filter((d) => d.sessionsCompleted > 0);
    if (withSessions.length < 4) return null;
    let interruptions = 0;
    let sessions = 0;
    for (const d of withSessions) {
      interruptions += d.interruptions;
      sessions += d.sessionsCompleted;
    }
    if (sessions === 0) return null;
    const ratio = interruptions / sessions;
    if (ratio < 1) return null;
    return {
      id: 'interruptions',
      severity: 'attention',
      scope: 'overall',
      title: 'Keep your flow intact',
      message: `Your sessions get interrupted about ${ratio.toFixed(1)}× each on average. A 5-minute pause between tasks can cut that noticeably.`,
    };
  },
};

function toDate(day: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
function toDayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function fromDate(date: Date): string {
  return toDayKey(date);
}
function subtractDays(day: string, n: number): string {
  const date = toDate(day);
  date.setDate(date.getDate() - n);
  return toDayKey(date);
}

/** Registry of insight generators. Adding a new insight = appending a generator here. */
export const INSIGHT_GENERATORS: InsightGenerator[] = [
  preferredHours,
  bestWeeklyDay,
  focusTrend,
  planCompletion,
  streakCallout,
  interruptionInsight,
];

export function runGenerators(context: InsightContext): Insight[] {
  const insights: Insight[] = [];
  for (const generator of INSIGHT_GENERATORS) {
    try {
      const result = generator.generate(context);
      if (result) insights.push(result);
    } catch {
      // a single generator must never break the whole feed
    }
  }
  return insights;
}
