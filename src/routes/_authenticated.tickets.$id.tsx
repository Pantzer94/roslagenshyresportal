import { createFileRoute, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate, ticketCategoryLabel } from "@/lib/format";
import { TicketStatusBadge, PriorityBadge } from "@/components/StatusBadge";
import { toast } from "sonner";
import { Paperclip, Download, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/tickets/$id")({
  component: TicketDetailPage,
});

function TicketDetailPage() {
  const { id } = useParams({ from: "/_authenticated/tickets/$id" });
  const { user, role } = useAuth();
  const qc = useQueryClient();
  const [comment, setComment] = useState("");
  const [posting, setPosting] = useState(false);

  const { data: ticket } = useQuery({
    queryKey: ["ticket", id],
    queryFn: async () => {
      const { data } = await supabase.from("maintenance_tickets").select("*, tenants(full_name, areas(name))").eq("id", id).maybeSingle();
      return data;
    },
  });

  const { data: comments } = useQuery({
    queryKey: ["ticket-comments", id],
    queryFn: async () => {
      const { data } = await supabase.from("ticket_comments").select("*, profiles(full_name)").eq("ticket_id", id).order("created_at", { ascending: true });
      return data ?? [];
    },
  });

  const { data: attachments } = useQuery({
    queryKey: ["ticket-attachments", id],
    queryFn: async () => {
      const { data } = await supabase.from("ticket_attachments").select("*").eq("ticket_id", id).order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  async function updateStatus(newStatus: string) {
    const { error } = await supabase.from("maintenance_tickets").update({ status: newStatus as any }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Status uppdaterad"); qc.invalidateQueries({ queryKey: ["ticket", id] }); }
  }

  async function updatePriority(newPriority: string) {
    const { error } = await supabase.from("maintenance_tickets").update({ priority: newPriority as any }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Prioritet uppdaterad"); qc.invalidateQueries({ queryKey: ["ticket", id] }); }
  }

  async function saveAdminNotes(notes: string) {
    const { error } = await supabase.from("maintenance_tickets").update({ admin_notes: notes || null }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Anteckning sparad"); qc.invalidateQueries({ queryKey: ["ticket", id] }); }
  }

  async function postComment(e: React.FormEvent) {
    e.preventDefault();
    if (!comment.trim()) return;
    setPosting(true);
    const { error } = await supabase.from("ticket_comments").insert({
      ticket_id: id, author_user_id: user!.id, message: comment.trim(),
    });
    setPosting(false);
    if (error) toast.error(error.message);
    else { setComment(""); qc.invalidateQueries({ queryKey: ["ticket-comments", id] }); }
  }

  async function uploadAttachment(file: File) {
    const path = `${id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error: upErr } = await supabase.storage.from("ticket-attachments").upload(path, file);
    if (upErr) { toast.error("Uppladdning misslyckades", { description: upErr.message }); return; }
    const { error: insErr } = await supabase.from("ticket_attachments").insert({
      ticket_id: id, file_path: path, file_name: file.name,
      mime_type: file.type || null, size_bytes: file.size, uploaded_by: user!.id,
    });
    if (insErr) { toast.error("Kunde inte spara bilaga", { description: insErr.message }); return; }
    toast.success("Bilaga uppladdad");
    qc.invalidateQueries({ queryKey: ["ticket-attachments", id] });
  }

  async function downloadAttachment(path: string, name: string) {
    const { data, error } = await supabase.storage.from("ticket-attachments").createSignedUrl(path, 60);
    if (error || !data?.signedUrl) { toast.error("Kunde inte hämta länk"); return; }
    const a = document.createElement("a");
    a.href = data.signedUrl; a.download = name; a.target = "_blank"; a.click();
  }

  async function deleteAttachment(attId: string, path: string) {
    if (role !== "admin") return;
    await supabase.storage.from("ticket-attachments").remove([path]);
    const { error } = await supabase.from("ticket_attachments").delete().eq("id", attId);
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["ticket-attachments", id] });
  }

  if (!ticket) return <p className="text-muted-foreground">Läser in…</p>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-semibold">{ticket.title}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {ticketCategoryLabel[ticket.category]} · skapat {formatDate(ticket.created_at)}
          {role === "admin" && ticket.tenants?.full_name && ` · ${ticket.tenants.full_name}`}
          {role === "admin" && ticket.tenants?.areas?.name && ` · ${ticket.tenants.areas.name}`}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <TicketStatusBadge status={ticket.status} />
        <PriorityBadge priority={ticket.priority} />
        {role === "admin" && (
          <div className="ml-auto flex flex-wrap gap-2">
            <Select value={ticket.priority} onValueChange={updatePriority}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Låg</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="high">Hög</SelectItem>
                <SelectItem value="urgent">Akut</SelectItem>
              </SelectContent>
            </Select>
            <Select value={ticket.status} onValueChange={updateStatus}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="new">Nytt</SelectItem>
                <SelectItem value="in_progress">Pågår</SelectItem>
                <SelectItem value="awaiting_tenant">Väntar hyresgäst</SelectItem>
                <SelectItem value="done">Klart</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {ticket.description && (
        <Card><CardContent className="pt-6 whitespace-pre-wrap text-sm">{ticket.description}</CardContent></Card>
      )}

      {role === "admin" && (
        <AdminNotes initial={ticket.admin_notes ?? ""} onSave={saveAdminNotes} />
      )}

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Paperclip className="h-4 w-4" /> Bilagor</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {!attachments?.length ? (
            <p className="text-sm text-muted-foreground">Inga bilagor.</p>
          ) : (
            <div className="space-y-2">
              {attachments.map((a: any) => (
                <div key={a.id} className="flex items-center justify-between gap-3 p-2 rounded border border-border">
                  <div className="text-sm truncate">{a.file_name}</div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="sm" variant="ghost" onClick={() => downloadAttachment(a.file_path, a.file_name)}><Download className="h-4 w-4" /></Button>
                    {role === "admin" && (
                      <Button size="sm" variant="ghost" onClick={() => deleteAttachment(a.id, a.file_path)}><Trash2 className="h-4 w-4" /></Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          <Input
            type="file"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) { uploadAttachment(f); e.target.value = ""; } }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Kommentarer</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {!comments?.length ? (
            <p className="text-sm text-muted-foreground">Inga kommentarer ännu.</p>
          ) : (
            comments.map((c: any) => (
              <div key={c.id} className="border-l-2 border-accent/40 pl-3">
                <div className="text-xs text-muted-foreground">{c.profiles?.full_name ?? "Användare"} · {formatDate(c.created_at)}</div>
                <div className="text-sm whitespace-pre-wrap mt-1">{c.message}</div>
              </div>
            ))
          )}
          <form onSubmit={postComment} className="space-y-2 pt-2">
            <Textarea placeholder="Skriv en kommentar…" rows={3} maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)} />
            <Button type="submit" disabled={posting || !comment.trim()}>{posting ? "Skickar…" : "Skicka kommentar"}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function AdminNotes({ initial, onSave }: { initial: string; onSave: (n: string) => Promise<void> }) {
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Intern anteckning (endast admin)</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        <Textarea rows={3} value={value} onChange={(e) => setValue(e.target.value)} placeholder="Anteckning syns inte för hyresgästen…" />
        <Button size="sm" disabled={busy || value === initial} onClick={async () => { setBusy(true); await onSave(value); setBusy(false); }}>
          {busy ? "Sparar…" : "Spara anteckning"}
        </Button>
      </CardContent>
    </Card>
  );
}