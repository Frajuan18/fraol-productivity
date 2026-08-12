import { describe, it, expect } from 'vitest';
import {
  createDefaultLayout,
  normalizeLayout,
  isDashboardLayout,
  moveWidget,
  moveWidgetToEdge,
  reorderWidgets,
  resizeWidget,
  restoreDefaultLayout,
  toggleWidgetCollapsed,
  toggleWidgetSize,
  toggleWidgetVisible,
  visibleWidgets,
  widgetCount,
  visibleWidgetCount,
} from '@/lib/dashboard/layout';
import { DASHBOARD_WIDGET_IDS, WIDGET_META, type DashboardLayout } from '@/lib/dashboard/types';

describe('createDefaultLayout', () => {
  it('contains every registered widget, visible and expanded', () => {
    const layout = createDefaultLayout();
    expect(widgetCount(layout)).toBe(DASHBOARD_WIDGET_IDS.length);
    expect(visibleWidgetCount(layout)).toBe(DASHBOARD_WIDGET_IDS.length);
    for (const widget of layout.widgets) {
      expect(widget.visible).toBe(true);
      expect(widget.collapsed).toBe(false);
      expect(widget.size).toBe(WIDGET_META[widget.id].defaultSize);
    }
  });
});

describe('isDashboardLayout', () => {
  it('accepts a valid layout and rejects garbage', () => {
    expect(isDashboardLayout(createDefaultLayout())).toBe(true);
    expect(isDashboardLayout(null)).toBe(false);
    expect(isDashboardLayout(undefined)).toBe(false);
    expect(isDashboardLayout('x')).toBe(false);
    expect(isDashboardLayout({})).toBe(false);
    expect(isDashboardLayout({ version: 1, widgets: 'nope' })).toBe(false);
  });
});

describe('normalizeLayout', () => {
  it('returns the default layout for malformed input', () => {
    expect(normalizeLayout(null)).toEqual(createDefaultLayout());
    expect(normalizeLayout(undefined)).toEqual(createDefaultLayout());
    expect(normalizeLayout('garbage')).toEqual(createDefaultLayout());
    expect(normalizeLayout({ widgets: 'nope' })).toEqual(createDefaultLayout());
  });

  it('drops unknown widget ids', () => {
    const input = {
      version: 1,
      widgets: [
        { id: 'today-focus', size: 'large', visible: true, collapsed: false },
        { id: 'not-a-widget', size: 'small', visible: true, collapsed: false },
      ],
    };
    const layout = normalizeLayout(input);
    expect(layout.widgets.map((w) => w.id)).not.toContain('not-a-widget');
    expect(layout.widgets.map((w) => w.id)).toContain('today-focus');
  });

  it('dedupes repeated ids keeping the first occurrence', () => {
    const input = {
      version: 1,
      widgets: [
        { id: 'today-focus', size: 'large', visible: true, collapsed: false },
        { id: 'today-focus', size: 'small', visible: false, collapsed: true },
      ],
    };
    const layout = normalizeLayout(input);
    const ids = layout.widgets.filter((w) => w.id === 'today-focus');
    expect(ids).toHaveLength(1);
    expect(ids[0].size).toBe('large');
  });

  it('fills missing fields with safe defaults', () => {
    const layout = normalizeLayout({ version: 1, widgets: [{ id: 'today-focus' }] });
    const widget = layout.widgets.find((w) => w.id === 'today-focus');
    expect(widget).toBeDefined();
    expect(widget!.visible).toBe(true);
    expect(widget!.collapsed).toBe(false);
    expect(widget!.size).toBe('large');
  });

  it('falls back to the default size for an invalid size value', () => {
    const layout = normalizeLayout({ version: 1, widgets: [{ id: 'recent-activity', size: 'huge' }] });
    const widget = layout.widgets.find((w) => w.id === 'recent-activity');
    expect(widget!.size).toBe(WIDGET_META['recent-activity'].defaultSize);
  });

  it('appends any newly registered widget missing from persisted data', () => {
    const layout = normalizeLayout({ version: 1, widgets: [{ id: 'today-focus' }] });
    expect(widgetCount(layout)).toBe(DASHBOARD_WIDGET_IDS.length);
    for (const id of DASHBOARD_WIDGET_IDS) {
      expect(layout.widgets.some((w) => w.id === id)).toBe(true);
    }
  });
});

describe('reorderWidgets', () => {
  it('reorders the visible list in the given order while pinning hidden widgets to the end', () => {
    const layout = createDefaultLayout();
    const hidden = normalizeLayout({
      version: 1,
      widgets: layout.widgets.map((w) => (w.id === 'quick-actions' ? { ...w, visible: false } : w)),
    });
    const reversedVisible = hidden.widgets
      .filter((w) => w.visible)
      .map((w) => w.id)
      .reverse();
    const ordered = reorderWidgets(hidden, reversedVisible);
    expect(ordered.widgets.map((w) => w.id)).toEqual([...reversedVisible, 'quick-actions']);
    expect(ordered.widgets[ordered.widgets.length - 1].visible).toBe(false);
  });

  it('keeps visible widgets not listed in the order (robust against partial orders)', () => {
    const layout = createDefaultLayout();
    const partial = reorderWidgets(layout, ['today-focus']);
    expect(layout.widgets.length).toBe(10);
    expect(partial.widgets.length).toBe(10);
    // every widget survives even though only one id was listed
    for (const id of DASHBOARD_WIDGET_IDS) {
      expect(partial.widgets.some((w) => w.id === id)).toBe(true);
    }
  });
});

