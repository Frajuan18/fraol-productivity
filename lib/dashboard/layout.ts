/**
 * Phase 18 — Pure layout reducer.
 *
 * All layout mutations are immutable functions over `DashboardLayout`, so the ordering,
 * visibility, collapse and resize rules are unit-testable without React, storage or the
 * repository. Persistence layers only need to store/return a `DashboardLayout`.
 */
import {
  DASHBOARD_LAYOUT_VERSION,
  DASHBOARD_WIDGET_IDS,
  WIDGET_META,
  WIDGET_SIZES,
  type DashboardLayout,
  type DashboardWidgetConfig,
  type DashboardWidgetId,
  type WidgetSize,
} from './types';

function isWidgetId(value: unknown): value is DashboardWidgetId {
  return typeof value === 'string' && (DASHBOARD_WIDGET_IDS as readonly string[]).includes(value);
}

function isWidgetSize(value: unknown): value is WidgetSize {
  return typeof value === 'string' && (WIDGET_SIZES as readonly string[]).includes(value);
}

function validSizeFor(id: DashboardWidgetId, size: unknown): WidgetSize {
  if (isWidgetSize(size)) return size;
  return WIDGET_META[id].defaultSize;
}

export function createDefaultLayout(): DashboardLayout {
  return {
    version: DASHBOARD_LAYOUT_VERSION,
    widgets: DASHBOARD_WIDGET_IDS.map((id) => ({
      id,
      size: WIDGET_META[id].defaultSize,
      visible: true,
      collapsed: false,
    })),
  };
}

export function isDashboardLayout(value: unknown): value is DashboardLayout {
  if (!value || typeof value !== 'object') return false;
  const layout = value as { version?: unknown; widgets?: unknown };
  return typeof layout.version === 'number' && Array.isArray(layout.widgets);
}

/**
 * Coerces arbitrary persisted input (including null, partial, or older shapes) into a
 * valid layout: unknown ids are dropped, duplicates collapsed, invalid sizes fall back to
 * defaults, and any newly-registered widgets are appended. Never throws.
 */
export function normalizeLayout(input: unknown): DashboardLayout {
  const base = createDefaultLayout();
  if (!isDashboardLayout(input)) return base;

  const seen = new Set<DashboardWidgetId>();
  const normalized: DashboardWidgetConfig[] = [];
  for (const raw of input.widgets) {
    if (!raw || typeof raw !== 'object') continue;
    const id = (raw as { id?: unknown }).id;
    if (!isWidgetId(id) || seen.has(id)) continue;
    seen.add(id);
    const item = raw as Partial<DashboardWidgetConfig>;
    normalized.push({
      id,
      size: validSizeFor(id, item.size),
      visible: typeof item.visible === 'boolean' ? item.visible : true,
      collapsed: typeof item.collapsed === 'boolean' ? item.collapsed : false,
    });
  }

  for (const id of DASHBOARD_WIDGET_IDS) {
    if (!seen.has(id)) {
      seen.add(id);
      normalized.push({
        id,
        size: WIDGET_META[id].defaultSize,
        visible: true,
        collapsed: false,
      });
    }
  }

  return { version: DASHBOARD_LAYOUT_VERSION, widgets: normalized };
}

export function visibleWidgets(layout: DashboardLayout): DashboardWidgetConfig[] {
  return layout.widgets.filter((w) => w.visible);
}

/**
 * Re-applies a user-provided order of visible ids onto the master array. Only visible
 * widgets move into the new order; any visible widget not mentioned (e.g. a stale or
 * partial order) is appended in its previous relative position, and hidden widgets are
 * pinned to the end so the visible order stays exactly what the user dragged into place.
 */
