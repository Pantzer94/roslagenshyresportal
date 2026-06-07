import { createFileRoute, useParams, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate, formatMonth } from "@/lib/format";
import { RentStatusBadge, TicketStatusBadge } from "@/components/StatusBadge";
import { toast } from "sonner";
import { ArrowLeft, AlertTriangle, Trash2, Upload, Download, FileText } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useServerFn } from "@tanstack/react-start";
import { adminUpdateTenantLoginEmail, adminDeleteTenant } from "@/lib/admin.functions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/tenants/$id")({
  component: AdminTenantDetailPage,
});

function AdminTenantDetailPage() {
  const { id } = useParams({ from: "/_authenticated/admin/tenants/$id" });
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuth();
  const changeLoginEmail = useServerFn(adminUpdateTenantLoginEmail);
  const removeTenant = useServerFn(adminDeleteTenant);

  const { data: tenant } = useQuery({
    queryKey: ["tenant", id],
    queryFn: async () => {
      const { data } = await supabase.from("tenants").select("*, areas(id, name)").eq("id", id).maybeSingle();
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

  const { data: documents } = useQuery({
    queryKey: ["tenant-documents", id],
    queryFn: async () => {
      const { data } = await supabase.from("documents").select("*").eq("tenant_id", id).order("created_at", { ascending: false });
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

  const [form, setForm] = useState<any>({});
  useEffect(() => { if (tenant) setForm(tenant); }, [tenant]);

  async function save() {
    const { error } = await supabase.from("tenants").update({
      full_name: form.full_name, email: form.email, phone: form.phone,
      street: form.street, postal_code: form.postal_code, city: form.city,
      area_id: form.area_id || null,
      apartment_number: form.apartment_number, monthly_rent: Number(form.monthly_rent) || 0,
      notes: form.notes, active: form.active,
      flagged: !!form.flagged, flag_note: form.flag_note || null,
      notify_email: form.notify_email !== false,
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

  async function deleteTenant() {
    try {
      await removeTenant({ data: { tenant_id: id } });
      toast.success("Hyresgäst och inloggning borttagen");
      navigate({ to: "/admin/tenants" });
    } catch (e: any) {
      toast.error("Kunde inte ta bort", { description: e?.message ?? String(e) });
    }
  }

  async function uploadDocument(file: File, description: string) {
    // Re-read the current user at click time (don't rely on possibly-stale hook state)
    const { data: au } = await supabase.auth.getUser();
    const uid = au?.user?.id ?? user?.id;
    if (!uid) { toast.error("Du verkar vara utloggad — logga in igen."); return; }
    const path = `${id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error: upErr } = await supabase.storage.from("documents").upload(path, file);
    if (upErr) { toast.error("Uppladdning misslyckades", { description: upErr.message }); return; }
    const { error: insErr } = await supabase.from("documents").insert({
      tenant_id: id, file_path: path, file_name: file.name,
      mime_type: file.type || null, size_bytes: file.size,
      description: description || null, uploaded_by: uid,
    });
    if (insErr) { toast.error("Kunde inte spara dokument", { description: insErr.message }); return; }
    toast.success("Dokument uppladdat");
    qc.invalidateQueries({ queryKey: ["tenant-documents", id] });
  }

  async function downloadDocument(path: string, name: string) {
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(path, 60);
    if (error || !data?.signedUrl) { toast.error("Kunde inte hämta länk"); return; }
    const a = document.createElement("a");
    a.href = data.signedUrl; a.download = name; a.target = "_blank"; a.click();
  }

  async function deleteDocument(docId: string, path: string) {
    await supabase.storage.from("documents").remove([path]);
    const { error } = await supabase.from("documents").delete().eq("id", docId);
    if (error) toast.error(error.message);
    else { toast.success("Dokument borttaget"); qc.invalidateQueries({ queryKey: ["tenant-documents", id] }); }
  }

  if (!tenant) return <p className="text-muted-foreground">Läser in…</p>;

  return (
    <div className="space-y-6">
      <Link to="/admin/tenants" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4 mr-1" /> Tillbaka
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-semibold">{tenant.full_name}</h1>
        {tenant.flagged && (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-destructive/10 text-destructive text-xs font-medium">
            <AlertTriangle className="h-3.5 w-3.5" /> Markerad
          </span>
        )}
        <div className="ml-auto">
          <Link to="/messages/$tenantId" params={{ tenantId: id }} className="text-sm text-accent hover:underline">Öppna meddelanden →</Link>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Profil</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid md:grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Namn</Label><Input value={form.full_name ?? ""} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
            <div className="space-y-1"><Label>E-post</Label><Input value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div className="space-y-1"><Label>Telefon</Label><Input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div className="space-y-1"><Label>Lägenhetsnr</Label><Input value={form.apartment_number ?? ""} onChange={(e) => setForm({ ...form, apartment_number: e.target.value })} /></div>
            <div className="space-y-1 md:col-span-2"><Label>Gata</Label><Input value={form.street ?? ""} onChange={(e) => setForm({ ...form, street: e.target.value })} placeholder="t.ex. Storgatan 5" /></div>
            <div className="space-y-1"><Label>Postnummer</Label><Input value={form.postal_code ?? ""} onChange={(e) => setForm({ ...form, postal_code: e.target.value })} placeholder="761 30" /></div>
            <div className="space-y-1"><Label>Ort</Label><Input value={form.city ?? ""} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Norrtälje" /></div>
            <div className="space-y-1">
              <Label>Område</Label>
              <Select value={form.area_id ?? "_none_"} onValueChange={(v) => setForm({ ...form, area_id: v === "_none_" ? null : v })}>
                <SelectTrigger><SelectValue placeholder="Välj område" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none_">(inget område)</SelectItem>
                  {(areas ?? []).map((a: any) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Månadshyra (SEK)</Label><Input type="number" value={form.monthly_rent ?? 0} onChange={(e) => setForm({ ...form, monthly_rent: e.target.value })} /></div>
            <div className="space-y-1"><Label>Status</Label>
              <select className="w-full h-10 px-3 rounded-md border border-input bg-background" value={form.active ? "1" : "0"} onChange={(e) => setForm({ ...form, active: e.target.value === "1" })}>
                <option value="1">Aktiv</option><option value="0">Inaktiverad</option>
              </select>
            </div>
          </div>
          <div className="space-y-1"><Label>Anteckningar</Label><Textarea rows={3} value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>

          <div className="flex items-center gap-3 rounded-md border border-border p-3 bg-muted/30">
            <Switch id="notify" checked={form.notify_email !== false} onCheckedChange={(v) => setForm({ ...form, notify_email: v })} />
            <Label htmlFor="notify" className="text-sm">Skicka notiser via e-post (faktura, påminnelser, meddelanden)</Label>
          </div>

          <div className="rounded-md border border-border p-3 space-y-2 bg-muted/30">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <Label htmlFor="flag" className="font-medium">Markera (misskötsel / OBS)</Label>
              </div>
              <Switch id="flag" checked={!!form.flagged} onCheckedChange={(v) => setForm({ ...form, flagged: v })} />
            </div>
            <Textarea
              rows={2}
              placeholder="Kort anteckning, t.ex. anledning till markeringen…"
              value={form.flag_note ?? ""}
              onChange={(e) => setForm({ ...form, flag_note: e.target.value })}
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <Button onClick={save}>Spara ändringar</Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm"><Trash2 className="h-4 w-4 mr-1" /> Ta bort hyresgäst</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Ta bort {tenant.full_name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Allt tas bort permanent: hyror, ärenden, meddelanden, dokument OCH inloggningen. E-postadressen kan därefter användas för att registrera en helt ny hyresgäst från start.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Avbryt</AlertDialogCancel>
                  <AlertDialogAction onClick={deleteTenant} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Ta bort</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>

      <LoginEmailCard
        currentEmail={tenant.email ?? ""}
        hasUser={!!tenant.user_id}
        onChange={async (newEmail: string) => {
          try {
            await changeLoginEmail({ data: { tenant_id: id, new_email: newEmail } });
            toast.success(tenant.user_id ? "Login-e-post uppdaterad" : "E-post uppdaterad (kopplas vid första inloggning)");
            qc.invalidateQueries({ queryKey: ["tenant", id] });
            qc.invalidateQueries({ queryKey: ["admin-tenants"] });
          } catch (e: any) {
            toast.error("Kunde inte byta e-post", { description: e?.message ?? String(e) });
          }
        }}
      />

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

      <Card>
        <CardHeader><CardTitle>Dokument</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <DocumentUpload onUpload={uploadDocument} />
          {!documents?.length ? (
            <p className="text-sm text-muted-foreground">Inga dokument uppladdade.</p>
          ) : (
            <div className="space-y-2">
              {documents.map((d: any) => (
                <div key={d.id} className="flex items-center justify-between gap-3 p-2 rounded border border-border">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">{d.file_name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {formatDate(d.created_at)}{d.description ? ` · ${d.description}` : ""}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="sm" variant="ghost" onClick={() => downloadDocument(d.file_path, d.file_name)}>
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => deleteDocument(d.id, d.file_path)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function DocumentUpload({ onUpload }: { onUpload: (file: File, description: string) => Promise<void> }) {
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    await onUpload(file, description);
    setBusy(false);
    setFile(null);
    setDescription("");
    (document.getElementById("doc-file") as HTMLInputElement | null)?.value && ((document.getElementById("doc-file") as HTMLInputElement).value = "");
  }

  return (
    <form onSubmit={submit} className="grid md:grid-cols-[1fr,1fr,auto] gap-2 items-end">
      <div className="space-y-1">
        <Label htmlFor="doc-file" className="text-xs">Fil</Label>
        <Input id="doc-file" type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="doc-desc" className="text-xs">Beskrivning (valfritt)</Label>
        <Input id="doc-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="t.ex. Hyreskontrakt 2026" />
      </div>
      <Button type="submit" disabled={!file || busy}>
        <Upload className="h-4 w-4 mr-1" /> {busy ? "Laddar…" : "Ladda upp"}
      </Button>
    </form>
  );
}

function LoginEmailCard({
  currentEmail,
  hasUser,
  onChange,
}: {
  currentEmail: string;
  hasUser: boolean;
  onChange: (newEmail: string) => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { setEmail(currentEmail); }, [currentEmail]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || trimmed === currentEmail) return;
    setBusy(true);
    try { await onChange(trimmed); } finally { setBusy(false); }
  }

  return (
    <Card>
      <CardHeader><CardTitle>Login-e-post</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          {hasUser
            ? "Ändrar både Auth-kontots inloggning och visningsadressen. Hyresgästen behöver ingen bekräftelse."
            : "Hyresgästen har inte registrerat sig ännu. Ändring uppdaterar adressen som krävs vid registrering."}
        </p>
        <form onSubmit={submit} className="flex gap-2 items-end">
          <div className="flex-1 space-y-1">
            <Label htmlFor="login-email">Ny e-post</Label>
            <Input id="login-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <Button type="submit" disabled={busy || !email.trim() || email.trim() === currentEmail}>
            {busy ? "Sparar…" : "Byt login-e-post"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}