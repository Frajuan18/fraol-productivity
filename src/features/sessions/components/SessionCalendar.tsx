'use client';

import { memo, useCallback, useState } from 'react';
import { FiChevronLeft, FiChevronRight, FiCheckCircle, FiClock, FiTrash2 } from 'react-icons/fi';
import { getMonthGrid, getMonthName } from '@/src/utils/date';
import type { Session } from '@/src/types';
import { getSessionStatusBadgeClass } from '@/src/utils/badges';

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getDate() === date2.getDate() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getFullYear() === date2.getFullYear()
  );
}

function isTodayDate(date: Date): boolean {
  return isSameDay(date, new Date());
}

interface SessionCalendarProps {
  sessions: Session[];
  onDeleteSession: (id: number) => void;
}

export const SessionCalendar = memo(function SessionCalendar({ sessions, onDeleteSession }: SessionCalendarProps) {
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());

  const { daysInMonth, firstDayOfMonth } = getMonthGrid(calendarDate);
  const monthName = getMonthName(calendarDate);
  const year = calendarDate.getFullYear();

  const changeMonth = (increment: number) => {
    const newDate = new Date(calendarDate);
    newDate.setMonth(newDate.getMonth() + increment);
    setCalendarDate(newDate);
  };

  const goToToday = () => {
    const today = new Date();
    setCalendarDate(today);
    setSelectedDate(today);
  };

  const hasSessionOnDate = (date: Date): boolean => {
    const dateStr = formatDate(date);
    return sessions.some((s) => s.date === dateStr);
  };

  const getSessionCountOnDate = (date: Date): number => {
    const dateStr = formatDate(date);
    return sessions.filter((s) => s.date === dateStr).length;
  };

  const getSessionsForDate = (date: Date): Session[] => {
    const dateStr = formatDate(date);
    return sessions.filter((s) => s.date === dateStr);
  };

  const selectedDateSessions = selectedDate ? getSessionsForDate(selectedDate) : [];

  const handleCalendarKeyDown = useCallback(
    (e: React.KeyboardEvent, date: Date) => {
      let newDate: Date | null = null;
      const year = date.getFullYear();
      const month = date.getMonth();
      const day = date.getDate();

      switch (e.key) {
        case 'ArrowLeft':
          newDate = new Date(year, month, day - 1);
          break;
        case 'ArrowRight':
          newDate = new Date(year, month, day + 1);
          break;
        case 'ArrowUp':
          newDate = new Date(year, month, day - 7);
          break;
        case 'ArrowDown':
          newDate = new Date(year, month, day + 7);
          break;
        case 'Home':
          newDate = new Date(year, month, 1);
          break;
        case 'End':
          newDate = new Date(year, month, daysInMonth);
          break;
        default:
          return;
      }
      e.preventDefault();
      if (newDate.getMonth() !== month) {
        setCalendarDate(new Date(newDate.getFullYear(), newDate.getMonth(), 1));
      }
      setSelectedDate(newDate);
    },
    [daysInMonth],
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => changeMonth(-1)}
              className="p-2 rounded-lg hover:bg-surface-hover transition-all text-text-secondary hover:text-text"
              aria-label="Previous month"
            >
              <FiChevronLeft size={18} />
            </button>
            <span className="text-lg font-semibold text-text">
              {monthName} {year}
            </span>
            <button
              onClick={() => changeMonth(1)}
              className="p-2 rounded-lg hover:bg-surface-hover transition-all text-text-secondary hover:text-text"
              aria-label="Next month"
            >
              <FiChevronRight size={18} />
            </button>
          </div>
          <button
            onClick={goToToday}
            className="px-3 py-1.5 text-xs bg-surface-hover rounded-lg text-text-secondary hover:bg-surface-hover transition-all"
          >
            Today
          </button>
        </div>

        <div role="grid" aria-label="Session calendar" className="grid grid-cols-7 gap-1">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={day} role="columnheader" className="text-center text-xs text-text-muted py-2 font-medium">
              {day}
            </div>
          ))}
          {Array.from({ length: firstDayOfMonth }).map((_, index) => (
            <div key={`empty-${index}`} role="gridcell" className="aspect-square rounded-xl" />
          ))}
          {Array.from({ length: daysInMonth }).map((_, index) => {
            const day = index + 1;
            const date = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), day);
            const isSelectedDate = selectedDate ? isSameDay(date, selectedDate) : false;
            const hasSession = hasSessionOnDate(date);
            const sessionCount = getSessionCountOnDate(date);
            const isToday = isTodayDate(date);
            const sessionsForDate = getSessionsForDate(date);
            const completedCount = sessionsForDate.filter((s) => s.status === 'Completed').length;
            const allCompleted = sessionsForDate.length > 0 && completedCount === sessionsForDate.length;

            return (
              <button
                key={day}
                role="gridcell"
                onClick={() => setSelectedDate(date)}
                onKeyDown={(e) => handleCalendarKeyDown(e, date)}
                tabIndex={isSelectedDate ? 0 : -1}
                className={`aspect-square rounded-xl flex flex-col items-center justify-center transition-all relative ${
                  isSelectedDate
                    ? 'bg-accent text-white'
                    : isToday
                      ? 'bg-surface-hover text-text border border-hover'
                      : hasSession
                        ? 'text-text hover:bg-surface-hover'
                        : 'text-text-muted hover:bg-surface-hover'
                }`}
                aria-label={`${monthName} ${day}${hasSession ? `, ${sessionCount} session(s)` : ''}`}
                aria-current={isToday ? 'date' : undefined}
              >
                <span className={`text-sm font-medium ${isSelectedDate ? 'text-white' : ''}`}>{day}</span>
                {hasSession && (
                  <div className="flex items-center gap-0.5 mt-0.5">
                    <div className={`w-1 h-1 rounded-full ${isSelectedDate ? 'bg-white' : 'bg-success'}`} />
                    {sessionCount > 1 && (
                      <span className={`text-[8px] ${isSelectedDate ? 'text-text-secondary' : 'text-text-secondary'}`}>
                        +{sessionCount - 1}
                      </span>
                    )}
                  </div>
                )}
                {allCompleted && (
                  <div className={`absolute -top-0.5 -right-0.5 ${isSelectedDate ? 'text-white' : 'text-success'}`}>
                    <FiCheckCircle size={10} />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-success" />
            <span className="text-xs text-text-secondary">Has session</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-surface-hover border border-border-hover" />
            <span className="text-xs text-text-secondary">Today</span>
          </div>
          <div className="flex items-center gap-2">
            <FiCheckCircle className="text-success" size={12} />
            <span className="text-xs text-text-secondary">All completed</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-accent" />
            <span className="text-xs text-text-secondary">Selected</span>
          </div>
        </div>
      </div>

      <div className="bg-surface-hover rounded-2xl p-4 border border-border">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-text">
            {selectedDate
              ? selectedDate.toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                })
              : 'Select a date'}
          </h4>
          <span className="text-xs text-text-secondary">{selectedDateSessions.length} sessions</span>
        </div>

        {selectedDateSessions.length === 0 ? (
          <div className="text-center py-8">
            <FiClock className="mx-auto text-2xl text-text-muted mb-2" />
            <p className="text-sm text-text-muted">No sessions on this day</p>
            <p className="text-xs text-text-muted mt-1">Start a new session to track here</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
            {selectedDateSessions.map((session) => (
              <div
                key={session.id}
                className="flex items-center justify-between p-3 bg-surface-hover rounded-xl border border-border hover:bg-surface-hover transition-all"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 border ${getSessionStatusBadgeClass(session.status)}`}
                  >
                    <FiCheckCircle size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-text truncate">{session.task}</div>
                    <div className="flex items-center gap-3 text-xs text-text-muted">
                      <span className="flex items-center gap-1">
                        <FiClock size={10} /> {session.duration}
                      </span>
                      {session.startTime && (
                        <span className="text-[10px] text-text-muted">
                          {session.startTime} - {session.endTime}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => onDeleteSession(session.id)}
                  className="p-1 text-text-secondary hover:text-danger hover:bg-danger-muted rounded-lg transition-all"
                  aria-label={`Delete ${session.task} session`}
                >
                  <FiTrash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});
