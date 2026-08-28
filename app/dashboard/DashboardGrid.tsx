'use client';

import {
  FiActivity,
  FiCalendar,
  FiClock,
  FiFilePlus,
  FiList,
  FiPieChart,
  FiSettings,
  FiStar,
  FiTarget,
  FiTrendingUp,
  FiUsers,
} from 'react-icons/fi';
import type { ComponentType } from 'react';
import { useDashboardLayout } from '@/lib/dashboard/useDashboardLayout';
import { WIDGET_META } from '@/lib/dashboard/types';
import type { DashboardWidgetConfig, DashboardWidgetId } from '@/lib/dashboard/types';
import type { DashboardBundle } from '@/lib/dashboard/useDashboard';
import type { PlanStatus } from '@/src/types';
import WidgetCard from './widgets/WidgetCard';
import TodayFocusWidget from './widgets/TodayFocusWidget';
import CurrentSessionWidget from './widgets/CurrentSessionWidget';
import WeeklyProgressWidget from './widgets/WeeklyProgressWidget';
import ProductivityInsightsWidget from './widgets/ProductivityInsightsWidget';
import UpcomingPlansWidget from './widgets/UpcomingPlansWidget';
import RecentActivityWidget from './widgets/RecentActivityWidget';
import BuddySummaryWidget from './widgets/BuddySummaryWidget';
import FocusHeatmapWidget from './widgets/FocusHeatmapWidget';
import LongTermGoalsWidget from './widgets/LongTermGoalsWidget';
import QuickActionsWidget from './widgets/QuickActionsWidget';
import FocusDistributionWidget from './widgets/FocusDistributionWidget';

const WIDGET_ICONS: Record<DashboardWidgetId, ComponentType<{ size?: number; className?: string }>> = {
  'weekly-progress': FiTrendingUp,
  'buddy-summary': FiUsers,
  'today-focus': FiClock,
  'current-session': FiActivity,
  'upcoming-plans': FiTarget,
  'recent-activity': FiList,
  'focus-distribution': FiPieChart,
  'focus-heatmap': FiCalendar,
  'productivity-insights': FiStar,
  'long-term-goals': FiFilePlus,
  'quick-actions': FiSettings,
};

interface DashboardGridProps {
  bundle: DashboardBundle;
  onNavigateTab: (tab: string) => void;
  onUpdatePlanStatus?: (id: number, status: PlanStatus) => void;
}

function renderWidgetFor(
  widget: DashboardWidgetConfig,
  bundle: DashboardBundle,
  onNavigateTab: (tab: string) => void,
  onUpdatePlanStatus?: (id: number, status: PlanStatus) => void,
) {
  const props = { bundle, onNavigateTab, onUpdatePlanStatus };
  switch (widget.id) {
    case 'today-focus':
      return <TodayFocusWidget {...props} />;
    case 'current-session':
      return <CurrentSessionWidget {...props} />;
    case 'weekly-progress':
      return <WeeklyProgressWidget {...props} />;
    case 'productivity-insights':
      return <ProductivityInsightsWidget {...props} />;
    case 'upcoming-plans':
      return <UpcomingPlansWidget {...props} />;
    case 'recent-activity':
      return <RecentActivityWidget {...props} />;
    case 'focus-distribution':
      return <FocusDistributionWidget {...props} />;
    case 'buddy-summary':
      return <BuddySummaryWidget {...props} />;
    case 'focus-heatmap':
      return <FocusHeatmapWidget {...props} />;
    case 'long-term-goals':
      return <LongTermGoalsWidget {...props} />;
    case 'quick-actions':
      return <QuickActionsWidget {...props} />;
    default:
      return null;
  }
}

function SkeletonCard() {
  return (
    <div className="card-glass flex flex-col rounded-[22px]">
      <header className="flex items-center gap-2.5 px-5 pt-4 pb-3">
        <div className="h-[17px] w-[17px] shrink-0 rounded bg-surface-hover" />
        <div className="h-[15px] w-28 rounded bg-surface-hover" />
      </header>
      <div className="flex-1 px-5 pb-5 space-y-3">
        <div className="h-3 w-3/4 rounded bg-surface-hover" />
        <div className="h-7 w-1/2 rounded-lg bg-surface-hover" />
        <div className="h-3 w-2/3 rounded bg-surface-hover" />
        <div className="h-16 rounded-xl bg-surface-hover" />
      </div>
    </div>
  );
}

export default function DashboardGrid({ bundle, onNavigateTab, onUpdatePlanStatus }: DashboardGridProps) {
  const { layout, loaded } = useDashboardLayout();

  if (!loaded) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {Array.from({ length: 11 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  const visible = layout.widgets.filter((w) => w.visible);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {visible.map((widget) => {
        const Icon = WIDGET_ICONS[widget.id];
        const meta = WIDGET_META[widget.id];
        return (
          <div key={widget.id}>
            <WidgetCard title={meta.title} icon={Icon} collapsed={widget.collapsed}>
              {renderWidgetFor(widget, bundle, onNavigateTab, onUpdatePlanStatus)}
            </WidgetCard>
          </div>
        );
      })}
    </div>
  );
}
