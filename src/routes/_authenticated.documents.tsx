import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileText } from "lucide-react";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/documents")({
  component: DocumentsPage,
});

function DocumentsPage() {
  const { user } = useAuth();

  const { data: tenant } = useQuery({
    queryKey: ["own-tenant-doc", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("tenants").select("id").eq("user_id", user!.id).maybeSingle();
      return data;
    },
  });

  const { data: documents, isLoading } = useQuery({
    enabled: !!tenant?.id,
    queryKey: ["my-documents", tenant?.id],
    queryFn: async () => {
      const { data } = await supabase.from("documents").select("*").eq("tenant_id", tenant!.id).order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  async function download(path: string, name: string) {
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(path, 60);
    if (error || !data?.signedUrl) { toast.error("Kunde inte hämta länk"); return; }
    const a = document.createElement("a");
    a.href = data.signedUrl; a.download = name; a.target = "_blank"; a.click();
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-3xl font-semibold">Mina dokument</h1>
      <p className="text-sm text-muted-foreground">Hyreskontrakt, kvitton och andra dokument som hyresvärden delat med dig.</p>
      <Card>
        <CardHeader><CardTitle>Dokument</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Läser in…</p>
          ) : !documents?.length ? (
            <p className="text-sm text-muted-foreground">Inga dokument ännu.</p>
          ) : (
            <div className="space-y-2">
              {documents.map((d: any) => (
                <div key={d.id} className="flex items-center justify-between gap-3 p-3 rounded border border-border">
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <div className="font-medium truncate">{d.file_name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {formatDate(d.created_at)}{d.description ? ` · ${d.description}` : ""}
                      </div>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => download(d.file_path, d.file_name)}>
                    <Download className="h-4 w-4 mr-1" /> Hämta
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}