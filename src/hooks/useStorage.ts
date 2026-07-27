'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { dataService } from '@/lib/dataService';
import { getDefaultData } from '@/src/utils/defaults';
import type { AppData } from '@/src/types';

const SAVE_DEBOUNCE_MS = 400;

export interface UseStorageResult {
  data: AppData;
  isLoading: boolean;
  error: string | null;
  setData: (data: AppData) => void;
  patchData: (patch: Partial<AppData>) => void;
  save: () => Promise<boolean>;
  reload: () => Promise<void>;
}

export function useStorage(): UseStorageResult {
  const [data, setDataState] = useState<AppData>(() => getDefaultData());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestData = useRef<AppData>(data);

  useEffect(() => {
    latestData.current = data;
  }, [data]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      try {
        const loaded = await dataService.loadData();
        if (!cancelled) {
          setDataState(loaded);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load data');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback(async (value: AppData): Promise<boolean> => {
    try {
      const ok = await dataService.saveData(value);
      if (!ok) setError('Failed to save data');
      return ok;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save data');
      return false;
    }
  }, []);

  const scheduleSave = useCallback(
    (value: AppData) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void persist(value);
      }, SAVE_DEBOUNCE_MS);
    },
    [persist],
  );

  const setData = useCallback(
    (next: AppData) => {
      setDataState(next);
      scheduleSave(next);
    },
    [scheduleSave],
  );

  const patchData = useCallback(
    (patch: Partial<AppData>) => {
      setDataState((prev) => {
        const merged = { ...prev, ...patch };
        scheduleSave(merged);
        return merged;
      });
    },
    [scheduleSave],
  );

  const save = useCallback(async () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    return persist(latestData.current);
  }, [persist]);

  const reload = useCallback(async () => {
    setIsLoading(true);
    try {
      const loaded = await dataService.loadData();
      setDataState(loaded);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reload data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  return { data, isLoading, error, setData, patchData, save, reload };
}
