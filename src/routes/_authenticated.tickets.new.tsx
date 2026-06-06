import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/tickets/new")({
  component: NewTicketPage,
});

function NewTicketPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("maintenance");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (title.trim().length < 3) { toast.error("Titeln måste vara minst 3 tecken"); return; }
    setSaving(true);
    let { data: tenant } = await supabase.from("tenants").select("id").eq("user_id", user!.id).maybeSingle();
    if (!tenant) {
      // Try case-insensitive self-link via RPC (matches tenants.email to auth.users.email)
      const { data: linkedId, error: linkErr } = await supabase.rpc("link_self_to_tenant");
      if (linkErr || !linkedId) {
        setSaving(false);
        toast.error("Din profil är inte kopplad till en hyresgäst.", {
          description: "Kontakta hyresvärden så att rätt e-postadress läggs in.",
        });
        return;
      }
      tenant = { id: linkedId } as any;
    }
    const { error } = await supabase.from("maintenance_tickets").insert({
      tenant_id: tenant!.id,
      title: title.trim(),
      category: category as any,
      priority: "normal",
      description: description.trim() || null,
    });
    setSaving(false);
    if (error) toast.error("Kunde inte skapa ärende", { description: error.message });
    else { toast.success("Ärende skapat"); navigate({ to: "/tickets" }); }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-3xl font-semibold">Nytt ärende</h1>
      <Card>
        <CardHeader><CardTitle>Beskriv ärendet</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Titel *</Label>
              <Input id="title" required maxLength={150} value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Kategori</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="damage">Skada</SelectItem>
                  <SelectItem value="maintenance">Underhåll</SelectItem>
                  <SelectItem value="report">Felanmälan</SelectItem>
                  <SelectItem value="other">Övrigt</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Hyresvärden bedömer prioritet när ärendet tas emot.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Beskrivning</Label>
              <Textarea id="description" rows={5} maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>{saving ? "Skapar…" : "Skapa ärende"}</Button>
              <Button type="button" variant="outline" onClick={() => navigate({ to: "/tickets" })}>Avbryt</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}