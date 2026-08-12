'use client';

import { Suspense, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from './Sidebar';
import { dataService } from '@/lib/dataService';
import { getRepository } from '@/lib/repositories/repository';
import { getErrorCode } from '@/lib/repositories/errors';
import { deletePlanFile } from '@/lib/plans/planFileApi';
import type { AnalyticsResult } from '@/lib/analytics/types';
import type { Session, Plan, PlanStatus } from '@/src/types';

const TabOverview = dynamic(() => import('./TabOverview'), { ssr: false });
const TabSessions = dynamic(() => import('./TabSessions'), { ssr: false });
const TabStats = dynamic(() => import('./TabStats'), { ssr: false });
const TabPlans = dynamic(() => import('./plans'), { ssr: false });
const TabProfile = dynamic(() => import('./TabProfile'), { ssr: false });
const TabPartner = dynamic(() => import('./TabPartner'), { ssr: false });

function DashboardContent() {
  const router = useRouter();
  const repository = getRepository();
  const isMongoMode = repository.mode === 'mongodb';
  const currentUserId = useRef('demo-user');
  const [user, setUser] = useState<string | null>(() =>
    typeof window !== 'undefined' ? sessionStorage.getItem('user') : null,
  );
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window === 'undefined') return 'overview';
    const params = new URLSearchParams(window.location.search);
    return params.get('tab') || 'overview';
  });
  const [collapsed, setCollapsed] = useState(false);
  const [sessionsSub, setSessionsSub] = useState<'new' | 'history'>('new');
  const [plansSection, setPlansSection] = useState<'plans' | 'history'>('plans');
  const [isLoading, setIsLoading] = useState(true);

  const [weeklyStreak, setWeeklyStreak] = useState(0);
  const [totalFocusHours, setTotalFocusHours] = useState(0);
  const [taskTypes, setTaskTypes] = useState<string[]>([]);
  const [plansData, setPlansData] = useState<Plan[]>([]);
  const plansRef = useRef<Plan[]>([]);
  useEffect(() => {
    plansRef.current = plansData;
  }, [plansData]);
  const [focusSessions, setFocusSessions] = useState<Session[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsResult | null>(null);
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
        if (isMongoMode) {
          const meResponse = await fetch('/api/auth/me');
          const me = (await meResponse.json()) as { ok: boolean; user?: { id: string; displayName: string } | null };
          if (!me.ok || !me.user) {
            router.replace('/');
            return;
          }
          currentUserId.current = me.user.id;
          setUser(me.user.displayName);
        } else {
          const isAuth = sessionStorage.getItem('isAuthenticated');
          if (!isAuth) {
            router.replace('/');
            return;
          }
        }

        const data = await repository.loadAppData();
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

        if (isMongoMode) {
          const userId = currentUserId.current;
          void repository
            .getAnalytics(userId)
            .then(setAnalytics)
            .catch((error) => console.error('Failed to load analytics:', error));
        }
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [isMongoMode, repository, router]);

  useEffect(() => {
    if (isLoading) return;
    // In MongoDB mode writes are persisted per-entity through the repository (see the
    // handlers below). The coarse JSON full-save is the local-mode path only.
    if (isMongoMode) return;
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
  }, [plansData, focusSessions, dailyStats, weeklyStreak, totalFocusHours, isLoading, isMongoMode, user, taskTypes]);

  const handleAddSession = useCallback(
    (newSession: Session) => {
      setFocusSessions((prev) => [newSession, ...prev]);
      setDailyStats((prev) => ({ ...prev, sessions: (prev.sessions || 0) + 1 }));
      if (isMongoMode) {
        const userId = currentUserId.current;
        void repository
          .createSession(userId, {
            task: newSession.task,
            duration: newSession.duration,
            date: newSession.date,
            status: newSession.status,
            startTime: newSession.startTime,
            endTime: newSession.endTime,
            actualDuration: newSession.actualDuration,
          })
          .catch((error) => console.error('Failed to save session:', error));
        const uid = currentUserId.current;
        void repository
          .refreshAnalytics(uid)
          .then(setAnalytics)
          .catch(() => undefined);
      }
    },
    [isMongoMode, repository],
  );

  const handleUpdateSession = useCallback((id: number, data: Partial<Session>) => {
    setFocusSessions((prev) => prev.map((s) => (s.id === id ? { ...s, ...data } : s)));
  }, []);

  const handleDeleteSession = useCallback((id: number) => {
    setFocusSessions((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const handleAddPlan = useCallback(
    (newPlan: Omit<Plan, 'id' | 'status'>) => {
      const plan: Plan = {
        ...newPlan,
        id: Date.now(),
        status: 'not-started',
        date: newPlan.date || new Date().toISOString().split('T')[0],
      };
      setPlansData((prev) => [plan, ...prev]);
      if (isMongoMode) {
        const userId = currentUserId.current;
        void repository
          .createPersonalPlan(userId, {
            title: newPlan.title,
            description: newPlan.description,
            type: newPlan.type,
            priority: newPlan.priority,
            category: newPlan.category,
            date: plan.date,
            status: 'not-started',
            file: newPlan.file ?? null,
          })
          .catch((error) => console.error('Failed to save plan:', error));
        const uid = currentUserId.current;
        void repository
          .refreshAnalytics(uid)
          .then(setAnalytics)
          .catch(() => undefined);
      }
    },
    [isMongoMode, repository],
  );

  const handleAddPlanFromFile = useCallback(
    (plan: Plan) => {
      setPlansData((prev) => [plan, ...prev]);
      if (isMongoMode) {
        const userId = currentUserId.current;
        void repository
          .createPersonalPlan(userId, {
            title: plan.title,
            description: plan.description,
            type: plan.type,
            priority: plan.priority,
            category: plan.category,
            date: plan.date,
            status: plan.status,
            file: plan.file ?? null,
          })
          .catch((error) => console.error('Failed to save file plan:', error));
      }
    },
    [isMongoMode, repository],
  );

  const refreshPlans = useCallback(async () => {
    if (!isMongoMode) return;
    try {
      const data = await repository.loadAppData();
      if (data.plans) setPlansData(data.plans);
    } catch (error) {
      console.error('Failed to refresh plans:', error);
    }
  }, [isMongoMode, repository]);

  const handleUpdatePlanStatus = useCallback(
    (id: number, status: PlanStatus) => {
      const target = plansRef.current.find((p) => p.id === id);
      setPlansData((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)));
      if (isMongoMode) {
        const userId = currentUserId.current;
        const call =
          target?.planType === 'common'
            ? repository.updateCommonPlan(userId, id, { status }, target.updatedAt)
            : repository.updatePersonalPlan(userId, id, { status });
        void call.catch((error) => {
          console.error('Failed to update plan status:', error);
          if (getErrorCode(error) === 'CONFLICT') void refreshPlans();
        });
      }
    },
    [isMongoMode, repository, refreshPlans],
  );

  const handleUpdatePlanData = useCallback(
    (id: number, data: Partial<Plan>) => {
      const target = plansRef.current.find((p) => p.id === id);
      setPlansData((prev) => prev.map((p) => (p.id === id ? { ...p, ...data } : p)));
      if (isMongoMode) {
        const userId = currentUserId.current;
        const call =
          target?.planType === 'common'
            ? repository.updateCommonPlan(userId, id, data, target.updatedAt)
            : repository.updatePersonalPlan(userId, id, data);
        void call.catch((error) => {
          console.error('Failed to update plan:', error);
          if (getErrorCode(error) === 'CONFLICT') void refreshPlans();
        });
      }
    },
    [isMongoMode, repository, refreshPlans],
  );

  const handleDeletePlan = useCallback(
    (id: number) => {
      setPlansData((prev) => {
        const target = prev.find((p) => p.id === id);
        if (target?.file) {
          void deletePlanFile(id);
        }
        return prev.filter((p) => p.id !== id);
      });
      if (isMongoMode) {
        const userId = currentUserId.current;
        void repository.deletePlan(userId, id).catch((error) => {
          console.error('Failed to delete plan:', error);
        });
      }
    },
    [isMongoMode, repository],
  );

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
            plans={plansData}
            user={user}
            analytics={analytics}
            onUpdatePlanStatus={handleUpdatePlanStatus}
            onNavigateTab={setActiveTab}
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
            activeSubTab={sessionsSub}
            onSubTabChange={setSessionsSub}
            loading={isLoading}
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
            analytics={analytics}
            onNavigateTab={setActiveTab}
          />
        );
      case 'plans':
        return (
          <TabPlans
            plans={plansData}
            onAddPlan={handleAddPlan}
            onAddPlanFromFile={handleAddPlanFromFile}
            onUpdatePlan={handleUpdatePlanStatus}
            onDeletePlan={handleDeletePlan}
            onUpdatePlanData={handleUpdatePlanData}
            onNavigateTab={setActiveTab}
            activeSection={plansSection}
            onSectionChange={setPlansSection}
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
            onNavigateTab={setActiveTab}
          />
        );
      case 'partner':
        return <TabPartner />;
      default:
        return null;
    }
  }, [
    activeTab,
    analytics,
    dailyStats,
    focusSessions,
    handleAddPlan,
    handleAddPlanFromFile,
    handleAddSession,
    handleAddTaskType,
    handleDeletePlan,
    handleDeleteSession,
    handleRemoveTaskType,
    handleUpdatePlanData,
    handleUpdatePlanStatus,
    handleUpdateSession,
    plansData,
    plansSection,
    sessionsSub,
    isLoading,
    taskTypes,
    totalFocusHours,
    user,
    weeklyStreak,
  ]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-page text-text lg:flex">
        <Sidebar
          activeTab="overview"
          setActiveTab={() => {}}
          user={user}
          collapsed={collapsed}
          onToggleCollapsed={() => setCollapsed((c) => !c)}
          sessionsSub={sessionsSub}
          onSessionsSubChange={setSessionsSub}
          plansSection={plansSection}
          onPlansSectionChange={setPlansSection}
        />
        <main className="min-w-0 flex-1 max-w-[1360px] mx-auto px-6 sm:px-10 py-8 sm:py-10">
          <div className="animate-pulse space-y-8">
            <div className="space-y-2">
              <div className="h-3 w-28 rounded bg-surface-hover" />
              <div className="h-7 w-64 rounded-lg bg-surface-hover" />
              <div className="h-3 w-72 rounded bg-surface-hover" />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-8 space-y-6">
                <div className="card-glass rounded-[22px] p-6 space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="h-4 w-24 rounded bg-surface-hover" />
                      <div className="h-6 w-48 rounded-lg bg-surface-hover" />
                    </div>
                    <div className="h-10 w-28 rounded-xl bg-surface-hover" />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="h-16 rounded-xl bg-surface-hover" />
                    <div className="h-16 rounded-xl bg-surface-hover" />
                    <div className="h-16 rounded-xl bg-surface-hover" />
                  </div>
                  <div className="flex items-end gap-2 h-24">
                    {Array.from({ length: 7 }).map((_, i) => (
                      <div
                        key={i}
                        className="flex-1 rounded-t-md bg-surface-hover"
                        style={{ height: `${20 + ((i * 17) % 60)}%` }}
                      />
                    ))}
                  </div>
                </div>
                <div className="card-glass rounded-[22px] p-6 space-y-3">
                  <div className="h-4 w-32 rounded bg-surface-hover" />
                  <div className="h-8 rounded-lg bg-surface-hover" />
                  <div className="h-8 rounded-lg bg-surface-hover" />
                </div>
              </div>
              <div className="lg:col-span-4 space-y-6">
                <div className="card-glass rounded-[22px] p-6 space-y-3">
                  <div className="h-4 w-28 rounded bg-surface-hover" />
                  <div className="h-24 rounded-xl bg-surface-hover" />
                  <div className="h-24 rounded-xl bg-surface-hover" />
                </div>
                <div className="card-glass rounded-[22px] p-6 space-y-3">
                  <div className="h-4 w-24 rounded bg-surface-hover" />
                  <div className="grid grid-cols-7 gap-1">
                    {Array.from({ length: 28 }).map((_, i) => (
                      <div key={i} className="aspect-square rounded bg-surface-hover" />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-page text-text lg:flex">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        user={user}
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed((c) => !c)}
        sessionsSub={sessionsSub}
        onSessionsSubChange={setSessionsSub}
        plansSection={plansSection}
        onPlansSectionChange={setPlansSection}
      />
      <main className="min-w-0 flex-1 max-w-[1360px] mx-auto px-6 sm:px-10 py-8 sm:py-10">
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