describe('moveWidget', () => {
  it('moves a widget up within the visible list', () => {
    const layout = createDefaultLayout();
    const moved = moveWidget(layout, 'weekly-progress', 'up');
    const visible = visibleWidgets(moved).map((w) => w.id);
    expect(visible.indexOf('weekly-progress')).toBeLessThan(visible.indexOf('current-session'));
  });

  it('moves a widget down within the visible list', () => {
    const layout = createDefaultLayout();
    const moved = moveWidget(layout, 'current-session', 'down');
    const visible = visibleWidgets(moved).map((w) => w.id);
    expect(visible.indexOf('current-session')).toBe(2);
  });

  it('is a no-op at the edges', () => {
    const layout = createDefaultLayout();
    expect(moveWidget(layout, 'today-focus', 'up')).toEqual(layout);
    const last = layout.widgets[layout.widgets.length - 1].id;
    expect(moveWidget(layout, last, 'down')).toEqual(layout);
  });

  it('ignores unknown ids', () => {
    const layout = createDefaultLayout();
    expect(moveWidget(layout, 'nope' as never, 'up')).toEqual(layout);
  });
});

describe('moveWidgetToEdge', () => {
  it('moves a widget to the start or end of the visible list', () => {
    const layout = createDefaultLayout();
    const toStart = moveWidgetToEdge(layout, 'quick-actions', 'start');
    expect(visibleWidgets(toStart)[0].id).toBe('quick-actions');
    const toEnd = moveWidgetToEdge(layout, 'today-focus', 'end');
    expect(visibleWidgets(toEnd)[visibleWidgets(toEnd).length - 1].id).toBe('today-focus');
  });
});

describe('toggleWidgetVisible', () => {
  it('hides a visible widget', () => {
    const layout = toggleWidgetVisible(createDefaultLayout(), 'quick-actions');
    expect(visibleWidgetCount(layout)).toBe(DASHBOARD_WIDGET_IDS.length - 1);
    expect(layout.widgets.find((w) => w.id === 'quick-actions')!.visible).toBe(false);
  });

  it('re-shows a hidden widget at the end of the visible order', () => {
    const hidden = toggleWidgetVisible(createDefaultLayout(), 'quick-actions');
    const shown = toggleWidgetVisible(hidden, 'quick-actions');
    expect(shown.widgets.find((w) => w.id === 'quick-actions')!.visible).toBe(true);
    const visible = visibleWidgets(shown).map((w) => w.id);
    expect(visible[visible.length - 1]).toBe('quick-actions');
  });
});

describe('toggleWidgetCollapsed', () => {
  it('collapses and expands a widget without touching order', () => {
    const collapsed = toggleWidgetCollapsed(createDefaultLayout(), 'today-focus');
    expect(collapsed.widgets.find((w) => w.id === 'today-focus')!.collapsed).toBe(true);
    const expanded = toggleWidgetCollapsed(collapsed, 'today-focus');
    expect(expanded.widgets.find((w) => w.id === 'today-focus')!.collapsed).toBe(false);
  });
});

describe('resizeWidget', () => {
  it('resizes a resizable widget', () => {
    const layout = resizeWidget(createDefaultLayout(), 'today-focus', 'medium');
    expect(layout.widgets.find((w) => w.id === 'today-focus')!.size).toBe('medium');
  });

  it('ignores non-resizable widgets', () => {
    const layout = resizeWidget(createDefaultLayout(), 'quick-actions', 'large');
    expect(layout.widgets.find((w) => w.id === 'quick-actions')!.size).toBe('small');
  });

  it('ignores invalid sizes', () => {
    const layout = resizeWidget(createDefaultLayout(), 'today-focus', 'huge' as never);
    expect(layout.widgets.find((w) => w.id === 'today-focus')!.size).toBe('large');
  });
});

describe('toggleWidgetSize', () => {
  it('toggles a large resizable widget to medium and back', () => {
    const smaller = toggleWidgetSize(createDefaultLayout(), 'today-focus');
    expect(smaller.widgets.find((w) => w.id === 'today-focus')!.size).toBe('medium');
    const larger = toggleWidgetSize(smaller, 'today-focus');
    expect(larger.widgets.find((w) => w.id === 'today-focus')!.size).toBe('large');
  });
});

describe('restoreDefaultLayout', () => {
  it('returns a fresh default layout', () => {
    const restored = restoreDefaultLayout();
    expect(restored).toEqual(createDefaultLayout());
  });
});

describe('layout invariants', () => {
  it('every layout produced by the reducer keeps all widget ids exactly once', () => {
    const starting = normalizeLayout({ version: 1, widgets: [{ id: 'today-focus' }] });
    const transforms: ((l: DashboardLayout) => DashboardLayout)[] = [
      (l) => moveWidget(l, 'today-focus', 'down'),
      (l) => toggleWidgetCollapsed(l, 'today-focus'),
      (l) => toggleWidgetVisible(l, 'today-focus'),
      (l) => resizeWidget(l, 'today-focus', 'medium'),
      (l) => reorderWidgets(l, ['today-focus']),
    ];
    for (const fn of transforms) {
      const result = fn(starting);
      const ids = result.widgets.map((w) => w.id);
      expect(new Set(ids).size).toBe(DASHBOARD_WIDGET_IDS.length);
      expect(ids.length).toBe(DASHBOARD_WIDGET_IDS.length);
    }
  });
});
