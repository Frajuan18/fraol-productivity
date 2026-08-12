'use client';

import { memo, useMemo, useState } from 'react';
import { FiChevronLeft, FiChevronRight, FiCalendar } from 'react-icons/fi';
import { getMonthGrid, getMonthName, isToday } from '@/src/utils/date';
import { sumSessionMinutes, formatMinutesAsHoursMinutes } from '@/src/utils/time';
import type { Session } from '@/src/types';

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatAccessibleDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
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
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const { daysInMonth, firstDayOfMonth } = getMonthGrid(calendarDate);
  const monthName = getMonthName(calendarDate);
  const year = calendarDate.getFullYear();

  const changeMonth = (increment: number) => {
    setCalendarDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + increment, 1));
  };

  const goToToday = () => {
    const now = new Date();
    setCalendarDate(now);
    setSelectedDate(now);
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

  const selectedSummary = useMemo(() => {
    if (!selectedDate) return null;
    const dateStr = formatDate(selectedDate);
    const daySessions = sessions.filter((s) => s.date === dateStr);
    return {
      label: formatAccessibleDate(selectedDate),
      count: daySessions.length,
      minutes: sumSessionMinutes(daySessions),
    };
  }, [sessions, selectedDate]);

  return (
    <div className="card-glass rounded-[22px] p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FiCalendar className="text-text-secondary" size={16} />
          <h3 className="text-[16px] font-semibold tracking-[-0.01em] text-text">Activity</h3>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => changeMonth(-1)}
            className="p-2 rounded-lg hover:bg-surface-hover transition-colors duration-150 text-text-secondary hover:text-text focus-visible:ring-2 focus-visible:ring-focus-ring outline-none"
            aria-label="Previous month"
          >
            <FiChevronLeft size={16} />
          </button>
          <button
            onClick={goToToday}
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-text-secondary hover:text-text hover:bg-surface-hover transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus-ring outline-none"
            aria-label="Go to today"
          >
            Today
          </button>
          <button
            onClick={() => changeMonth(1)}
            className="p-2 rounded-lg hover:bg-surface-hover transition-colors duration-150 text-text-secondary hover:text-text focus-visible:ring-2 focus-visible:ring-focus-ring outline-none"
            aria-label="Next month"
          >
            <FiChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="text-xs font-medium text-text-muted mb-3" aria-live="polite">
        {monthName} {year}
      </div>

      <div className="grid grid-cols-7 gap-1">
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
          const isSelected = selectedDate !== null && date.toDateString() === selectedDate.toDateString();
          const minutes = sumSessionMinutes(sessions.filter((s) => s.date === formatDate(date)));
          const level = heatmapLevel(count, dayData.max);
          const label = `${formatAccessibleDate(date)} — ${count} session${count !== 1 ? 's' : ''}, ${formatMinutesAsHoursMinutes(minutes)} focused`;
          return (
            <button
              key={date.getDate()}
              type="button"
              onClick={() => setSelectedDate(date)}
              aria-label={label}
              title={label}
              aria-pressed={isSelected}
              className={`relative flex items-center justify-center rounded-lg transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
                today || isSelected ? 'ring-1 ring-border-hover' : ''
              }`}
              style={{ minHeight: '32px' }}
            >
              <div
                className={`absolute inset-0 rounded-lg ${heatmapBg[level]} ${level === 0 && !today ? 'opacity-0' : ''}`}
              />
              <span
                className={`relative text-[11px] font-medium z-10 ${heatmapText[level]} ${isSelected ? 'text-accent' : ''}`}
              >
                {date.getDate()}
              </span>
            </button>
          );
        })}
      </div>

      {selectedSummary ? (
        <div className="mt-4 rounded-xl bg-surface-hover/70 border border-border px-4 py-3">
          <div className="text-[13px] font-medium text-text">{selectedSummary.label}</div>
          <div className="text-xs text-text-muted mt-0.5">
            {selectedSummary.count} session{selectedSummary.count !== 1 ? 's' : ''} &middot;{' '}
            {formatMinutesAsHoursMinutes(selectedSummary.minutes)} focused
          </div>
        </div>
      ) : (
        <div className="mt-4 text-xs text-text-muted">Select a day to see its activity.</div>
      )}

      <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-border">
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