export function reorderWidgets(layout: DashboardLayout, orderedVisibleIds: DashboardWidgetId[]): DashboardLayout {
  const byId = new Map<DashboardWidgetId, DashboardWidgetConfig>(layout.widgets.map((w) => [w.id, w]));
  const mentioned = new Set<DashboardWidgetId>(orderedVisibleIds);
  const visible: DashboardWidgetConfig[] = [];
  for (const id of orderedVisibleIds) {
    const widget = byId.get(id);
    if (widget && widget.visible) visible.push(widget);
  }
  for (const widget of layout.widgets) {
    if (widget.visible && !mentioned.has(widget.id)) visible.push(widget);
  }
  const hidden = layout.widgets.filter((w) => !w.visible);
  return { ...layout, widgets: [...visible, ...hidden] };
}

export type MoveDirection = 'up' | 'down';

/** Moves a widget one visible slot up or down (no-op at the edges). */
export function moveWidget(layout: DashboardLayout, id: DashboardWidgetId, direction: MoveDirection): DashboardLayout {
  const visible = layout.widgets.filter((w) => w.visible);
  const index = visible.findIndex((w) => w.id === id);
  if (index < 0) return layout;
  const target = direction === 'up' ? index - 1 : index + 1;
  if (target < 0 || target >= visible.length) return layout;
  const next = [...visible];
  [next[index], next[target]] = [next[target], next[index]];
  return reorderWidgets(
    layout,
    next.map((w) => w.id),
  );
}

/** Moves a visible widget to the first or last visible slot. */
export function moveWidgetToEdge(
  layout: DashboardLayout,
  id: DashboardWidgetId,
  edge: 'start' | 'end',
): DashboardLayout {
  const visible = layout.widgets.filter((w) => w.visible);
  const index = visible.findIndex((w) => w.id === id);
  if (index < 0) return layout;
  const next = [...visible];
  const [moved] = next.splice(index, 1);
  if (edge === 'start') next.unshift(moved);
  else next.push(moved);
  return reorderWidgets(
    layout,
    next.map((w) => w.id),
  );
}

export function toggleWidgetVisible(layout: DashboardLayout, id: DashboardWidgetId): DashboardLayout {
  let hid = false;
  const widgets = layout.widgets.map((w) => (w.id === id ? { ...w, visible: !w.visible } : w));
  // Re-shown widgets drop to the end of the visible list, keeping the rest untouched.
  if (layout.widgets.find((w) => w.id === id)?.visible) hid = true;
  if (hid) {
    const shown = widgets.filter((w) => w.visible);
    const hidden = widgets.filter((w) => !w.visible);
    return { ...layout, widgets: [...shown, ...hidden] };
  }
  return { ...layout, widgets };
}

export function toggleWidgetCollapsed(layout: DashboardLayout, id: DashboardWidgetId): DashboardLayout {
  return {
    ...layout,
    widgets: layout.widgets.map((w) => (w.id === id ? { ...w, collapsed: !w.collapsed } : w)),
  };
}

export function resizeWidget(layout: DashboardLayout, id: DashboardWidgetId, size: WidgetSize): DashboardLayout {
  if (!WIDGET_META[id]?.resizable) return layout;
  const next = isWidgetSize(size) ? size : WIDGET_META[id].defaultSize;
  return {
    ...layout,
    widgets: layout.widgets.map((w) => (w.id === id ? { ...w, size: next } : w)),
  };
}

export function toggleWidgetSize(layout: DashboardLayout, id: DashboardWidgetId): DashboardLayout {
  const widget = layout.widgets.find((w) => w.id === id);
  if (!widget || !WIDGET_META[id]?.resizable) return layout;
  const next = widget.size === 'large' ? 'medium' : 'large';
  return resizeWidget(layout, id, next);
}

export function restoreDefaultLayout(): DashboardLayout {
  return createDefaultLayout();
}

export function widgetCount(layout: DashboardLayout): number {
  return layout.widgets.length;
}

export function visibleWidgetCount(layout: DashboardLayout): number {
  return layout.widgets.filter((w) => w.visible).length;
}
