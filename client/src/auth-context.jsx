import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from './api.js';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/auth/me')
      .then((d) => setUser(d.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (username, password) => {
    const d = await api.post('/auth/login', { username, password });
    setUser(d.user);
  }, []);

  const register = useCallback(async (username, displayName, password) => {
    const d = await api.post('/auth/register', { username, displayName, password });
    setUser(d.user);
  }, []);

  const logout = useCallback(async () => {
    await api.post('/auth/logout');
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const d = await api.get('/auth/me');
    setUser(d.user);
  }, []);

  return (
    <AuthCtx.Provider value={{ user, loading, login, register, logout, refreshUser, setUser }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
