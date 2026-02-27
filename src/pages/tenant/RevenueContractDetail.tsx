import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/components/ui/sonner";
import { ArrowLeft, BookOpen, CheckCircle, TrendingUp, DollarSign, Percent } from "lucide-react";
import { format } from "date-fns";
import { fmtNum } from "@/lib/utils";
import { postWithRuleOrFallback } from "@/lib/postingHelper";
import { Progress } from "@/components/ui/progress";

export default function RevenueContractDetail() {
  const { id } = useParams();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const { locale } = useLanguage();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const sr = locale === "sr";

  const [recognizeDialog, setRecognizeDialog] = useState<string | null>(null);
  const [recognizeAmount, setRecognizeAmount] = useState("");
  const [recognizeDate, setRecognizeDate] = useState(new Date().toISOString().slice(0, 10));
  const [costIncurred, setCostIncurred] = useState("");

  const { data: contract } = useQuery({
    queryKey: ["revenue-contract", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("revenue_contracts").select("*").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: obligations = [] } = useQuery({
    queryKey: ["revenue-obligations", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("revenue_performance_obligations")
        .select("*")
        .eq("contract_id", id!)
        .order("obligation_number");
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  const { data: entries = [] } = useQuery({
    queryKey: ["revenue-entries", id],
    queryFn: async () => {
      const oblIds = obligations.map((o: any) => o.id);
      if (oblIds.length === 0) return [];
      const { data, error } = await supabase
        .from("revenue_recognition_entries")
        .select("*")
        .in("obligation_id", oblIds)
        .order("entry_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: obligations.length > 0,
  });

  const fmt = (n: number | null) => n != null ? fmtNum(Number(n)) : "—";

  const statusVariant = (s: string) => s === "satisfied" ? "default" as const : s === "partially_satisfied" ? "secondary" as const : "outline" as const;
  const statusLabel: Record<string, string> = {
    unsatisfied: sr ? "Neispunjena" : "Unsatisfied",
    partially_satisfied: sr ? "Delimično" : "Partially Satisfied",
    satisfied: sr ? "Ispunjena" : "Satisfied",
  };

  const methodLabel: Record<string, string> = {
    point_in_time: sr ? "U trenutku" : "Point in time",
    over_time_output: sr ? "Tokom vr. (output)" : "Over time (output)",
    over_time_input: sr ? "Tokom vr. (input)" : "Over time (input)",
    over_time_cost: sr ? "Tokom vr. (trošak)" : "Over time (cost-to-cost)",
  };

  const recognizeMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId || !user || !recognizeDialog || !contract) throw new Error("Missing context");
      const obl = obligations.find((o: any) => o.id === recognizeDialog);
      if (!obl) throw new Error("Obligation not found");

      let amount = parseFloat(recognizeAmount);
      if (!amount || amount <= 0) throw new Error(sr ? "Unesite iznos" : "Enter amount");

      // For cost-to-cost method, calculate based on % complete
      if ((obl as any).recognition_method === "over_time_cost" && costIncurred) {
        const newCostIncurred = parseFloat(costIncurred);
        const totalCost = Number((obl as any).total_cost_estimate) || 1;
        const newPct = Math.min(100, (newCostIncurred / totalCost) * 100);
        const totalAllocated = Number((obl as any).allocated_price);
        const shouldHaveRecognized = (newPct / 100) * totalAllocated;
        const alreadyRecognized = Number((obl as any).revenue_recognized);
        amount = Math.max(0, shouldHaveRecognized - alreadyRecognized);

        // Update cost incurred
        await supabase.from("revenue_performance_obligations").update({
          cost_incurred_to_date: newCostIncurred,
          percent_complete: Math.round(newPct * 100) / 100,
        }).eq("id", obl.id);
      }

      if (amount <= 0) throw new Error(sr ? "Nema prihoda za priznavanje" : "No revenue to recognize");

      // Post journal entry: Dr Deferred Revenue / Contract Asset, Cr Revenue
      const jeId = await postWithRuleOrFallback({
        tenantId,
        userId: user.id,
        modelCode: "IFRS15_REVENUE",
        amount,
        entryDate: recognizeDate,
        description: `IFRS 15 Revenue — ${contract.contract_number} / ${(obl as any).description}`,
        reference: `${contract.contract_number}-REV-${(obl as any).obligation_number}`,
        context: {},
        fallbackLines: [
          { accountCode: (obl as any).gl_deferred_revenue_account || "4600", debit: amount, credit: 0, description: sr ? "Razgraničenje prihoda" : "Deferred revenue release", sortOrder: 1 },
          { accountCode: (obl as any).gl_revenue_account || "6010", debit: 0, credit: amount, description: sr ? "Priznat prihod" : "Revenue recognized", sortOrder: 2 },
        ],
      });

      // Record entry
      await supabase.from("revenue_recognition_entries").insert({
        tenant_id: tenantId,
        obligation_id: obl.id,
        entry_date: recognizeDate,
        amount,
        entry_type: "recognition",
        journal_entry_id: jeId,
        percent_at_recognition: Number((obl as any).percent_complete) || null,
        created_by: user.id,
      });

      // Update obligation balances
      const newRecognized = Number((obl as any).revenue_recognized) + amount;
      const newDeferred = Number((obl as any).allocated_price) - newRecognized;
      const newStatus = newDeferred <= 0.01 ? "satisfied" : newRecognized > 0 ? "partially_satisfied" : "unsatisfied";

      await supabase.from("revenue_performance_obligations").update({
        revenue_recognized: Math.round(newRecognized * 100) / 100,
        deferred_revenue: Math.max(0, Math.round(newDeferred * 100) / 100),
        status: newStatus,
      }).eq("id", obl.id);
    },
    onSuccess: () => {
      toast.success(sr ? "Prihod priznat" : "Revenue recognized");
      setRecognizeDialog(null);
      setRecognizeAmount("");
      setCostIncurred("");
      qc.invalidateQueries({ queryKey: ["revenue-obligations", id] });
      qc.invalidateQueries({ queryKey: ["revenue-entries", id] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const activateMutation = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error("Missing id");
      await supabase.from("revenue_contracts").update({ status: "active" }).eq("id", id);
    },
    onSuccess: () => {
      toast.success(sr ? "Ugovor aktiviran" : "Contract activated");
      qc.invalidateQueries({ queryKey: ["revenue-contract", id] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!contract) return <div className="p-8 text-center text-muted-foreground">{sr ? "Učitavanje..." : "Loading..."}</div>;

  const totalRecognized = obligations.reduce((s: number, o: any) => s + Number(o.revenue_recognized || 0), 0);
  const totalDeferred = obligations.reduce((s: number, o: any) => s + Number(o.deferred_revenue || 0), 0);
  const pctComplete = Number(contract.total_transaction_price) > 0 ? (totalRecognized / Number(contract.total_transaction_price)) * 100 : 0;

  const contractStatusVariant = (s: string) => s === "active" ? "default" as const : s === "completed" ? "secondary" as const : "outline" as const;

  return (
    <div className="space-y-4 p-1">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/accounting/revenue-contracts")}><ArrowLeft className="h-5 w-5" /></Button>
        <div>
          <h1 className="text-2xl font-bold">{contract.contract_number}</h1>
          <p className="text-muted-foreground text-sm">{contract.customer_name || contract.description}</p>
        </div>
        <Badge variant={contractStatusVariant(contract.status)} className="ml-auto">{contract.status}</Badge>
        {contract.status === "draft" && (
          <Button size="sm" onClick={() => activateMutation.mutate()} disabled={activateMutation.isPending}>
            {sr ? "Aktiviraj" : "Activate"}
          </Button>
        )}
      </div>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground"><DollarSign className="h-4 w-4 inline mr-1" />{sr ? "Cena transakcije" : "Transaction Price"}</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{fmt(contract.total_transaction_price)} RSD</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground"><TrendingUp className="h-4 w-4 inline mr-1" />{sr ? "Priznat prihod" : "Recognized"}</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{fmt(totalRecognized)} RSD</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{sr ? "Razgraničeno" : "Deferred"}</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{fmt(totalDeferred)} RSD</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground"><Percent className="h-4 w-4 inline mr-1" />{sr ? "% završenosti" : "% Complete"}</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pctComplete.toFixed(1)}%</div>
            <Progress value={pctComplete} className="mt-2 h-2" />
          </CardContent>
        </Card>
      </div>

      {/* Performance Obligations */}
      <Card>
        <CardHeader><CardTitle>{sr ? "Obaveze ispunjenja" : "Performance Obligations"}</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>{sr ? "Opis" : "Description"}</TableHead>
                <TableHead>{sr ? "Metod" : "Method"}</TableHead>
                <TableHead className="text-right">{sr ? "Alocirana cena" : "Allocated"}</TableHead>
                <TableHead className="text-right">{sr ? "Priznato" : "Recognized"}</TableHead>
                <TableHead className="text-right">{sr ? "Razgraničeno" : "Deferred"}</TableHead>
                <TableHead>{sr ? "% završ." : "% Done"}</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {obligations.map((o: any) => {
                const pct = Number(o.allocated_price) > 0 ? (Number(o.revenue_recognized) / Number(o.allocated_price)) * 100 : 0;
                return (
                  <TableRow key={o.id}>
                    <TableCell>{o.obligation_number}</TableCell>
                    <TableCell className="font-medium">{o.description}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{methodLabel[o.recognition_method] || o.recognition_method}</Badge></TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(o.allocated_price)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(o.revenue_recognized)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(o.deferred_revenue)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={pct} className="h-2 w-16" />
                        <span className="text-xs text-muted-foreground">{pct.toFixed(0)}%</span>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant={statusVariant(o.status)}>{statusLabel[o.status] || o.status}</Badge></TableCell>
                    <TableCell>
                      {o.status !== "satisfied" && contract.status === "active" && (
                        <Button size="sm" variant="outline" onClick={() => { setRecognizeDialog(o.id); setRecognizeAmount(""); setCostIncurred(String(o.cost_incurred_to_date || "")); }}>
                          <BookOpen className="h-3 w-3 mr-1" /> {sr ? "Priznavaj" : "Recognize"}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Recognition journal */}
      {entries.length > 0 && (
        <Card>
          <CardHeader><CardTitle>{sr ? "Istorija priznavanja" : "Recognition History"}</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{sr ? "Datum" : "Date"}</TableHead>
                  <TableHead>{sr ? "Tip" : "Type"}</TableHead>
                  <TableHead className="text-right">{sr ? "Iznos" : "Amount"}</TableHead>
                  <TableHead>{sr ? "% u tom trenutku" : "% at Time"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((e: any) => (
                  <TableRow key={e.id}>
                    <TableCell>{format(new Date(e.entry_date), "dd.MM.yyyy")}</TableCell>
                    <TableCell><Badge variant="outline">{e.entry_type}</Badge></TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">{fmt(e.amount)} RSD</TableCell>
                    <TableCell>{e.percent_at_recognition != null ? `${Number(e.percent_at_recognition).toFixed(1)}%` : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Recognize Dialog */}
      <Dialog open={!!recognizeDialog} onOpenChange={() => setRecognizeDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{sr ? "Priznavaj prihod" : "Recognize Revenue"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {obligations.find((o: any) => o.id === recognizeDialog)?.recognition_method === "over_time_cost" && (
              <div>
                <Label>{sr ? "Nastali troškovi do danas" : "Costs Incurred to Date"}</Label>
                <Input type="number" step="0.01" value={costIncurred} onChange={e => {
                  setCostIncurred(e.target.value);
                  const obl = obligations.find((o: any) => o.id === recognizeDialog);
                  if (obl) {
                    const totalCost = Number((obl as any).total_cost_estimate) || 1;
                    const pct = Math.min(1, parseFloat(e.target.value) / totalCost);
                    const shouldRecognize = pct * Number((obl as any).allocated_price) - Number((obl as any).revenue_recognized);
                    setRecognizeAmount(Math.max(0, shouldRecognize).toFixed(2));
                  }
                }} />
              </div>
            )}
            <div>
              <Label>{sr ? "Iznos za priznavanje (RSD)" : "Amount to Recognize (RSD)"}</Label>
              <Input type="number" step="0.01" value={recognizeAmount} onChange={e => setRecognizeAmount(e.target.value)} />
            </div>
            <div>
              <Label>{sr ? "Datum knjiženja" : "Entry Date"}</Label>
              <Input type="date" value={recognizeDate} onChange={e => setRecognizeDate(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecognizeDialog(null)}>{sr ? "Otkaži" : "Cancel"}</Button>
            <Button onClick={() => recognizeMutation.mutate()} disabled={recognizeMutation.isPending}>
              <CheckCircle className="h-4 w-4 mr-1" /> {sr ? "Proknjiži" : "Post"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
