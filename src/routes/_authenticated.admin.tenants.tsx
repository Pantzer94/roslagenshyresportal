import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Search } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/tenants")({
  component: AdminTenantsPage,
});

function AdminTenantsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-tenants"],
    queryFn: async () => {
      const { data } = await supabase.from("tenants").select("*").order("full_name", { ascending: true });
      return data ?? [];
    },
  });

  const filtered = (data ?? []).filter((t: any) =>
    !search || t.full_name?.toLowerCase().includes(search.toLowerCase()) || t.email?.toLowerCase().includes(search.toLowerCase()) || t.apartment_number?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold">Hyresgäster</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" /> Ny hyresgäst</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Lägg till hyresgäst</DialogTitle></DialogHeader>
            <NewTenantForm onSaved={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["admin-tenants"] }); }} />
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Alla hyresgäster ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative mb-4">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Sök namn, e-post eller lägenhet…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          {isLoading ? <p className="text-muted-foreground">Läser in…</p> : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Namn</TableHead>
                    <TableHead>Lgh</TableHead>
                    <TableHead>E-post</TableHead>
                    <TableHead>Telefon</TableHead>
                    <TableHead>Hyra</TableHead>
                    <TableHead>Aktiv</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((t: any) => (
                    <TableRow key={t.id} className="cursor-pointer hover:bg-muted/50" onClick={() => window.location.assign(`/admin/tenants/${t.id}`)}>
                      <TableCell className="font-medium">
                        <Link to="/admin/tenants/$id" params={{ id: t.id }} className="hover:text-accent">{t.full_name}</Link>
                      </TableCell>
                      <TableCell>{t.apartment_number ?? "—"}</TableCell>
                      <TableCell>{t.email ?? "—"}</TableCell>
                      <TableCell>{t.phone ?? "—"}</TableCell>
                      <TableCell>{formatCurrency(t.monthly_rent)}</TableCell>
                      <TableCell>{t.active ? "Ja" : "Nej"}</TableCell>
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

function NewTenantForm({ onSaved }: { onSaved: () => void }) {
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", address: "", apartment_number: "", monthly_rent: "" });
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (form.full_name.trim().length < 2) { toast.error("Namn krävs"); return; }
    setSaving(true);
    const { error } = await supabase.from("tenants").insert({
      full_name: form.full_name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      address: form.address.trim() || null,
      apartment_number: form.apartment_number.trim() || null,
      monthly_rent: Number(form.monthly_rent) || 0,
    });
    setSaving(false);
    if (error) toast.error("Kunde inte spara", { description: error.message });
    else { toast.success("Hyresgäst skapad"); onSaved(); }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="space-y-1"><Label>Namn *</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required /></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1"><Label>E-post</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        <div className="space-y-1"><Label>Telefon</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
      </div>
      <div className="space-y-1"><Label>Adress</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1"><Label>Lägenhetsnr</Label><Input value={form.apartment_number} onChange={(e) => setForm({ ...form, apartment_number: e.target.value })} /></div>
        <div className="space-y-1"><Label>Månadshyra (SEK)</Label><Input type="number" min={0} value={form.monthly_rent} onChange={(e) => setForm({ ...form, monthly_rent: e.target.value })} /></div>
      </div>
      <Button type="submit" disabled={saving} className="w-full">{saving ? "Sparar…" : "Skapa hyresgäst"}</Button>
      <p className="text-xs text-muted-foreground">Hyresgästkontot kopplas automatiskt när personen registrerar sig med samma e-postadress.</p>
    </form>
  );
}