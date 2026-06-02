import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, ticketCategoryLabel } from "@/lib/format";
import { TicketStatusBadge, PriorityBadge } from "@/components/StatusBadge";

export const Route = createFileRoute("/_authenticated/tickets")({
  component: TicketsListPage,
});

function TicketsListPage() {
  const { user, role } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["my-tickets", user!.id],
    queryFn: async () => {
      if (role === "admin") {
        const { data } = await supabase.from("maintenance_tickets").select("*, tenants(full_name)").order("created_at", { ascending: false });
        return data ?? [];
      }
      const { data: tenant } = await supabase.from("tenants").select("id").eq("user_id", user!.id).maybeSingle();
      if (!tenant) return [];
      const { data } = await supabase.from("maintenance_tickets").select("*").eq("tenant_id", tenant.id).order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-3xl font-semibold">Ärenden</h1>
        {role !== "admin" && (
          <Button asChild>
            <Link to="/tickets/new"><Plus className="h-4 w-4 mr-1" /> Nytt ärende</Link>
          </Button>
        )}
      </div>
      <Card>
        <CardHeader><CardTitle>Alla ärenden</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p className="text-muted-foreground">Läser in…</p> : !data?.length ? (
            <p className="text-muted-foreground">Inga ärenden ännu.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Titel</TableHead>
                    {role === "admin" && <TableHead>Hyresgäst</TableHead>}
                    <TableHead>Kategori</TableHead>
                    <TableHead>Prioritet</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Skapad</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((t: any) => (
                    <TableRow key={t.id} className="cursor-pointer" onClick={() => window.location.assign(`/tickets/${t.id}`)}>
                      <TableCell className="font-medium">{t.title}</TableCell>
                      {role === "admin" && <TableCell>{t.tenants?.full_name ?? "—"}</TableCell>}
                      <TableCell>{ticketCategoryLabel[t.category]}</TableCell>
                      <TableCell><PriorityBadge priority={t.priority} /></TableCell>
                      <TableCell><TicketStatusBadge status={t.status} /></TableCell>
                      <TableCell>{formatDate(t.created_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}