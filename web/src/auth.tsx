import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { api, setCsrfToken } from './api';
import { requireSupabase, supabase, translateAuthError } from './supabase';
import type { ProfileStats, User } from './types';

export interface RegisterInput {
  email: string;
  password: string;
  alias?: string;
  publicCompetitionConsent?: boolean;
}

interface AuthValue {
  status: 'loading' | 'anon' | 'auth';
  user: User | null;
  stats: ProfileStats | null;
  /** True when the Supabase project is configured for this build. */
  configured: boolean;
  refresh: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  /** Returns 'confirmed' when a session was created, 'verify-email' when confirmation is pending. */
  register: (input: RegisterInput) => Promise<'confirmed' | 'verify-email'>;
  logout: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<string>;
  updatePassword: (password: string) => Promise<void>;
  /** Re-authenticates against Supabase and returns a fresh access token (used before deletion). */
  reauthenticate: (email: string, password: string) => Promise<string>;
  setUser: (user: User) => void;
}

const AuthContext = createContext<AuthValue | null>(null);

const CONFIGURE_HINT =
  'Inloggningen är inte konfigurerad i den här miljön. Sätt VITE_SUPABASE_URL och VITE_SUPABASE_ANON_KEY.';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<'loading' | 'anon' | 'auth'>('loading');
  const [user, setUserState] = useState<User | null>(null);
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const exchangedFor = useRef<string | null>(null);

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

  /** Swaps a Supabase access token for the app's own server-side session. */
  const exchange = useCallback(async (accessToken: string, extra: Record<string, unknown> = {}) => {
    const result = await api.session({ accessToken, ...extra });
    exchangedFor.current = accessToken;
    setCsrfToken(result.csrfToken);
    setUserState(result.user);
    setStatus('auth');
    const me = await api.me();
    setStats(me.stats ?? null);
    if (me.csrfToken) setCsrfToken(me.csrfToken);
    return result;
  }, []);

  // Pick up an existing Supabase session (returning visitor or a magic link) exactly once.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!supabase) {
        await refresh();
        return;
      }
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (cancelled) return;
      if (!token) {
        await refresh();
        return;
      }
      try {
        await exchange(token);
      } catch {
        await supabase.auth.signOut().catch(() => undefined);
        await refresh();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [exchange, refresh]);

  useEffect(() => {
    if (!supabase) return undefined;
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        exchangedFor.current = null;
        setUserState(null);
        setStats(null);
        setStatus('anon');
      } else if (event === 'SIGNED_IN' && session?.access_token && session.access_token !== exchangedFor.current) {
        void exchange(session.access_token).catch(() => undefined);
      }
    });
    return () => data.subscription.unsubscribe();
  }, [exchange]);

  useEffect(() => {
    const handleUnauthorized = () => {
      setUserState(null);
      setStats(null);
      setStatus('anon');
    };
    window.addEventListener('sparly:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('sparly:unauthorized', handleUnauthorized);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      if (!supabase) throw new Error(CONFIGURE_HINT);
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error(translateAuthError(error.message));
      if (!data.session) throw new Error('Inloggningen kunde inte slutföras. Försök igen.');
      await exchange(data.session.access_token);
    },
    [exchange],
  );

  const register = useCallback<AuthValue['register']>(
    async (input) => {
      if (!supabase) throw new Error(CONFIGURE_HINT);
      const { data, error } = await supabase.auth.signUp({
        email: input.email,
        password: input.password,
        options: { data: { alias: input.alias ?? null } },
      });
      if (error) throw new Error(translateAuthError(error.message));
      if (!data.session) return 'verify-email';
      await exchange(data.session.access_token, {
        ...(input.alias ? { alias: input.alias } : {}),
        ...(input.publicCompetitionConsent !== undefined
          ? { publicCompetitionConsent: input.publicCompetitionConsent }
          : {}),
      });
      return 'confirmed';
    },
    [exchange],
  );

  const logout = useCallback(async () => {
    try {
      const result = await api.logout();
      setCsrfToken(result.csrfToken);
    } finally {
      if (supabase) await supabase.auth.signOut().catch(() => undefined);
      exchangedFor.current = null;
      setUserState(null);
      setStats(null);
      setStatus('anon');
    }
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    if (!supabase) throw new Error(CONFIGURE_HINT);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/aterstall-losenord`,
    });
    if (error) throw new Error(translateAuthError(error.message));
    return 'Om adressen finns hos oss har vi skickat en länk för att välja ett nytt lösenord.';
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    if (!supabase) throw new Error(CONFIGURE_HINT);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw new Error(translateAuthError(error.message));
  }, []);

  const reauthenticate = useCallback(async (email: string, password: string) => {
    const client = requireSupabase();
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw new Error('Lösenordet stämmer inte.');
    if (!data.session) throw new Error('Kunde inte bekräfta lösenordet. Försök igen.');
    // The fresh token is only used for this one privileged call; the app session stays as it is.
    exchangedFor.current = data.session.access_token;
    return data.session.access_token;
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      status,
      user,
      stats,
      configured: Boolean(supabase),
      refresh,
      login,
      register,
      logout,
      requestPasswordReset,
      updatePassword,
      reauthenticate,
      setUser: (next) => setUserState(next),
    }),
    [status, user, stats, refresh, login, register, logout, requestPasswordReset, updatePassword, reauthenticate],
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
