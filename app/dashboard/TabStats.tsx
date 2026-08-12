'use client';

import { useMemo, useState, useId } from 'react';
import type { ComponentType, ReactNode } from 'react';
import {
  FiClock,
  FiTrendingUp,
  FiTrendingDown,
  FiActivity,
  FiBarChart2,
  FiTarget,
  FiCheckCircle,
  FiMinus,
  FiStar,
  FiInfo,
  FiArrowRight,
  FiPlay,
  FiPlus,
  FiXCircle,
  FiZap,
} from 'react-icons/fi';
import { FaFire } from 'react-icons/fa';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { sumSessionMinutes, formatMinutesAsHoursMinutes } from '@/src/utils/time';
import { calculateStreak, calculateSuccessRate } from '@/src/utils/statistics';
import { formatShortDate, formatLongDate, toIsoDateString, getWeekStart, getPreviousWeekStart } from '@/src/utils/date';
import { AnimatedNumber } from '@/src/components/ui/AnimatedNumber';
import { PLAN_STATUS } from '@/src/types';
import type { Session, Plan } from '@/src/types';
import type { AnalyticsResult } from '@/lib/analytics/types';
import type { Insight } from '@/lib/analytics/types';

interface TabStatsProps {
  dailyStats: { focusTime: string; sessions: number; streak: string; productivity: string };
  weeklyStreak: number;
  totalFocusHours: number;
  sessions?: Session[];
  plans?: Plan[];
  analytics?: AnalyticsResult | null;
  onNavigateTab?: (tab: string) => void;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

type SeverityStyle = { pill: string; ring: string; icon: string };

const SEVERITY_STYLES: Record<Insight['severity'], SeverityStyle> = {
  positive: {
    pill: 'bg-success/10 text-success',
    ring: 'bg-success/10',
    icon: 'text-success',
  },
  neutral: {
    pill: 'bg-surface-hover text-text-secondary',
    ring: 'bg-surface-hover',
    icon: 'text-text-secondary',
  },
  attention: {
    pill: 'bg-warning/10 text-warning',
    ring: 'bg-warning/10',
    icon: 'text-warning',
  },
};

const SEVERITY_LABELS: Record<Insight['severity'], string> = {
  positive: 'Positive',
  neutral: 'Neutral',
  attention: 'Attention',
};

const softCard = 'card-glass rounded-[22px] p-6 sm:p-8';
const interactiveCard =
  'hover:-translate-y-px hover:shadow-[var(--card-shadow-hover)] hover:bg-surface-hover/40 transition-all duration-200';

type RangeKey = 'week' | 'month' | '3m' | 'all';

const RANGES: { key: RangeKey; label: string }[] = [
  { key: 'week', label: 'This week' },
  { key: 'month', label: 'This month' },
  { key: '3m', label: 'Last 3 months' },
  { key: 'all', label: 'All time' },
];

const RANGE_LABELS: Record<RangeKey, string> = {
  week: 'This week',
  month: 'This month',
  '3m': 'Last 3 months',
  all: 'All time',
};

interface Bounds {
  start: Date;
  end: Date;
  prevStart: Date;
  prevEnd: Date | null;
  prevLabel: string;
}

function rangeBounds(range: RangeKey, now = new Date()): Bounds | null {
  if (range === 'week') {
    const weekStart = getWeekStart(now);
    return {
      start: weekStart,
      end: now,
      prevStart: getPreviousWeekStart(now),
      prevEnd: new Date(weekStart.getTime() - 1),
      prevLabel: 'last week',
    };
  }
  if (range === 'month') {
    return {
      start: new Date(now.getFullYear(), now.getMonth(), 1),
      end: now,
      prevStart: new Date(now.getFullYear(), now.getMonth() - 1, 1),
      prevEnd: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999),
      prevLabel: 'last month',
    };
  }
  if (range === '3m') {
    const start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    return {
      start,
      end: now,
      prevStart: new Date(now.getFullYear(), now.getMonth() - 5, 1),
      prevEnd: new Date(start.getTime() - 1),
      prevLabel: 'the previous 3 months',
    };
  }
  return null;
}

function sessionsInRange(sessions: Session[], start: Date, end: Date): Session[] {
  const startMs = start.getTime();
  const endMs = end.getTime();
  return sessions.filter((s) => {
    const t = new Date(s.date).getTime();
    return t >= startMs && t <= endMs;
  });
}

interface Bucket {
  key: string;
  label: string;
  axis: string;
  minutes: number;
  count: number;
  completed: number;
}

