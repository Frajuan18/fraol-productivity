'use client';

import { useMemo } from 'react';
import {
  FiUser,
  FiCheckCircle,
  FiMail,
  FiSun,
  FiMoon,
  FiSettings,
  FiLogOut,
  FiUsers,
  FiTrendingUp,
  FiAward,
  FiClock,
  FiTarget,
  FiZap,
  FiActivity,
  FiStar,
  FiBarChart2,
} from 'react-icons/fi';
import { FaFire } from 'react-icons/fa';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { useStatistics } from '@/src/hooks/useStatistics';
import { useTheme, PALETTES } from '@/src/contexts/ThemeContext';
import { sumSessionMinutes, formatMinutesAsHoursMinutes } from '@/src/utils/time';
import type { Session, Plan } from '@/src/types';

interface TabProfileProps {
  user: string | null;
  sessions?: Session[];
  plans?: Plan[];
  dailyStats?: { focusTime: string; sessions: number; streak: string; productivity: string };
  weeklyStreak?: number;
  totalFocusHours?: number;
}

const PALETTE_META = [
  { id: 'navy', label: 'Navy', desc: 'Focus, stability, professionalism' },
  { id: 'teal', label: 'Teal', desc: 'Modern, calm, intelligent' },
  { id: 'orange', label: 'Orange', desc: 'Energy, action, creativity' },
  { id: 'amber', label: 'Amber', desc: 'Achievement, progress, confidence' },
  { id: 'charcoal', label: 'Charcoal', desc: 'Minimal, premium, distraction-free' },
] as const;

