import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Banknote, Wrench, AlertTriangle, Users } from "lucide-react";
import { formatCurrency, formatDate, formatMonth } from "@/lib/format";
import { RentStatusBadge, TicketStatusBadge } from "@/components/StatusBadge";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const { role, user } = useAuth();
  if (role === "admin") return <AdminDashboard />;
  return <TenantDashboard userId={user!.id} />;
}

function AdminDashboard() {
  const { user } = useAuth();
  const { data: profile } = useQuery({
    queryKey: ["my-profile", user!.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("full_name").eq("id", user!.id).maybeSingle();
      return data;
    },
  });
  const firstName = (profile?.full_name?.trim().split(/\s+/)[0]) || (user?.email?.split("@")[0]) || "";

  const { data, isLoading } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: async () => {
      const [tenants, unpaid, openTickets, recentTickets, areaRows] = await Promise.all([
        supabase.from("tenants").select("id", { count: "exact", head: true }).eq("active", true),
        supabase.from("rent_invoices").select("id, amount, due_date, status, tenants(full_name)").in("status", ["unpaid", "overdue"]).order("due_date", { ascending: true }).limit(10),
        supabase.from("maintenance_tickets").select("id", { count: "exact", head: true }).in("status", ["new", "in_progress"]),
        supabase.from("maintenance_tickets").select("id, title, status, created_at, tenants(full_name)").order("created_at", { ascending: false }).limit(5),
        supabase.from("tenants").select("area_id, areas(name)").eq("active", true),
      ]);
      const byArea = new Map<string, number>();
      (areaRows.data ?? []).forEach((r: any) => {
        const name = r.areas?.name ?? "Utan område";
        byArea.set(name, (byArea.get(name) ?? 0) + 1);
      });
      const areaCounts = Array.from(byArea.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);
      return {
        tenantCount: tenants.count ?? 0,
        unpaid: unpaid.data ?? [],
        openTicketCount: openTickets.count ?? 0,
        recentTickets: recentTickets.data ?? [],
        areaCounts,
      };
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Översikt</h1>
        <p className="text-muted-foreground mt-1">Välkommen tillbaka{firstName ? `, ${firstName}` : ""}.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard icon={Users} label="Aktiva hyresgäster" value={isLoading ? "…" : String(data?.tenantCount ?? 0)} />
        <StatCard icon={AlertTriangle} label="Obetalda hyror" value={isLoading ? "…" : String(data?.unpaid.length ?? 0)} tone="warning" />
        <StatCard icon={Wrench} label="Öppna ärenden" value={isLoading ? "…" : String(data?.openTicketCount ?? 0)} />
      </div>

      {data?.areaCounts && data.areaCounts.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Hyresgäster per område</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {data.areaCounts.map((a) => (
                <Link
                  key={a.name}
                  to="/admin/tenants"
                  search={{ area: a.name } as any}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-accent/10 text-accent text-sm hover:bg-accent/20"
                >
                  <span className="font-medium">{a.name}</span>
                  <span className="opacity-70">{a.count}</span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Obetalda hyror</CardTitle></CardHeader>
          <CardContent>
            {!data?.unpaid.length ? (
              <p className="text-sm text-muted-foreground">Inga obetalda hyror just nu.</p>
            ) : (
              <div className="space-y-3">
                {data.unpaid.map((r: any) => (
                  <div key={r.id} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{r.tenants?.full_name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">Förfaller {formatDate(r.due_date)} · {formatCurrency(r.amount)}</div>
                    </div>
                    <RentStatusBadge status={r.status} />
                  </div>
                ))}
                <Link to="/admin/rent" className="text-sm text-accent hover:underline">Visa alla hyror →</Link>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Senaste ärenden</CardTitle></CardHeader>
          <CardContent>
            {!data?.recentTickets.length ? (
              <p className="text-sm text-muted-foreground">Inga ärenden ännu.</p>
            ) : (
              <div className="space-y-3">
                {data.recentTickets.map((t: any) => (
                  <Link key={t.id} to="/admin/tickets" className="flex items-center justify-between gap-3 hover:bg-muted/50 -mx-2 px-2 py-1 rounded">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{t.title}</div>
                      <div className="text-xs text-muted-foreground">{t.tenants?.full_name} · {formatDate(t.created_at)}</div>
                    </div>
                    <TicketStatusBadge status={t.status} />
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function TenantDashboard({ userId }: { userId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["tenant-dashboard", userId],
    queryFn: async () => {
      const { data: tenant } = await supabase.from("tenants").select("*").eq("user_id", userId).maybeSingle();
      if (!tenant) return { tenant: null, nextRent: null, openTickets: [] };
      const [{ data: rents }, { data: tickets }] = await Promise.all([
        supabase.from("rent_invoices").select("*").eq("tenant_id", tenant.id).in("status", ["unpaid", "overdue"]).order("due_date", { ascending: true }).limit(1),
        supabase.from("maintenance_tickets").select("*").eq("tenant_id", tenant.id).in("status", ["new", "in_progress", "awaiting_tenant"]).order("created_at", { ascending: false }),
      ]);
      return { tenant, nextRent: rents?.[0] ?? null, openTickets: tickets ?? [] };
    },
  });

  if (isLoading) return <p className="text-muted-foreground">Läser in…</p>;

  if (!data?.tenant) {
    return (
      <Card>
        <CardHeader><CardTitle>Välkommen</CardTitle></CardHeader>
        <CardContent><p className="text-muted-foreground">Ditt konto är inte kopplat till en hyresgästprofil ännu. Kontakta hyresvärden.</p></CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Hej {data.tenant.full_name.split(" ")[0]}</h1>
        <p className="text-muted-foreground mt-1">Här är en översikt av ditt boende.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Banknote className="h-5 w-5 text-accent" /> Nästa hyra</CardTitle></CardHeader>
          <CardContent>
            {data.nextRent ? (
              <div className="space-y-3">
                <div className="text-3xl font-semibold">{formatCurrency(data.nextRent.amount)}</div>
                <div className="text-sm text-muted-foreground">{formatMonth(data.nextRent.period_month)} · förfaller {formatDate(data.nextRent.due_date)}</div>
                <RentStatusBadge status={data.nextRent.status} />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Du har inga obetalda hyror. 🎉</p>
            )}
            <Link to="/payments" className="text-sm text-accent hover:underline block mt-4">Visa betalhistorik →</Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Wrench className="h-5 w-5 text-accent" /> Mina öppna ärenden</CardTitle></CardHeader>
          <CardContent>
            {data.openTickets.length === 0 ? (
              <p className="text-sm text-muted-foreground">Inga öppna ärenden.</p>
            ) : (
              <div className="space-y-3">
                {data.openTickets.slice(0, 4).map((t: any) => (
                  <Link key={t.id} to="/tickets/$id" params={{ id: t.id }} className="flex items-center justify-between gap-3 hover:bg-muted/50 -mx-2 px-2 py-1 rounded">
                    <div className="font-medium truncate">{t.title}</div>
                    <TicketStatusBadge status={t.status} />
                  </Link>
                ))}
              </div>
            )}
            <Link to="/tickets" className="text-sm text-accent hover:underline block mt-4">Visa alla ärenden →</Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, tone }: { icon: any; label: string; value: string; tone?: "warning" }) {
  return (
    <Card>
      <CardContent className="p-6 flex items-center gap-4">
        <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${tone === "warning" ? "bg-[oklch(0.96_0.06_75)] text-[oklch(0.45_0.13_75)]" : "bg-accent/10 text-accent"}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <div className="text-2xl font-semibold">{value}</div>
          <div className="text-sm text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}