function buildBuckets(sessions: Session[], range: RangeKey, now = new Date()): Bucket[] {
  if (range === 'week') {
    const start = getWeekStart(now);
    const buckets: Bucket[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const dateStr = formatShortDate(d);
      const daySessions = sessions.filter((s) => s.date === dateStr);
      buckets.push({
        key: dateStr,
        label: formatShortDate(d),
        axis: DAYS[i],
        minutes: sumSessionMinutes(daySessions),
        count: daySessions.length,
        completed: daySessions.filter((s) => s.status === 'Completed').length,
      });
    }
    return buckets;
  }

  if (range === 'month') {
    const y = now.getFullYear();
    const m = now.getMonth();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const buckets: Bucket[] = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(y, m, day);
      const dateStr = formatShortDate(d);
      const daySessions = sessions.filter((s) => s.date === dateStr);
      buckets.push({
        key: dateStr,
        label: formatShortDate(d),
        axis: String(day),
        minutes: sumSessionMinutes(daySessions),
        count: daySessions.length,
        completed: daySessions.filter((s) => s.status === 'Completed').length,
      });
    }
    return buckets;
  }

  if (range === '3m') {
    const end = getWeekStart(now);
    const buckets: Bucket[] = [];
    for (let w = 12; w >= 0; w--) {
      const start = new Date(end);
      start.setDate(start.getDate() - w * 7);
      const weekEnd = new Date(start);
      weekEnd.setDate(start.getDate() + 6);
      const weekSessions = sessionsInRange(sessions, start, weekEnd);
      buckets.push({
        key: `${start.getTime()}`,
        label: `Week of ${start.getMonth() + 1}/${start.getDate()}`,
        axis: `${start.getMonth() + 1}/${start.getDate()}`,
        minutes: sumSessionMinutes(weekSessions),
        count: weekSessions.length,
        completed: weekSessions.filter((s) => s.status === 'Completed').length,
      });
    }
    return buckets;
  }

  const sessionTimes = sessions.map((s) => new Date(s.date).getTime()).filter((t) => !Number.isNaN(t));
  const firstTime = sessionTimes.length > 0 ? Math.min(...sessionTimes) : now.getTime();
  const cursor = new Date(firstTime);
  cursor.setDate(1);
  cursor.setHours(0, 0, 0, 0);
  const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const buckets: Bucket[] = [];
  let guard = 0;
  while (cursor.getTime() <= currentMonth.getTime() && guard < 400) {
    const monthStart = new Date(cursor);
    const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59, 999);
    const monthSessions = sessionsInRange(sessions, monthStart, monthEnd);
    buckets.push({
      key: `${cursor.getTime()}`,
      label: cursor.toLocaleString('default', { month: 'long', year: 'numeric' }),
      axis: cursor.toLocaleString('default', { month: 'short' }),
      minutes: sumSessionMinutes(monthSessions),
      count: monthSessions.length,
      completed: monthSessions.filter((s) => s.status === 'Completed').length,
    });
    cursor.setMonth(cursor.getMonth() + 1);
    guard++;
  }
  return buckets;
}

function smoothLine(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return d;
}

function SectionTitle({
  icon: Icon,
  title,
  right,
}: {
  icon: ComponentType<{ size?: number; className?: string }>;
  title: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <Icon size={18} className="text-text-secondary" />
        <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-text">{title}</h2>
      </div>
      {right}
    </div>
  );
}

function ProgressRing({
  value,
  size = 36,
  strokeWidth = 3,
  children,
  color = 'var(--accent)',
  bgColor = 'var(--surface-hover)',
  reduced = false,
}: {
  value: number;
  size?: number;
  strokeWidth?: number;
  children?: ReactNode;
  color?: string;
  bgColor?: string;
  reduced?: boolean | null;
}) {
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = Math.max(0, circumference - (Math.min(value, 100) / 100) * circumference);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg className="w-full h-full -rotate-90" viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke={bgColor} strokeWidth={strokeWidth} fill="none" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: reduced ? 0 : 1, ease: 'easeOut' }}
        />
      </svg>
      {children && <div className="absolute inset-0 flex items-center justify-center">{children}</div>}
    </div>
  );
}

