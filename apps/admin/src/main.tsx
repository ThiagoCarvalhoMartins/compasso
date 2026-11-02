import { StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, NavLink, Outlet, Route, Routes } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { BarChart3, FileText, ScrollText, Users } from "lucide-react";
import { Button, Toaster, cn } from "@compasso/ui";
import { AdminAuthProvider, ROLE_LABEL, queryClient, useAdmin } from "./lib";
import { AuditPage } from "./pages/Audit";
import { DashboardPage } from "./pages/Dashboard";
import { LoginPage } from "./pages/Login";
import { ReportsPage } from "./pages/Reports";
import { UserDetailPage, UsersPage } from "./pages/Users";
import "./index.css";

const links = [
  { to: "/", label: "Dashboard", icon: BarChart3, end: true },
  { to: "/usuarios", label: "Usuários", icon: Users },
  { to: "/relatorios", label: "Relatórios", icon: FileText },
  { to: "/auditoria", label: "Auditoria", icon: ScrollText },
];

function Shell() {
  const { admin, logout } = useAdmin();
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[220px_1fr]">
      <aside className="border-b bg-card p-4 md:min-h-dvh md:border-b-0 md:border-r">
        <div className="mb-4 flex items-center gap-2">
          <img src="/icon.svg" alt="" className="size-7" />
          <div>
            <p className="font-serif text-lg leading-none">Compasso</p>
            <p className="text-xs text-muted-foreground">Painel administrativo</p>
          </div>
        </div>
        <nav aria-label="Painel" className="flex gap-1 overflow-x-auto md:flex-col">
          {links.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn("flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm hover:bg-muted", isActive && "bg-muted font-medium")
              }
            >
              <Icon className="size-4" aria-hidden /> {label}
            </NavLink>
          ))}
        </nav>
        {admin && (
          <div className="mt-6 hidden text-xs text-muted-foreground md:block">
            <p className="font-medium text-foreground">{admin.name}</p>
            <p>{ROLE_LABEL[admin.role]}</p>
            <Button variant="link" size="sm" className="mt-1 h-auto p-0" onClick={logout}>
              Sair
            </Button>
          </div>
        )}
      </aside>
      <main className="min-w-0 p-4 md:p-8">
        <Outlet />
      </main>
    </div>
  );
}

function Protected({ children }: { children: ReactNode }) {
  const { status } = useAdmin();
  if (status === "loading") return <p className="p-6 text-muted-foreground">Carregando…</p>;
  return status === "authenticated" ? children : <Navigate to="/entrar" replace />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AdminAuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/entrar" element={<LoginPage />} />
            <Route element={<Protected><Shell /></Protected>}>
              <Route index element={<DashboardPage />} />
              <Route path="usuarios" element={<UsersPage />} />
              <Route path="usuarios/:id" element={<UserDetailPage />} />
              <Route path="relatorios" element={<ReportsPage />} />
              <Route path="auditoria" element={<AuditPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster />
      </AdminAuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
