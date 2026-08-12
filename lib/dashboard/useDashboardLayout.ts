'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getRepository } from '@/lib/repositories/repository';
import {
  createDefaultLayout,
  moveWidget,
  moveWidgetToEdge,
  normalizeLayout,
  reorderWidgets,
  resizeWidget,
  restoreDefaultLayout,
  toggleWidgetCollapsed,
  toggleWidgetSize,
  toggleWidgetVisible,
  type MoveDirection,
} from './layout';
import type { DashboardLayout, DashboardWidgetConfig, DashboardWidgetId, WidgetSize } from './types';

const SAVE_DEBOUNCE_MS = 400;

export interface DashboardLayoutActions {
  move: (id: DashboardWidgetId, direction: MoveDirection) => void;
  moveToEdge: (id: DashboardWidgetId, edge: 'start' | 'end') => void;
  reorder: (orderedVisibleIds: DashboardWidgetId[]) => void;
  toggleCollapsed: (id: DashboardWidgetId) => void;
  toggleVisible: (id: DashboardWidgetId) => void;
  toggleSize: (id: DashboardWidgetId) => void;
  setSize: (id: DashboardWidgetId, size: WidgetSize) => void;
  restore: () => void;
}

export interface DashboardLayoutState {
  layout: DashboardLayout;
  visible: DashboardWidgetConfig[];
  loaded: boolean;
  error: string | null;
  editing: boolean;
  setEditing: (value: boolean) => void;
  restoreDefaults: () => void;
  actions: DashboardLayoutActions;
}

export function useDashboardLayout(): DashboardLayoutState {
  const repository = getRepository();
  const [layout, setLayout] = useState<DashboardLayout>(() => createDefaultLayout());
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    repository
      .getDashboardLayout('')
      .then((value) => {
        if (cancelled) return;
        setLayout(normalizeLayout(value));
        setLoaded(true);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load dashboard layout.');
        setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [repository]);

  const saveTimer = useRef<number | null>(null);
  const latestRef = useRef(layout);
  useEffect(() => {
    latestRef.current = layout;
  }, [layout]);

  useEffect(() => {
    if (!loaded) return;
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      void repository.saveDashboardLayout('', normalizeLayout(layout)).catch(() => undefined);
    }, SAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    };
  }, [layout, loaded, repository]);

  useEffect(
    () => () => {
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
      void repository.saveDashboardLayout('', normalizeLayout(latestRef.current)).catch(() => undefined);
    },
    [repository],
  );

  const move = useCallback((id: DashboardWidgetId, direction: MoveDirection) => {
    setLayout((prev) => moveWidget(prev, id, direction));
  }, []);
  const moveToEdge = useCallback((id: DashboardWidgetId, edge: 'start' | 'end') => {
    setLayout((prev) => moveWidgetToEdge(prev, id, edge));
  }, []);
  const reorder = useCallback((orderedVisibleIds: DashboardWidgetId[]) => {
    setLayout((prev) => reorderWidgets(prev, orderedVisibleIds));
  }, []);
  const toggleCollapsed = useCallback((id: DashboardWidgetId) => {
    setLayout((prev) => toggleWidgetCollapsed(prev, id));
  }, []);
  const toggleVisible = useCallback((id: DashboardWidgetId) => {
    setLayout((prev) => toggleWidgetVisible(prev, id));
  }, []);
  const toggleSize = useCallback((id: DashboardWidgetId) => {
    setLayout((prev) => toggleWidgetSize(prev, id));
  }, []);
  const setSize = useCallback((id: DashboardWidgetId, size: WidgetSize) => {
    setLayout((prev) => resizeWidget(prev, id, size));
  }, []);
  const restore = useCallback(() => {
    setLayout(() => restoreDefaultLayout());
  }, []);

  const actions = useMemo<DashboardLayoutActions>(
    () => ({ move, moveToEdge, reorder, toggleCollapsed, toggleVisible, toggleSize, setSize, restore }),
    [move, moveToEdge, reorder, toggleCollapsed, toggleVisible, toggleSize, setSize, restore],
  );

  const visible = useMemo(() => layout.widgets.filter((w) => w.visible), [layout]);

  return {
    layout,
    visible,
    loaded,
    error,
    editing,
    setEditing,
    restoreDefaults: restore,
    actions,
  };
}

export type { DashboardLayout, DashboardWidgetConfig };
