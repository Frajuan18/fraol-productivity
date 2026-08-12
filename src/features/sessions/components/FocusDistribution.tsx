'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { FiTrendingUp, FiActivity, FiArrowDownRight, FiInfo, FiPieChart, FiArrowRight } from 'react-icons/fi';
import { QUICK_TASKS } from '@/src/constants';
import { parseDuration } from '@/src/utils/time';
import { getWeekStart } from '@/src/utils/date';
import type { SessionStatusFilter } from './SessionStatsBar';
import type { Session } from '@/src/types';

type DistributionRange = 'week' | 'month' | 'last30' | 'all';

interface FocusDistributionProps {
  sessions: Session[];
  taskTypes?: string[];
  statusFilter?: SessionStatusFilter;
  loading?: boolean;
}

const RANGE_OPTIONS: { id: DistributionRange; label: string }[] = [
  { id: 'week', label: 'This week' },
  { id: 'month', label: 'This month' },
  { id: 'last30', label: 'Last 30 days' },
  { id: 'all', label: 'All time' },
];

const CX = 200;
const CY = 180;
const RADIUS = 104;
const LABEL_RADIUS = 142;
const LEVELS = 5;
const VIEW_W = 400;
const VIEW_H = 360;

function matchesRange(dateStr: string, range: DistributionRange): boolean {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return true;
  const now = new Date();
  if (range === 'week') return d.getTime() >= getWeekStart().getTime();
  if (range === 'month') return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  if (range === 'last30') {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    return d.getTime() >= today - 29 * 24 * 60 * 60 * 1000;
  }
  return true;
}

function statusMatches(status: Session['status'], filter: SessionStatusFilter): boolean {
  if (filter === 'in-progress') return status === 'In Progress';
  if (filter === 'missed') return status === 'Missed';
  return status === 'Completed';
}

