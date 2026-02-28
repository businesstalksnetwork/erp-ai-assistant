import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { useLegalEntities } from "@/hooks/useLegalEntities";
import { useLanguage } from "@/i18n/LanguageContext";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { Calculator, FileText, Plus, ChevronDown } from "lucide-react";

export default function CitTaxReturn() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const { entities: legalEntities } = useLegalEntities();
  const qc = useQueryClient();
  const { toast } = useToast();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(String(currentYear - 1));
  const [selectedEntity, setSelectedEntity] = useState("");
  const [adjustIncrease, setAdjustIncrease] = useState(0);
  const [adjustDecrease, setAdjustDecrease] = useState(0);
  const [taxCredits, setTaxCredits] = useState(0);
  const [adjustmentDetails, setAdjustmentDetails] = useState("");
  const [adjustmentsOpen, setAdjustmentsOpen] = useState(false);

  const { data: returns = [], isLoading } = useQuery({
    queryKey: ["cit-returns", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("cit_tax_returns")
        .select("*, legal_entity:legal_entity_id(name)")
        .eq("tenant_id", tenantId)
        .order("fiscal_year", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: plData = [] } = useQuery({
    queryKey: ["cit-pl-data", tenantId, selectedYear, selectedEntity],
    queryFn: async () => {
      if (!tenantId || !selectedYear) return [];
      let query = supabase
        .from("journal_lines")
        .select(`debit, credit, account:account_id(code, account_class, account_type), journal_entry:journal_entry_id(entry_date, status, tenant_id, legal_entity_id)`)
        .eq("journal_entry.tenant_id", tenantId)
        .eq("journal_entry.status", "posted")
        .gte("journal_entry.entry_date", `${selectedYear}-01-01`)
        .lte("journal_entry.entry_date", `${selectedYear}-12-31`);
      if (selectedEntity) query = query.eq("journal_entry.legal_entity_id", selectedEntity);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId && !!selectedYear,
  });

  const calculated = useMemo(() => {
    let totalRevenue = 0, totalExpenses = 0;
    for (const line of plData) {
      const account = (line as any).account as any;
      if (!account?.code) continue;
      const accountType = account.account_type;
      // Use account_type for accurate classification across all CoA classes (5-9)
      if (accountType === "revenue") {
        totalRevenue += Number(line.credit || 0) - Number(line.debit || 0);
      } else if (accountType === "expense") {
        totalExpenses += Number(line.debit || 0) - Number(line.credit || 0);
      }
    }
    const accountingProfit = totalRevenue - totalExpenses;
    const taxableBase = Math.max(0, accountingProfit + adjustIncrease - adjustDecrease);
    const taxRate = 15;
    const taxAmount = Math.round(taxableBase * taxRate / 100);
    const finalTax = Math.max(0, taxAmount - taxCredits);
    return {
      totalRevenue: Math.round(totalRevenue),
      totalExpenses: Math.round(totalExpenses),
      accountingProfit: Math.round(accountingProfit),
      taxableBase,
      taxRate,
      taxAmount,
      finalTax,
    };
  }, [plData, adjustIncrease, adjustDecrease, taxCredits]);

  const createReturnMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("cit_tax_returns").insert({
        tenant_id: tenantId!, legal_entity_id: selectedEntity || null, fiscal_year: Number(selectedYear),
        total_revenue: calculated.totalRevenue, total_expenses: calculated.totalExpenses,
        accounting_profit: calculated.accountingProfit, taxable_base: calculated.taxableBase,
        tax_rate: calculated.taxRate, tax_amount: calculated.taxAmount,
        tax_adjustments_increase: adjustIncrease,
        tax_adjustments_decrease: adjustDecrease,
        tax_credits: taxCredits,
        adjustment_details: adjustmentDetails || null,
        final_tax: calculated.finalTax,
        created_by: user?.id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast({ title: t("citCreated") }); qc.invalidateQueries({ queryKey: ["cit-returns"] }); },
    onError: (e: any) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const existingReturn = returns.find((r: any) => r.fiscal_year === Number(selectedYear) && (r.legal_entity_id || "") === selectedEntity);
  const statusLabels: Record<string, string> = { draft: t("draft"), calculated: t("calculated"), submitted: t("submitted"), accepted: t("approved") };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader title={t("citTaxReturnTitle")} description={t("citTaxReturnDesc")} />

      <div className="flex flex-col sm:flex-row gap-4 items-end">
        <div>
          <Label>{t("fiscalYear")}</Label>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[currentYear - 1, currentYear - 2, currentYear - 3].map(y => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {legalEntities.length > 1 && (
          <div>
            <Label>{t("legalEntity")}</Label>
            <Select value={selectedEntity} onValueChange={setSelectedEntity}>
              <SelectTrigger className="w-60"><SelectValue placeholder={t("allEntities")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">{t("allEntities")}</SelectItem>
                {legalEntities.map((le: any) => (
                  <SelectItem key={le.id} value={le.id}>{le.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card><CardContent className="p-4 text-center">
          <p className="text-xs text-muted-foreground">{t("totalRevenueLabel")}</p>
          <p className="text-lg font-bold">{calculated.totalRevenue.toLocaleString("sr-RS")} RSD</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-xs text-muted-foreground">{t("totalExpensesLabel")}</p>
          <p className="text-lg font-bold">{calculated.totalExpenses.toLocaleString("sr-RS")} RSD</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-xs text-muted-foreground">{t("accountingProfitLabel")}</p>
          <p className={`text-lg font-bold ${calculated.accountingProfit >= 0 ? "text-primary" : "text-destructive"}`}>
            {calculated.accountingProfit.toLocaleString("sr-RS")} RSD
          </p>
        </CardContent></Card>
      </div>

      {/* Tax Adjustments Section — Bug 9 */}
      <Collapsible open={adjustmentsOpen} onOpenChange={setAdjustmentsOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer">
              <CardTitle className="text-base flex items-center gap-2">
                <ChevronDown className={`h-4 w-4 transition-transform ${adjustmentsOpen ? "rotate-180" : ""}`} />
                Poreska usklađivanja
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label className="text-xs">Rashodi koji se ne priznaju (povećanje)</Label>
                  <Input type="number" min={0} value={adjustIncrease || ""} onChange={e => setAdjustIncrease(Number(e.target.value) || 0)} placeholder="0" />
                </div>
                <div>
                  <Label className="text-xs">Poreski podsticaji (umanjenje)</Label>
                  <Input type="number" min={0} value={adjustDecrease || ""} onChange={e => setAdjustDecrease(Number(e.target.value) || 0)} placeholder="0" />
                </div>
                <div>
                  <Label className="text-xs">Poreski krediti</Label>
                  <Input type="number" min={0} value={taxCredits || ""} onChange={e => setTaxCredits(Number(e.target.value) || 0)} placeholder="0" />
                </div>
              </div>
              <div>
                <Label className="text-xs">Napomene o usklađivanjima</Label>
                <Textarea value={adjustmentDetails} onChange={e => setAdjustmentDetails(e.target.value)} placeholder="Detalji o nepriznatim rashodima, podsticajima..." rows={3} />
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Calculator className="h-4 w-4" /> {t("citCalculation")}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <span className="text-muted-foreground">{t("accountingProfitLabel")}:</span>
            <span className="text-right font-semibold">{calculated.accountingProfit.toLocaleString("sr-RS")} RSD</span>
            {(adjustIncrease > 0 || adjustDecrease > 0) && (
              <>
                <span className="text-muted-foreground">+ Nepriznati rashodi:</span>
                <span className="text-right font-semibold">{adjustIncrease.toLocaleString("sr-RS")} RSD</span>
                <span className="text-muted-foreground">− Poreski podsticaji:</span>
                <span className="text-right font-semibold">{adjustDecrease.toLocaleString("sr-RS")} RSD</span>
              </>
            )}
            <span className="text-muted-foreground">{t("taxableBaseLabel")}:</span>
            <span className="text-right font-semibold">{calculated.taxableBase.toLocaleString("sr-RS")} RSD</span>
            <span className="text-muted-foreground">{t("taxRateLabel")}:</span>
            <span className="text-right font-semibold">{calculated.taxRate}%</span>
            <span className="text-muted-foreground">{t("taxAmountLabel")}:</span>
            <span className="text-right font-semibold">{calculated.taxAmount.toLocaleString("sr-RS")} RSD</span>
            {taxCredits > 0 && (
              <>
                <span className="text-muted-foreground">− Poreski krediti:</span>
                <span className="text-right font-semibold">{taxCredits.toLocaleString("sr-RS")} RSD</span>
              </>
            )}
            <span className="text-muted-foreground font-bold">Konačan porez:</span>
            <span className="text-right font-bold text-lg">{calculated.finalTax.toLocaleString("sr-RS")} RSD</span>
          </div>
          {!existingReturn && calculated.taxableBase > 0 && (
            <Button className="w-full" onClick={() => createReturnMut.mutate()} disabled={createReturnMut.isPending}>
              <Plus className="h-4 w-4 mr-2" /> {createReturnMut.isPending ? t("creating") : t("createCitReturn")}
            </Button>
          )}
          {existingReturn && (
            <Badge variant="default" className="text-sm">
              {t("returnAlreadyExists")} — {statusLabels[existingReturn.status] || existingReturn.status}
            </Badge>
          )}
        </CardContent>
      </Card>

      {returns.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" /> {t("createdReturns")}</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow>
                <TableHead>{t("fiscalYear")}</TableHead>
                <TableHead>{t("legalEntity")}</TableHead>
                <TableHead className="text-right">{t("totalRevenueLabel")}</TableHead>
                <TableHead className="text-right">{t("totalExpensesLabel")}</TableHead>
                <TableHead className="text-right">{t("tax")}</TableHead>
                <TableHead>{t("status")}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {returns.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-semibold">{r.fiscal_year}</TableCell>
                    <TableCell>{(r.legal_entity as any)?.name || t("allEntities")}</TableCell>
                    <TableCell className="text-right">{Number(r.total_revenue).toLocaleString("sr-RS")}</TableCell>
                    <TableCell className="text-right">{Number(r.total_expenses).toLocaleString("sr-RS")}</TableCell>
                    <TableCell className="text-right font-semibold">{Number(r.final_tax).toLocaleString("sr-RS")}</TableCell>
                    <TableCell><Badge variant="secondary">{statusLabels[r.status] || r.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
