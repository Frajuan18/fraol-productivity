'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FiCheckCircle,
  FiMail,
  FiSun,
  FiMoon,
  FiSettings,
  FiLogOut,
  FiActivity,
  FiTrendingUp,
  FiClock,
  FiTarget,
  FiCalendar,
  FiCheck,
  FiArrowRight,
  FiLock,
  FiBarChart2,
  FiUsers,
  FiZap,
  FiXCircle,
  FiImage,
} from 'react-icons/fi';
import { FaFire } from 'react-icons/fa';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import Image from 'next/image';
import { useStatistics } from '@/src/hooks/useStatistics';
import { useTheme } from '@/src/contexts/ThemeContext';
import { sumSessionMinutes, formatMinutesAsHoursMinutes } from '@/src/utils/time';
import { formatLongDate } from '@/src/utils/date';
import { AnimatedNumber } from '@/src/components/ui/AnimatedNumber';
import AccentColorControl from '@/src/components/ui/AccentColorControl';
import { getRepository } from '@/lib/repositories/repository';
import { getPublicCloudEnabled } from '@/lib/config';
import { privacySummary } from '@/lib/repositories/privacyMath';
import type { PartnerPrivacySettings } from '@/src/types/collaboration';
import type { Session, Plan } from '@/src/types';

const DEMO_USER_ID = 'demo-user';

async function resolveUserId(): Promise<string> {
  if (getPublicCloudEnabled()) {
    try {
      const response = await fetch('/api/auth/me');
      const body = (await response.json()) as { ok: boolean; user?: { id: string } | null };
      if (body.ok && body.user) return body.user.id;
    } catch {
      // fall through
    }
    return '';
  }
  return DEMO_USER_ID;
}

interface TabProfileProps {
  user: string | null;
  sessions?: Session[];
  plans?: Plan[];
  dailyStats?: { focusTime: string; sessions: number; streak: string; productivity: string };
  weeklyStreak?: number;
  totalFocusHours?: number;
  onNavigateTab?: (tab: string) => void;
}

const softCard = 'card-glass rounded-[22px] p-6 sm:p-7';
const interactiveCard = 'hover:-translate-y-px hover:shadow-[var(--card-shadow-hover)] transition-all duration-200';
const tileBase =
  'rounded-[16px] border border-border bg-surface-hover/40 p-4 hover:-translate-y-px hover:bg-surface-hover/60 transition-all duration-200';

function CompletionRing({
  value,
  size = 46,
  stroke = 3,
  reduced,
}: {
  value: number;
  size?: number;
  stroke?: number;
  reduced: boolean | null;
}) {
  const pct = Math.max(0, Math.min(100, value));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  const center = size / 2;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} aria-hidden="true">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={center} cy={center} r={r} fill="none" strokeWidth={stroke} className="stroke-border-hover" />
        <motion.circle
          cx={center}
          cy={center}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          className="stroke-accent"
          strokeDasharray={c}
          initial={reduced ? { strokeDashoffset: offset } : { strokeDashoffset: c }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: reduced ? 0 : 0.6, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold text-text tabular-nums">
        {pct}%
      </div>
    </div>
  );
}

