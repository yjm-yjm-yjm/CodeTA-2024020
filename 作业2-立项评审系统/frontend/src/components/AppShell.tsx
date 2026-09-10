import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { homePath, useAuth } from "@/store/auth";
import { ROLE_LABEL } from "@/types";

export function AppShell({ links }: { links: { to: string; label: string }[] }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-6">
            <Link to={homePath(user?.role)} className="text-lg font-bold text-indigo-600">
              黑客松立项评审系统
            </Link>
            <nav className="hidden items-center gap-1 md:flex">
              {links.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  className={({ isActive }) =>
                    `rounded-md px-3 py-2 text-sm ${
                      isActive
                        ? "bg-indigo-50 font-medium text-indigo-600"
                        : "text-slate-500 hover:text-slate-900"
                    }`
                  }
                >
                  {l.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-slate-500">
              {user?.email} · {ROLE_LABEL[user?.role || ""]}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                logout();
                nav("/login");
              }}
            >
              退出
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
