'use client';

import { memo, useMemo, useState } from 'react';
import { FiChevronLeft, FiChevronRight, FiCalendar } from 'react-icons/fi';
import { getMonthGrid, getMonthName, isToday } from '@/src/utils/date';
import type { Session } from '@/src/types';

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

interface MiniCalendarProps {
  sessions: Session[];
}

function heatmapLevel(count: number, max: number): number {
  if (count === 0) return 0;
  const ratio = count / max;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

const heatmapBg: Record<number, string> = {
  0: '',
  1: 'bg-accent/10',
  2: 'bg-accent/20',
  3: 'bg-accent/35',
  4: 'bg-accent/50',
};

const heatmapText: Record<number, string> = {
  0: 'text-text-secondary',
  1: 'text-text',
  2: 'text-text',
  3: 'text-text',
  4: 'text-text',
};

export const MiniCalendar = memo(function MiniCalendar({ sessions }: MiniCalendarProps) {
  const [calendarDate, setCalendarDate] = useState(new Date());

  const { daysInMonth, firstDayOfMonth } = getMonthGrid(calendarDate);
  const monthName = getMonthName(calendarDate);
  const year = calendarDate.getFullYear();

  const changeMonth = (increment: number) => {
    const newDate = new Date(calendarDate);
    newDate.setMonth(newDate.getMonth() + increment);
    setCalendarDate(newDate);
  };

  const dayData = useMemo(() => {
    const counts: { date: Date; count: number }[] = [];
    let max = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), day);
      const dateStr = formatDate(date);
      const count = sessions.filter((s) => s.date === dateStr).length;
      counts.push({ date, count });
      if (count > max) max = count;
    }

    return { counts, max };
  }, [sessions, calendarDate, daysInMonth]);

  return (
    <div className="bg-surface rounded-2xl p-4 border border-border">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <FiCalendar className="text-text-secondary" size={16} />
          <h3 className="text-sm font-medium text-text">Activity</h3>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => changeMonth(-1)}
            className="p-1 rounded-md hover:bg-surface-hover transition-all text-text-secondary hover:text-text"
            aria-label="Previous month"
          >
            <FiChevronLeft size={14} />
          </button>
          <span className="text-xs font-semibold text-text px-1 min-w-[80px] text-center">
            {monthName} {year}
          </span>
          <button
            onClick={() => changeMonth(1)}
            className="p-1 rounded-md hover:bg-surface-hover transition-all text-text-secondary hover:text-text"
            aria-label="Next month"
          >
            <FiChevronRight size={14} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
          <div key={day} className="text-center text-[10px] text-text-muted py-1 font-medium">
            {day}
          </div>
        ))}
        {Array.from({ length: firstDayOfMonth }).map((_, index) => (
          <div key={`empty-${index}`} />
        ))}
        {dayData.counts.map(({ date, count }) => {
          const today = isToday(date);
          const level = heatmapLevel(count, dayData.max);

          return (
            <div
              key={date.getDate()}
              className={`relative flex items-center justify-center rounded-lg transition-all ${
                today ? 'ring-1 ring-border-hover' : ''
              }`}
              style={{ minHeight: '28px' }}
            >
              <div
                className={`absolute inset-0 rounded-lg ${heatmapBg[level]} ${
                  level === 0 && !today ? 'opacity-0' : ''
                }`}
              />
              <span className={`relative text-[11px] font-medium z-10 ${heatmapText[level]}`}>{date.getDate()}</span>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-border">
        <span className="text-[10px] text-text-muted">Less</span>
        <div className="w-3 h-3 rounded-sm bg-accent/10" />
        <div className="w-3 h-3 rounded-sm bg-accent/20" />
        <div className="w-3 h-3 rounded-sm bg-accent/35" />
        <div className="w-3 h-3 rounded-sm bg-accent/50" />
        <span className="text-[10px] text-text-muted">More</span>
      </div>
    </div>
  );
});
