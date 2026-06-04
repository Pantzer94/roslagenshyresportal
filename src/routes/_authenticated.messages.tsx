import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import { MessageThread } from "@/components/MessageThread";
import { MessageSquare, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/messages")({
  component: MessagesPage,
});

function MessagesPage() {
  const { role, user } = useAuth();
  const navigate = useNavigate();

  // Tenant: find own tenant record and show thread inline
  const { data: ownTenant } = useQuery({
    enabled: role === "tenant",
    queryKey: ["own-tenant", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("tenants").select("id, full_name").eq("user_id", user!.id).maybeSingle();
      return data;
    },
  });

  // Admin: list of tenants with last message
  const { data: conversations } = useQuery({
    enabled: role === "admin",
    queryKey: ["admin-conversations"],
    queryFn: async () => {
      const { data: tenants } = await supabase.from("tenants").select("id, full_name, apartment_number").order("full_name");
      const { data: msgs } = await supabase.from("messages").select("tenant_id, body, created_at, read_at, sender_is_admin").order("created_at", { ascending: false });
      const lastByTenant = new Map<string, any>();
      const unreadByTenant = new Map<string, number>();
      (msgs ?? []).forEach((m: any) => {
        if (!lastByTenant.has(m.tenant_id)) lastByTenant.set(m.tenant_id, m);
        if (!m.sender_is_admin && !m.read_at) {
          unreadByTenant.set(m.tenant_id, (unreadByTenant.get(m.tenant_id) ?? 0) + 1);
        }
      });
      return (tenants ?? []).map((t: any) => ({
        ...t,
        last: lastByTenant.get(t.id),
        unread: unreadByTenant.get(t.id) ?? 0,
      })).sort((a, b) => {
        const ad = a.last?.created_at ?? "";
        const bd = b.last?.created_at ?? "";
        return bd.localeCompare(ad);
      });
    },
  });

  useEffect(() => {
    // no-op
  }, []);

  if (role === "tenant") {
    if (!ownTenant) return <p className="text-muted-foreground">Inget hyresgästkonto kopplat ännu.</p>;
    return (
      <div className="space-y-6 max-w-3xl">
        <h1 className="text-3xl font-semibold">Meddelanden</h1>
        <p className="text-sm text-muted-foreground">Direktkontakt med hyresvärden.</p>
        <MessageThread tenantId={ownTenant.id} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">Meddelanden</h1>
      <Card>
        <CardHeader><CardTitle>Konversationer</CardTitle></CardHeader>
        <CardContent>
          {!conversations?.length ? (
            <p className="text-sm text-muted-foreground">Inga hyresgäster.</p>
          ) : (
            <div className="divide-y divide-border">
              {conversations.map((c: any) => (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => navigate({ to: "/messages/$tenantId", params: { tenantId: c.id } })}
                  className="w-full text-left flex items-center justify-between gap-3 py-3 px-2 hover:bg-muted/50 rounded"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <MessageSquare className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium truncate">
                        {c.full_name}
                        {c.apartment_number && <span className="text-muted-foreground font-normal"> · Lgh {c.apartment_number}</span>}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {c.last ? `${c.last.sender_is_admin ? "Du: " : ""}${c.last.body}` : "Inga meddelanden ännu"}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {c.last && <span className="text-xs text-muted-foreground">{formatDate(c.last.created_at)}</span>}
                    {c.unread > 0 && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-accent text-accent-foreground">{c.unread}</span>
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}