import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { api, clearTokens, getAccessToken, setTokens } from "../api/client";
import type { AuthResponse, AuthUser, Tenant } from "../api/types";

interface AuthState {
  user: AuthUser | null;
  tenant: Tenant | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, tenantName?: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getAccessToken()) {
      setLoading(false);
      return;
    }
    api<{ user: AuthUser; tenant: Tenant }>("/api/v1/auth/me")
      .then((data) => {
        setUser(data.user);
        setTenant(data.tenant);
      })
      .catch(() => clearTokens())
      .finally(() => setLoading(false));
  }, []);

  const apply = useCallback((res: AuthResponse) => {
    setTokens(res.accessToken, res.refreshToken);
    setUser(res.user);
    setTenant(res.tenant);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      apply(await api<AuthResponse>("/api/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }));
    },
    [apply],
  );

  const register = useCallback(
    async (name: string, email: string, password: string, tenantName?: string) => {
      apply(await api<AuthResponse>("/api/v1/auth/register", {
        method: "POST",
        body: JSON.stringify({ name, email, password, tenantName: tenantName || undefined }),
      }));
    },
    [apply],
  );

  const logout = useCallback(() => {
    clearTokens();
    setUser(null);
    setTenant(null);
  }, []);

  const value = useMemo(
    () => ({ user, tenant, loading, login, register, logout }),
    [user, tenant, loading, login, register, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