export default function TabProfile({ user, sessions = [], plans = [] }: TabProfileProps) {
  const router = useRouter();
  const { theme, palette, toggleTheme, setPalette } = useTheme();
  const stats = useStatistics(sessions, plans);
  const totalMinutes = sumSessionMinutes(sessions);
  const displayTime = formatMinutesAsHoursMinutes(totalMinutes);

  const bestDay = useMemo(() => {
    if (sessions.length === 0) return 'N/A';
    const dayCounts: Record<string, number> = {};
    sessions.forEach((s) => {
      const day = new Date(s.date).toLocaleDateString('en-US', { weekday: 'long' });
      dayCounts[day] = (dayCounts[day] || 0) + 1;
    });
    return Object.entries(dayCounts).sort(([, a], [, b]) => b - a)[0]?.[0] || 'N/A';
  }, [sessions]);

  const handleLogout = () => {
    sessionStorage.removeItem('isAuthenticated');
    sessionStorage.removeItem('user');
    router.push('/');
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-surface rounded-2xl p-8 border border-border flex flex-col items-center text-center"
        >
          {/* Users: Replace this avatar with your own profile image by adding an <Image> component from next/image with src="/images/your-photo.jpg" */}
          <div className="w-24 h-24 rounded-full bg-transparent flex items-center justify-center mb-4 overflow-hidden border-2 border-success">
            <Image
              src="/images/profile.png"
              alt={`${user || 'User'}'s profile picture`}
              width={96}
              height={96}
              className="object-cover w-full h-full"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
          <h2 className="text-xl font-semibold text-text">{user || 'User'}</h2>
          <p className="text-text-secondary text-sm flex items-center gap-1 mt-1">
            <FiCheckCircle size={14} className="text-success" />
            {stats.sessionCounts.total > 0 ? `${stats.sessionCounts.total} sessions completed` : 'No sessions yet'}
          </p>
          <div className="flex items-center gap-2 mt-3 bg-surface-hover rounded-full px-4 py-1.5">
            <FiMail className="text-text-secondary" size={14} />
            <span className="text-text-secondary text-xs">{user?.toLowerCase() || 'user'}@gmail.com</span>
          </div>
          <div className="flex gap-8 mt-6 pt-6 border-t border-border w-full justify-center">
            <div>
              <div className="text-2xl font-bold text-text">{stats.sessionCounts.total}</div>
              <div className="text-xs text-text-secondary flex items-center justify-center gap-1">
                <FiActivity size={12} /> Sessions
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold text-text">{stats.streak}</div>
              <div className="text-xs text-text-secondary flex items-center justify-center gap-1">
                <FaFire size={12} className="text-warning" /> Streak
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold text-text">{stats.successRate}%</div>
              <div className="text-xs text-text-secondary flex items-center justify-center gap-1">
                <FiTrendingUp size={12} /> Success
              </div>
            </div>
          </div>
        </motion.div>

        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.05 }}
              className="bg-surface rounded-2xl p-4 border border-border"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-accent-muted rounded-xl">
                  <FiClock className="text-info" size={16} />
                </div>
                <span className="text-text-secondary text-xs uppercase tracking-wider">Focus Time</span>
              </div>
              <div className="text-2xl font-bold text-text">{displayTime}</div>
              <div className="text-xs text-text-muted mt-1">Total focus hours</div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="bg-surface rounded-2xl p-4 border border-border"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-accent-muted rounded-xl">
                  <FiTarget className="text-accent" size={16} />
                </div>
                <span className="text-text-secondary text-xs uppercase tracking-wider">Plans</span>
              </div>
              <div className="text-2xl font-bold text-text">{stats.planCounts.total}</div>
              <div className="text-xs text-text-muted mt-1">{stats.planCounts.completed} completed</div>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.15 }}
            className="grid grid-cols-3 gap-3"
          >
            <div className="bg-surface rounded-2xl p-3 border border-border text-center">
              <div className="text-xs text-text-secondary">Best Day</div>
              <div className="text-lg font-bold text-text">{bestDay}</div>
            </div>
            <div className="bg-surface rounded-2xl p-3 border border-border text-center">
              <div className="text-xs text-text-secondary">Completion</div>
              <div className="text-lg font-bold text-success">{stats.successRate}%</div>
            </div>
            <div className="bg-surface rounded-2xl p-3 border border-border text-center">
              <div className="text-xs text-text-secondary">Plans Done</div>
              <div className="text-lg font-bold text-text">{stats.planCompletionRate}%</div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
            className="bg-surface rounded-2xl p-4 border border-border"
          >
            <h3 className="text-sm font-medium text-text-secondary mb-3 flex items-center gap-2">
              <FiSettings size={16} /> Theme & Accent
            </h3>

            <div className="flex items-center justify-between mb-4 p-3 bg-surface-hover rounded-xl border border-border">
              <div className="flex items-center gap-3">
                {theme === 'dark' ? (
                  <FiSun className="text-text-secondary" size={18} />
                ) : (
                  <FiMoon className="text-text-secondary" size={18} />
                )}
                <div>
                  <div className="text-sm text-text">{theme === 'dark' ? 'Dark Mode' : 'Light Mode'}</div>
                  <div className="text-xs text-text-muted">
                    {theme === 'dark' ? 'Easier on the eyes' : 'Bright and clean'}
                  </div>
                </div>
              </div>
              <button
                onClick={toggleTheme}
                className={`relative w-12 h-6 rounded-full transition-colors ${theme === 'dark' ? 'bg-accent' : 'bg-border-hover'}`}
                aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
              >
                <div
                  className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${theme === 'dark' ? 'translate-x-6' : 'translate-x-0.5'}`}
                />
              </button>
            </div>

            <div className="space-y-2">
              {PALETTE_META.map((opt) => {
                const p = PALETTES[opt.id as keyof typeof PALETTES];
                const hex = theme === 'light' ? p.accentLight : p.accent;
                const isActive = palette === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => setPalette(opt.id as typeof palette)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${
                      isActive
                        ? 'border-accent bg-accent-muted'
                        : 'border-border-hover hover:border-border bg-surface-hover'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full flex-shrink-0 border-2 ${isActive ? 'border-white' : 'border-border'}`}
                      style={{ backgroundColor: hex }}
                    />
                    <div className="text-left">
                      <div className={`text-sm font-medium ${isActive ? 'text-text' : 'text-text-secondary'}`}>
                        {opt.label}
                      </div>
                      <div className="text-[10px] text-text-muted">{opt.desc}</div>
                    </div>
                    {isActive && <FiCheckCircle size={16} className="text-accent ml-auto" />}
                  </button>
                );
              })}
            </div>
          </motion.div>

          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.25 }}
            onClick={handleLogout}
            className="w-full py-3 px-4 bg-danger-muted hover:bg-danger-muted rounded-2xl text-sm font-bold text-danger flex items-center justify-center gap-3 transition-colors border border-danger/20"
          >
            <FiLogOut size={18} /> <span>Sign Out</span>
          </motion.button>
        </div>
      </div>
    </div>
  );
}
