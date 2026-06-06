import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2, Plus, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/areas")({
  component: AdminAreasPage,
});

function AdminAreasPage() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: areas } = useQuery({
    queryKey: ["areas-admin"],
    queryFn: async () => {
      const { data } = await supabase.from("areas").select("*").order("name");
      const counts: Record<string, number> = {};
      const { data: t } = await supabase.from("tenants").select("area_id");
      (t ?? []).forEach((x: any) => { if (x.area_id) counts[x.area_id] = (counts[x.area_id] ?? 0) + 1; });
      return (data ?? []).map((a: any) => ({ ...a, tenant_count: counts[a.id] ?? 0 }));
    },
  });

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    setBusy(true);
    const { error } = await supabase.from("areas").insert({ name: n });
    setBusy(false);
    if (error) toast.error(error.message);
    else { setName(""); toast.success("Område tillagt"); qc.invalidateQueries({ queryKey: ["areas-admin"] }); qc.invalidateQueries({ queryKey: ["areas"] }); }
  }

  async function rename(id: string, newName: string) {
    const { error } = await supabase.from("areas").update({ name: newName.trim() }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Sparat"); qc.invalidateQueries({ queryKey: ["areas-admin"] }); qc.invalidateQueries({ queryKey: ["areas"] }); }
  }

  async function remove(id: string, count: number) {
    if (count > 0) { toast.error(`Området används av ${count} hyresgäst${count === 1 ? "" : "er"}. Flytta dem först.`); return; }
    const { error } = await supabase.from("areas").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Borttaget"); qc.invalidateQueries({ queryKey: ["areas-admin"] }); qc.invalidateQueries({ queryKey: ["areas"] }); }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Områden</h1>
        <p className="text-muted-foreground mt-1">Gruppera hyresgäster (t.ex. Stava, Norrtälje, Lervik).</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Lägg till område</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={add} className="flex gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Områdesnamn" />
            <Button type="submit" disabled={busy}><Plus className="h-4 w-4 mr-1" /> Lägg till</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Alla områden</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {!areas?.length ? <p className="text-sm text-muted-foreground">Inga områden ännu.</p> :
            areas.map((a) => <AreaRow key={a.id} area={a} onRename={rename} onDelete={remove} />)}
        </CardContent>
      </Card>
    </div>
  );
}

function AreaRow({ area, onRename, onDelete }: { area: any; onRename: (id: string, n: string) => Promise<void>; onDelete: (id: string, c: number) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(area.name);
  return (
    <div className="flex items-center gap-2 p-2 rounded border border-border">
      {editing ? (
        <>
          <Input value={value} onChange={(e) => setValue(e.target.value)} className="flex-1" />
          <Button size="sm" variant="ghost" onClick={async () => { await onRename(area.id, value); setEditing(false); }}><Check className="h-4 w-4" /></Button>
          <Button size="sm" variant="ghost" onClick={() => { setValue(area.name); setEditing(false); }}><X className="h-4 w-4" /></Button>
        </>
      ) : (
        <>
          <div className="flex-1 font-medium">{area.name}</div>
          <span className="text-xs text-muted-foreground">{area.tenant_count} hyresgäst{area.tenant_count === 1 ? "" : "er"}</span>
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" /></Button>
          <Button size="sm" variant="ghost" onClick={() => onDelete(area.id, area.tenant_count)}><Trash2 className="h-4 w-4" /></Button>
        </>
      )}
    </div>
  );
}