import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Building2 } from "lucide-react";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Logga in — Hyresportalen" }] }),
  component: LoginPage,
});

function LoginPage() {
  const { session, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && session) navigate({ to: "/dashboard", replace: true });
  }, [session, authLoading, navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error("Inloggning misslyckades", { description: error.message });
    } else {
      toast.success("Inloggad");
      navigate({ to: "/dashboard", replace: true });
    }
  }

  async function onSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email, password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { full_name: fullName },
      },
    });
    setLoading(false);
    if (error) toast.error("Registrering misslyckades", { description: error.message });
    else toast.success("Konto skapat", { description: "Kontrollera din e-post för att bekräfta kontot." });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary/30 to-background p-4">
      <Card className="w-full max-w-md shadow-xl border-border/60">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto h-12 w-12 rounded-xl bg-primary text-primary-foreground flex items-center justify-center">
            <Building2 className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl">Hyresportalen</CardTitle>
          <CardDescription>Säker portal för hyresvärd och hyresgäster</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="signin">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Logga in</TabsTrigger>
              <TabsTrigger value="signup">Registrera</TabsTrigger>
            </TabsList>
            <TabsContent value="signin">
              <form onSubmit={onSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">E-post</Label>
                  <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Lösenord</Label>
                  <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>{loading ? "Loggar in…" : "Logga in"}</Button>
                <div className="text-center text-sm">
                  <Link to="/forgot-password" className="text-accent hover:underline">Glömt lösenord?</Link>
                </div>
              </form>
            </TabsContent>
            <TabsContent value="signup">
              <form onSubmit={onSignup} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="su-name">Namn</Label>
                  <Input id="su-name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="su-email">E-post</Label>
                  <Input id="su-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="su-password">Lösenord (minst 8 tecken)</Label>
                  <Input id="su-password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>{loading ? "Skapar…" : "Skapa konto"}</Button>
                <p className="text-xs text-muted-foreground text-center">
                  Endast e-postadresser som hyresvärden lagt upp kan registreras. Det första kontot i systemet blir hyresvärd.
                </p>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}