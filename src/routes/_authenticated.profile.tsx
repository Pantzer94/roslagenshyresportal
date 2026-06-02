import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile", user!.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle();
      return data;
    },
  });

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setName(profile.full_name ?? "");
      setPhone(profile.phone ?? "");
    }
  }, [profile]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ full_name: name, phone }).eq("id", user!.id);
    setSaving(false);
    if (error) toast.error("Kunde inte spara", { description: error.message });
    else { toast.success("Profil uppdaterad"); qc.invalidateQueries({ queryKey: ["profile"] }); }
  }

  if (isLoading) return <p className="text-muted-foreground">Läser in…</p>;

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-3xl font-semibold">Min profil</h1>
      <Card>
        <CardHeader><CardTitle>Personuppgifter</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={save} className="space-y-4">
            <div className="space-y-2">
              <Label>E-post</Label>
              <Input value={user!.email ?? ""} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Fullständigt namn</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telefon</Label>
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={40} />
            </div>
            <Button type="submit" disabled={saving}>{saving ? "Sparar…" : "Spara"}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}