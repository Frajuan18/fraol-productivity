'use client';

import { useState, useEffect, useCallback } from 'react';
import { getRepository } from '@/lib/repositories/repository';
import type { HistorySignals } from './types';

let cachedSignals: HistorySignals | null = null;
let inflight: Promise<HistorySignals | null> | null = null;

function fetchSignals(): Promise<HistorySignals | null> {
  return getRepository()
    .getPlanningSignals('')
    .then(
      (signals) => {
        cachedSignals = signals;
        return signals;
      },
      (error: unknown) => {
        console.error('Failed to load planning signals:', error);
        return null;
      },
    );
}

/**
 * Loads the compact planning signals once per page (shared module cache) so both plan
 * creators get the same data without duplicate requests. Never exposes raw history.
 */
export function usePlanningSignals(): {
  signals: HistorySignals | null;
  refresh: () => void;
} {
  const [signals, setSignals] = useState<HistorySignals | null>(() => cachedSignals);

  useEffect(() => {
    if (cachedSignals) return;
    if (inflight) {
      inflight.then(setSignals).catch(() => undefined);
      return;
    }
    let cancelled = false;
    inflight = fetchSignals().finally(() => {
      inflight = null;
    });
    inflight.then((next) => {
      if (!cancelled) setSignals(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = useCallback(() => {
    cachedSignals = null;
    inflight = fetchSignals().finally(() => {
      inflight = null;
    });
    inflight.then(setSignals).catch(() => undefined);
  }, []);

  return { signals, refresh };
}