function MiniBar({
  value,
  color = 'var(--accent)',
  height = 4,
  reduced = false,
}: {
  value: number;
  color?: string;
  height?: number;
  reduced?: boolean | null;
}) {
  return (
    <div className="w-full bg-surface-hover rounded-full overflow-hidden" style={{ height }}>
      <motion.div
        className="h-full rounded-full"
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(value, 100)}%` }}
        transition={{ duration: reduced ? 0 : 0.8, ease: 'easeOut' }}
        style={{ background: color }}
      />
    </div>
  );
}

function RangeControl({ range, onChange }: { range: RangeKey; onChange: (range: RangeKey) => void }) {
  const reduced = useReducedMotion();
  const uid = useId();
  return (
    <div
      role="group"
      aria-label="Statistics range"
      className="flex items-center bg-surface-hover rounded-xl p-1 border border-border w-fit"
    >
      {RANGES.map((r) => {
        const active = range === r.key;
        return (
          <button
            key={r.key}
            type="button"
            onClick={() => onChange(r.key)}
            aria-pressed={active}
            className={`relative rounded-lg px-3 h-9 text-[13px] font-medium transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-focus-ring outline-none ${
              active ? 'text-text' : 'text-text-secondary hover:text-text'
            }`}
          >
            {active && (
              <motion.span
                layoutId={`stats-range-${uid}`}
                className="absolute inset-0 rounded-lg bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_10px_rgba(0,0,0,0.06)]"
                transition={{ type: 'tween', duration: reduced ? 0 : 0.22, ease: 'easeInOut' }}
              />
            )}
            <span className="relative z-10">{r.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function InfoTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="More about this metric"
        className="flex items-center justify-center w-5 h-5 rounded-full text-text-muted hover:text-text hover:bg-surface-hover transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus-ring outline-none"
      >
        <FiInfo size={13} />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <button
              className="fixed inset-0 z-20 cursor-default"
              aria-hidden="true"
              tabIndex={-1}
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-full mt-2 z-30 w-60 card-glass rounded-xl p-3 text-xs text-text-secondary leading-relaxed"
              role="tooltip"
            >
              {text}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </span>
  );
}

function FocusChart({ buckets, onViewSessions }: { buckets: Bucket[]; onViewSessions?: () => void }) {
  const reduced = useReducedMotion();
  const uid = useId();
  const [hover, setHover] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);

  const max = Math.max(...buckets.map((b) => b.minutes), 1);
  const points = buckets.map((b, i) => ({
    x: buckets.length > 1 ? (i / (buckets.length - 1)) * 100 : 50,
    y: 34 - (b.minutes / max) * 24,
  }));
  const path = smoothLine(points);
  const area = `${path} L 100 34 L 0 34 Z`;
  const tooltipLeft = hover !== null ? Math.min(92, Math.max(8, (hover / (buckets.length - 1)) * 100)) : 0;
  const totalMinutes = buckets.reduce((acc, b) => acc + b.minutes, 0);
  const hasAnyData = totalMinutes > 0;
  const axisStep = Math.max(1, Math.ceil(buckets.length / 7));

  return (
    <>
      <div className="relative h-40">
        <motion.svg
          viewBox="0 0 100 36"
          className="w-full h-full"
          preserveAspectRatio="none"
          aria-hidden="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: reduced ? 0 : 0.5 }}
        >
          <defs>
            <linearGradient id={`${uid}-area`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.12" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[10, 18, 26, 34].map((y) => (
            <line
              key={y}
              x1="0"
              y1={y}
              x2="100"
              y2={y}
              stroke="var(--chart-grid)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {hasAnyData && <path d={area} fill={`url(#${uid}-area)`} />}
          {hasAnyData && (
            <motion.path
              d={path}
              fill="none"
              stroke="var(--accent)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: reduced ? 0 : 0.7, ease: 'easeOut' }}
            />
          )}
          {hasAnyData &&
            points.map((p, i) => (
              <motion.circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={buckets[i].minutes > 0 ? 1.6 : 0.9}
                fill={buckets[i].minutes > 0 ? 'var(--accent)' : 'var(--surface-hover)'}
                stroke="var(--page)"
                strokeWidth="0.4"
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: reduced ? 0 : 0.3, delay: reduced ? 0 : 0.2 + i * 0.02 }}
              />
            ))}
        </motion.svg>

        <div className="absolute inset-0 flex">
          {buckets.map((b, i) => (
            <button
              key={b.key}
              type="button"
              tabIndex={0}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              onClick={() => setSelected((prev) => (prev === i ? null : i))}
              aria-label={`${b.label} — ${formatMinutesAsHoursMinutes(b.minutes)} focused, ${b.count} session${b.count !== 1 ? 's' : ''}`}
              aria-pressed={selected === i}
              className="flex-1 h-full rounded-md outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            />
          ))}
        </div>

        {hover !== null && (
          <div className="pointer-events-none absolute top-0 z-20 -translate-x-1/2" style={{ left: `${tooltipLeft}%` }}>
            <div className="card-glass rounded-lg px-3 py-2 text-xs whitespace-nowrap -mt-1">
              <div className="font-medium text-text">{buckets[hover].label}</div>
              <div className="text-text-muted mt-0.5">
                {formatMinutesAsHoursMinutes(buckets[hover].minutes)} focused &middot; {buckets[hover].count} session
                {buckets[hover].count !== 1 ? 's' : ''}
              </div>
              <div className="text-text-muted">{buckets[hover].completed} completed</div>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-between mt-2 px-0.5">
        {buckets.map((b, i) => (
          <span
            key={b.key}
            className={`text-[10px] text-text-muted tabular-nums ${i % axisStep !== 0 ? 'opacity-0' : ''}`}
          >
            {b.axis}
          </span>
        ))}
      </div>

      <AnimatePresence>
        {selected !== null && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: reduced ? 0 : 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-4 rounded-xl bg-surface-hover/70 border border-border px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
                  <div>
                    <div className="text-[13px] font-medium text-text">{buckets[selected].label}</div>
                    <div className="text-xs text-text-muted mt-0.5">Selected period</div>
                  </div>
                  <div className="text-[13px] text-text-secondary">
                    <span className="font-medium text-text tabular-nums">
                      {formatMinutesAsHoursMinutes(buckets[selected].minutes)}
                    </span>{' '}
                    focus time
                  </div>
                  <div className="text-[13px] text-text-secondary">
                    <span className="font-medium text-text tabular-nums">{buckets[selected].count}</span> sessions
                  </div>
                  <div className="text-[13px] text-text-secondary">
                    <span className="font-medium text-text tabular-nums">{buckets[selected].completed}</span> completed
                  </div>
                </div>
                <button
                  onClick={onViewSessions}
                  className="inline-flex items-center gap-1.5 text-[13px] font-medium text-accent hover:text-accent-hover transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus-ring outline-none"
                >
                  View sessions <FiArrowRight size={14} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default function TabStats({ sessions = [], plans = [], analytics, onNavigateTab }: TabStatsProps) {
  const reduced = useReducedMotion();
  const [range, setRange] = useState<RangeKey>('week');

  const bounds = useMemo(() => rangeBounds(range), [range]);

  const rangeSessions = useMemo(() => {
    if (!bounds) return sessions;
    return sessionsInRange(sessions, bounds.start, bounds.end);
  }, [sessions, bounds]);

  const prevSessions = useMemo(() => {
    if (!bounds || !bounds.prevEnd) return [];
    return sessionsInRange(sessions, bounds.prevStart, bounds.prevEnd);
  }, [sessions, bounds]);

  const buckets = useMemo(() => buildBuckets(sessions, range), [sessions, range]);

  const rangeMinutes = sumSessionMinutes(rangeSessions);
  const prevMinutes = sumSessionMinutes(prevSessions);

  const rangeCounts = useMemo(
    () => ({
      completed: rangeSessions.filter((s) => s.status === 'Completed').length,
      inProgress: rangeSessions.filter((s) => s.status === 'In Progress').length,
      missed: rangeSessions.filter((s) => s.status === 'Missed').length,
      total: rangeSessions.length,
    }),
    [rangeSessions],
  );

  const successRate = calculateSuccessRate(rangeSessions);
  const missedRate = rangeCounts.total > 0 ? Math.round((rangeCounts.missed / rangeCounts.total) * 100) : 0;
  const avgSessionMin = rangeCounts.completed > 0 ? Math.round(rangeMinutes / rangeCounts.completed) : 0;
  const noSessions = rangeCounts.total === 0;
  const hasAnyData = sessions.length > 0;

  const trend = useMemo(() => {
    if (prevMinutes <= 0) {
      return rangeMinutes > 0 ? ({ type: 'new', text: 'New' } as const) : ({ type: 'none', text: 'No data' } as const);
    }
    const pct = Math.round(((rangeMinutes - prevMinutes) / prevMinutes) * 100);
    if (pct > 0) return { type: 'up', text: `+${pct}%` } as const;
    if (pct < 0) return { type: 'down', text: `${pct}%` } as const;
    return { type: 'flat', text: '0%' } as const;
  }, [rangeMinutes, prevMinutes]);

  const firstSessionLabel = useMemo(() => {
    const times = sessions.map((s) => new Date(s.date).getTime()).filter((t) => !Number.isNaN(t));
    if (times.length === 0) return '';
    const first = new Date(Math.min(...times));
    return first.toLocaleString('default', { month: 'long', year: 'numeric' });
  }, [sessions]);

  const bestBucket = useMemo(() => {
    let best = buckets[0];
    for (const b of buckets) if (b.minutes > best.minutes) best = b;
    return best;
  }, [buckets]);

  const streak = calculateStreak(rangeSessions);

  const rangePlans = useMemo(() => {
    if (!bounds) return plans;
    const startIso = toIsoDateString(bounds.start);
    const endIso = toIsoDateString(bounds.end);
    return plans.filter((p) => p.date >= startIso && p.date <= endIso);
  }, [plans, bounds]);

  const planCounts = useMemo(
    () => ({
      completed: rangePlans.filter((p) => p.status === PLAN_STATUS.COMPLETED).length,
      inProgress: rangePlans.filter((p) => p.status === PLAN_STATUS.IN_PROGRESS).length,
      pending: rangePlans.filter((p) => p.status === PLAN_STATUS.PENDING).length,
      notStarted: rangePlans.filter((p) => p.status === PLAN_STATUS.NOT_STARTED).length,
      total: rangePlans.length,
    }),
    [rangePlans],
  );
  const planCompletionRate = planCounts.total > 0 ? Math.round((planCounts.completed / planCounts.total) * 100) : 0;

  const last7Days = useMemo(() => {
    const dots: { date: string; active: boolean }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = formatShortDate(d);
      dots.push({ date: dateStr, active: sessions.some((s) => s.date === dateStr && s.status === 'Completed') });
    }
    return dots;
  }, [sessions]);

  const metricCards = [
    {
      label: 'Total Sessions',
      value: rangeCounts.total,
      icon: FiClock,
      iconClass: 'text-text-muted',
      sub: noSessions ? 'No sessions yet' : `${formatMinutesAsHoursMinutes(rangeMinutes)} total`,
    },
    {
      label: 'Completed',
      value: rangeCounts.completed,
      icon: FiCheckCircle,
      iconClass: 'text-success',
      sub: noSessions ? 'No completions' : `${successRate}% completion`,
    },
    {
      label: 'In Progress',
      value: rangeCounts.inProgress,
      icon: FiActivity,
      iconClass: 'text-warning',
      sub: rangeCounts.inProgress > 0 ? 'Focus in progress' : 'No active session',
    },
    {
      label: 'Missed',
      value: rangeCounts.missed,
      icon: FiXCircle,
      iconClass: 'text-danger',
      sub: rangeCounts.missed > 0 ? `${missedRate}% rate` : 'Nothing missed',
    },
  ];

  const quickCells = [
    {
      label: 'Avg session',
      value: noSessions ? '—' : `${avgSessionMin}m`,
      sub: noSessions ? 'No data' : `${rangeCounts.completed} completed`,
    },
    {
      label: 'Best day',
      value: bestBucket && bestBucket.minutes > 0 ? bestBucket.axis : '—',
      sub:
        bestBucket && bestBucket.minutes > 0 ? `${formatMinutesAsHoursMinutes(bestBucket.minutes)} focused` : 'No data',
    },
    {
      label: 'Sessions',
      value: String(rangeCounts.total),
      sub: noSessions ? 'No data' : `${rangeCounts.completed} completed`,
    },
    {
      label: 'Completion',
      value: noSessions ? '—' : `${successRate}%`,
      sub: noSessions ? 'No data' : `${rangeCounts.completed}/${rangeCounts.total} sessions`,
    },
  ];

  const productivityLabel =
    successRate >= 80 ? 'Excellent' : successRate >= 60 ? 'Good' : successRate >= 40 ? 'Fair' : 'Needs focus';

  const insights = useMemo(() => {
    if (rangeSessions.length === 0)
      return [] as { icon: ComponentType<{ size?: number; className?: string }>; text: string; sub: string }[];
    const list: { icon: ComponentType<{ size?: number; className?: string }>; text: string; sub: string }[] = [];
    if (bestBucket && bestBucket.minutes > 0) {
      list.push({
        icon: FiStar,
        text: `Your strongest focus was ${bestBucket.label}.`,
        sub: `${formatMinutesAsHoursMinutes(bestBucket.minutes)} of focus`,
      });
    }
    if (avgSessionMin > 0) {
      list.push({
        icon: FiClock,
        text: `Your average session was ${avgSessionMin} minutes.`,
        sub: avgSessionMin >= 25 ? 'Great depth' : avgSessionMin >= 15 ? 'Good pace' : 'Building up',
      });
    }
    if (trend.type !== 'none') {
      if (range === 'all') {
        list.push({
          icon: FiTrendingUp,
          text: `You've logged ${formatMinutesAsHoursMinutes(rangeMinutes)} of focus in total.`,
          sub: `${rangeCounts.total} session${rangeCounts.total !== 1 ? 's' : ''} all time`,
        });
      } else if (trend.type === 'up' || trend.type === 'down') {
        list.push({
          icon: FiTrendingUp,
          text: `You focused ${trend.text} vs ${bounds?.prevLabel}.`,
          sub: range === 'week' ? 'Compared with last week' : 'Compared with the previous period',
        });
      }
    }
    list.push({
      icon: FiTarget,
      text: `You completed ${successRate}% of sessions in this period.`,
      sub: `${rangeCounts.completed}/${rangeCounts.total} sessions`,
    });
    return list.slice(0, 4);
  }, [rangeSessions, bestBucket, avgSessionMin, trend, range, rangeMinutes, rangeCounts, bounds, successRate]);

  const fade = (delay: number) => ({
    initial: { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: reduced ? 0 : 0.18, delay: reduced ? 0 : delay },
  });

  return (
    <div className="space-y-8">
      {/* ===== Header ===== */}
      <motion.header {...fade(0)} className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-[13px] text-text-muted">{formatLongDate(new Date())}</div>
          <h1 className="mt-1.5 text-[34px] sm:text-[40px] font-semibold leading-[1.1] tracking-[-0.025em] text-text">
            Statistics
          </h1>
          <p className="mt-2 text-[15px] text-text-secondary">Your focus, scores, and trends at a glance.</p>
        </div>
        <div className="self-start md:self-auto">
          <RangeControl range={range} onChange={setRange} />
        </div>
      </motion.header>

      {/* ===== Hero: Total Focus Time + chart ===== */}
      <motion.section {...fade(0.05)} className={`${softCard} ${interactiveCard}`}>
        <div className="flex flex-col lg:flex-row lg:items-end gap-5 lg:gap-0">
          <div className="lg:flex-1">
            <div className="text-[13px] text-text-muted">Total Focus Time &middot; {RANGE_LABELS[range]}</div>
            <div className="mt-1.5 text-5xl lg:text-6xl font-semibold tracking-[-0.02em] text-text tabular-nums leading-none">
              {formatMinutesAsHoursMinutes(rangeMinutes)}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-text-secondary">
              <span>
                <strong className="text-text font-medium tabular-nums">{rangeCounts.total}</strong> session
                {rangeCounts.total !== 1 ? 's' : ''} in period
              </span>
              {rangeCounts.total > 0 && (
                <>
                  <span className="w-px h-4 bg-border" />
                  {range === 'all' ? (
                    <span className="flex items-center gap-1.5">
                      <FiMinus size={14} className="text-text-muted" />
                      <span className="text-text-muted">Since {firstSessionLabel}</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5">
                      {trend.type === 'up' && <FiTrendingUp size={14} className="text-success" />}
                      {trend.type === 'down' && <FiTrendingDown size={14} className="text-danger" />}
                      {trend.type === 'flat' && <FiMinus size={14} className="text-text-muted" />}
                      {trend.type === 'new' && <FiTrendingUp size={14} className="text-success" />}
                      <span
                        className={
                          trend.type === 'up' || trend.type === 'new'
                            ? 'text-success'
                            : trend.type === 'down'
                              ? 'text-danger'
                              : 'text-text-muted'
                        }
                      >
                        {trend.type === 'new' ? 'New' : trend.text}
                      </span>
                      <span>vs {bounds?.prevLabel}</span>
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
          {!noSessions && (
            <div className="flex items-center gap-5 lg:pl-8 lg:border-l border-border">
              <div className="text-center">
                <div className="text-xs text-text-muted mb-1">Best {range === 'week' ? 'day' : 'period'}</div>
                <div className="text-lg font-semibold text-text tabular-nums">
                  {bestBucket && bestBucket.minutes > 0 ? bestBucket.axis : '\u2014'}
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs text-text-muted mb-1">Completion</div>
                <div className="text-lg font-semibold text-text tabular-nums">{successRate}%</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-text-muted mb-1">Avg session</div>
                <div className="text-lg font-semibold text-text tabular-nums">{avgSessionMin}m</div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-5 pt-5 border-t border-divider">
          {noSessions ? (
            <div className="flex flex-col items-center justify-center text-center py-8">
              <div className="w-12 h-12 rounded-full bg-surface-hover flex items-center justify-center">
                <FiTrendingUp className="text-text-muted" size={20} />
              </div>
              <p className="mt-4 text-[15px] text-text-secondary">
                {hasAnyData ? `No focus sessions in this range yet.` : 'No focus sessions yet.'}
              </p>
              <p className="mt-1 text-sm text-text-muted">
                {hasAnyData
                  ? 'Try a different range, or start a new focus session.'
                  : 'Start your first focus session to build your history.'}
              </p>
              <button
                onClick={() => onNavigateTab?.('sessions')}
                className="mt-5 inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-accent-contrast rounded-[12px] px-5 h-10 text-[14px] font-semibold transition-colors duration-200 active:opacity-80 focus-visible:ring-2 focus-visible:ring-focus-ring outline-none"
              >
                <FiPlay size={15} className="fill-current" /> Start focus
              </button>
            </div>
          ) : (
            <FocusChart buckets={buckets} onViewSessions={() => onNavigateTab?.('sessions')} />
          )}
        </div>
      </motion.section>

      {/* ===== Productivity insights (Phase 16) ===== */}
      <motion.section {...fade(0.08)} className={`${softCard} ${interactiveCard}`}>
        <SectionTitle
          icon={FiZap}
          title="Productivity insights"
          right={
            analytics ? (
              <span className="text-[11px] text-text-muted">{analytics.daily.length} days analysed</span>
            ) : undefined
          }
        />
        {!analytics || analytics.daily.length === 0 ? (
          <div className="flex items-start gap-3 mt-5">
            <FiInfo className="text-text-muted mt-0.5 shrink-0" size={16} />
            <p className="text-sm text-text-muted leading-relaxed">
              Insights are computed from your focus history when analytics are enabled. Add a few sessions and plans to
              start seeing patterns.
            </p>
          </div>
        ) : analytics.insights.length === 0 ? (
          <div className="flex items-start gap-3 mt-5">
            <FiInfo className="text-text-muted mt-0.5 shrink-0" size={16} />
            <p className="text-sm text-text-muted leading-relaxed">
              Not enough history yet to detect patterns. Keep logging sessions and plans — insights will appear
              automatically.
            </p>
          </div>
        ) : (
          <ul className="mt-5 space-y-4">
            {analytics.insights.map((insight) => {
              const style = SEVERITY_STYLES[insight.severity];
              return (
                <li key={insight.id} className="flex items-start gap-3">
                  <span className={`w-8 h-8 rounded-full ${style.ring} flex items-center justify-center shrink-0`}>
                    <FiZap className={style.icon} size={14} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-text">{insight.title}</p>
                      <span
                        className={`text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 ${style.pill}`}
                      >
                        {SEVERITY_LABELS[insight.severity]}
                      </span>
                    </div>
                    <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">{insight.message}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </motion.section>

      {/* ===== Session metrics ===== */}
      <motion.section {...fade(0.1)}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {metricCards.map((item, i) => {
            const Icon = item.icon;
            return (
              <motion.button
                key={item.label}
                type="button"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: reduced ? 0 : 0.25, delay: reduced ? 0 : i * 0.04 }}
                onClick={() => onNavigateTab?.('sessions')}
                aria-label={`View ${item.label.toLowerCase()} in sessions`}
                className="card-glass rounded-[20px] p-5 text-left relative overflow-hidden transition-all duration-200 hover:-translate-y-px hover:shadow-[var(--card-shadow-hover)] hover:bg-surface-hover/40 cursor-pointer focus-visible:ring-2 focus-visible:ring-focus-ring outline-none"
              >
                <span className="text-xs font-medium text-text-secondary">{item.label}</span>
                <div className="mt-1.5 flex items-baseline justify-between gap-2">
                  <span className="text-[26px] font-semibold tracking-tight text-text tabular-nums leading-none">
                    <AnimatedNumber value={item.value} />
                  </span>
                  <span className={item.iconClass}>
                    <Icon size={15} />
                  </span>
                </div>
                <div className="mt-1.5 text-xs text-text-muted">{item.sub}</div>
              </motion.button>
            );
          })}
        </div>
      </motion.section>

      {/* ===== Focus Score + Streak + Quick stats ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.section {...fade(0.15)}>
          <div className={`${softCard} h-full`}>
            <SectionTitle
              icon={FiTarget}
              title="Focus score"
              right={
                noSessions ? (
                  <span className="text-xs text-text-muted">No data</span>
                ) : (
                  <span className="text-xs font-medium text-success">{productivityLabel}</span>
                )
              }
            />
            <div className="mt-5 flex items-center gap-5">
              <ProgressRing value={successRate} size={88} strokeWidth={6} reduced={reduced}>
                <span className="text-lg font-bold text-text tabular-nums">
                  {noSessions ? '\u2014' : <AnimatedNumber value={successRate} suffix="%" />}
                </span>
              </ProgressRing>
              <div className="min-w-0 flex-1 space-y-2.5">
                <div className="flex items-center gap-2 text-xs text-text-secondary">
                  <FiTarget size={12} className="shrink-0 text-text-secondary" />
                  <span className="min-w-0">
                    {noSessions
                      ? 'No sessions completed in this period'
                      : `${successRate}% of sessions completed in this period`}
                  </span>
                  <InfoTip text="Focus score is the share of sessions you completed in the selected period, based on completed sessions divided by all sessions." />
                </div>
                <div className="flex items-center gap-2 text-xs text-text-secondary">
                  <FiClock size={12} className="shrink-0 text-text-secondary" />
                  <span className="min-w-0">
                    {noSessions
                      ? 'Start a session to get a score'
                      : `Based on ${rangeCounts.total} session${rangeCounts.total !== 1 ? 's' : ''}`}
                  </span>
                </div>
                <MiniBar value={successRate} height={4} reduced={reduced} />
              </div>
            </div>
          </div>
        </motion.section>

        <motion.section {...fade(0.2)}>
          <div className={`${softCard} h-full`}>
            <div className="flex items-center justify-between gap-3">
              <SectionTitle icon={FaFire} title="Streak" />
              <span className="text-[11px] text-text-muted">{RANGE_LABELS[range]}</span>
            </div>
            <div className="mt-5 flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-surface-hover flex items-center justify-center">
                <FaFire size={22} className={streak > 0 ? 'text-warning' : 'text-text-muted'} />
              </div>
              <div>
                <div className="flex items-end gap-1.5">
                  <span className="text-4xl font-semibold tracking-tight text-text tabular-nums">
                    <AnimatedNumber value={streak} />
                  </span>
                  <span className="text-sm text-text-secondary mb-1">day{streak !== 1 ? 's' : ''}</span>
                </div>
                <div className="text-xs text-text-muted mt-1">
                  {streak > 0 ? 'Current streak' : noSessions ? 'Start a session to begin' : 'No active streak'}
                </div>
              </div>
            </div>
            <div className="mt-5 pt-4 border-t border-divider">
              <div className="flex items-center gap-1.5">
                {last7Days.map((d, i) => (
                  <div
                    key={i}
                    role="img"
                    aria-label={`${d.date}${d.active ? ', completed a session' : ', no session'}`}
                    className="w-full h-2 rounded-full transition-colors duration-150"
                    style={{ background: d.active ? 'var(--warning)' : 'var(--surface-hover)' }}
                  />
                ))}
              </div>
              <div className="flex justify-between text-[10px] text-text-muted mt-1">
                <span>7 days ago</span>
                <span>Today</span>
              </div>
              <div className="mt-4">
                {streak === 0 ? (
                  <button
                    onClick={() => onNavigateTab?.('sessions')}
                    className="inline-flex items-center gap-2 rounded-xl bg-accent hover:bg-accent-hover text-accent-contrast px-4 h-9 text-[13px] font-semibold transition-colors duration-200 active:opacity-80 focus-visible:ring-2 focus-visible:ring-focus-ring outline-none"
                  >
                    <FiPlay size={14} className="fill-current" /> Start a session
                  </button>
                ) : (
                  <p className="text-xs text-text-muted">Complete a session each day to keep it going.</p>
                )}
              </div>
            </div>
          </div>
        </motion.section>

        <motion.section {...fade(0.25)}>
          <div className={`${softCard} h-full`}>
            <SectionTitle icon={FiBarChart2} title="Quick stats" />
            <div className="mt-5 grid grid-cols-2 gap-px bg-divider rounded-2xl overflow-hidden border border-divider">
              {quickCells.map((cell) => (
                <div key={cell.label} className="bg-surface p-4">
                  <div className="text-xs text-text-muted">{cell.label}</div>
                  <div className="mt-1.5 text-[22px] font-semibold tracking-tight text-text tabular-nums">
                    {cell.value}
                  </div>
                  <div className="mt-0.5 text-[10px] text-text-muted">{cell.sub}</div>
                </div>
              ))}
            </div>
          </div>
        </motion.section>
      </div>

      {/* ===== Plans Overview + Insights ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.section {...fade(0.3)}>
          <div className={`${softCard} h-full`}>
            <SectionTitle
              icon={FiTarget}
              title="Plans"
              right={
                <button
                  onClick={() => onNavigateTab?.('plans')}
                  className="inline-flex items-center gap-1 text-[12px] font-medium text-accent hover:text-accent-hover transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus-ring outline-none"
                >
                  View plans <FiArrowRight size={13} />
                </button>
              }
            />
            {rangePlans.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-8">
                <p className="text-[15px] text-text-secondary">
                  {hasAnyData ? `No plans in this range.` : 'No plans yet.'}
                </p>
                <p className="mt-1 text-sm text-text-muted">
                  {hasAnyData
                    ? 'Switch ranges, or create a new plan.'
                    : 'Create a plan to give your focus a clear direction.'}
                </p>
                <button
                  onClick={() => onNavigateTab?.('plans')}
                  className="mt-5 inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-accent-contrast rounded-[12px] px-5 h-10 text-[14px] font-semibold transition-colors duration-200 active:opacity-80 focus-visible:ring-2 focus-visible:ring-focus-ring outline-none"
                >
                  <FiPlus size={16} /> Create a plan
                </button>
              </div>
            ) : (
              <>
                <div className="mt-5 flex items-baseline justify-between text-[13px]">
                  <span className="text-text-secondary">
                    {planCounts.completed} of {planCounts.total} plans complete
                  </span>
                  <span className="font-medium text-text tabular-nums">{planCompletionRate}%</span>
                </div>
                <div className="mt-2">
                  <MiniBar value={planCompletionRate} height={4} reduced={reduced} />
                </div>
                <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-success" />
                    <span className="text-text-secondary">
                      Completed <strong className="text-text tabular-nums">{planCounts.completed}</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-warning" />
                    <span className="text-text-secondary">
                      In progress <strong className="text-text tabular-nums">{planCounts.inProgress}</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-info" />
                    <span className="text-text-secondary">
                      Pending <strong className="text-text tabular-nums">{planCounts.pending}</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-border" />
                    <span className="text-text-secondary">
                      Not started <strong className="text-text tabular-nums">{planCounts.notStarted}</strong>
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
        </motion.section>

        <motion.section {...fade(0.35)}>
          <div className={`${softCard} h-full`}>
            <SectionTitle icon={FiStar} title="Insights" />
            {insights.length === 0 ? (
              <div className="flex items-start gap-3 mt-5">
                <FiInfo className="text-text-muted mt-0.5 shrink-0" size={16} />
                <p className="text-sm text-text-muted leading-relaxed">
                  Insights will appear as you build more focus history in this period.
                </p>
              </div>
            ) : (
              <ul className="mt-5 space-y-4 group/insights">
                {insights.map((insight, i) => {
                  const Icon = insight.icon;
                  return (
                    <li key={i} className="flex items-start gap-3">
                      <span className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                        <Icon className="text-accent" size={14} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-text-secondary leading-relaxed">{insight.text}</p>
                        <p className="text-xs text-text-muted mt-0.5">{insight.sub}</p>
                      </div>
                      <button
                        onClick={() => onNavigateTab?.('sessions')}
                        className="shrink-0 inline-flex items-center gap-1 text-[12px] font-medium text-accent hover:text-accent-hover transition-colors duration-150 opacity-0 group-hover/insights:opacity-100 focus-visible:opacity-100 outline-none"
                      >
                        Sessions <FiArrowRight size={13} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </motion.section>
      </div>
    </div>
  );
}
