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
import { sumSessionMinutes, formatMinutes } from '@/src/utils/time';

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
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [writeError, setWriteError] = useState<string | null>(null);

  const [weeklyStreak, setWeeklyStreak] = useState(0);
  const [totalFocusHours, setTotalFocusHours] = useState(0);
  const [taskTypes, setTaskTypes] = useState<string[]>([]);
  const [plansData, setPlansData] = useState<Plan[]>([]);
  const plansRef = useRef<Plan[]>([]);
  useEffect(() => {
    plansRef.current = plansData;
  }, [plansData]);
  const [focusSessions, setFocusSessions] = useState<Session[]>([]);
  const focusSessionsRef = useRef<Session[]>([]);
  useEffect(() => {
    focusSessionsRef.current = focusSessions;
  }, [focusSessions]);
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
        setConnectionError(null);
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
        const msg = error instanceof Error ? error.message : 'Failed to connect to the database.';
        console.error('Error loading data:', error);
        setConnectionError(msg);
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
      const updated = [newSession, ...focusSessionsRef.current];
      focusSessionsRef.current = updated;
      setFocusSessions(updated);
      const totalMinutes = sumSessionMinutes(updated);
      setTotalFocusHours(Math.round((totalMinutes / 60) * 10) / 10);
      setDailyStats((prev) => ({
        ...prev,
        sessions: (prev.sessions || 0) + 1,
        focusTime: formatMinutes(totalMinutes),
      }));
      if (isMongoMode) {
        const userId = currentUserId.current;
        repository
          .createSession(userId, {
            task: newSession.task,
            duration: newSession.duration,
            date: newSession.date,
            status: newSession.status,
            startTime: newSession.startTime,
            endTime: newSession.endTime,
            actualDuration: newSession.actualDuration,
          })
          .then((created) => {
            setFocusSessions((prev) => prev.map((s) => (s.id === newSession.id ? created : s)));
            focusSessionsRef.current = focusSessionsRef.current.map((s) => (s.id === newSession.id ? created : s));
            setWriteError(null);
          })
          .catch((error) => {
            console.error('Failed to save session:', error);
            setWriteError(error instanceof Error ? error.message : 'Failed to save session to database.');
          });
        const uid = currentUserId.current;
        void repository
          .refreshAnalytics(uid)
          .then(setAnalytics)
          .catch(() => undefined);
      }
    },
    [isMongoMode, repository],
  );

  const handleUpdateSession = useCallback(
    (id: number, data: Partial<Session>) => {
      setFocusSessions((prev) => prev.map((s) => (s.id === id ? { ...s, ...data } : s)));
      if (isMongoMode) {
        const userId = currentUserId.current;
        repository
          .updateSession(userId, String(id), data)
          .then(() => {
            setWriteError(null);
          })
          .catch((error) => {
            console.error('Failed to update session:', error);
            setWriteError(error instanceof Error ? error.message : 'Failed to update session.');
          });
      }
    },
    [isMongoMode, repository],
  );

  const handleDeleteSession = useCallback(
    (id: number) => {
      setFocusSessions((prev) => prev.filter((s) => s.id !== id));
      if (isMongoMode) {
        const userId = currentUserId.current;
        repository
          .deleteSession(userId, String(id))
          .then(() => {
            setWriteError(null);
          })
          .catch((error) => {
            console.error('Failed to delete session:', error);
            setWriteError(error instanceof Error ? error.message : 'Failed to delete session.');
          });
      }
    },
    [isMongoMode, repository],
  );

  const handleAddPlan = useCallback(
    (newPlan: Omit<Plan, 'id' | 'status'>) => {
      const date = newPlan.date || new Date().toISOString().split('T')[0];
      if (isMongoMode) {
        const userId = currentUserId.current;
        repository
          .createPersonalPlan(userId, {
            title: newPlan.title,
            description: newPlan.description,
            type: newPlan.type,
            priority: newPlan.priority,
            category: newPlan.category,
            date,
            status: 'not-started',
            file: newPlan.file ?? null,
          })
          .then((created) => {
            setPlansData((prev) => [created, ...prev]);
            setWriteError(null);
          })
          .catch((error) => {
            console.error('Failed to save plan:', error);
            setWriteError(error instanceof Error ? error.message : 'Failed to save plan to database.');
          });
        const uid = currentUserId.current;
        void repository
          .refreshAnalytics(uid)
          .then(setAnalytics)
          .catch(() => undefined);
      } else {
        const plan: Plan = {
          ...newPlan,
          id: Date.now(),
          status: 'not-started',
          date,
        };
        setPlansData((prev) => [plan, ...prev]);
      }
    },
    [isMongoMode, repository],
  );

  const handleAddPlanFromFile = useCallback(
    (plan: Plan) => {
      if (isMongoMode) {
        const userId = currentUserId.current;
        repository
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
          .then((created) => {
            setPlansData((prev) => [created, ...prev]);
            setWriteError(null);
          })
          .catch((error) => {
            console.error('Failed to save file plan:', error);
            setWriteError(error instanceof Error ? error.message : 'Failed to save plan to database.');
          });
      } else {
        setPlansData((prev) => [plan, ...prev]);
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
        call
          .then(() => {
            setWriteError(null);
          })
          .catch((error) => {
            console.error('Failed to update plan status:', error);
            setWriteError(error instanceof Error ? error.message : 'Failed to update plan.');
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
        call
          .then(() => {
            setWriteError(null);
          })
          .catch((error) => {
            console.error('Failed to update plan:', error);
            setWriteError(error instanceof Error ? error.message : 'Failed to update plan.');
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
        repository
          .deletePlan(userId, id)
          .then(() => {
            setWriteError(null);
          })
          .catch((error) => {
            console.error('Failed to delete plan:', error);
            setWriteError(error instanceof Error ? error.message : 'Failed to delete plan from database.');
          });
      }
    },
    [isMongoMode, repository],
  );

  const handleAddTaskType = useCallback(
    (newType: string) => {
      const trimmed = newType.trim();
      if (trimmed) {
        setTaskTypes((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
        if (isMongoMode) {
          const userId = currentUserId.current;
          repository
            .addTaskType(userId, trimmed)
            .then(() => {
              setWriteError(null);
            })
            .catch((error) => {
              console.error('Failed to save task type:', error);
              setWriteError(error instanceof Error ? error.message : 'Failed to save task type.');
            });
        }
      }
    },
    [isMongoMode, repository],
  );

  const handleRemoveTaskType = useCallback(
    (type: string) => {
      setTaskTypes((prev) => prev.filter((t) => t !== type));
      if (isMongoMode) {
        const userId = currentUserId.current;
        repository
          .removeTaskType(userId, type)
          .then(() => {
            setWriteError(null);
          })
          .catch((error) => {
            console.error('Failed to remove task type:', error);
            setWriteError(error instanceof Error ? error.message : 'Failed to remove task type.');
          });
      }
    },
    [isMongoMode, repository],
  );

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
      <div className="dashboard-density min-h-screen bg-page text-text lg:flex">
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
        <main className="min-w-0 flex-1 max-w-[1360px] mx-auto px-5 sm:px-7 py-6 sm:py-7">
          <div className="animate-pulse space-y-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div className="max-w-[640px] space-y-2">
                <div className="h-3 w-28 rounded bg-surface-hover" />
                <div className="h-9 w-64 rounded-lg bg-surface-hover" />
                <div className="h-3 w-72 rounded bg-surface-hover" />
              </div>
              <div className="h-9 w-44 self-start rounded-full bg-surface-hover md:self-auto" />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="card-glass flex flex-col rounded-[22px]">
                  <header className="flex items-center gap-2.5 px-5 pb-3 pt-4">
                    <div className="h-[17px] w-[17px] shrink-0 rounded bg-surface-hover" />
                    <div className="h-[15px] w-28 rounded bg-surface-hover" />
                  </header>
                  <div className="flex-1 space-y-3 px-5 pb-5">
                    <div className="h-3 w-3/4 rounded bg-surface-hover" />
                    <div className="h-7 w-1/2 rounded-lg bg-surface-hover" />
                    <div className="h-3 w-2/3 rounded bg-surface-hover" />
                    <div className="h-16 rounded-xl bg-surface-hover" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (connectionError) {
    return (
      <div className="dashboard-density min-h-screen bg-page text-text flex items-center justify-center p-6">
        <div className="max-w-md w-full card-glass rounded-[22px] p-8 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-full bg-danger/10 flex items-center justify-center">
            <svg className="w-7 h-7 text-danger" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
              />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-text">Database connection failed</h2>
          <p className="text-sm text-text-secondary leading-relaxed">{connectionError}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 inline-flex items-center gap-2 rounded-[12px] bg-accent hover:bg-accent-hover text-accent-contrast px-5 h-10 text-[14px] font-medium transition-colors duration-200"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-density min-h-screen bg-page text-text lg:flex">
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
      <main className="min-w-0 flex-1 max-w-[1360px] mx-auto px-5 sm:px-7 py-6 sm:py-7">
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
      {writeError && (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-start gap-3 rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger backdrop-blur-sm shadow-lg">
            <svg
              className="mt-0.5 h-4 w-4 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
              />
            </svg>
            <span className="flex-1">{writeError}</span>
            <button
              onClick={() => setWriteError(null)}
              className="shrink-0 text-danger/60 hover:text-danger transition-colors"
              aria-label="Dismiss"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
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
