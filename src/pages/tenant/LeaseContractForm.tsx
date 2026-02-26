import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import { ArrowLeft, Save, Calculator } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { addMonths, format } from "date-fns";

/**
 * IFRS 16 PV calculation:
 * PV of annuity = payment × [(1 - (1+r)^-n) / r]
 * where r = monthly rate, n = number of periods
 */
function calculateLeaseSchedule(monthlyPayment: number, annualRate: number, termMonths: number, startDate: string) {
  const monthlyRate = annualRate / 12;
  // PV of lease liability
  const pvFactor = monthlyRate > 0
    ? (1 - Math.pow(1 + monthlyRate, -termMonths)) / monthlyRate
    : termMonths;
  const initialLiability = monthlyPayment * pvFactor;
  const initialRou = initialLiability; // Simplified: ROU = liability (no prepayments/incentives)
  const monthlyDepreciation = initialRou / termMonths;

  const schedule: Array<{
    period: number; date: string; payment: number;
    interest: number; principal: number; depreciation: number;
    liabilityAfter: number; rouNbvAfter: number;
  }> = [];

  let liabilityBalance = initialLiability;
  let rouNbv = initialRou;

  for (let i = 1; i <= termMonths; i++) {
    const interest = liabilityBalance * monthlyRate;
    const principal = monthlyPayment - interest;
    liabilityBalance = Math.max(0, liabilityBalance - principal);
    rouNbv = Math.max(0, rouNbv - monthlyDepreciation);

    schedule.push({
      period: i,
      date: format(addMonths(new Date(startDate), i - 1), "yyyy-MM-dd"),
      payment: monthlyPayment,
      interest: Math.round(interest * 100) / 100,
      principal: Math.round(principal * 100) / 100,
      depreciation: Math.round(monthlyDepreciation * 100) / 100,
      liabilityAfter: Math.round(liabilityBalance * 100) / 100,
      rouNbvAfter: Math.round(rouNbv * 100) / 100,
    });
  }

  return { initialLiability: Math.round(initialLiability * 100) / 100, initialRou: Math.round(initialRou * 100) / 100, schedule };
}