export default function TabProfile({ user, sessions = [], plans = [], onNavigateTab }: TabProfileProps) {
  const router = useRouter();
  const reduced = useReducedMotion();
  const { theme, toggleTheme } = useTheme();
  const stats = useStatistics(sessions, plans);
  const totalMinutes = sumSessionMinutes(sessions);
  const displayTime = formatMinutesAsHoursMinutes(totalMinutes);

  const [imgFailed, setImgFailed] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const signOutRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const statusTimer = useRef<number | null>(null);

  const [privacy, setPrivacy] = useState<PartnerPrivacySettings | null>(null);
  const [privacyLoading, setPrivacyLoading] = useState(true);
  const [privacyBusy, setPrivacyBusy] = useState<keyof PartnerPrivacySettings | null>(null);
  const [privacyError, setPrivacyError] = useState<string | null>(null);
  const [privacySaved, setPrivacySaved] = useState(false);
  const privacySavedTimer = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const uid = await resolveUserId();
      if (!uid) {
        if (!cancelled) {
          setPrivacyLoading(false);
          setPrivacyError('Sign in to manage partner privacy.');
        }
        return;
      }
      try {
        const settings = await getRepository().getPrivacySettings(uid);
        if (!cancelled) setPrivacy(settings);
      } catch {
        if (!cancelled) setPrivacyError('Could not load privacy settings.');
      } finally {
        if (!cancelled) setPrivacyLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      if (privacySavedTimer.current) window.clearTimeout(privacySavedTimer.current);
    };
  }, []);

  async function togglePrivacy(key: keyof PartnerPrivacySettings) {
    if (!privacy || privacyBusy) return;
    const previous = privacy[key];
    const optimistic: PartnerPrivacySettings = { ...privacy, [key]: !previous };
    setPrivacy(optimistic);
    setPrivacyBusy(key);
    setPrivacyError(null);
    try {
      const uid = await resolveUserId();
      if (!uid) throw new Error('Sign in to manage partner privacy.');
      const saved = await getRepository().updatePrivacySettings(uid, { [key]: optimistic[key] });
      setPrivacy(saved);
      setPrivacySaved(true);
      if (privacySavedTimer.current) window.clearTimeout(privacySavedTimer.current);
      privacySavedTimer.current = window.setTimeout(() => setPrivacySaved(false), 1800);
    } catch (err) {
      setPrivacy(privacy);
      setPrivacyError(err instanceof Error ? err.message : 'Could not update privacy settings.');
    } finally {
      setPrivacyBusy(null);
    }
  }

  const email = useMemo(() => `${(user || 'user').toLowerCase()}@gmail.com`, [user]);

  const summary = useMemo(() => {
    if (stats.sessionCounts.total > 0) {
      return `${stats.sessionCounts.total} session${stats.sessionCounts.total !== 1 ? 's' : ''} completed`;
    }
    return 'No sessions yet';
  }, [stats.sessionCounts.total]);

  const bestDay = useMemo(() => {
    if (sessions.length === 0) return 'Building';
    const dayCounts: Record<string, number> = {};
    sessions.forEach((s) => {
      const day = new Date(s.date).toLocaleDateString('en-US', { weekday: 'long' });
      dayCounts[day] = (dayCounts[day] || 0) + 1;
    });
    return Object.entries(dayCounts).sort(([, a], [, b]) => b - a)[0]?.[0] || 'Building';
  }, [sessions]);

  const hasSessions = sessions.length > 0;
  const hasPlans = plans.length > 0;
  const planSupport = hasPlans
    ? `${stats.planCounts.completed} of ${stats.planCounts.total} completed`
    : 'No plans yet';
  const bestDaySupport = hasSessions
    ? 'Your strongest focus day'
    : 'Complete sessions across more days to find your pattern.';
  const completionSupport = hasSessions ? 'Based on completed sessions' : 'Complete a session to calculate your rate.';
  const plansDoneSupport = hasPlans
    ? `${stats.planCounts.completed} of ${stats.planCounts.total} completed`
    : 'Create a plan to start tracking progress.';

  function announce(message: string) {
    setStatusMsg(message);
    if (statusTimer.current) window.clearTimeout(statusTimer.current);
    statusTimer.current = window.setTimeout(() => setStatusMsg(null), 1800);
  }

  useEffect(() => {
    return () => {
      if (statusTimer.current) window.clearTimeout(statusTimer.current);
    };
  }, []);

  function handleToggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    toggleTheme();
    announce(next === 'light' ? 'Light mode enabled' : 'Dark mode enabled');
  }

  function openDialog() {
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    requestAnimationFrame(() => signOutRef.current?.focus());
  }

  function confirmSignOut() {
    sessionStorage.removeItem('isAuthenticated');
    sessionStorage.removeItem('user');
    router.push('/');
  }

  useEffect(() => {
    if (!dialogOpen) return;
    const container = dialogRef.current;
    cancelRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeDialog();
        return;
      }
      if (e.key === 'Tab' && container) {
        const focusables = Array.from(
          container.querySelectorAll<HTMLElement>('button, [href], input, [tabindex]:not([tabindex="-1"])'),
        ).filter((el) => !el.hasAttribute('disabled'));
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [dialogOpen]);

  const fade = (delay: number) => ({
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: reduced ? 0 : 0.3, delay: reduced ? 0 : delay },
  });

  return (
    <div className="space-y-8">
      {/* ===== Header ===== */}
      <motion.header {...fade(0)}>
        <div className="text-[13px] text-text-muted">{formatLongDate(new Date())}</div>
        <h1 className="mt-1.5 text-[30px] sm:text-[32px] font-semibold leading-[1.1] tracking-[-0.025em] text-text">
          Profile
        </h1>
        <p className="mt-2 text-[14px] text-text-secondary">Your productivity, preferences, and personal settings.</p>
      </motion.header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ===== Level 1: Personal identity ===== */}
        <motion.section {...fade(0.03)} className="lg:col-span-4">
          <div className={`${softCard} h-full flex flex-col items-center text-center`}>
            <div className="w-20 h-20 rounded-full overflow-hidden border border-border shadow-[var(--card-shadow)] bg-surface-hover flex items-center justify-center shrink-0">
              {imgFailed ? (
                <div className="w-full h-full flex items-center justify-center bg-accent-muted">
                  <span className="text-2xl font-semibold text-accent">{user?.[0]?.toUpperCase() || 'U'}</span>
                </div>
              ) : (
                <Image
                  src="/images/profile.png"
                  alt={`${user || 'User'}'s profile picture`}
                  width={80}
                  height={80}
                  className="object-cover w-full h-full"
                  onError={() => setImgFailed(true)}
                />
              )}
            </div>

            <h2 className="mt-4 text-[22px] font-semibold tracking-[-0.01em] text-text">{user || 'User'}</h2>
            <p className="mt-1.5 text-sm text-text-secondary flex items-center gap-1.5">
              <FiCheckCircle size={14} className="text-success shrink-0" />
              <span>{summary}</span>
            </p>

            <div className="mt-4 inline-flex items-center gap-2 rounded-xl bg-surface-hover px-3.5 py-2 max-w-full">
              <FiMail size={13} className="text-text-muted shrink-0" />
              <span className="text-[13px] text-text-muted truncate">{email}</span>
            </div>

            <div className="w-full mt-auto pt-6 border-t border-divider">
              <div className="grid grid-cols-3 divide-x divide-divider">
                <button
                  onClick={() => onNavigateTab?.('sessions')}
                  className="group px-1 py-1 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                  aria-label="View sessions"
                >
                  <div className="text-2xl font-semibold text-text tabular-nums">
                    <AnimatedNumber value={stats.sessionCounts.total} />
                  </div>
                  <div className="text-xs text-text-secondary flex items-center justify-center gap-1 mt-1">
                    <FiActivity
                      size={11}
                      className="text-text-muted group-hover:text-accent transition-colors duration-200"
                    />
                    Sessions
                  </div>
                </button>
                <button
                  onClick={() => onNavigateTab?.('stats')}
                  className="group px-1 py-1 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                  aria-label="View focus streak statistics"
                >
                  <div className="text-2xl font-semibold text-text tabular-nums">
                    <AnimatedNumber value={stats.streak} />
                  </div>
                  <div className="text-xs text-text-secondary flex items-center justify-center gap-1 mt-1">
                    <FaFire size={11} className="text-warning" />
                    Streak
                  </div>
                </button>
                <button
                  onClick={() => onNavigateTab?.('stats')}
                  className="group px-1 py-1 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                  aria-label="View completion statistics"
                >
                  <div className="text-2xl font-semibold text-text tabular-nums">
                    <AnimatedNumber value={stats.successRate} />
                    <span className="text-base text-text-secondary">%</span>
                  </div>
                  <div className="text-xs text-text-secondary flex items-center justify-center gap-1 mt-1">
                    <FiTrendingUp
                      size={11}
                      className="text-text-muted group-hover:text-accent transition-colors duration-200"
                    />
                    Success
                  </div>
                </button>
              </div>
            </div>
          </div>
        </motion.section>

        {/* ===== Right column ===== */}
        <div className="lg:col-span-8 space-y-6">
          {/* ===== Level 2: Personal productivity snapshot ===== */}
          <motion.section {...fade(0.06)}>
            <div className={`${softCard} ${interactiveCard}`}>
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-xl bg-accent-muted flex items-center justify-center shrink-0">
                  <FiActivity size={16} className="text-accent" />
                </span>
                <div>
                  <h2 className="text-[16px] font-semibold tracking-[-0.01em] text-text">Personal productivity</h2>
                  <p className="text-xs text-text-muted mt-0.5">Your focus and progress at a glance.</p>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className={tileBase}>
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-lg bg-surface-hover border border-border flex items-center justify-center shrink-0">
                      <FiClock size={14} className="text-accent" />
                    </span>
                    <span className="text-xs text-text-secondary">Focus Time</span>
                  </div>
                  <div className="mt-3 text-3xl font-semibold tracking-tight text-text tabular-nums leading-none">
                    {displayTime}
                  </div>
                  <div className="mt-1.5 text-[11px] text-text-muted">Total focus time</div>
                  <button
                    onClick={() => onNavigateTab?.('stats')}
                    className="mt-2.5 inline-flex items-center gap-1 text-[11px] font-medium text-accent hover:text-accent-hover transition-colors duration-150 rounded-md px-0.5 outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                  >
                    View focus statistics <FiArrowRight size={11} />
                  </button>
                </div>

                <div className={tileBase}>
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-lg bg-surface-hover border border-border flex items-center justify-center shrink-0">
                      <FiTarget size={14} className="text-accent" />
                    </span>
                    <span className="text-xs text-text-secondary">Plans</span>
                  </div>
                  <div className="mt-3 text-3xl font-semibold tracking-tight text-text tabular-nums leading-none">
                    <AnimatedNumber value={stats.planCounts.total} />
                  </div>
                  <div className="mt-1.5 text-[11px] text-text-muted">{planSupport}</div>
                  <button
                    onClick={() => onNavigateTab?.('plans')}
                    className="mt-2.5 inline-flex items-center gap-1 text-[11px] font-medium text-accent hover:text-accent-hover transition-colors duration-150 rounded-md px-0.5 outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                  >
                    View plans <FiArrowRight size={11} />
                  </button>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className={tileBase}>
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-surface-hover border border-border flex items-center justify-center shrink-0">
                      <FiCalendar size={13} className="text-accent" />
                    </span>
                    <span className="text-xs text-text-secondary">Best Day</span>
                  </div>
                  <div className="mt-2.5 text-xl font-semibold tracking-tight text-text leading-none truncate">
                    {bestDay}
                  </div>
                  <div className="mt-1.5 text-[11px] text-text-muted leading-snug">{bestDaySupport}</div>
                </div>

                <div className={tileBase}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-7 h-7 rounded-lg bg-surface-hover border border-border flex items-center justify-center shrink-0">
                        <FiTrendingUp size={13} className="text-accent" />
                      </span>
                      <span className="text-xs text-text-secondary">Completion</span>
                    </div>
                    {hasSessions && <CompletionRing value={stats.successRate} reduced={reduced} />}
                  </div>
                  <div className="mt-2.5 text-xl font-semibold tracking-tight text-text tabular-nums leading-none">
                    {hasSessions ? `${stats.successRate}%` : '\u2014'}
                  </div>
                  <div className="mt-1.5 text-[11px] text-text-muted leading-snug">{completionSupport}</div>
                </div>

                <div className={tileBase}>
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-surface-hover border border-border flex items-center justify-center shrink-0">
                      <FiCheckCircle size={13} className="text-success" />
                    </span>
                    <span className="text-xs text-text-secondary">Plans Done</span>
                  </div>
                  <div className="mt-2.5 text-xl font-semibold tracking-tight text-text tabular-nums leading-none">
                    {hasPlans ? `${stats.planCompletionRate}%` : '\u2014'}
                  </div>
                  <div className="mt-1.5 text-[11px] text-text-muted leading-snug">{plansDoneSupport}</div>
                </div>
              </div>
            </div>
          </motion.section>

          {/* ===== Level 3: Appearance ===== */}
          <motion.section {...fade(0.1)}>
            <div className={`${softCard} ${interactiveCard}`}>
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-xl bg-accent-muted flex items-center justify-center shrink-0">
                  <FiSettings size={16} className="text-accent" />
                </span>
                <div>
                  <h2 className="text-[16px] font-semibold tracking-[-0.01em] text-text">Appearance</h2>
                  <p className="text-xs text-text-muted mt-0.5">Choose how Productivity looks and feels.</p>
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-border bg-surface-hover/40 overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3.5">
                  <span className="w-9 h-9 rounded-xl bg-surface-hover flex items-center justify-center shrink-0">
                    {theme === 'light' ? (
                      <FiSun size={16} className="text-warning" />
                    ) : (
                      <FiMoon size={16} className="text-info" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[15px] text-text">
                      Appearance{' '}
                      <span className="text-text-secondary font-medium">{theme === 'light' ? 'Light' : 'Dark'}</span>
                    </div>
                    <div className="text-xs text-text-muted mt-0.5">
                      {theme === 'light' ? 'Bright and clean' : 'Easier on the eyes'}
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={theme === 'light'}
                    aria-label="Appearance mode"
                    onClick={handleToggleTheme}
                    className={`relative w-12 h-8 rounded-full shrink-0 transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
                      theme === 'light' ? 'bg-accent' : 'bg-border-hover'
                    }`}
                  >
                    <motion.span
                      initial={false}
                      animate={{ x: theme === 'light' ? 20 : 0 }}
                      transition={{ duration: reduced ? 0 : 0.2, ease: 'easeOut' }}
                      className="absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow-sm"
                    />
                  </button>
                </div>

                <div className="h-px bg-divider" />

                <div className="px-4 py-4">
                  <AccentColorControl />
                </div>

                <div className="h-px bg-divider" />

                <div className="px-4 py-4">
                  <div className="text-[13px] font-medium text-text">Live Preview</div>
                  <div className="text-xs text-text-muted mt-0.5">A quick look at your selected accent.</div>
                  <div className="mt-3 rounded-xl border border-border bg-surface p-3.5 space-y-3">
                    <div className="flex items-center justify-between rounded-lg bg-surface-hover px-3 py-2">
                      <div className="flex items-center gap-2 text-[12px] font-medium text-text">
                        <span className="w-2 h-2 rounded-full bg-accent" />
                        Active navigation
                      </div>
                      <span className="text-[10px] text-accent">Selected</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center rounded-lg bg-accent px-3 h-8 text-[12px] font-semibold text-accent-contrast">
                        Primary button
                      </span>
                      <div className="flex-1 h-1.5 rounded-full bg-surface-hover overflow-hidden">
                        <div className="h-full rounded-full bg-accent" style={{ width: '62%' }} />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded-full bg-accent-muted border border-accent/30 px-2 py-0.5 text-[10px] font-medium text-accent">
                        <FiCheck size={10} /> Selected chip
                      </span>
                      <span className="inline-flex items-center rounded-full bg-surface-hover border border-border px-2 py-0.5 text-[10px] text-text-muted">
                        Neutral chip
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {statusMsg && (
                <div className="mt-3 flex items-center gap-1.5 text-xs text-success" role="status" aria-live="polite">
                  <FiCheck size={12} className="shrink-0" />
                  <span>{statusMsg}</span>
                </div>
              )}
            </div>
          </motion.section>

          {/* ===== Partner privacy ===== */}
          <motion.section {...fade(0.12)}>
            <div className={`${softCard} ${interactiveCard}`}>
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-xl bg-accent-muted flex items-center justify-center shrink-0">
                  <FiLock size={16} className="text-accent" />
                </span>
                <div>
                  <h2 className="text-[16px] font-semibold tracking-[-0.01em] text-text">Partner privacy</h2>
                  <p className="text-xs text-text-muted mt-0.5">Control what your partner can see.</p>
                </div>
              </div>

              {privacyLoading ? (
                <div className="mt-5 space-y-3">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-2xl border border-border bg-surface-hover/40 px-4 py-3.5 animate-pulse"
                    >
                      <div className="space-y-1.5">
                        <div className="h-3 w-36 rounded-full bg-surface-hover" />
                        <div className="h-2.5 w-56 rounded-full bg-surface-hover/70" />
                      </div>
                      <div className="w-12 h-8 rounded-full bg-surface-hover" />
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <div className="mt-5 grid grid-cols-1 gap-3">
                    {[
                      {
                        key: 'shareWeeklyStats' as const,
                        icon: FiBarChart2,
                        title: 'Share focus statistics',
                        description: 'Allow your partner to view your focus time, completed sessions, and streak.',
                      },
                      {
                        key: 'sharePlans' as const,
                        icon: FiUsers,
                        title: 'Share personal plans',
                        description: 'Show plans you explicitly mark as shared in your partner workspace.',
                      },
                      {
                        key: 'shareLiveFocus' as const,
                        icon: FiZap,
                        title: 'Share current focus status',
                        description: 'Let your partner see whether you are focusing right now.',
                      },
                      {
                        key: 'shareStreak' as const,
                        icon: FiActivity,
                        title: 'Share recent activity',
                        description: 'Allow your partner to see recent focus activity and trends.',
                      },
                      {
                        key: 'shareSnapshots' as const,
                        icon: FiImage,
                        title: 'Allow snapshot sharing',
                        description:
                          'Let you send snapshots into the shared chat. Existing snapshots are never removed.',
                      },
                    ].map((control) => {
                      const enabled = !!privacy?.[control.key];
                      return (
                        <div
                          key={control.key}
                          className="flex items-center gap-3 rounded-2xl border border-border bg-surface-hover/40 px-4 py-3.5"
                        >
                          <span className="w-9 h-9 rounded-xl bg-surface-hover border border-border flex items-center justify-center shrink-0">
                            <control.icon size={15} className={enabled ? 'text-accent' : 'text-text-muted'} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="text-[14px] text-text">{control.title}</div>
                            <div className="text-xs text-text-muted mt-0.5 leading-snug">{control.description}</div>
                          </div>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={enabled}
                            aria-label={control.title}
                            disabled={!!privacyBusy}
                            onClick={() => togglePrivacy(control.key)}
                            className={`relative w-12 h-8 rounded-full shrink-0 transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:opacity-60 ${
                              enabled ? 'bg-accent' : 'bg-border-hover'
                            }`}
                          >
                            <motion.span
                              initial={false}
                              animate={{ x: enabled ? 20 : 0 }}
                              transition={{ duration: reduced ? 0 : 0.2, ease: 'easeOut' }}
                              className="absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow-sm"
                            />
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-4 rounded-2xl border border-border bg-surface-hover/40 px-4 py-3.5">
                    <div className="text-[13px] font-medium text-text">What your partner sees</div>
                    {privacy && (
                      <div className="mt-2.5 flex flex-wrap gap-2">
                        {[
                          { label: 'Statistics', gate: privacySummary(privacy).statistics },
                          { label: 'Focus status', gate: privacySummary(privacy).focusStatus },
                          { label: 'Recent activity', gate: privacySummary(privacy).recentActivity },
                          { label: 'Snapshots', gate: privacySummary(privacy).snapshots },
                        ].map((row) => (
                          <span
                            key={row.label}
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                              row.gate === 'shared'
                                ? 'border-accent/30 bg-accent-muted text-accent'
                                : 'border-border bg-surface-hover text-text-muted'
                            }`}
                          >
                            {row.gate === 'shared' ? (
                              <FiCheckCircle size={11} className="shrink-0" />
                            ) : (
                              <FiXCircle size={11} className="shrink-0" />
                            )}
                            {row.label}: {row.gate === 'shared' ? 'Shared' : 'Private'}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="mt-2 text-[11px] text-text-muted leading-snug">
                      Plans you mark as shared remain visible only to your partner, never to others.
                    </div>
                  </div>

                  {privacySaved && (
                    <div
                      className="mt-3 flex items-center gap-1.5 text-xs text-success"
                      role="status"
                      aria-live="polite"
                    >
                      <FiCheck size={12} className="shrink-0" />
                      <span>Privacy updated</span>
                    </div>
                  )}
                  {privacyError && (
                    <div className="mt-3 flex items-center gap-1.5 text-xs text-danger" role="alert">
                      <FiXCircle size={12} className="shrink-0" />
                      <span>{privacyError}</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.section>

          {/* ===== Level 4: Sign out ===== */}
          <motion.section {...fade(0.14)}>
            <div className={`${softCard}`}>
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="w-10 h-10 rounded-xl bg-danger-muted flex items-center justify-center shrink-0">
                    <FiLogOut size={18} className="text-danger" />
                  </span>
                  <div className="min-w-0">
                    <div className="text-[15px] font-semibold text-text">Sign Out</div>
                    <div className="text-xs text-text-muted mt-0.5">
                      Sign out of your Productivity account on this device.
                    </div>
                  </div>
                </div>
                <button
                  ref={signOutRef}
                  onClick={openDialog}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-danger/25 bg-danger-muted/40 hover:bg-danger-muted px-3.5 h-10 text-[13px] font-semibold text-danger transition-colors duration-150 shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                >
                  <FiLogOut size={14} /> Sign Out
                </button>
              </div>
            </div>
          </motion.section>
        </div>
      </div>

      {/* ===== Sign out confirmation dialog ===== */}
      <AnimatePresence>
        {dialogOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduced ? 0 : 0.18 }}
              className="absolute inset-0 bg-overlay"
              onClick={closeDialog}
              aria-hidden="true"
            />
            <motion.div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="signout-title"
              aria-describedby="signout-desc"
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: reduced ? 0 : 0.18, ease: 'easeOut' }}
              className="relative card-glass rounded-[22px] p-6 w-full max-w-sm"
            >
              <div className="w-12 h-12 rounded-2xl bg-danger-muted flex items-center justify-center">
                <FiLogOut size={22} className="text-danger" />
              </div>
              <h2 id="signout-title" className="mt-4 text-lg font-semibold tracking-[-0.01em] text-text">
                Sign out?
              </h2>
              <p id="signout-desc" className="mt-1.5 text-sm text-text-secondary">
                You&rsquo;ll need to sign in again to access your productivity data.
              </p>
              <div className="mt-6 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
                <button
                  ref={cancelRef}
                  onClick={closeDialog}
                  className="inline-flex items-center justify-center rounded-xl border border-border bg-surface-hover/60 hover:bg-surface-hover px-4 h-10 text-[13px] font-medium text-text transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmSignOut}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-danger hover:bg-danger-muted px-4 h-10 text-[13px] font-semibold text-white transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                >
                  <FiLogOut size={14} /> Sign Out
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
