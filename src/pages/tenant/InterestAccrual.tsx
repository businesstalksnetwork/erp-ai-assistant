import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Calculator, BookOpen, Loader2 } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { Badge } from "@/components/ui/badge";

const NBS_DEFAULT_RATE = 6.5; // NBS referentna stopa
const PENALTY_MARKUP = 8; // ZoOO Art. 278

interface AccrualLine {
  source_type: "loan" | "receivable";
  source_id: string;
  label: string;
  principal: number;
  rate: number;
  days: number;
  accrued_amount: number;
}

export default function InterestAccrual() {
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const qc = useQueryClient();
  const today = format(new Date(), "yyyy-MM-dd");
  const [periodStart, setPeriodStart] = useState(format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), "yyyy-MM-dd"));
  const [periodEnd, setPeriodEnd] = useState(today);

  const { data: loans = [] } = useQuery({
    queryKey: ["active-loans", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("loans").select("id, partner_id, principal_amount, interest_rate, start_date, partners(name)")
        .eq("tenant_id", tenantId!).eq("status", "active");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: overdueInvoices = [] } = useQuery({
    queryKey: ["overdue-invoices", tenantId, periodEnd],
    queryFn: async () => {
      const { data } = await supabase.from("invoices").select("id, invoice_number, partner_id, total_amount, due_date, partners(name)")
        .eq("tenant_id", tenantId!).eq("invoice_type", "customer").lt("due_date", periodEnd).neq("status", "paid");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: existingAccruals = [] } = useQuery({
    queryKey: ["interest-accruals", tenantId],
    queryFn: async () => {
      const { data } = await (supabase.from("interest_accruals" as any) as any)
        .select("*").eq("tenant_id", tenantId!).order("created_at", { ascending: false }).limit(50);
      return data || [];
    },
    enabled: !!tenantId,
  });

  const calculatedLines = useMemo<AccrualLine[]>(() => {
    const lines: AccrualLine[] = [];
    const days = differenceInDays(new Date(periodEnd), new Date(periodStart));
    if (days <= 0) return lines;

    loans.forEach((loan: any) => {
      const rate = loan.interest_rate || NBS_DEFAULT_RATE;
      const principal = Number(loan.principal_amount);
      const accrued = (principal * rate / 100) * (days / 365);
      lines.push({
        source_type: "loan", source_id: loan.id,
        label: `Kredit - ${loan.partners?.name || "N/A"}`,
        principal, rate, days, accrued_amount: Math.round(accrued * 100) / 100,
      });
    });

    overdueInvoices.forEach((inv: any) => {
      const overdueDays = differenceInDays(new Date(periodEnd), new Date(inv.due_date));
      if (overdueDays <= 0) return;
      const effectiveDays = Math.min(overdueDays, days);
      const rate = NBS_DEFAULT_RATE + PENALTY_MARKUP;
      const principal = Number(inv.total_amount);
      const accrued = (principal * rate / 100) * (effectiveDays / 365);
      lines.push({
        source_type: "receivable", source_id: inv.id,
        label: `Faktura ${inv.invoice_number} - ${inv.partners?.name || "N/A"}`,
        principal, rate, days: effectiveDays, accrued_amount: Math.round(accrued * 100) / 100,
      });
    });

    return lines;
  }, [loans, overdueInvoices, periodStart, periodEnd]);

  const totalAccrued = calculatedLines.reduce((s, l) => s + l.accrued_amount, 0);

  const postMut = useMutation({
    mutationFn: async () => {
      const inserts = calculatedLines.map(l => ({
        tenant_id: tenantId, source_type: l.source_type, source_id: l.source_id,
        period_start: periodStart, period_end: periodEnd, principal: l.principal,
        rate: l.rate, accrued_amount: l.accrued_amount, posted: false, created_by: user?.id,
      }));
      const { error } = await (supabase.from("interest_accruals" as any) as any).insert(inserts);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["interest-accruals"] });
      toast.success(`${calculatedLines.length} obračuna kamata sačuvano`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Obračun kamate</h1>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Calculator className="h-5 w-5" />Parametri obračuna</CardTitle></CardHeader>
        <CardContent>
          <div className="flex gap-4 items-end">
            <div className="grid gap-2"><Label>Period od</Label><Input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} /></div>
            <div className="grid gap-2"><Label>Period do</Label><Input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} /></div>
            <div className="text-sm text-muted-foreground">
              <p>Referentna stopa NBS: {NBS_DEFAULT_RATE}%</p>
              <p>Zatezna kamata (čl. 278 ZoOO): {NBS_DEFAULT_RATE + PENALTY_MARKUP}%</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Pregled obračuna ({calculatedLines.length})</CardTitle>
            <Button onClick={() => postMut.mutate()} disabled={calculatedLines.length === 0 || postMut.isPending}>
              {postMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <BookOpen className="h-4 w-4 mr-2" />}
              Sačuvaj obračune
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tip</TableHead>
                <TableHead>Opis</TableHead>
                <TableHead className="text-right">Glavnica</TableHead>
                <TableHead className="text-right">Stopa %</TableHead>
                <TableHead className="text-right">Dani</TableHead>
                <TableHead className="text-right">Kamata</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {calculatedLines.map((l, i) => (
                <TableRow key={i}>
                  <TableCell><Badge variant={l.source_type === "loan" ? "secondary" : "outline"}>{l.source_type === "loan" ? "Kredit" : "Potraživanje"}</Badge></TableCell>
                  <TableCell>{l.label}</TableCell>
                  <TableCell className="text-right">{l.principal.toLocaleString("sr-RS", { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell className="text-right">{l.rate.toFixed(2)}</TableCell>
                  <TableCell className="text-right">{l.days}</TableCell>
                  <TableCell className="text-right font-medium">{l.accrued_amount.toLocaleString("sr-RS", { minimumFractionDigits: 2 })}</TableCell>
                </TableRow>
              ))}
              {calculatedLines.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nema stavki za obračun</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
          {calculatedLines.length > 0 && (
            <div className="p-4 text-right font-semibold border-t">
              Ukupna kamata: {totalAccrued.toLocaleString("sr-RS", { minimumFractionDigits: 2 })} RSD
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Istorija obračuna</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tip</TableHead>
                <TableHead>Period</TableHead>
                <TableHead className="text-right">Glavnica</TableHead>
                <TableHead className="text-right">Kamata</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {existingAccruals.map((a: any) => (
                <TableRow key={a.id}>
                  <TableCell><Badge variant="outline">{a.source_type === "loan" ? "Kredit" : "Potraživanje"}</Badge></TableCell>
                  <TableCell>{a.period_start} — {a.period_end}</TableCell>
                  <TableCell className="text-right">{Number(a.principal).toLocaleString("sr-RS", { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell className="text-right">{Number(a.accrued_amount).toLocaleString("sr-RS", { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell><Badge variant={a.posted ? "default" : "secondary"}>{a.posted ? "Proknjiženo" : "Neproknjiženo"}</Badge></TableCell>
                </TableRow>
              ))}
              {existingAccruals.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nema obračuna</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
