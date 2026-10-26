import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, hasSessionHint, onSessionChange, refreshSession, setSession } from '@/api/client';
import type { TokenResponse, UserSummary } from '@/api/types';

interface AuthState {
  user: UserSummary | null;
  ready: boolean;
  isAdmin: boolean;
  login: (email: string, password: string, rememberMe: boolean) => Promise<UserSummary>;
  applySession: (s: TokenResponse) => void;
  logout: (all?: boolean) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserSummary | null>(null);
  const [ready, setReady] = useState(false);
  const qc = useQueryClient();

  useEffect(() => {
    const off = onSessionChange((s) => setUser(s?.user ?? null));
    // Khôi phục phiên từ cookie refresh_token khi tải trang.
    if (hasSessionHint()) refreshSession().finally(() => setReady(true));
    else setReady(true);
    return () => {
      off();
    };
  }, []);

  const value: AuthState = {
    user,
    ready,
    isAdmin: !!user?.roles.includes('ADMIN'),
    async login(email, password, rememberMe) {
      const s = await api<TokenResponse>('/auth/login', { method: 'POST', body: { email, password, rememberMe } });
      setSession(s);
      qc.invalidateQueries();
      return s.user;
    },
    applySession(s) {
      setSession(s);
      qc.invalidateQueries();
    },
    async logout(all = false) {
      try {
        await api<void>(`/auth/logout${all ? '?all=true' : ''}`, { method: 'POST' });
      } finally {
        setSession(null);
        qc.clear();
      }
    },
    async refreshUser() {
      await refreshSession();
    },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth phải nằm trong AuthProvider');
  return v;
}
