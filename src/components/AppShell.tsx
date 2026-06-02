import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Building2, LayoutDashboard, CreditCard, Wrench, User, Users, Banknote, LogOut, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem { to: string; label: string; icon: typeof LayoutDashboard }

const tenantNav: NavItem[] = [
  { to: "/dashboard", label: "Översikt", icon: LayoutDashboard },
  { to: "/payments", label: "Betalningar", icon: CreditCard },
  { to: "/tickets", label: "Ärenden", icon: Wrench },
  { to: "/profile", label: "Min profil", icon: User },
];

const adminNav: NavItem[] = [
  { to: "/dashboard", label: "Översikt", icon: LayoutDashboard },
  { to: "/admin/tenants", label: "Hyresgäster", icon: Users },
  { to: "/admin/rent", label: "Hyror", icon: Banknote },
  { to: "/admin/tickets", label: "Ärenden", icon: Wrench },
  { to: "/profile", label: "Min profil", icon: User },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { role, user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const nav = role === "admin" ? adminNav : tenantNav;

  async function handleSignOut() {
    await signOut();
    navigate({ to: "/login", replace: true });
  }

  return (
    <div className="min-h-screen flex bg-secondary/30">
      <aside className="hidden lg:flex w-64 flex-col bg-primary text-primary-foreground">
        <div className="px-6 py-5 flex items-center gap-3 border-b border-white/10">
          <div className="h-9 w-9 rounded-lg bg-accent flex items-center justify-center">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <div className="font-semibold leading-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Hyresportalen</div>
            <div className="text-xs opacity-70">{role === "admin" ? "Hyresvärd" : "Hyresgäst"}</div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.to || location.pathname.startsWith(item.to + "/");
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                  active ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5 hover:text-white"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-white/10">
          <div className="px-3 py-2 text-xs opacity-70 truncate">{user?.email}</div>
          <Button variant="ghost" size="sm" onClick={handleSignOut} className="w-full justify-start text-white/80 hover:text-white hover:bg-white/10">
            <LogOut className="h-4 w-4 mr-2" /> Logga ut
          </Button>
        </div>
      </aside>

      <div className="lg:hidden fixed top-0 inset-x-0 h-14 bg-primary text-primary-foreground flex items-center justify-between px-4 z-40">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          <span className="font-semibold">Hyresportalen</span>
        </div>
        <button onClick={() => setOpen(!open)} className="p-2" aria-label="Meny">
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      {open && (
        <div className="lg:hidden fixed inset-0 top-14 z-30 bg-primary text-primary-foreground p-4">
          <nav className="space-y-1">
            {nav.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.to} to={item.to} onClick={() => setOpen(false)} className="flex items-center gap-3 px-3 py-3 rounded-md text-sm hover:bg-white/10">
                  <Icon className="h-4 w-4" /> {item.label}
                </Link>
              );
            })}
            <button onClick={handleSignOut} className="flex items-center gap-3 px-3 py-3 rounded-md text-sm hover:bg-white/10 w-full">
              <LogOut className="h-4 w-4" /> Logga ut
            </button>
          </nav>
        </div>
      )}

      <main className="flex-1 pt-14 lg:pt-0">
        <div className="max-w-6xl mx-auto p-4 md:p-8">{children}</div>
      </main>
    </div>
  );
}