function formatFocusTime(totalMinutes: number): string {
  if (totalMinutes <= 0) return '0m';
  const h = Math.floor(totalMinutes / 60);
  const m = Math.round(totalMinutes % 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function describeMinutes(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = Math.round(totalMinutes % 60);
  if (h > 0 && m > 0) return `${h} hours and ${m} minutes`;
  if (h > 0) return `${h} hours`;
  return `${m} minutes`;
}

function truncateLabel(name: string): string {
  return name.length > 12 ? `${name.slice(0, 11).trimEnd()}…` : name;
}

function balanceLabel(score: number): string {
  if (score < 30) return 'Highly concentrated';
  if (score < 50) return 'Mostly concentrated';
  if (score < 70) return 'Developing variety';
  if (score < 85) return 'Balanced';
  return 'Highly balanced';
}

function pointAt(i: number, n: number, value: number): { x: number; y: number } {
  const a = (Math.PI / 180) * (-90 + (360 / n) * i);
  return { x: CX + Math.cos(a) * value * RADIUS, y: CY + Math.sin(a) * value * RADIUS };
}

export function FocusDistribution({
  sessions,
  taskTypes = [],
  statusFilter = 'completed',
  loading = false,
}: FocusDistributionProps) {
  const reduced = useReducedMotion();
  const [range, setRange] = useState<DistributionRange>('all');
  const [active, setActive] = useState<number | null>(null);
  const [showInfo, setShowInfo] = useState(false);

  useEffect(() => {
    if (active == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActive(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [active]);

  const dist = useMemo(() => {
    const included = sessions.filter((s) => matchesRange(s.date, range) && statusMatches(s.status, statusFilter));
    const map = new Map<string, { minutes: number; sessions: number }>();
    for (const s of included) {
      const minutes = parseDuration(s.duration).totalMinutes;
      const cur = map.get(s.task) || { minutes: 0, sessions: 0 };
      cur.minutes += minutes;
      cur.sessions += 1;
      map.set(s.task, cur);
    }
    const categories = [...QUICK_TASKS];
    for (const t of taskTypes) if (t && !categories.includes(t) && (map.get(t)?.minutes ?? 0) > 0) categories.push(t);
    const data = categories.map((name) => {
      const { minutes, sessions: count } = map.get(name) || { minutes: 0, sessions: 0 };
      return { name, minutes, sessions: count };
    });
    const totalMinutes = data.reduce((a, d) => a + d.minutes, 0);
    const maxMinutes = Math.max(1, ...data.map((d) => d.minutes));
    return { data, totalMinutes, maxMinutes, hasData: totalMinutes > 0 };
  }, [sessions, range, statusFilter, taskTypes]);

  const safeActive = active != null && active < dist.data.length ? active : null;

  const n = dist.data.length;

  const labels = useMemo(
    () =>
      dist.data.map((d, i) => {
        const base = pointAt(i, n, 1);
        const x = CX + ((base.x - CX) * LABEL_RADIUS) / RADIUS;
        const y = CY + ((base.y - CY) * LABEL_RADIUS) / RADIUS;
        return { ...d, i, x, y, label: truncateLabel(d.name) };
      }),
    [dist, n],
  );

  const insights = useMemo(() => {
    if (!dist.hasData) return null;
    const d = dist.data;
    const top = d.reduce((a, b) => (b.minutes > a.minutes ? b : a), d[0]);
    const nonZero = d.filter((x) => x.minutes > 0);
    const pool = nonZero.length ? nonZero : d;
    const least = pool.reduce((a, b) => (b.minutes < a.minutes ? b : a));
    const share = 1 / d.length;
    const balanced = pool.reduce((a, b) =>
      Math.abs(b.minutes / dist.totalMinutes - share) < Math.abs(a.minutes / dist.totalMinutes - share) ? b : a,
    );
    return { top, least, balanced };
  }, [dist]);

  const balanceScore = useMemo(() => {
    if (!dist.hasData) return null;
    const d = dist.data;
    if (d.length <= 1) return 100;
    let h = 0;
    for (const x of d) {
      if (x.minutes <= 0) continue;
      const p = x.minutes / dist.totalMinutes;
      h -= p * Math.log(p);
    }
    return Math.round((h / Math.log(d.length)) * 100);
  }, [dist]);

  const activePoint =
    safeActive != null ? pointAt(safeActive, n, dist.data[safeActive].minutes / dist.maxMinutes) : null;
  const tooltipX = activePoint ? Math.min(92, Math.max(8, (activePoint.x / VIEW_W) * 100)) : 0;
  const tooltipY = activePoint ? (activePoint.y / VIEW_H) * 100 : 0;
  const tooltipAbove = tooltipY >= 40;
  const tooltipStyle = activePoint
    ? {
        left: `${tooltipX}%`,
        top: `${tooltipY}%`,
        transform: tooltipAbove ? 'translate(-50%, calc(-100% - 12px))' : 'translate(-50%, 12px)',
      }
    : {};

  if (loading) {
    return (
      <section className="card-glass rounded-[22px] p-5 sm:p-6" aria-label="Loading focus distribution">
        <div className="h-4 w-40 rounded bg-surface-hover animate-pulse" />
        <div className="mt-2 h-3 w-64 max-w-full rounded bg-surface-hover/70 animate-pulse" />
        <div className="mt-5 grid gap-6 lg:grid-cols-2">
          <div className="aspect-[400/360] rounded-2xl bg-surface-hover/40 animate-pulse" />
          <div className="space-y-3">
            <div className="h-11 rounded-xl bg-surface-hover/60 animate-pulse" />
            <div className="h-11 rounded-xl bg-surface-hover/60 animate-pulse" />
            <div className="h-11 rounded-xl bg-surface-hover/60 animate-pulse" />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="card-glass rounded-[22px] p-5 sm:p-6" aria-label="Focus Distribution">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[16px] font-semibold tracking-[-0.01em] text-text">Focus Distribution</h3>
          <p className="mt-1 text-[13px] text-text-muted">
            See how your completed focus time is spread across categories.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1 rounded-xl border border-border bg-surface-hover p-1">
          {RANGE_OPTIONS.map((opt) => {
            const isActive = range === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setRange(opt.id)}
                aria-pressed={isActive}
                className={`h-8 rounded-lg px-2.5 text-[12px] font-medium transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-focus-ring sm:px-3 sm:text-[13px] ${
                  isActive ? 'bg-surface text-text shadow-sm' : 'text-text-secondary hover:text-text'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {!dist.hasData ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-hover">
            <FiPieChart size={20} className="text-text-muted" aria-hidden />
          </span>
          <p className="mt-4 text-[15px] text-text-secondary">No focus distribution yet</p>
          <p className="mt-1 max-w-[260px] text-sm text-text-muted">
            Complete sessions in different focus categories to see your distribution.
          </p>
          <button
            type="button"
            onClick={() => setRange('all')}
            className="mt-5 inline-flex h-10 items-center gap-1.5 rounded-xl border border-border bg-surface-hover/50 px-4 text-[13px] font-medium text-text outline-none transition-colors duration-150 hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            <FiArrowRight size={14} aria-hidden /> View all sessions
          </button>
        </div>
      ) : (
        <div className="mt-5 grid gap-6 lg:grid-cols-2 lg:items-start">
          <div className="relative mx-auto w-full max-w-[380px]">
            <div className="relative aspect-[400/360]">
              <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="absolute inset-0 h-full w-full" aria-hidden="true">
                <rect x="0" y="0" width={VIEW_W} height={VIEW_H} fill="transparent" onClick={() => setActive(null)} />

                {Array.from({ length: LEVELS }, (_, l) => {
                  const v = (l + 1) / LEVELS;
                  const d = dist.data.map((_, i) => pointAt(i, n, v));
                  const path =
                    d.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') + ' Z';
                  return <path key={l} d={path} fill="none" stroke="var(--chart-grid)" strokeWidth="1" />;
                })}

                {dist.data.map((_, i) => {
                  const p = pointAt(i, n, 1);
                  return <line key={i} x1={CX} y1={CY} x2={p.x} y2={p.y} stroke="var(--chart-grid)" strokeWidth="1" />;
                })}

                <g
                  key={dist.data
                    .map(
                      (d, i) =>
                        `${d.name}:${pointAt(i, n, dist.maxMinutes > 0 ? d.minutes / dist.maxMinutes : 0).x.toFixed(1)},${pointAt(i, n, dist.maxMinutes > 0 ? d.minutes / dist.maxMinutes : 0).y.toFixed(1)}`,
                    )
                    .join('|')}
                  className={reduced ? undefined : 'fd-animate-polygon'}
                >
                  <polygon
                    points={dist.data
                      .map((d, i) => {
                        const p = pointAt(i, n, dist.maxMinutes > 0 ? d.minutes / dist.maxMinutes : 0);
                        return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
                      })
                      .join(' ')}
                    fill="var(--accent)"
                    fillOpacity={0.16}
                    stroke="var(--accent)"
                    strokeWidth="2"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    opacity={safeActive != null ? 0.45 : 1}
                    className="transition-opacity duration-200"
                  />
                </g>

                {safeActive != null && activePoint && (
                  <line
                    x1={CX}
                    y1={CY}
                    x2={activePoint.x}
                    y2={activePoint.y}
                    stroke="var(--accent)"
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                    opacity="0.55"
                  />
                )}

                {dist.data.map((d, i) => {
                  const p = pointAt(i, n, dist.maxMinutes > 0 ? d.minutes / dist.maxMinutes : 0);
                  const isActive = safeActive === i;
                  const dimmed = safeActive != null && !isActive;
                  return (
                    <g key={i}>
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r={isActive ? 4.5 : 3.5}
                        fill="var(--accent)"
                        stroke={isActive ? 'var(--accent)' : 'var(--page)'}
                        strokeWidth={isActive ? 2 : 1.5}
                        opacity={dimmed ? 0.4 : 1}
                        className="transition-opacity duration-150"
                      />
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r="20"
                        fill="transparent"
                        className="cursor-pointer"
                        role="button"
                        tabIndex={0}
                        onMouseEnter={() => setActive(i)}
                        onMouseLeave={() => setActive((v) => (v === i ? null : v))}
                        onClick={() => setActive((v) => (v === i ? null : i))}
                        onFocus={() => setActive(i)}
                        onBlur={() => setActive((v) => (v === i ? null : v))}
                        aria-label={`${d.name} — ${formatFocusTime(d.minutes)} focused, ${d.sessions} sessions, ${Math.round((d.minutes / dist.totalMinutes) * 100)}% of total focus time`}
                      />
                    </g>
                  );
                })}
              </svg>

              {labels.map((l) => (
                <button
                  key={l.i}
                  type="button"
                  onMouseEnter={() => setActive(l.i)}
                  onMouseLeave={() => setActive((v) => (v === l.i ? null : v))}
                  onFocus={() => setActive(l.i)}
                  onBlur={() => setActive((v) => (v === l.i ? null : v))}
                  onClick={() => setActive((v) => (v === l.i ? null : l.i))}
                  className={`absolute max-w-[88px] -translate-x-1/2 -translate-y-1/2 truncate rounded-md px-1 py-0.5 text-[13px] font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus-ring ${
                    safeActive === l.i ? 'text-accent' : 'text-text-secondary hover:text-text'
                  }`}
                  style={{ left: `${(l.x / VIEW_W) * 100}%`, top: `${(l.y / VIEW_H) * 100}%` }}
                >
                  {l.label}
                </button>
              ))}

              {safeActive != null && (
                <div className="pointer-events-none absolute z-20" style={tooltipStyle}>
                  <div className="card-glass w-max max-w-[190px] rounded-xl px-3 py-2.5 text-left text-xs">
                    <div className="truncate text-[13px] font-medium text-text">{dist.data[safeActive].name}</div>
                    <div className="mt-1.5 flex flex-col gap-0.5 text-text-muted">
                      <span>{formatFocusTime(dist.data[safeActive].minutes)} focused</span>
                      <span>
                        {dist.data[safeActive].sessions} completed session
                        {dist.data[safeActive].sessions !== 1 ? 's' : ''}
                      </span>
                      <span>
                        {Math.round((dist.data[safeActive].minutes / dist.totalMinutes) * 100)}% of total focus time
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {insights && (
                <span className="sr-only">
                  Focus Distribution for the selected period. {insights.top.name} has the most focus time with{' '}
                  {describeMinutes(insights.top.minutes)} across {insights.top.sessions} sessions. {insights.least.name}{' '}
                  has the least focus time with {describeMinutes(insights.least.minutes)}.{' '}
                  {dist.data
                    .map(
                      (d) =>
                        `${d.name}: ${describeMinutes(d.minutes)} across ${d.sessions} sessions, ${Math.round(
                          (d.minutes / dist.totalMinutes) * 100,
                        )}% of total focus time`,
                    )
                    .join('. ')}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            {insights && (
              <div className="divide-y divide-divider rounded-2xl border border-border bg-surface-hover/40">
                <div className="flex items-center gap-3 px-4 py-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-text-muted">
                    <FiTrendingUp size={14} aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] uppercase tracking-[0.06em] text-text-muted">Top Focus</div>
                    <div className="truncate text-[13px] font-medium text-text">{insights.top.name}</div>
                  </div>
                  <div className="shrink-0 text-[13px] font-medium tabular-nums text-text">
                    {formatFocusTime(insights.top.minutes)}
                  </div>
                </div>

                <div className="flex items-center gap-3 px-4 py-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-text-muted">
                    <FiActivity size={14} aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] uppercase tracking-[0.06em] text-text-muted">Most Balanced</div>
                    <div className="truncate text-[13px] font-medium text-text">{insights.balanced.name}</div>
                    <div className="truncate text-[11px] text-text-muted">Consistent across the selected period</div>
                  </div>
                  <div className="shrink-0 text-[13px] font-medium tabular-nums text-text">
                    {formatFocusTime(insights.balanced.minutes)}
                  </div>
                </div>

                <div className="flex items-center gap-3 px-4 py-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-text-muted">
                    <FiArrowDownRight size={14} aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] uppercase tracking-[0.06em] text-text-muted">Least Focused</div>
                    <div className="truncate text-[13px] font-medium text-text">{insights.least.name}</div>
                  </div>
                  <div className="shrink-0 text-[13px] font-medium tabular-nums text-text">
                    {formatFocusTime(insights.least.minutes)}
                  </div>
                </div>
              </div>
            )}

            {balanceScore != null && (
              <div className="rounded-2xl border border-border bg-surface-hover/40 px-4 py-3.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-[13px] font-semibold text-text">Focus Balance</span>
                  <button
                    type="button"
                    onClick={() => setShowInfo((v) => !v)}
                    aria-expanded={showInfo}
                    aria-label="About focus balance"
                    className="flex h-5 w-5 items-center justify-center rounded-full text-text-muted outline-none transition-colors duration-150 hover:bg-surface hover:text-text focus-visible:ring-2 focus-visible:ring-focus-ring"
                  >
                    <FiInfo size={13} aria-hidden />
                  </button>
                </div>
                <div className="mt-1.5 flex items-baseline gap-2">
                  <span className="text-[26px] font-semibold leading-none tracking-tight tabular-nums text-text">
                    {balanceScore}%
                  </span>
                  <span className="text-[13px] text-text-muted">{balanceLabel(balanceScore)}</span>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-hover">
                  <motion.div
                    className="h-full rounded-full bg-accent"
                    initial={{ width: 0 }}
                    animate={{ width: `${balanceScore}%` }}
                    transition={{ duration: reduced ? 0 : 0.5, ease: 'easeOut' }}
                  />
                </div>
                <AnimatePresence>
                  {showInfo && (
                    <motion.p
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: reduced ? 0 : 0.2 }}
                      className="overflow-hidden"
                    >
                      <span className="mt-2.5 block text-[11px] leading-relaxed text-text-muted">
                        Focus Balance measures how evenly your completed focus time is distributed across your active
                        categories. It does not measure productivity or performance.
                      </span>
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
