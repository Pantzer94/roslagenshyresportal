import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Send } from "lucide-react";

function fmtTime(s: string) {
  return new Date(s).toLocaleString("sv-SE", { dateStyle: "short", timeStyle: "short" });
}

export function MessageThread({ tenantId }: { tenantId: string }) {
  const { user, role } = useAuth();
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  const { data: messages } = useQuery({
    queryKey: ["messages", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: true });
      return data ?? [];
    },
    refetchInterval: 8000,
  });

  // Mark unread (from other side) as read
  useEffect(() => {
    if (!messages?.length) return;
    const isAdmin = role === "admin";
    const unreadIds = messages
      .filter((m: any) => !m.read_at && m.sender_is_admin !== isAdmin)
      .map((m: any) => m.id);
    if (unreadIds.length === 0) return;
    supabase.rpc("mark_messages_read", { p_ids: unreadIds }).then(() => {
      qc.invalidateQueries({ queryKey: ["admin-conversations"] });
    });
  }, [messages, role, qc]);

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight });
  }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;
    setSending(true);
    const { error } = await supabase.from("messages").insert({
      tenant_id: tenantId,
      sender_user_id: user!.id,
      sender_is_admin: role === "admin",
      body: text,
    });
    setSending(false);
    if (error) return;
    setBody("");
    qc.invalidateQueries({ queryKey: ["messages", tenantId] });
    qc.invalidateQueries({ queryKey: ["admin-conversations"] });
  }

  const isAdmin = role === "admin";

  return (
    <div className="flex flex-col h-[calc(100vh-16rem)] min-h-[420px] rounded-lg border border-border bg-card">
      <div ref={scrollerRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {!messages?.length ? (
          <p className="text-sm text-muted-foreground text-center mt-8">Inga meddelanden ännu — skriv något!</p>
        ) : (
          messages.map((m: any) => {
            const mine = m.sender_is_admin === isAdmin;
            return (
              <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                <div className={cn(
                  "max-w-[78%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap break-words",
                  mine ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted text-foreground rounded-bl-sm"
                )}>
                  <div>{m.body}</div>
                  <div className={cn("text-[10px] mt-1 opacity-70", mine ? "text-right" : "text-left")}>{fmtTime(m.created_at)}</div>
                </div>
              </div>
            );
          })
        )}
      </div>
      <form onSubmit={send} className="border-t border-border p-3 flex gap-2 items-end">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Skriv ett meddelande…"
          rows={2}
          maxLength={2000}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send(e as any); }}
          className="resize-none"
        />
        <Button type="submit" disabled={sending || !body.trim()}>
          <Send className="h-4 w-4 mr-1" /> Skicka
        </Button>
      </form>
    </div>
  );
}