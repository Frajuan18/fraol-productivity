'use client';

import { useEffect, useMemo, useState } from 'react';
import { getRepository } from '@/lib/repositories/repository';
import { createDefaultLayout, normalizeLayout } from './layout';
import type { DashboardLayout, DashboardWidgetConfig } from './types';

async function resolveUserId(): Promise<string> {
  try {
    const res = await fetch('/api/auth/me');
    const data = (await res.json()) as { ok: boolean; user?: { id: string } };
    if (data.ok && data.user?.id) return data.user.id;
  } catch {}
  return 'demo-user';
}

export interface DashboardLayoutState {
  layout: DashboardLayout;
  visible: DashboardWidgetConfig[];
  loaded: boolean;
}

export function useDashboardLayout(): DashboardLayoutState {
  const repository = getRepository();
  const [layout, setLayout] = useState<DashboardLayout>(() => createDefaultLayout());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    resolveUserId().then((uid) => {
      if (cancelled) return;
      repository
        .getDashboardLayout(uid)
        .then((value) => {
          if (cancelled) return;
          setLayout(normalizeLayout(value));
          setLoaded(true);
        })
        .catch(() => {
          if (cancelled) return;
          setLoaded(true);
        });
    });
    return () => {
      cancelled = true;
    };
  }, [repository]);

  const visible = useMemo(() => layout.widgets.filter((w) => w.visible), [layout]);

  return { layout, visible, loaded };
}

export type { DashboardLayout, DashboardWidgetConfig };