export default function LeaseContractForm() {
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [form, setForm] = useState({
    contract_number: "", lessor_name: "", description: "",
    start_date: new Date().toISOString().slice(0, 10),
    lease_term_months: "36",
    monthly_payment: "",
    annual_discount_rate: "5",
    classification: "operating",
    rou_asset_account: "0140",
    rou_depreciation_account: "5420",
    rou_accumulated_dep_account: "0149",
    liability_account: "4140",
    interest_expense_account: "5620",
    notes: "",
  });

  const [preview, setPreview] = useState<ReturnType<typeof calculateLeaseSchedule> | null>(null);

  const set = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }));

  const handlePreview = () => {
    if (!form.monthly_payment || !form.lease_term_months) return;
    const result = calculateLeaseSchedule(
      parseFloat(form.monthly_payment),
      parseFloat(form.annual_discount_rate) / 100,
      parseInt(form.lease_term_months),
      form.start_date,
    );
    setPreview(result);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error("No tenant");
      if (!form.monthly_payment || !form.lease_term_months) throw new Error("Popunite obavezna polja");

      const calc = calculateLeaseSchedule(
        parseFloat(form.monthly_payment),
        parseFloat(form.annual_discount_rate) / 100,
        parseInt(form.lease_term_months),
        form.start_date,
      );

      const endDate = format(addMonths(new Date(form.start_date), parseInt(form.lease_term_months) - 1), "yyyy-MM-dd");

      // Create asset (ROU)
      const assetCode = `ROU-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;
      const { data: asset, error: ae } = await supabase.from("assets").insert({
        tenant_id: tenantId,
        name: `ROU: ${form.description || form.contract_number}`,
        asset_code: assetCode,
        asset_type: "intangible",
        status: "active",
        acquisition_cost: calc.initialRou,
        current_value: calc.initialRou,
      }).select("id").single();
      if (ae) throw ae;

      // Create lease contract
      const { data: lease, error: le } = await supabase.from("lease_contracts").insert({
        tenant_id: tenantId,
        asset_id: asset.id,
        contract_number: form.contract_number,
        lessor_name: form.lessor_name || null,
        description: form.description || null,
        start_date: form.start_date,
        end_date: endDate,
        lease_term_months: parseInt(form.lease_term_months),
        monthly_payment: parseFloat(form.monthly_payment),
        annual_discount_rate: parseFloat(form.annual_discount_rate) / 100,
        initial_rou_value: calc.initialRou,
        initial_liability: calc.initialLiability,
        rou_net_book_value: calc.initialRou,
        lease_liability_balance: calc.initialLiability,
        classification: form.classification,
        rou_asset_account: form.rou_asset_account,
        rou_depreciation_account: form.rou_depreciation_account,
        rou_accumulated_dep_account: form.rou_accumulated_dep_account,
        liability_account: form.liability_account,
        interest_expense_account: form.interest_expense_account,
        notes: form.notes || null,
        created_by: user?.id,
        status: "active",
      }).select("id").single();
      if (le) throw le;

      // Create schedule rows
      const scheduleRows = calc.schedule.map(s => ({
        lease_id: lease.id,
        tenant_id: tenantId,
        period_number: s.period,
        payment_date: s.date,
        payment_amount: s.payment,
        interest_amount: s.interest,
        principal_amount: s.principal,
        rou_depreciation: s.depreciation,
        liability_balance_after: s.liabilityAfter,
        rou_nbv_after: s.rouNbvAfter,
        status: "scheduled",
      }));

      const { error: se } = await supabase.from("lease_payment_schedule").insert(scheduleRows);
      if (se) throw se;

      return lease.id;
    },
    onSuccess: (id) => {
      toast.success("Ugovor o lizingu kreiran");
      qc.invalidateQueries({ queryKey: ["lease-contracts"] });
      navigate(`/assets/leases/${id}`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const fmt = (n: number) => n.toLocaleString("sr", { minimumFractionDigits: 2 });

  return (
    <div className="space-y-4 p-1">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5" /></Button>
        <h1 className="text-2xl font-bold">Novi ugovor o lizingu (IFRS 16)</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Osnovni podaci</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Broj ugovora *</Label><Input value={form.contract_number} onChange={e => set("contract_number", e.target.value)} placeholder="LZ-2026-001" /></div>
              <div><Label>Zakupodavac</Label><Input value={form.lessor_name} onChange={e => set("lessor_name", e.target.value)} /></div>
            </div>
            <div><Label>Opis</Label><Input value={form.description} onChange={e => set("description", e.target.value)} placeholder="Poslovni prostor, vozilo..." /></div>
            <div className="grid grid-cols-3 gap-4">
              <div><Label>Početak *</Label><Input type="date" value={form.start_date} onChange={e => set("start_date", e.target.value)} /></div>
              <div><Label>Trajanje (meseci) *</Label><Input type="number" value={form.lease_term_months} onChange={e => set("lease_term_months", e.target.value)} /></div>
              <div>
                <Label>Klasifikacija</Label>
                <Select value={form.classification} onValueChange={v => set("classification", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="operating">Operativni</SelectItem>
                    <SelectItem value="finance">Finansijski</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Mesečna rata (RSD) *</Label><Input type="number" step="0.01" value={form.monthly_payment} onChange={e => set("monthly_payment", e.target.value)} /></div>
              <div><Label>Diskontna stopa (% godišnje)</Label><Input type="number" step="0.01" value={form.annual_discount_rate} onChange={e => set("annual_discount_rate", e.target.value)} /></div>
            </div>
            <div><Label>Napomene</Label><Textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2} /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>GL konta (IFRS 16)</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>ROU sredstvo</Label><Input value={form.rou_asset_account} onChange={e => set("rou_asset_account", e.target.value)} /></div>
              <div><Label>Akumulirana amort. ROU</Label><Input value={form.rou_accumulated_dep_account} onChange={e => set("rou_accumulated_dep_account", e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Trošak amortizacije ROU</Label><Input value={form.rou_depreciation_account} onChange={e => set("rou_depreciation_account", e.target.value)} /></div>
              <div><Label>Obaveza po lizingu</Label><Input value={form.liability_account} onChange={e => set("liability_account", e.target.value)} /></div>
            </div>
            <div><Label>Trošak kamate</Label><Input value={form.interest_expense_account} onChange={e => set("interest_expense_account", e.target.value)} /></div>

            <Button variant="outline" className="w-full" onClick={handlePreview}>
              <Calculator className="h-4 w-4 mr-2" /> Pregled amortizacionog plana
            </Button>

            {preview && (
              <div className="rounded-lg border p-4 space-y-2 bg-muted/50">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>Početna obaveza (PV):</div><div className="font-semibold text-right">{fmt(preview.initialLiability)} RSD</div>
                  <div>ROU vrednost:</div><div className="font-semibold text-right">{fmt(preview.initialRou)} RSD</div>
                  <div>Ukupna kamata:</div><div className="font-semibold text-right">{fmt(preview.schedule.reduce((s, r) => s + r.interest, 0))} RSD</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {preview && preview.schedule.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Amortizacioni plan ({preview.schedule.length} perioda)</CardTitle></CardHeader>
          <CardContent className="p-0 max-h-96 overflow-auto">
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.schedule.map(s => (
                  <TableRow key={s.period}>
                    <TableCell>{s.period}</TableCell>
                    <TableCell>{format(new Date(s.date), "MM/yyyy")}</TableCell>
                    <TableCell className="text-right">{fmt(s.payment)}</TableCell>
                    <TableCell className="text-right">{fmt(s.interest)}</TableCell>
                    <TableCell className="text-right">{fmt(s.principal)}</TableCell>
                    <TableCell className="text-right">{fmt(s.depreciation)}</TableCell>
                    <TableCell className="text-right">{fmt(s.liabilityAfter)}</TableCell>
                    <TableCell className="text-right">{fmt(s.rouNbvAfter)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => navigate(-1)}>Otkaži</Button>
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          <Save className="h-4 w-4 mr-2" /> {saveMutation.isPending ? "Čuvanje..." : "Kreiraj ugovor"}
        </Button>
      </div>
    </div>
  );
}
