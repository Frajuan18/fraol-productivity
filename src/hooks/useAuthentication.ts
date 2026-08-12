'use client';

import { useCallback, useEffect, useState } from 'react';
import { AUTH_STORAGE_KEYS } from '@/src/constants';
import { getPublicCloudEnabled } from '@/lib/config';

const DEMO_USERNAME = 'Fra_juan';
const DEMO_PASSWORD = 'Fra@#$%600';
const LOGIN_DELAY_MS = 400;

export interface AuthApiUser {
  id: string;
  email: string;
  displayName: string;
}

export interface RegisterResult {
  ok: boolean;
  error?: string;
}

export interface UseAuthenticationResult {
  mode: 'local' | 'mongodb';
  isAuthenticated: boolean;
  user: string | null;
  isHydrating: boolean;
  login: (identifier: string, password: string) => Promise<boolean>;
  register: (email: string, password: string, displayName: string) => Promise<RegisterResult>;
  logout: () => Promise<void>;
}

async function postJson<T>(url: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return (await response.json()) as T;
}

function setSessionUser(displayName: string): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(AUTH_STORAGE_KEYS.IS_AUTHENTICATED, 'true');
  sessionStorage.setItem(AUTH_STORAGE_KEYS.USER, displayName);
}

function clearSessionUser(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(AUTH_STORAGE_KEYS.IS_AUTHENTICATED);
  sessionStorage.removeItem(AUTH_STORAGE_KEYS.USER);
}

/**
 * Mode-aware authentication.
 * - MongoDB mode: real accounts via /api/auth/* with an httpOnly session cookie. The
 *   identity is re-validated through /api/auth/me on mount and on every login.
 * - Local mode: keeps the original demo credentials so the app works without MongoDB.
 */
export function useAuthentication(): UseAuthenticationResult {
  const mode = getPublicCloudEnabled() ? 'mongodb' : 'local';
  const [isHydrating, setIsHydrating] = useState(mode === 'mongodb');
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => typeof window !== 'undefined' && sessionStorage.getItem(AUTH_STORAGE_KEYS.IS_AUTHENTICATED) === 'true',
  );
  const [user, setUser] = useState<string | null>(() =>
    typeof window !== 'undefined' ? sessionStorage.getItem(AUTH_STORAGE_KEYS.USER) : null,
  );

  useEffect(() => {
    if (mode !== 'mongodb') return;
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/auth/me');
        const body = (await response.json()) as { ok: boolean; user?: AuthApiUser | null };
        if (!cancelled) {
          if (body.ok && body.user) {
            setIsAuthenticated(true);
            setUser(body.user.displayName);
          } else {
            setIsAuthenticated(false);
            setUser(null);
            clearSessionUser();
          }
        }
      } catch {
        if (!cancelled) {
          setIsAuthenticated(false);
          setUser(null);
        }
      } finally {
        if (!cancelled) setIsHydrating(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode]);

  const login = useCallback(
    async (identifier: string, password: string): Promise<boolean> => {
      if (mode === 'mongodb') {
        try {
          const body = await postJson<{ ok: boolean; user?: AuthApiUser }>('/api/auth/login', {
            email: identifier.trim(),
            password,
          });
          if (body.ok && body.user) {
            setSessionUser(body.user.displayName);
            setIsAuthenticated(true);
            setUser(body.user.displayName);
            return true;
          }
        } catch {
          // fall through to failure
        }
        setIsAuthenticated(false);
        return false;
      }

      await new Promise((resolve) => setTimeout(resolve, LOGIN_DELAY_MS));
      if (identifier === DEMO_USERNAME && password === DEMO_PASSWORD) {
        setSessionUser(identifier);
        setIsAuthenticated(true);
        setUser(identifier);
        return true;
      }
      return false;
    },
    [mode],
  );

  const register = useCallback(
    async (email: string, password: string, displayName: string): Promise<RegisterResult> => {
      if (mode === 'mongodb') {
        try {
          const body = await postJson<{ ok: boolean; user?: AuthApiUser; error?: string }>('/api/auth/register', {
            email: email.trim(),
            password,
            displayName: displayName.trim(),
          });
          if (body.ok && body.user) {
            setSessionUser(body.user.displayName);
            setIsAuthenticated(true);
            setUser(body.user.displayName);
            return { ok: true };
          }
          return { ok: false, error: body.error ?? 'Registration failed.' };
        } catch {
          return { ok: false, error: 'Registration failed. Please try again.' };
        }
      }
      return { ok: false, error: 'Registration requires MongoDB. Use the demo sign-in instead.' };
    },
    [mode],
  );

  const logout = useCallback(async (): Promise<void> => {
    if (mode === 'mongodb') {
      try {
        await fetch('/api/auth/logout', { method: 'POST' });
      } catch {
        // best-effort; the local state is cleared regardless
      }
    }
    clearSessionUser();
    setIsAuthenticated(false);
    setUser(null);
  }, [mode]);

  return { mode, isAuthenticated, user, isHydrating, login, register, logout };
}
