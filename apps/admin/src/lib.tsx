import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { QueryClient } from "@tanstack/react-query";
import type { AuthResponse, UserDTO } from "@compasso/shared";
import { createApiClient } from "@compasso/ui";

export const api = createApiClient({
  baseUrl: import.meta.env.VITE_API_URL ?? "http://localhost:3000/api/v1",
  refreshPath: "/admin/auth/refresh",
  onUnauthorized: () => window.dispatchEvent(new Event("compasso-admin:logout")),
});

export const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } },
});

type Status = "loading" | "authenticated" | "anonymous";

const AuthContext = createContext<{
  status: Status;
  admin: UserDTO | null;
  setSession: (s: AuthResponse) => void;
  logout: () => Promise<void>;
} | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [admin, setAdmin] = useState<UserDTO | null>(null);

  const clear = useCallback(() => {
    api.setAccessToken(null);
    setAdmin(null);
    setStatus("anonymous");
    queryClient.clear();
  }, []);

  useEffect(() => {
    const off = api.onSessionRefreshed((s) => setAdmin((s as AuthResponse).user));
    api.refresh().then((ok) => setStatus(ok ? "authenticated" : "anonymous"));
    window.addEventListener("compasso-admin:logout", clear);
    return () => {
      off();
      window.removeEventListener("compasso-admin:logout", clear);
    };
  }, [clear]);

  const setSession = useCallback((s: AuthResponse) => {
    api.setAccessToken(s.accessToken);
    setAdmin(s.user);
    setStatus("authenticated");
  }, []);

  const logout = useCallback(async () => {
    await api.post("/admin/auth/logout").catch(() => undefined);
    clear();
  }, [clear]);

  return <AuthContext.Provider value={{ status, admin, setSession, logout }}>{children}</AuthContext.Provider>;
}

export function useAdmin() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAdmin precisa do AdminAuthProvider");
  return ctx;
}

export const formatDateTime = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";

export const pct = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `${Math.round(v * 100)}%`);

export const STATUS_LABEL = { ACTIVE: "Ativo", BLOCKED: "Bloqueado", DELETED: "Excluído" } as const;
export const ROLE_LABEL = { USER: "Usuário", SUPPORT: "Suporte", ADMIN: "Administrador" } as const;

export const AGE_GROUPS = ["13–17", "18–24", "25–34", "35–44", "45–59", "60+"];

/** Cores dos gráficos a partir da paleta (texto escuro sobre pastel). */
export const CHART = {
  primary: "#A8C3A0",
  secondary: "#C7BEDF",
  blue: "#B9D3E3",
  peach: "#F4C9B0",
  mint: "#BFE3D0",
  rose: "#EBC3C8",
  butter: "#F3E1A6",
  ink: "#3D3A36",
  grid: "#E8E1D6",
};
