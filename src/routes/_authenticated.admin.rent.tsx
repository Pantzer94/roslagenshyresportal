import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency, formatDate, formatMonth } from "@/lib/format";
import { RentStatusBadge } from "@/components/StatusBadge";
import { toast } from "sonner";
import { Download } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/rent")({
  component: AdminRentPage,
});

function AdminRentPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-rent"],
    queryFn: async () => {
      const { data } = await supabase.from("rent_invoices").select("*, tenants(id, full_name, apartment_number, areas(name))").order("due_date", { ascending: false });
      return data ?? [];
    },
  });

  async function markPaid(id: string) {
    const { error } = await supabase.from("rent_invoices").update({ status: "paid", paid_date: new Date().toISOString().slice(0, 10) }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Betalning registrerad"); qc.invalidateQueries({ queryKey: ["admin-rent"] }); }
  }

  async function generateForAll() {
    const period = new Date(); period.setDate(1);
    const periodStr = period.toISOString().slice(0, 10);
    const due = new Date(period); due.setDate(27);
    const { data: tenants } = await supabase.from("tenants").select("id, monthly_rent").eq("active", true);
    if (!tenants?.length) { toast.error("Inga aktiva hyresgäster"); return; }
    const rows = tenants.filter((t) => Number(t.monthly_rent) > 0).map((t) => ({
      tenant_id: t.id, period_month: periodStr, due_date: due.toISOString().slice(0, 10),
      amount: Number(t.monthly_rent),
    }));
    const { error, count } = await supabase.from("rent_invoices").upsert(rows, { onConflict: "tenant_id,period_month", ignoreDuplicates: true, count: "exact" });
    if (error) toast.error(error.message); else { toast.success(`${count ?? rows.length} hyror skapade för ${formatMonth(period)}`); qc.invalidateQueries({ queryKey: ["admin-rent"] }); }
  }

  const filtered = (data ?? []).filter((r: any) => filter === "all" || r.status === filter);

  function exportCsv() {
    const rows = filtered;
    if (!rows.length) { toast.error("Inget att exportera"); return; }
    const header = ["Hyresgäst", "Område", "Lgh", "Period", "Belopp", "Förfaller", "Status", "Betald", "Mail skickat"];
    const esc = (v: any) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [header.join(",")];
    rows.forEach((r: any) => {
      lines.push([
        r.tenants?.full_name, r.tenants?.areas?.name ?? "", r.tenants?.apartment_number ?? "",
        r.period_month, r.amount, r.due_date, r.status, r.paid_date ?? "", r.email_sent_at ?? "",
      ].map(esc).join(","));
    });
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `hyror-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold">Hyror</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-1" /> Exportera CSV</Button>
          <Button onClick={generateForAll}>Skapa hyror för denna månad</Button>
        </div>
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle>Hyresavier</CardTitle>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alla</SelectItem>
              <SelectItem value="unpaid">Obetalda</SelectItem>
              <SelectItem value="overdue">Försenade</SelectItem>
              <SelectItem value="paid">Betalda</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {isLoading ? <p className="text-muted-foreground">Läser in…</p> : !filtered.length ? (
            <p className="text-muted-foreground">Inga hyror matchar filtret.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Hyresgäst</TableHead>
                    <TableHead>Område</TableHead>
                    <TableHead>Lgh</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Belopp</TableHead>
                    <TableHead>Förfaller</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">
                        <Link to="/admin/tenants/$id" params={{ id: r.tenants.id }} className="hover:text-accent">{r.tenants.full_name}</Link>
                      </TableCell>
                      <TableCell>{r.tenants?.areas?.name ?? <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell>{r.tenants.apartment_number ?? "—"}</TableCell>
                      <TableCell>{formatMonth(r.period_month)}</TableCell>
                      <TableCell>{formatCurrency(r.amount)}</TableCell>
                      <TableCell>{formatDate(r.due_date)}</TableCell>
                      <TableCell><RentStatusBadge status={r.status} /></TableCell>
                      <TableCell className="text-right">
                        {r.status !== "paid" && <Button size="sm" variant="outline" onClick={() => markPaid(r.id)}>Markera betald</Button>}
                      </TableCell>
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