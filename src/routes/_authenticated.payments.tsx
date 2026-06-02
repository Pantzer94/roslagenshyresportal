import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate, formatMonth } from "@/lib/format";
import { RentStatusBadge } from "@/components/StatusBadge";

export const Route = createFileRoute("/_authenticated/payments")({
  component: PaymentsPage,
});

function PaymentsPage() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["my-payments", user!.id],
    queryFn: async () => {
      const { data: tenant } = await supabase.from("tenants").select("id").eq("user_id", user!.id).maybeSingle();
      if (!tenant) return [];
      const { data: rents } = await supabase.from("rent_invoices").select("*").eq("tenant_id", tenant.id).order("period_month", { ascending: false });
      return rents ?? [];
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">Betalningar</h1>
      <Card>
        <CardHeader><CardTitle>Betalhistorik</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p className="text-muted-foreground">Läser in…</p> : !data?.length ? (
            <p className="text-muted-foreground">Inga hyror registrerade ännu.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead>
                    <TableHead>Belopp</TableHead>
                    <TableHead>Förfaller</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Betalades</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{formatMonth(r.period_month)}</TableCell>
                      <TableCell>{formatCurrency(r.amount)}</TableCell>
                      <TableCell>{formatDate(r.due_date)}</TableCell>
                      <TableCell><RentStatusBadge status={r.status} /></TableCell>
                      <TableCell>{r.paid_date ? formatDate(r.paid_date) : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}