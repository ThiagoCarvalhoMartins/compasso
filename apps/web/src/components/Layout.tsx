import { Link, NavLink, Outlet } from "react-router-dom";
import { CalendarDays, Compass, LogOut, Sparkles, UserRound } from "lucide-react";
import { Avatar, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, cn } from "@compasso/ui";
import { useAuth } from "../lib/auth";

const links = [
  { to: "/", label: "Compasso", icon: Compass, end: true },
  { to: "/agenda", label: "Agenda", icon: CalendarDays },
  { to: "/qp", label: "Repetições QP", icon: Sparkles },
  { to: "/perfil", label: "Perfil", icon: UserRound },
];

export function Layout() {
  const { user, logout } = useAuth();
  return (
    <div className="min-h-dvh pb-20 md:pb-0">
      <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <NavLink to="/" className="flex items-center gap-2">
            <img src="/icon.svg" alt="" className="size-7" />
            <span className="font-serif text-xl">Compasso</span>
          </NavLink>
          <nav aria-label="Principal" className="hidden gap-1 md:flex">
            {links.map(({ to, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn("rounded-lg px-3 py-2 text-sm transition-colors duration-200 hover:bg-muted", isActive && "bg-muted font-medium")
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
          {user && (
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger
                aria-label="Menu do usuário"
                className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring cursor-pointer"
              >
                <Avatar name={user.name} src={user.avatarUrl} className="size-8" />
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem asChild>
                  <Link to="/perfil">
                    <UserRound aria-hidden /> Perfil
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void logout()}>
                  <LogOut aria-hidden /> Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>

      {/* Navegação inferior no celular */}
      <nav aria-label="Principal" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t bg-card pb-[env(safe-area-inset-bottom)] md:hidden">
        {links.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn("flex flex-col items-center gap-0.5 py-2 text-[11px] text-muted-foreground", isActive && "font-medium text-foreground")
            }
          >
            <Icon className="size-5" aria-hidden />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
