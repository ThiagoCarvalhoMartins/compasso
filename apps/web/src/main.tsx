import { StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@compasso/ui";
import { Layout } from "./components/Layout";
import { queryClient } from "./lib/api";
import { AuthProvider, useAuth } from "./lib/auth";
import { AgendaPage } from "./pages/Agenda";
import { AnalyticsPage } from "./pages/Analytics";
import {
  ForgotPasswordPage,
  LoginPage,
  PrivacyPage,
  RegisterPage,
  ResetPasswordPage,
  VerifyEmailPage,
} from "./pages/Auth";
import { CompassPage } from "./pages/Compass";
import { ProfilePage } from "./pages/Profile";
import "./index.css";

function Protected({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  if (status === "loading") return <p className="p-6 text-muted-foreground">Carregando…</p>;
  return status === "authenticated" ? children : <Navigate to="/entrar" replace />;
}

function PublicOnly({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  if (status === "loading") return null;
  return status === "authenticated" ? <Navigate to="/" replace /> : children;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/entrar" element={<PublicOnly><LoginPage /></PublicOnly>} />
            <Route path="/cadastro" element={<PublicOnly><RegisterPage /></PublicOnly>} />
            <Route path="/esqueci-senha" element={<ForgotPasswordPage />} />
            <Route path="/redefinir-senha" element={<ResetPasswordPage />} />
            <Route path="/confirmar-email" element={<VerifyEmailPage />} />
            <Route path="/privacidade" element={<PrivacyPage />} />
            <Route element={<Protected><Layout /></Protected>}>
              <Route index element={<CompassPage />} />
              <Route path="agenda" element={<AgendaPage />} />
              <Route path="analytics" element={<AnalyticsPage />} />
              <Route path="qp" element={<Navigate to="/analytics" replace />} />
              <Route path="perfil" element={<ProfilePage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);

// RNF02: PWA instalável
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js"));
}
