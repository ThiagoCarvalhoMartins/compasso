import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { AuthResponse, UserDTO } from "@compasso/shared";
import { api, queryClient } from "./api";

type Status = "loading" | "authenticated" | "anonymous";

interface AuthContextValue {
  status: Status;
  user: UserDTO | null;
  setSession: (session: AuthResponse) => void;
  setUser: (user: UserDTO) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [user, setUser] = useState<UserDTO | null>(null);

  const setSession = useCallback((session: AuthResponse) => {
    api.setAccessToken(session.accessToken);
    setUser(session.user);
    setStatus("authenticated");
  }, []);

  const clear = useCallback(() => {
    api.setAccessToken(null);
    setUser(null);
    setStatus("anonymous");
    queryClient.clear();
  }, []);

  // Restaura a sessão pelo cookie de refresh ao abrir o app.
  useEffect(() => {
    const off = api.onSessionRefreshed((s) => setUser((s as AuthResponse).user));
    api.refresh().then((ok) => setStatus(ok ? "authenticated" : "anonymous"));
    window.addEventListener("compasso:logout", clear);
    return () => {
      off();
      window.removeEventListener("compasso:logout", clear);
    };
  }, [clear]);

  const logout = useCallback(async () => {
    await api.post("/auth/logout").catch(() => undefined);
    clear();
  }, [clear]);

  return (
    <AuthContext.Provider value={{ status, user, setSession, setUser, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth precisa do AuthProvider");
  return ctx;
}
