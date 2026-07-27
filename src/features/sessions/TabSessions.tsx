'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiPlus, FiList } from 'react-icons/fi';
import { TabNav } from '@/src/components/ui/TabNav';
import { SessionTimer } from './components/SessionTimer';
import { SessionCalendar } from './components/SessionCalendar';
import { SessionHistoryList } from './components/SessionHistoryList';
import { SessionStatsBar } from './components/SessionStatsBar';
import type { Session } from '@/src/types';

interface TabSessionsProps {
  sessions: Session[];
  onAddSession: (session: Session) => void;
  onUpdateSession: (id: number, data: Partial<Session>) => void;
  onDeleteSession: (id: number) => void;
  taskTypes: string[];
  onAddTaskType: (type: string) => void;
  onRemoveTaskType: (type: string) => void;
}

const SUB_TABS = [
  { id: 'new', label: 'New Session', icon: FiPlus },
  { id: 'history', label: 'History', icon: FiList },
] as const;

export default function TabSessions({
  sessions,
  onAddSession,
  onDeleteSession,
  taskTypes,
  onAddTaskType,
  onRemoveTaskType,
}: TabSessionsProps) {
  const [activeSubTab, setActiveSubTab] = useState<'new' | 'history'>('new');
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');

  return (
    <div className="space-y-5">
      <SessionStatsBar sessions={sessions} />

      <TabNav tabs={SUB_TABS} activeTab={activeSubTab} onTabChange={(id) => setActiveSubTab(id as 'new' | 'history')} />

      <AnimatePresence mode="wait">
        {activeSubTab === 'new' ? (
          <motion.div
            key="new-session"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            <SessionTimer
              onSessionComplete={onAddSession}
              taskTypes={taskTypes}
              onAddTaskType={onAddTaskType}
              onRemoveTaskType={onRemoveTaskType}
            />
          </motion.div>
        ) : (
          <motion.div
            key="history"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="bg-surface rounded-2xl p-6 border border-border"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-medium text-text-secondary flex items-center gap-2">
                <FiList size={16} /> Session History
                <span className="text-text-muted text-xs ml-2">{sessions.length} total sessions</span>
              </h3>
              <div className="flex items-center gap-1 bg-surface-hover rounded-lg p-1">
                <button
                  onClick={() => setViewMode('calendar')}
                  className={`p-2 rounded-lg transition-all ${viewMode === 'calendar' ? 'bg-accent text-white' : 'text-text-secondary hover:text-text'}`}
                  aria-label="Calendar view"
                >
                  <CalendarIcon />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-accent text-white' : 'text-text-secondary hover:text-text'}`}
                  aria-label="List view"
                >
                  <ListIcon />
                </button>
              </div>
            </div>

            {viewMode === 'calendar' ? (
              <SessionCalendar sessions={sessions} onDeleteSession={onDeleteSession} />
            ) : (
              <SessionHistoryList sessions={sessions} onDeleteSession={onDeleteSession} />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}
