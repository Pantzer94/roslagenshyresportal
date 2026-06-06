import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Search, AlertTriangle, Upload } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/tenants/")({
  component: AdminTenantsPage,
  validateSearch: (s: Record<string, unknown>) => ({ area: typeof s.area === "string" ? s.area : undefined }),
});

function AdminTenantsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const search0 = Route.useSearch();
  const [search, setSearch] = useState("");
  const [areaFilter, setAreaFilter] = useState<string>(search0.area ?? "all");
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-tenants"],
    queryFn: async () => {
      const { data } = await supabase.from("tenants").select("*, areas(id, name)").order("full_name", { ascending: true });
      return data ?? [];
    },
  });

  const { data: areas } = useQuery({
    queryKey: ["areas"],
    queryFn: async () => {
      const { data } = await supabase.from("areas").select("*").order("name");
      return data ?? [];
    },
  });

  const filtered = (data ?? []).filter((t: any) =>
    (!search ||
      t.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      t.email?.toLowerCase().includes(search.toLowerCase()) ||
      t.apartment_number?.toLowerCase().includes(search.toLowerCase())) &&
    (areaFilter === "all" || (areaFilter === "_none_" ? !t.area_id : t.areas?.name === areaFilter))
  );

  // Counts per area (active + inactive included for visibility)
  const counts: Record<string, number> = {};
  (data ?? []).forEach((t: any) => {
    const k = t.areas?.name ?? "_none_";
    counts[k] = (counts[k] ?? 0) + 1;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold">Hyresgäster</h1>
        <div className="flex flex-wrap gap-2">
          <Dialog open={importOpen} onOpenChange={setImportOpen}>
            <DialogTrigger asChild>
              <Button variant="outline"><Upload className="h-4 w-4 mr-1" /> Importera CSV</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Importera hyresgäster (CSV)</DialogTitle></DialogHeader>
              <CsvImport areas={areas ?? []} onDone={() => { setImportOpen(false); qc.invalidateQueries({ queryKey: ["admin-tenants"] }); }} />
            </DialogContent>
          </Dialog>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-1" /> Ny hyresgäst</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Lägg till hyresgäst</DialogTitle></DialogHeader>
              <NewTenantForm areas={areas ?? []} onSaved={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["admin-tenants"] }); }} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <FilterChip label={`Alla (${data?.length ?? 0})`} active={areaFilter === "all"} onClick={() => setAreaFilter("all")} />
        {(areas ?? []).map((a: any) => (
          <FilterChip key={a.id} label={`${a.name} (${counts[a.name] ?? 0})`} active={areaFilter === a.name} onClick={() => setAreaFilter(a.name)} />
        ))}
        {counts["_none_"] ? (
          <FilterChip label={`Utan område (${counts["_none_"]})`} active={areaFilter === "_none_"} onClick={() => setAreaFilter("_none_")} />
        ) : null}
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
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Namn</TableHead>
                    <TableHead>Område</TableHead>
                    <TableHead>Lgh</TableHead>
                    <TableHead>E-post</TableHead>
                    <TableHead>Telefon</TableHead>
                    <TableHead>Hyra</TableHead>
                    <TableHead>Aktiv</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((t: any) => (
                    <TableRow key={t.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate({ to: "/admin/tenants/$id", params: { id: t.id } })}>
                      <TableCell>
                        {t.flagged && (
                          <span title={t.flag_note ?? "Markerad"}>
                            <AlertTriangle className="h-4 w-4 text-destructive" />
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">
                        <Link to="/admin/tenants/$id" params={{ id: t.id }} className="hover:text-accent">{t.full_name}</Link>
                      </TableCell>
                      <TableCell>{t.areas?.name ?? <span className="text-muted-foreground">—</span>}</TableCell>
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

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "px-3 py-1.5 rounded-full text-sm transition-colors border " +
        (active ? "bg-accent text-accent-foreground border-accent" : "bg-background text-foreground border-border hover:bg-muted")
      }
    >
      {label}
    </button>
  );
}

function NewTenantForm({ areas, onSaved }: { areas: any[]; onSaved: () => void }) {
  const [form, setForm] = useState({
    full_name: "", email: "", phone: "",
    street: "", postal_code: "", city: "", area_id: "",
    apartment_number: "", monthly_rent: "",
  });
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (form.full_name.trim().length < 2) { toast.error("Namn krävs"); return; }
    setSaving(true);
    const { error } = await supabase.from("tenants").insert({
      full_name: form.full_name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      street: form.street.trim() || null,
      postal_code: form.postal_code.trim() || null,
      city: form.city.trim() || null,
      area_id: form.area_id || null,
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
      <div className="space-y-1"><Label>Gata</Label><Input value={form.street} onChange={(e) => setForm({ ...form, street: e.target.value })} placeholder="t.ex. Storgatan 5" /></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1"><Label>Postnummer</Label><Input value={form.postal_code} onChange={(e) => setForm({ ...form, postal_code: e.target.value })} placeholder="761 30" /></div>
        <div className="space-y-1"><Label>Ort</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Norrtälje" /></div>
      </div>
      <div className="space-y-1">
        <Label>Område</Label>
        <Select value={form.area_id || "_none_"} onValueChange={(v) => setForm({ ...form, area_id: v === "_none_" ? "" : v })}>
          <SelectTrigger><SelectValue placeholder="Välj område" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_none_">(inget område)</SelectItem>
            {areas.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">Hantera områden under <Link to="/admin/areas" className="text-accent hover:underline">Områden</Link>.</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1"><Label>Lägenhetsnr</Label><Input value={form.apartment_number} onChange={(e) => setForm({ ...form, apartment_number: e.target.value })} /></div>
        <div className="space-y-1"><Label>Månadshyra (SEK)</Label><Input type="number" min={0} value={form.monthly_rent} onChange={(e) => setForm({ ...form, monthly_rent: e.target.value })} /></div>
      </div>
      <Button type="submit" disabled={saving} className="w-full">{saving ? "Sparar…" : "Skapa hyresgäst"}</Button>
      <p className="text-xs text-muted-foreground">Hyresgästkontot kopplas automatiskt när personen registrerar sig med samma e-postadress.</p>
    </form>
  );
}

function CsvImport({ areas, onDone }: { areas: any[]; onDone: () => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function run() {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (!lines.length) { toast.error("Klistra in CSV-data"); return; }
    const [header, ...rows] = lines;
    const cols = header.split(",").map((c) => c.trim().toLowerCase());
    const idx = (n: string) => cols.indexOf(n);
    const required = ["full_name"];
    for (const r of required) {
      if (idx(r) < 0) { toast.error(`Saknar kolumn: ${r}`); return; }
    }
    setBusy(true);
    const areaByName = new Map<string, string>();
    areas.forEach((a: any) => areaByName.set(a.name.toLowerCase(), a.id));

    const records = rows.map((row) => {
      const cells = parseCsvRow(row);
      const get = (n: string) => { const i = idx(n); return i >= 0 ? (cells[i] ?? "").trim() : ""; };
      const areaName = get("area") || get("område");
      return {
        full_name: get("full_name") || get("namn"),
        email: get("email") || null,
        phone: get("phone") || get("telefon") || null,
        street: get("street") || get("gata") || null,
        postal_code: get("postal_code") || get("postnr") || null,
        city: get("city") || get("ort") || null,
        apartment_number: get("apartment_number") || get("lgh") || null,
        monthly_rent: Number(get("monthly_rent") || get("hyra") || 0) || 0,
        area_id: areaName ? (areaByName.get(areaName.toLowerCase()) ?? null) : null,
      };
    }).filter((r) => r.full_name);

    if (!records.length) { setBusy(false); toast.error("Inga giltiga rader"); return; }
    const { error } = await supabase.from("tenants").insert(records as any);
    setBusy(false);
    if (error) toast.error("Importen misslyckades", { description: error.message });
    else { toast.success(`${records.length} hyresgäster importerade`); onDone(); }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Klistra in CSV med rubrikrad. Kolumner: <code>full_name, email, phone, street, postal_code, city, apartment_number, monthly_rent, area</code>.
        Områdesnamnet matchas mot listan (skapa nya först under Områden).
      </p>
      <textarea
        className="w-full h-48 p-2 rounded-md border border-input bg-background font-mono text-xs"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={"full_name,email,phone,street,postal_code,city,apartment_number,monthly_rent,area\nAnna Andersson,anna@ex.se,070-1234567,Storgatan 5,76130,Norrtälje,12,8500,Norrtälje"}
      />
      <Button onClick={run} disabled={busy} className="w-full">{busy ? "Importerar…" : "Importera"}</Button>
    </div>
  );
}

function parseCsvRow(row: string): string[] {
  const out: string[] = []; let cur = ""; let inQ = false;
  for (let i = 0; i < row.length; i++) {
    const c = row[i];
    if (inQ) {
      if (c === '"' && row[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') inQ = false;
      else cur += c;
    } else {
      if (c === ',') { out.push(cur); cur = ""; }
      else if (c === '"') inQ = true;
      else cur += c;
    }
  }
  out.push(cur); return out;
}