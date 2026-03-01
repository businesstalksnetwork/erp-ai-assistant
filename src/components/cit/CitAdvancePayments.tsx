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

const QUARTER_SCHEDULE = [
  { quarter: 1, month: 4, day: 15, label: "Q1 (Apr 15)" },
  { quarter: 2, month: 7, day: 15, label: "Q2 (Jul 15)" },
  { quarter: 3, month: 10, day: 15, label: "Q3 (Okt 15)" },
  { quarter: 4, month: 1, day: 15, label: "Q4 (Jan 15)", nextYear: true },
];

export function CitAdvancePayments({ fiscalYear, finalTax, returnId }: Props) {
  const { tenantId } = useTenant();
  const qc = useQueryClient();
  const { toast } = useToast();
  const quarterlyAmount = Math.round(finalTax / 4);

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
    mutationFn: async ({ quarter, paid }: { quarter: number; paid: boolean }) => {
      const q = QUARTER_SCHEDULE[quarter - 1];
      const dueYear = q.nextYear ? fiscalYear + 2 : fiscalYear + 1;
      const dueDate = `${dueYear}-${String(q.month).padStart(2, "0")}-${String(q.day).padStart(2, "0")}`;
      
      const existing = advances.find((a: any) => a.month === quarter);
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
            month: quarter,
            amount: quarterlyAmount,
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
          <CalendarDays className="h-4 w-4" /> Kvartalne akontacije poreza na dobit — {fiscalYear}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-3">
          Mesečna akontacija: <span className="font-semibold">{quarterlyAmount.toLocaleString("sr-RS")} RSD</span> (godišnji porez / 4)
        </p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kvartal</TableHead>
              <TableHead>Rok</TableHead>
              <TableHead className="text-right">Iznos</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Plaćeno</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {QUARTER_SCHEDULE.map((q) => {
              const adv = advances.find((a: any) => a.month === q.quarter);
              const isPaid = adv?.status === "paid";
              const dueYear = q.nextYear ? fiscalYear + 2 : fiscalYear + 1;
              const dueDate = new Date(dueYear, q.month - 1, q.day);
              const isOverdue = !isPaid && dueDate < new Date();

              return (
                <TableRow key={q.quarter}>
                  <TableCell className="font-semibold">{q.label}</TableCell>
                  <TableCell>{dueDate.toLocaleDateString("sr-Latn-RS")}</TableCell>
                  <TableCell className="text-right tabular-nums">{quarterlyAmount.toLocaleString("sr-RS")} RSD</TableCell>
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
                      onCheckedChange={(checked) => togglePaid.mutate({ quarter: q.quarter, paid: !!checked })}
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
