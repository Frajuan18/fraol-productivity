/**
 * Phase 18 — Customizable dashboard contract.
 *
 * The overview tab is composed of isolated widgets. Users reorder, collapse, hide and
 * resize them; that configuration is a `DashboardLayout` persisted per user (MongoDB in
 * production, JSON in local mode). This module only describes the data shape — it stays
 * free of React and storage so the layout reducer is trivially unit-testable.
 */

export const WIDGET_SIZES = ['small', 'medium', 'large'] as const;
export type WidgetSize = (typeof WIDGET_SIZES)[number];

export const DASHBOARD_WIDGET_IDS = [
  'today-focus',
  'current-session',
  'weekly-progress',
  'productivity-insights',
  'upcoming-plans',
  'recent-activity',
  'buddy-summary',
  'focus-heatmap',
  'long-term-goals',
  'quick-actions',
] as const;

export type DashboardWidgetId = (typeof DASHBOARD_WIDGET_IDS)[number];

export interface DashboardWidgetConfig {
  id: DashboardWidgetId;
  size: WidgetSize;
  visible: boolean;
  collapsed: boolean;
}

export interface DashboardLayout {
  /** Bump when the shape changes so stale persisted layouts are migrated. */
  version: number;
  /** Master order of all widgets (hidden ones stay in the array, rendered last). */
  widgets: DashboardWidgetConfig[];
}

export interface WidgetMeta {
  id: DashboardWidgetId;
  title: string;
  description: string;
  defaultSize: WidgetSize;
  resizable: boolean;
}

export const WIDGET_META: Record<DashboardWidgetId, WidgetMeta> = {
  'today-focus': {
    id: 'today-focus',
    title: "Today's Focus",
    description: 'Focus minutes, sessions and streak for today.',
    defaultSize: 'large',
    resizable: true,
  },
  'current-session': {
    id: 'current-session',
    title: 'Current Session',
    description: 'Live status of your running focus session.',
    defaultSize: 'medium',
    resizable: false,
  },
  'weekly-progress': {
    id: 'weekly-progress',
    title: 'Weekly Progress',
    description: 'Focus time this week compared with last week.',
    defaultSize: 'medium',
    resizable: true,
  },
  'productivity-insights': {
    id: 'productivity-insights',
    title: 'Productivity Insights',
    description: 'Quick observations drawn from your history.',
    defaultSize: 'small',
    resizable: false,
  },
  'upcoming-plans': {
    id: 'upcoming-plans',
    title: 'Upcoming Plans',
    description: "Today's plan with completion toggles.",
    defaultSize: 'medium',
    resizable: false,
  },
  'recent-activity': {
    id: 'recent-activity',
    title: 'Recent Activity',
    description: 'Your latest focus sessions.',
    defaultSize: 'small',
    resizable: false,
  },
  'buddy-summary': {
    id: 'buddy-summary',
    title: 'Shared Buddy',
    description: "Your partner's focus summary, privacy-filtered.",
    defaultSize: 'small',
    resizable: false,
  },
  'focus-heatmap': {
    id: 'focus-heatmap',
    title: 'Focus Heatmap',
    description: 'Your last 30 days of focus at a glance.',
    defaultSize: 'large',
    resizable: true,
  },
  'long-term-goals': {
    id: 'long-term-goals',
    title: 'Long-Term Goals',
    description: 'Open weekly and monthly plans.',
    defaultSize: 'medium',
    resizable: false,
  },
  'quick-actions': {
    id: 'quick-actions',
    title: 'Quick Actions',
    description: 'One-tap shortcuts for common tasks.',
    defaultSize: 'small',
    resizable: false,
  },
};

export const DASHBOARD_LAYOUT_VERSION = 1;
