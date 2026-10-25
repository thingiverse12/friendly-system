import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { api, setCsrfToken } from './api';
import type { ProfileStats, User } from './types';

interface AuthValue {
  status: 'loading' | 'anon' | 'auth';
  user: User | null;
  stats: ProfileStats | null;
  refresh: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (body: {
    email: string;
    password: string;
    alias?: string;
    publicCompetitionConsent?: boolean;
    acceptedTerms: true;
  }) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<'loading' | 'anon' | 'auth'>('loading');
  const [user, setUserState] = useState<User | null>(null);
  const [stats, setStats] = useState<ProfileStats | null>(null);

  const refresh = useCallback(async () => {
    try {
      const me = await api.me();
      setCsrfToken(me.csrfToken);
      if (me.authenticated && me.user) {
        setUserState(me.user);
        setStats(me.stats ?? null);
        setStatus('auth');
      } else {
        setUserState(null);
        setStats(null);
        setStatus('anon');
      }
    } catch {
      setStatus('anon');
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const handleUnauthorized = () => {
      setUserState(null);
      setStats(null);
      setStatus('anon');
    };
    window.addEventListener('sparly:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('sparly:unauthorized', handleUnauthorized);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await api.login({ email, password });
    setCsrfToken(result.csrfToken);
    setUserState(result.user);
    setStatus('auth');
    const me = await api.me();
    setStats(me.stats ?? null);
    if (me.csrfToken) setCsrfToken(me.csrfToken);
  }, []);

  const register = useCallback<AuthValue['register']>(async (body) => {
    const result = await api.register(body);
    setCsrfToken(result.csrfToken);
    setUserState(result.user);
    setStatus('auth');
    const me = await api.me();
    setStats(me.stats ?? null);
  }, []);

  const logout = useCallback(async () => {
    try {
      const result = await api.logout();
      setCsrfToken(result.csrfToken);
    } finally {
      setUserState(null);
      setStats(null);
      setStatus('anon');
    }
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      status,
      user,
      stats,
      refresh,
      login,
      register,
      logout,
      setUser: (next) => setUserState(next),
    }),
    [status, user, stats, refresh, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth måste användas inom AuthProvider');
  return value;
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading') {
    return (
      <div className="boot-screen" role="status" aria-live="polite">
        <div className="boot-mark" aria-hidden="true">✦</div>
        <p>Laddar Sparly …</p>
      </div>
    );
  }
  if (status === 'anon') {
    return <Navigate to="/logga-in" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}
