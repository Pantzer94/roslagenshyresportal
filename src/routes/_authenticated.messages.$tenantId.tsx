import { createFileRoute, useParams, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { MessageThread } from "@/components/MessageThread";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/messages/$tenantId")({
  component: ConversationPage,
});

function ConversationPage() {
  const { tenantId } = useParams({ from: "/_authenticated/messages/$tenantId" });
  const { role } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (role === "tenant") navigate({ to: "/messages", replace: true });
  }, [role, navigate]);

  const { data: tenant } = useQuery({
    queryKey: ["tenant-basic", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("tenants").select("id, full_name, apartment_number").eq("id", tenantId).maybeSingle();
      return data;
    },
  });

  if (role !== "admin") return null;

  return (
    <div className="space-y-4 max-w-3xl">
      <Link to="/messages" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4 mr-1" /> Alla konversationer
      </Link>
      <h1 className="text-2xl font-semibold">
        {tenant?.full_name ?? "…"}
        {tenant?.apartment_number && <span className="text-muted-foreground font-normal text-lg"> · Lgh {tenant.apartment_number}</span>}
      </h1>
      <MessageThread tenantId={tenantId} />
    </div>
  );
}