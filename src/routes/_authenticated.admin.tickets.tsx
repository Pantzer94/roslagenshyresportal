import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate, ticketCategoryLabel } from "@/lib/format";
import { TicketStatusBadge, PriorityBadge } from "@/components/StatusBadge";

export const Route = createFileRoute("/_authenticated/admin/tickets")({
  component: AdminTicketsPage,
});

function AdminTicketsPage() {
  const [status, setStatus] = useState("open");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-tickets", status],
    queryFn: async () => {
      let q = supabase.from("maintenance_tickets").select("*, tenants(full_name, apartment_number)").order("created_at", { ascending: false });
      if (status === "open") q = q.in("status", ["new", "in_progress", "awaiting_tenant"]);
      else if (status !== "all") q = q.eq("status", status as any);
      const { data } = await q;
      return data ?? [];
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">Ärenden</h1>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle>Alla ärenden</CardTitle>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Öppna</SelectItem>
              <SelectItem value="all">Alla</SelectItem>
              <SelectItem value="new">Nya</SelectItem>
              <SelectItem value="in_progress">Pågår</SelectItem>
              <SelectItem value="awaiting_tenant">Väntar hyresgäst</SelectItem>
              <SelectItem value="done">Klara</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {isLoading ? <p className="text-muted-foreground">Läser in…</p> : !data?.length ? (
            <p className="text-muted-foreground">Inga ärenden matchar.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Titel</TableHead>
                    <TableHead>Hyresgäst</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead>Prioritet</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Skapad</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((t: any) => (
                    <TableRow key={t.id} className="cursor-pointer hover:bg-muted/50">
                      <TableCell className="font-medium">
                        <Link to="/tickets/$id" params={{ id: t.id }} className="hover:text-accent">{t.title}</Link>
                      </TableCell>
                      <TableCell>{t.tenants?.full_name} {t.tenants?.apartment_number ? `(${t.tenants.apartment_number})` : ""}</TableCell>
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