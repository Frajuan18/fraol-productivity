'use client';

import { Suspense, useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import Navbar from './Navbar';
import { dataService } from '@/lib/dataService';
import type { Session, Plan, PlanStatus } from '@/src/types';

const TabOverview = dynamic(() => import('./TabOverview'), { ssr: false });
const TabSessions = dynamic(() => import('./TabSessions'), { ssr: false });
const TabStats = dynamic(() => import('./TabStats'), { ssr: false });
const TabPlans = dynamic(() => import('./plans'), { ssr: false });
const TabProfile = dynamic(() => import('./TabProfile'), { ssr: false });

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<string | null>(() =>
    typeof window !== 'undefined' ? sessionStorage.getItem('user') : null,
  );
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window === 'undefined') return 'overview';
    const params = new URLSearchParams(window.location.search);
    return params.get('tab') || 'overview';
  });
  const [isLoading, setIsLoading] = useState(true);

  const [weeklyStreak, setWeeklyStreak] = useState(0);
  const [totalFocusHours, setTotalFocusHours] = useState(0);
  const [taskTypes, setTaskTypes] = useState<string[]>([]);
  const [plansData, setPlansData] = useState<Plan[]>([]);
  const [focusSessions, setFocusSessions] = useState<Session[]>([]);
  const [dailyStats, setDailyStats] = useState({
    focusTime: '0h',
    sessions: 0,
    streak: '+0',
    productivity: '+0',
    dailyStreak: 0,
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await dataService.loadData();
        if (data.plans) setPlansData(data.plans);
        if (data.sessions) setFocusSessions(data.sessions);
        if (data.stats) {
          setDailyStats({
            focusTime: data.stats.focusTime || '0h',
            sessions: data.stats.sessions || 0,
            streak: data.stats.streak || '+0',
            productivity: data.stats.productivity || '+0',
            dailyStreak: data.stats.dailyStreak || 0,
          });
          setTotalFocusHours(data.stats.totalFocusHours || 0);
          setWeeklyStreak(data.stats.weeklyStreak || 0);
        }
        if (data.user) {
          setWeeklyStreak(data.user.streak || 0);
          setTotalFocusHours(data.user.totalFocusHours || 0);
          setTaskTypes(data.user.taskTypes || []);
        }
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    if (isLoading) return;
    const saveData = async () => {
      try {
        await dataService.saveData({
          plans: plansData,
          sessions: focusSessions,
          stats: { ...dailyStats, totalFocusHours, weeklyStreak },
          user: { name: user || 'Fraol', streak: weeklyStreak, totalFocusHours, taskTypes },
        });
      } catch (error) {
        console.error('Error saving data:', error);
      }
    };
    saveData();
  }, [plansData, focusSessions, dailyStats, weeklyStreak, totalFocusHours, isLoading, user, taskTypes]);

  useEffect(() => {
    const isAuth = sessionStorage.getItem('isAuthenticated');
    if (!isAuth) {
      router.replace('/');
      return;
    }
  }, [router]);

  const handleAddSession = useCallback((newSession: Session) => {
    setFocusSessions((prev) => [newSession, ...prev]);
    setDailyStats((prev) => ({ ...prev, sessions: (prev.sessions || 0) + 1 }));
  }, []);

  const handleUpdateSession = useCallback((id: number, data: Partial<Session>) => {
    setFocusSessions((prev) => prev.map((s) => (s.id === id ? { ...s, ...data } : s)));
  }, []);

  const handleDeleteSession = useCallback((id: number) => {
    setFocusSessions((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const handleAddPlan = useCallback((newPlan: Omit<Plan, 'id' | 'status' | 'date'>) => {
    const plan: Plan = {
      ...newPlan,
      id: Date.now(),
      status: 'not-started',
      date: new Date().toISOString().split('T')[0],
    };
    setPlansData((prev) => [plan, ...prev]);
  }, []);

  const handleUpdatePlanStatus = useCallback((id: number, status: PlanStatus) => {
    setPlansData((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)));
  }, []);

  const handleDeletePlan = useCallback((id: number) => {
    setPlansData((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const handleAddTaskType = useCallback((newType: string) => {
    const trimmed = newType.trim();
    if (trimmed) {
      setTaskTypes((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
    }
  }, []);

  const handleRemoveTaskType = useCallback((type: string) => {
    setTaskTypes((prev) => prev.filter((t) => t !== type));
  }, []);

  const activeTabComponent = useMemo(() => {
    switch (activeTab) {
      case 'overview':
        return (
          <TabOverview
            dailyStats={dailyStats}
            focusSessions={focusSessions}
            weeklyStreak={weeklyStreak}
            totalFocusHours={totalFocusHours}
            plansCount={plansData.length}
          />
        );
      case 'sessions':
        return (
          <TabSessions
            sessions={focusSessions}
            onAddSession={handleAddSession}
            onUpdateSession={handleUpdateSession}
            onDeleteSession={handleDeleteSession}
            taskTypes={taskTypes}
            onAddTaskType={handleAddTaskType}
            onRemoveTaskType={handleRemoveTaskType}
          />
        );
      case 'stats':
        return (
          <TabStats
            dailyStats={dailyStats}
            weeklyStreak={weeklyStreak}
            totalFocusHours={totalFocusHours}
            sessions={focusSessions}
            plans={plansData}
          />
        );
      case 'plans':
        return (
          <TabPlans
            plans={plansData}
            onAddPlan={handleAddPlan}
            onUpdatePlan={handleUpdatePlanStatus}
            onDeletePlan={handleDeletePlan}
          />
        );
      case 'profile':
        return (
          <TabProfile
            user={user}
            sessions={focusSessions}
            plans={plansData}
            dailyStats={dailyStats}
            weeklyStreak={weeklyStreak}
            totalFocusHours={totalFocusHours}
          />
        );
      default:
        return null;
    }
  }, [
    activeTab,
    dailyStats,
    focusSessions,
    handleAddPlan,
    handleAddSession,
    handleAddTaskType,
    handleDeletePlan,
    handleDeleteSession,
    handleRemoveTaskType,
    handleUpdatePlanStatus,
    handleUpdateSession,
    plansData,
    taskTypes,
    totalFocusHours,
    user,
    weeklyStreak,
  ]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-page text-text flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 border-2 border-border border-t-accent rounded-full animate-spin" />
          <span>Loading your data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-page text-text">
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} user={user} />
      <main className="max-w-7xl mx-auto px-8 py-8 backdrop-blur-xl">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
          >
            {activeTabComponent}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-page text-text flex items-center justify-center">Loading dashboard...</div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
