'use client';

import {
  Reorder,
  useDragControls,
  useReducedMotion,
  type DragControls,
} from 'framer-motion';
import {
  FiActivity,
  FiCalendar,
  FiClock,
  FiFilePlus,
  FiList,
  FiSettings,
  FiStar,
  FiTarget,
  FiTrendingUp,
  FiUsers,
} from 'react-icons/fi';
import type { ComponentType } from 'react';
import { useDashboardLayout } from '@/lib/dashboard/useDashboardLayout';
import { WIDGET_META } from '@/lib/dashboard/types';
import type { DashboardWidgetConfig, DashboardWidgetId, WidgetSize } from '@/lib/dashboard/types';
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

const WIDGET_ICONS: Record<DashboardWidgetId, ComponentType<{ size?: number; className?: string }>> = {
  'today-focus': FiClock,
  'current-session': FiActivity,
  'weekly-progress': FiTrendingUp,
  'productivity-insights': FiStar,
  'upcoming-plans': FiTarget,
  'recent-activity': FiList,
  'buddy-summary': FiUsers,
  'focus-heatmap': FiCalendar,
  'long-term-goals': FiFilePlus,
  'quick-actions': FiSettings,
};

const SIZE_CLASSES: Record<WidgetSize, string> = {
  small: 'sm:col-span-1 lg:col-span-4',
  medium: 'sm:col-span-2 lg:col-span-6',
  large: 'sm:col-span-2 lg:col-span-8',
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

function DragGrip({ dragControls, label }: { dragControls: DragControls; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      onPointerDown={(event) => dragControls.start(event.nativeEvent)}
      className="flex h-7 w-6 cursor-grab touch-none items-center justify-center rounded-lg text-text-muted hover:text-text hover:bg-surface-hover transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
    >
      <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor" aria-hidden="true">
        <circle cx="2" cy="2" r="1.4" />
        <circle cx="8" cy="2" r="1.4" />
        <circle cx="2" cy="8" r="1.4" />
        <circle cx="8" cy="8" r="1.4" />
        <circle cx="2" cy="14" r="1.4" />
        <circle cx="8" cy="14" r="1.4" />
      </svg>
    </button>
  );
}

interface GridItemProps {
  widget: DashboardWidgetConfig;
  editable: boolean;
  editing: boolean;
  bundle: DashboardBundle;
  onNavigateTab: (tab: string) => void;
  onUpdatePlanStatus?: (id: number, status: PlanStatus) => void;
  actions: ReturnType<typeof useDashboardLayout>['actions'];
}

function GridItem({ widget, editable, editing, bundle, onNavigateTab, onUpdatePlanStatus, actions }: GridItemProps) {
  const dragControls = useDragControls();
  const Icon = WIDGET_ICONS[widget.id];
  const meta = WIDGET_META[widget.id];
  return (
    <Reorder.Item
      key={widget.id}
      value={widget.id}
      dragListener={false}
      dragControls={dragControls}
      className={`min-w-0 ${SIZE_CLASSES[widget.size]}`}
    >
      <WidgetCard
        title={meta.title}
        icon={Icon}
        collapsed={widget.collapsed}
        editing={editing}
        resizable={meta.resizable}
        size={widget.size}
        onToggleCollapse={() => actions.toggleCollapsed(widget.id)}
        onToggleSize={() => actions.toggleSize(widget.id)}
        onHide={() => actions.toggleVisible(widget.id)}
        onMove={(direction) => actions.move(widget.id, direction)}
        onMoveEdge={(edge) => actions.moveToEdge(widget.id, edge)}
        dragHandle={editable ? <DragGrip dragControls={dragControls} label={`Drag ${meta.title} to reorder`} /> : undefined}
      >
        {renderWidgetFor(widget, bundle, onNavigateTab, onUpdatePlanStatus)}
      </WidgetCard>
    </Reorder.Item>
  );
}

export default function DashboardGrid({ bundle, onNavigateTab, onUpdatePlanStatus }: DashboardGridProps) {
  const reducedMotion = useReducedMotion();
  const { layout, loaded, editing, setEditing, restoreDefaults, actions } = useDashboardLayout();

  if (!loaded) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-6" aria-hidden="true">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="card-glass h-56 rounded-[22px] p-5 animate-pulse">
            <div className="h-3 w-24 rounded bg-surface-hover" />
            <div className="mt-4 h-7 w-32 rounded-lg bg-surface-hover" />
            <div className="mt-3 h-3 w-full rounded bg-surface-hover" />
            <div className="mt-2 h-3 w-3/4 rounded bg-surface-hover" />
          </div>
        ))}
      </div>
    );
  }

  const visible = layout.widgets.filter((w) => w.visible);
  const hidden = layout.widgets.filter((w) => !w.visible);
  const visibleIds = visible.map((w) => w.id);
  const editable = editing && !reducedMotion;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-text-secondary">
          {editing
            ? 'Drag widgets or use the controls to rearrange your dashboard.'
            : 'Your focus at a glance — personalize it anytime.'}
        </p>
        <div className="flex items-center gap-2">
          {editing && (
            <button
              onClick={restoreDefaults}
              className="rounded-full bg-surface px-4 py-2 text-[13px] font-medium text-text-secondary hover:bg-surface-hover hover:text-text transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              Restore default layout
            </button>
          )}
          <button
            onClick={() => setEditing(!editing)}
            aria-pressed={editing}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-semibold transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
              editing ? 'bg-accent text-accent-contrast' : 'bg-surface text-text-secondary hover:bg-surface-hover hover:text-text'
            }`}
          >
            <FiSettings size={14} />
            {editing ? 'Done' : 'Customize'}
          </button>
        </div>
      </div>

      <Reorder.Group
        axis="y"
        values={visibleIds}
        onReorder={(ids) => actions.reorder(ids as DashboardWidgetId[])}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-6 list-none m-0 p-0"
      >
        {visible.map((widget) => (
          <GridItem
            key={widget.id}
            widget={widget}
            editable={editable}
            editing={editing}
            actions={actions}
            bundle={bundle}
            onNavigateTab={onNavigateTab}
            onUpdatePlanStatus={onUpdatePlanStatus}
          />
        ))}
      </Reorder.Group>

      {editing && (
        <div className="mt-6 rounded-[18px] border border-dashed border-border bg-surface/40 px-5 py-4">
          <p className="text-[13px] font-medium text-text-secondary">Hidden widgets</p>
          <p className="mt-0.5 text-[12px] text-text-muted">Bring any widget back to your dashboard.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {hidden.length === 0 && <span className="text-[12px] text-text-muted">All widgets are visible.</span>}
            {hidden.map((widget) => (
              <button
                key={widget.id}
                onClick={() => actions.toggleVisible(widget.id)}
                className="flex items-center gap-2 rounded-full bg-surface-hover px-4 py-2 text-[13px] font-medium text-text-secondary hover:text-text hover:bg-surface-raised transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-text-muted" aria-hidden="true" />
                {WIDGET_META[widget.id].title}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
