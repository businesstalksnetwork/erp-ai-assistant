import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { CalendarDays } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Props {
  fiscalYear: number;
  finalTax: number;
  returnId?: string;
}

// CR4-05: Monthly schedule per ZPDPL Art. 68 (1/12 of annual tax, due 15th of each month in N+1)
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "Maj", "Jun", "Jul", "Avg", "Sep", "Okt", "Nov", "Dec"];

export function CitAdvancePayments({ fiscalYear, finalTax, returnId }: Props) {
  const { tenantId } = useTenant();
  const qc = useQueryClient();
  const { toast } = useToast();
  const monthlyAmount = Math.round(finalTax / 12);

  const { data: advances = [] } = useQuery({
    queryKey: ["cit-advances", tenantId, fiscalYear],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase
        .from("cit_advance_payments")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("fiscal_year", fiscalYear)
        .order("month");
      return data || [];
    },
    enabled: !!tenantId && finalTax > 0,
  });

  const togglePaid = useMutation({
    mutationFn: async ({ month, paid }: { month: number; paid: boolean }) => {
      // CR4-04: All advances for fiscal year N are due in year N+1
      const dueDate = `${fiscalYear + 1}-${String(month).padStart(2, "0")}-15`;
      
      const existing = advances.find((a: any) => a.month === month);
      if (existing) {
        const { error } = await supabase
          .from("cit_advance_payments")
          .update({ status: paid ? "paid" : "pending", paid_date: paid ? new Date().toISOString().slice(0, 10) : null })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("cit_advance_payments")
          .insert({
            tenant_id: tenantId!,
            fiscal_year: fiscalYear,
            month,
            amount: monthlyAmount,
            due_date: dueDate,
            status: paid ? "paid" : "pending",
            paid_date: paid ? new Date().toISOString().slice(0, 10) : null,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cit-advances"] });
      toast({ title: "Ažurirano" });
    },
    onError: (e: any) => toast({ title: "Greška", description: e.message, variant: "destructive" }),
  });

  if (finalTax <= 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarDays className="h-4 w-4" /> Mesečne akontacije poreza na dobit — {fiscalYear} (ZPDPL čl. 68)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-3">
          Mesečna akontacija: <span className="font-semibold">{monthlyAmount.toLocaleString("sr-RS")} RSD</span> (godišnji porez / 12)
        </p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mesec</TableHead>
              <TableHead>Rok</TableHead>
              <TableHead className="text-right">Iznos</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Plaćeno</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
              const adv = advances.find((a: any) => a.month === month);
              const isPaid = adv?.status === "paid";
              const dueDate = new Date(fiscalYear + 1, month - 1, 15);
              const isOverdue = !isPaid && dueDate < new Date();

              return (
                <TableRow key={month}>
                  <TableCell className="font-semibold">{MONTH_LABELS[month - 1]} {fiscalYear + 1}</TableCell>
                  <TableCell>{dueDate.toLocaleDateString("sr-Latn-RS")}</TableCell>
                  <TableCell className="text-right tabular-nums">{monthlyAmount.toLocaleString("sr-RS")} RSD</TableCell>
                  <TableCell>
                    {isPaid ? (
                      <Badge variant="default">Plaćeno</Badge>
                    ) : isOverdue ? (
                      <Badge variant="destructive">Dospelo</Badge>
                    ) : (
                      <Badge variant="secondary">Čeka</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Checkbox
                      checked={isPaid}
                      onCheckedChange={(checked) => togglePaid.mutate({ month, paid: !!checked })}
                      disabled={togglePaid.isPending}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
