'use client';

import { useCallback, useEffect, useState } from 'react';
import { AUTH_STORAGE_KEYS } from '@/src/constants';

const DEMO_USERNAME = 'Fra_juan';
const DEMO_PASSWORD = 'Fra@#$%600';
const LOGIN_DELAY_MS = 800;

export interface UseAuthenticationResult {
  isAuthenticated: boolean;
  user: string | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
}

export function useAuthentication(): UseAuthenticationResult {
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => typeof window !== 'undefined' && sessionStorage.getItem(AUTH_STORAGE_KEYS.IS_AUTHENTICATED) === 'true',
  );
  const [user, setUser] = useState<string | null>(() =>
    typeof window !== 'undefined' ? sessionStorage.getItem(AUTH_STORAGE_KEYS.USER) : null,
  );

  const login = useCallback(async (username: string, password: string): Promise<boolean> => {
    await new Promise((resolve) => setTimeout(resolve, LOGIN_DELAY_MS));

    if (username === DEMO_USERNAME && password === DEMO_PASSWORD) {
      sessionStorage.setItem(AUTH_STORAGE_KEYS.IS_AUTHENTICATED, 'true');
      sessionStorage.setItem(AUTH_STORAGE_KEYS.USER, username);
      setIsAuthenticated(true);
      setUser(username);
      return true;
    }
    return false;
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem(AUTH_STORAGE_KEYS.IS_AUTHENTICATED);
    sessionStorage.removeItem(AUTH_STORAGE_KEYS.USER);
    setIsAuthenticated(false);
    setUser(null);
  }, []);

  return { isAuthenticated, user, login, logout };
}
