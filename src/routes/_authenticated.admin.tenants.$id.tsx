import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate, formatMonth } from "@/lib/format";
import { RentStatusBadge, TicketStatusBadge } from "@/components/StatusBadge";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/tenants/$id")({
  component: AdminTenantDetailPage,
});

function AdminTenantDetailPage() {
  const { id } = useParams({ from: "/_authenticated/admin/tenants/$id" });
  const qc = useQueryClient();

  const { data: tenant } = useQuery({
    queryKey: ["tenant", id],
    queryFn: async () => {
      const { data } = await supabase.from("tenants").select("*").eq("id", id).maybeSingle();
      return data;
    },
  });

  const { data: rents } = useQuery({
    queryKey: ["tenant-rents", id],
    queryFn: async () => {
      const { data } = await supabase.from("rent_invoices").select("*").eq("tenant_id", id).order("period_month", { ascending: false });
      return data ?? [];
    },
  });

  const { data: tickets } = useQuery({
    queryKey: ["tenant-tickets", id],
    queryFn: async () => {
      const { data } = await supabase.from("maintenance_tickets").select("*").eq("tenant_id", id).order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const [form, setForm] = useState<any>({});
  useEffect(() => { if (tenant) setForm(tenant); }, [tenant]);

  async function save() {
    const { error } = await supabase.from("tenants").update({
      full_name: form.full_name, email: form.email, phone: form.phone, address: form.address,
      apartment_number: form.apartment_number, monthly_rent: Number(form.monthly_rent) || 0,
      notes: form.notes, active: form.active,
    }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Sparat"); qc.invalidateQueries({ queryKey: ["tenant", id] }); }
  }

  async function addRentInvoice() {
    const period = new Date();
    period.setDate(1);
    const due = new Date(period); due.setDate(27);
    const { error } = await supabase.from("rent_invoices").insert({
      tenant_id: id, period_month: period.toISOString().slice(0, 10),
      due_date: due.toISOString().slice(0, 10),
      amount: Number(form.monthly_rent) || 0,
    });
    if (error) toast.error(error.message); else { toast.success("Hyra skapad"); qc.invalidateQueries({ queryKey: ["tenant-rents", id] }); }
  }

  async function markPaid(invoiceId: string) {
    const { error } = await supabase.from("rent_invoices").update({
      status: "paid", paid_date: new Date().toISOString().slice(0, 10),
    }).eq("id", invoiceId);
    if (error) toast.error(error.message); else { toast.success("Markerad som betald"); qc.invalidateQueries({ queryKey: ["tenant-rents", id] }); }
  }

  if (!tenant) return <p className="text-muted-foreground">Läser in…</p>;

  return (
    <div className="space-y-6">
      <Link to="/admin/tenants" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4 mr-1" /> Tillbaka
      </Link>
      <h1 className="text-3xl font-semibold">{tenant.full_name}</h1>

      <Card>
        <CardHeader><CardTitle>Profil</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid md:grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Namn</Label><Input value={form.full_name ?? ""} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
            <div className="space-y-1"><Label>E-post</Label><Input value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div className="space-y-1"><Label>Telefon</Label><Input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div className="space-y-1"><Label>Lägenhetsnr</Label><Input value={form.apartment_number ?? ""} onChange={(e) => setForm({ ...form, apartment_number: e.target.value })} /></div>
            <div className="space-y-1 md:col-span-2"><Label>Adress</Label><Input value={form.address ?? ""} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
            <div className="space-y-1"><Label>Månadshyra (SEK)</Label><Input type="number" value={form.monthly_rent ?? 0} onChange={(e) => setForm({ ...form, monthly_rent: e.target.value })} /></div>
            <div className="space-y-1"><Label>Status</Label>
              <select className="w-full h-10 px-3 rounded-md border border-input bg-background" value={form.active ? "1" : "0"} onChange={(e) => setForm({ ...form, active: e.target.value === "1" })}>
                <option value="1">Aktiv</option><option value="0">Inaktiverad</option>
              </select>
            </div>
          </div>
          <div className="space-y-1"><Label>Anteckningar</Label><Textarea rows={3} value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          <Button onClick={save}>Spara ändringar</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Hyror</CardTitle>
          <Button size="sm" variant="outline" onClick={addRentInvoice}>+ Lägg till denna månad</Button>
        </CardHeader>
        <CardContent>
          {!rents?.length ? <p className="text-sm text-muted-foreground">Inga hyror.</p> : (
            <Table>
              <TableHeader><TableRow><TableHead>Period</TableHead><TableHead>Belopp</TableHead><TableHead>Förfaller</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
              <TableBody>
                {rents.map((r: any) => (
                  <TableRow key={r.id}>
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
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Ärenden</CardTitle></CardHeader>
        <CardContent>
          {!tickets?.length ? <p className="text-sm text-muted-foreground">Inga ärenden.</p> : (
            <div className="space-y-2">
              {tickets.map((t: any) => (
                <Link key={t.id} to="/tickets/$id" params={{ id: t.id }} className="flex items-center justify-between gap-3 p-2 -mx-2 rounded hover:bg-muted/50">
                  <div><div className="font-medium">{t.title}</div><div className="text-xs text-muted-foreground">{formatDate(t.created_at)}</div></div>
                  <TicketStatusBadge status={t.status} />
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}