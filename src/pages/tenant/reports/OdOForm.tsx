import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useLanguage } from "@/i18n/LanguageContext";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Download, Plus, FileText } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

// OD-O tax rates (Serbian non-employment income)
const OD_O_RATES: Record<string, { taxRate: number; pioRate: number; healthRate: number; unemploymentRate: number; normCostPct: number; label: string }> = {
  royalties: { taxRate: 20, pioRate: 25.5, healthRate: 10.3, unemploymentRate: 0, normCostPct: 34, label: "Autorski honorar" },
  rent: { taxRate: 20, pioRate: 0, healthRate: 0, unemploymentRate: 0, normCostPct: 25, label: "Prihod od izdavanja" },
  capital_income: { taxRate: 15, pioRate: 0, healthRate: 0, unemploymentRate: 0, normCostPct: 0, label: "Prihod od kapitala" },
  capital_gains: { taxRate: 15, pioRate: 0, healthRate: 0, unemploymentRate: 0, normCostPct: 0, label: "Kapitalni dobitak" },
  other_income: { taxRate: 20, pioRate: 25.5, healthRate: 10.3, unemploymentRate: 0, normCostPct: 20, label: "Drugi prihodi" },
  sports: { taxRate: 20, pioRate: 25.5, healthRate: 10.3, unemploymentRate: 0, normCostPct: 50, label: "Sportisti / javne ličnosti" },
};

function calculateOdO(grossAmount: number, incomeType: string) {
  const rates = OD_O_RATES[incomeType] || OD_O_RATES.other_income;
  const normCost = grossAmount * (rates.normCostPct / 100);
  const taxBase = grossAmount - normCost;
  const taxAmount = taxBase * (rates.taxRate / 100);
  const pioAmount = taxBase * (rates.pioRate / 100);
  const healthAmount = taxBase * (rates.healthRate / 100);
  const unemploymentAmount = taxBase * (rates.unemploymentRate / 100);
  const netAmount = grossAmount - taxAmount - pioAmount - healthAmount - unemploymentAmount;
  return { taxBase, taxAmount, pioAmount, healthAmount, unemploymentAmount, netAmount };
}

export default function OdOForm() {
  const { tenantId } = useTenant();
  const { t } = useLanguage();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [form, setForm] = useState({
    employee_id: "",
    period_year: currentYear,
    period_month: currentMonth,
    income_type: "royalties",
    gross_amount: 0,
  });

  const calc = calculateOdO(form.gross_amount, form.income_type);

  const { data: employees = [] } = useQuery({
    queryKey: ["employees", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("employees").select("id, full_name, jmbg").eq("tenant_id", tenantId!).eq("status", "active").order("full_name");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["od-o-reports", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("od_o_reports").select("*, employees(full_name)").eq("tenant_id", tenantId!).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!tenantId,
  });

  const createMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("od_o_reports").insert({
        tenant_id: tenantId!,
        employee_id: form.employee_id,
        period_year: form.period_year,
        period_month: form.period_month,
        income_type: form.income_type,
        gross_amount: form.gross_amount,
        tax_base: calc.taxBase,
        tax_amount: calc.taxAmount,
        pio_amount: calc.pioAmount,
        health_amount: calc.healthAmount,
        unemployment_amount: calc.unemploymentAmount,
        net_amount: calc.netAmount,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "OD-O obračun kreiran" });
      qc.invalidateQueries({ queryKey: ["od-o-reports"] });
      setOpen(false);
    },
    onError: (e: any) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const generateXml = async (reportId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("generate-od-o-xml", {
        body: { report_id: reportId, tenant_id: tenantId },
      });
      if (error) throw error;
      if (data?.xml) {
        const blob = new Blob([data.xml], { type: "application/xml" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `OD-O_${reportId.slice(0, 8)}.xml`;
        a.click();
        URL.revokeObjectURL(url);
        toast({ title: "XML generisan" });
        qc.invalidateQueries({ queryKey: ["od-o-reports"] });
      }
    } catch (e: any) {
      toast({ title: t("error"), description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="OD-O Obračun" description="Obračun poreza i doprinosa na prihode van radnog odnosa" />
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" /> Novi obračun</Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Obračuni</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-40" /> : reports.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nema obračuna. Kreirajte novi.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Primalac</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Vrsta prihoda</TableHead>
                    <TableHead className="text-right">Bruto</TableHead>
                    <TableHead className="text-right">Neto</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Akcije</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.employees?.full_name}</TableCell>
                      <TableCell>{r.period_month}/{r.period_year}</TableCell>
                      <TableCell>{OD_O_RATES[r.income_type]?.label || r.income_type}</TableCell>
                      <TableCell className="text-right">{Number(r.gross_amount).toLocaleString("sr-RS", { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-right">{Number(r.net_amount).toLocaleString("sr-RS", { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell><Badge variant={r.status === "generated" ? "default" : "secondary"}>{r.status}</Badge></TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => generateXml(r.id)}>
                          <Download className="h-3 w-3 mr-1" /> XML
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Novi OD-O obračun</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Primalac prihoda</Label>
              <Select value={form.employee_id} onValueChange={(v) => setForm({ ...form, employee_id: v })}>
                <SelectTrigger><SelectValue placeholder="Izaberite..." /></SelectTrigger>
                <SelectContent>
                  {employees.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Godina</Label>
                <Input type="number" value={form.period_year} onChange={(e) => setForm({ ...form, period_year: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Mesec</Label>
                <Select value={String(form.period_month)} onValueChange={(v) => setForm({ ...form, period_month: Number(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => <SelectItem key={i + 1} value={String(i + 1)}>{i + 1}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Vrsta prihoda</Label>
              <Select value={form.income_type} onValueChange={(v) => setForm({ ...form, income_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(OD_O_RATES).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Bruto iznos (RSD)</Label>
              <Input type="number" min={0} step="0.01" value={form.gross_amount} onChange={(e) => setForm({ ...form, gross_amount: Number(e.target.value) })} />
            </div>

            {form.gross_amount > 0 && (
              <Card className="bg-muted/50">
                <CardContent className="pt-4 space-y-1 text-sm">
                  <div className="flex justify-between"><span>Normirani troškovi ({OD_O_RATES[form.income_type]?.normCostPct}%):</span><span>{(form.gross_amount * (OD_O_RATES[form.income_type]?.normCostPct || 0) / 100).toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>Poreska osnovica:</span><span>{calc.taxBase.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>Porez ({OD_O_RATES[form.income_type]?.taxRate}%):</span><span>{calc.taxAmount.toFixed(2)}</span></div>
                  {calc.pioAmount > 0 && <div className="flex justify-between"><span>PIO doprinos:</span><span>{calc.pioAmount.toFixed(2)}</span></div>}
                  {calc.healthAmount > 0 && <div className="flex justify-between"><span>Zdravstveni doprinos:</span><span>{calc.healthAmount.toFixed(2)}</span></div>}
                  <div className="flex justify-between font-semibold border-t pt-1 mt-1"><span>Neto za isplatu:</span><span>{calc.netAmount.toFixed(2)}</span></div>
                </CardContent>
              </Card>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => createMut.mutate()} disabled={!form.employee_id || form.gross_amount <= 0 || createMut.isPending}>
              {createMut.isPending ? t("saving") : t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
