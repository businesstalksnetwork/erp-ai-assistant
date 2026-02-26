import { useParams, useNavigate } from "react-router-dom";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/components/ui/sonner";
import { ArrowLeft, BookOpen, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { postWithRuleOrFallback } from "@/lib/postingHelper";

export default function LeaseContractDetail() {
  const { id } = useParams();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: lease } = useQuery({
    queryKey: ["lease-contract", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("lease_contracts").select("*").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: schedule } = useQuery({
    queryKey: ["lease-schedule", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lease_payment_schedule")
        .select("*")
        .eq("lease_id", id!)
        .order("period_number", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  const postPeriodMutation = useMutation({
    mutationFn: async (periodId: string) => {
      if (!lease || !tenantId || !user) throw new Error("Missing context");
      const period = (schedule || []).find((s: any) => s.id === periodId);
      if (!period) throw new Error("Period not found");

      const entryDate = period.payment_date;

      // 1. Post ROU depreciation: Dr Depreciation Expense, Cr Accumulated Depreciation
      await postWithRuleOrFallback({
        tenantId,
        userId: user.id,
        modelCode: "LEASE_ROU_DEPR",
        amount: Number(period.rou_depreciation),
        entryDate,
        description: `Amortizacija ROU — ${lease.contract_number} period ${period.period_number}`,
        reference: `${lease.contract_number}-ROU-${period.period_number}`,
        legalEntityId: lease.legal_entity_id || undefined,
        context: {},
        fallbackLines: [
          { accountCode: lease.rou_depreciation_account || "5420", debit: Number(period.rou_depreciation), credit: 0, description: "Trošak amortizacije ROU", sortOrder: 1 },
          { accountCode: lease.rou_accumulated_dep_account || "0149", debit: 0, credit: Number(period.rou_depreciation), description: "Akumulirana amort. ROU", sortOrder: 2 },
        ],
      });

      // 2. Post lease payment: Dr Interest Expense + Dr Liability, Cr Cash/Bank
      const jeId = await postWithRuleOrFallback({
        tenantId,
        userId: user.id,
        modelCode: "LEASE_PAYMENT",
        amount: Number(period.payment_amount),
        entryDate,
        description: `Rata lizinga — ${lease.contract_number} period ${period.period_number}`,
        reference: `${lease.contract_number}-PAY-${period.period_number}`,
        legalEntityId: lease.legal_entity_id || undefined,
        context: {},
        fallbackLines: [
          { accountCode: lease.interest_expense_account || "5620", debit: Number(period.interest_amount), credit: 0, description: "Trošak kamate po lizingu", sortOrder: 1 },
          { accountCode: lease.liability_account || "4140", debit: Number(period.principal_amount), credit: 0, description: "Smanjenje obaveze po lizingu", sortOrder: 2 },
          { accountCode: "2410", debit: 0, credit: Number(period.payment_amount), description: "Isplata rate lizinga", sortOrder: 3 },
        ],
      });

      // Mark period as posted
      await supabase.from("lease_payment_schedule").update({
        status: "posted",
        posted_at: new Date().toISOString(),
        journal_entry_id: jeId,
      }).eq("id", periodId);

      // Update lease balances
      await supabase.from("lease_contracts").update({
        lease_liability_balance: period.liability_balance_after,
        rou_net_book_value: period.rou_nbv_after,
      }).eq("id", lease.id);
    },
    onSuccess: () => {
      toast.success("Period proknjižen u GK");
      qc.invalidateQueries({ queryKey: ["lease-schedule", id] });
      qc.invalidateQueries({ queryKey: ["lease-contract", id] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const fmt = (n: number | null) => n != null ? Number(n).toLocaleString("sr", { minimumFractionDigits: 2 }) : "—";
  const statusLabel: Record<string, string> = { draft: "U pripremi", active: "Aktivan", expired: "Istekao", terminated: "Raskinut" };

  if (!lease) return <div className="p-8 text-center text-muted-foreground">Učitavanje...</div>;

  const posted = (schedule || []).filter((s: any) => s.status === "posted").length;
  const total = (schedule || []).length;

  return (
    <div className="space-y-4 p-1">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/assets/leases")}><ArrowLeft className="h-5 w-5" /></Button>
        <div>
          <h1 className="text-2xl font-bold">{lease.contract_number}</h1>
          <p className="text-muted-foreground text-sm">{lease.description || lease.lessor_name}</p>
        </div>
        <Badge variant={lease.status === "active" ? "default" : "secondary"} className="ml-auto">
          {statusLabel[lease.status] || lease.status}
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Početna obaveza", value: fmt(lease.initial_liability) },
          { label: "Trenutna obaveza", value: fmt(lease.lease_liability_balance) },
          { label: "ROU početna vr.", value: fmt(lease.initial_rou_value) },
          { label: "ROU NBV", value: fmt(lease.rou_net_book_value) },
        ].map(kpi => (
          <Card key={kpi.label}>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{kpi.label}</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold">{kpi.value}</div></CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Amortizacioni plan ({posted}/{total} proknjiženo)</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0 max-h-[500px] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Datum</TableHead>
                <TableHead className="text-right">Rata</TableHead>
                <TableHead className="text-right">Kamata</TableHead>
                <TableHead className="text-right">Glavnica</TableHead>
                <TableHead className="text-right">Amort. ROU</TableHead>
                <TableHead className="text-right">Obaveza</TableHead>
                <TableHead className="text-right">ROU NBV</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(schedule || []).map((s: any) => (
                <TableRow key={s.id} className={s.status === "posted" ? "bg-muted/30" : ""}>
                  <TableCell>{s.period_number}</TableCell>
                  <TableCell>{format(new Date(s.payment_date), "MM/yyyy")}</TableCell>
                  <TableCell className="text-right">{fmt(s.payment_amount)}</TableCell>
                  <TableCell className="text-right">{fmt(s.interest_amount)}</TableCell>
                  <TableCell className="text-right">{fmt(s.principal_amount)}</TableCell>
                  <TableCell className="text-right">{fmt(s.rou_depreciation)}</TableCell>
                  <TableCell className="text-right">{fmt(s.liability_balance_after)}</TableCell>
                  <TableCell className="text-right">{fmt(s.rou_nbv_after)}</TableCell>
                  <TableCell>
                    {s.status === "posted" ? (
                      <Badge variant="default"><CheckCircle className="h-3 w-3 mr-1" />Proknjižen</Badge>
                    ) : (
                      <Badge variant="secondary">Zakazan</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {s.status === "scheduled" && (
                      <Button size="sm" variant="outline" onClick={() => postPeriodMutation.mutate(s.id)} disabled={postPeriodMutation.isPending}>
                        <BookOpen className="h-3 w-3 mr-1" /> Proknjiži
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Detalji ugovora</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div><span className="text-muted-foreground">Zakupodavac:</span><br/><strong>{lease.lessor_name || "—"}</strong></div>
            <div><span className="text-muted-foreground">Period:</span><br/><strong>{format(new Date(lease.start_date), "dd.MM.yyyy")} — {format(new Date(lease.end_date), "dd.MM.yyyy")}</strong></div>
            <div><span className="text-muted-foreground">Trajanje:</span><br/><strong>{lease.lease_term_months} meseci</strong></div>
            <div><span className="text-muted-foreground">Diskontna stopa:</span><br/><strong>{(Number(lease.annual_discount_rate) * 100).toFixed(2)}%</strong></div>
            <div><span className="text-muted-foreground">ROU konto:</span><br/><strong>{lease.rou_asset_account}</strong></div>
            <div><span className="text-muted-foreground">Amort. konto:</span><br/><strong>{lease.rou_depreciation_account}</strong></div>
            <div><span className="text-muted-foreground">Obaveza konto:</span><br/><strong>{lease.liability_account}</strong></div>
            <div><span className="text-muted-foreground">Kamata konto:</span><br/><strong>{lease.interest_expense_account}</strong></div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
