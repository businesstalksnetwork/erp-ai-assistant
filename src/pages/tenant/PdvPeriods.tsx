// @ts-nocheck
import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { useLegalEntities } from "@/hooks/useLegalEntities";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Plus, Calculator, Eye, Send, FileDown } from "lucide-react";
import { ExportButton } from "@/components/ExportButton";
import { fmtNum } from "@/lib/utils";
import { DownloadPdfButton } from "@/components/DownloadPdfButton";

// POPDV sections per Serbian law
const POPDV_SECTIONS = [
  { code: "3", label: "Promet dobara i usluga (opšta stopa)", direction: "output", rate: 20 },
  { code: "3a", label: "Promet dobara i usluga (posebna stopa)", direction: "output", rate: 10 },
  { code: "4", label: "Oslobođen promet sa pravom na odbitak", direction: "output", rate: 0 },
  { code: "5", label: "Oslobođen promet bez prava na odbitak", direction: "output", rate: 0 },
  { code: "6", label: "Promet izvršen van RS", direction: "output", rate: 0 },
  { code: "8a", label: "Nabavke sa pravom na odbitak (opšta stopa)", direction: "input", rate: 20 },
  { code: "8b", label: "Nabavke sa pravom na odbitak (posebna stopa)", direction: "input", rate: 10 },
  { code: "8v", label: "Uvoz dobara", direction: "input", rate: 20 },
  { code: "9", label: "Nabavke bez prava na odbitak", direction: "input", rate: 0 },
  { code: "10", label: "Ispravka odbitka prethodnog poreza", direction: "input", rate: 0 },
  { code: "11", label: "Posebni postupci oporezivanja", direction: "output", rate: 0 },
];

export default function PdvPeriods() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<any>(null);
  const [formName, setFormName] = useState("");
  const [formStart, setFormStart] = useState("");
  const [formEnd, setFormEnd] = useState("");
  const [formLegalEntityId, setFormLegalEntityId] = useState("");
  const { entities: legalEntities } = useLegalEntities();

  const { data: periods = [], isLoading } = useQuery({
    queryKey: ["pdv_periods", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("pdv_periods").select("*").eq("tenant_id", tenantId!).order("start_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const { data: entries = [] } = useQuery({
    queryKey: ["pdv_entries", selectedPeriod?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("pdv_entries").select("*").eq("pdv_period_id", selectedPeriod!.id).order("popdv_section, document_date");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedPeriod?.id,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!formName || !formStart || !formEnd) throw new Error("All fields required");
      const { error } = await supabase.from("pdv_periods").insert({
        tenant_id: tenantId!, period_name: formName, start_date: formStart, end_date: formEnd,
        legal_entity_id: formLegalEntityId || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pdv_periods"] });
      toast({ title: t("success") });
      setCreateOpen(false);
      setFormName(""); setFormStart(""); setFormEnd(""); setFormLegalEntityId("");
    },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  // Calculate PDV: aggregate from invoices and supplier invoices within the period dates
  const calculateMutation = useMutation({
    mutationFn: async (periodId: string) => {
      const period = periods.find(p => p.id === periodId);
      if (!period) throw new Error("Period not found");

      // Clear existing entries
      await supabase.from("pdv_entries").delete().eq("pdv_period_id", periodId);

      // Fetch invoices (output VAT) in period
      const { data: invoices } = await supabase.from("invoices")
        .select("id, invoice_number, invoice_date, partner_name, partner_pib, subtotal, tax_amount, total, status, invoice_type")
        .eq("tenant_id", tenantId!)
        .in("status", ["sent", "paid"])
        .gte("invoice_date", period.start_date)
        .lte("invoice_date", period.end_date);

      // Fetch invoice lines to get per-rate breakdown
      const outputEntries: any[] = [];
      for (const inv of invoices || []) {
        const { data: lines } = await supabase.from("invoice_lines")
          .select("line_total, tax_amount, tax_rate_value")
          .eq("invoice_id", inv.id);

        // Group by rate
        const rateGroups: Record<number, { base: number; vat: number }> = {};
        for (const l of lines || []) {
          const rate = Number(l.tax_rate_value);
          if (!rateGroups[rate]) rateGroups[rate] = { base: 0, vat: 0 };
          rateGroups[rate].base += Number(l.line_total);
          rateGroups[rate].vat += Number(l.tax_amount);
        }

        for (const [rate, amounts] of Object.entries(rateGroups)) {
          const numRate = Number(rate);
          let section = "3"; // default: opšta stopa output
          if (numRate === 10) section = "3a";
          else if (numRate === 0) section = "4";

          // Advance invoices go to a special treatment
          if (inv.invoice_type === "advance") section = numRate === 10 ? "3a" : "3";

          outputEntries.push({
            tenant_id: tenantId!,
            pdv_period_id: periodId,
            popdv_section: section,
            document_type: inv.invoice_type === "advance" ? "advance" : "invoice",
            document_id: inv.id,
            document_number: inv.invoice_number,
            document_date: inv.invoice_date,
            partner_name: inv.partner_name,
            partner_pib: inv.partner_pib,
            base_amount: amounts.base,
            vat_amount: amounts.vat,
            vat_rate: numRate,
            direction: "output",
          });
        }
      }

      // Fetch supplier invoices (input VAT) — no line-level breakdown, use header totals
      const { data: supplierInvs } = await supabase.from("supplier_invoices")
        .select("id, invoice_number, invoice_date, supplier_name, amount, tax_amount, total, status")
        .eq("tenant_id", tenantId!)
        .in("status", ["approved", "paid"])
        .gte("invoice_date", period.start_date)
        .lte("invoice_date", period.end_date);

      const inputEntries: any[] = [];
      for (const si of supplierInvs || []) {
        const baseAmount = Number(si.amount);
        const vatAmount = Number(si.tax_amount);
        const effectiveRate = baseAmount > 0 ? Math.round((vatAmount / baseAmount) * 100) : 20;
        let section = "8a";
        if (effectiveRate === 10) section = "8b";
        else if (effectiveRate === 0) section = "9";

        inputEntries.push({
          tenant_id: tenantId!,
          pdv_period_id: periodId,
          popdv_section: section,
          document_type: "supplier_invoice",
          document_id: si.id,
          document_number: si.invoice_number,
          document_date: si.invoice_date,
          partner_name: si.supplier_name,
          partner_pib: null,
          base_amount: baseAmount,
          vat_amount: vatAmount,
          vat_rate: effectiveRate,
          direction: "input",
        });
      }

      const allEntries = [...outputEntries, ...inputEntries];
      if (allEntries.length > 0) {
        const { error } = await supabase.from("pdv_entries").insert(allEntries);
        if (error) throw error;
      }

      // Calculate totals
      const totalOutput = outputEntries.reduce((s, e) => s + e.vat_amount, 0);
      const totalInput = inputEntries.reduce((s, e) => s + e.vat_amount, 0);
      const liability = totalOutput - totalInput;

      await supabase.from("pdv_periods").update({
        output_vat: totalOutput,
        input_vat: totalInput,
        vat_liability: liability,
        status: "calculated",
      }).eq("id", periodId);

      return { entries: allEntries.length, output: totalOutput, input: totalInput, liability };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["pdv_periods"] });
      qc.invalidateQueries({ queryKey: ["pdv_entries"] });
      toast({ title: t("pdvCalculated"), description: `${data.entries} ${t("pdvEntriesProcessed")}` });
    },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const submitMutation = useMutation({
    mutationFn: async (periodId: string) => {
      const { error } = await supabase.rpc("submit_pdv_period", {
        p_pdv_period_id: periodId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pdv_periods"] });
      qc.invalidateQueries({ queryKey: ["pdv_entries"] });
      toast({ title: t("pdvSubmitted"), description: t("pdvPeriodSubmittedSuccessfully") });
    },
    onError: (e: Error) => {
      toast({
        title: t("error"),
        description: e.message || t("pdvSubmissionFailed"),
        variant: "destructive",
      });
    },
  });

  const fmt = (n: number) => fmtNum(Number(n));

  const statusBadge = (status: string) => {
    if (status === "calculated") return <Badge className="bg-blue-600">{t("pdvCalculated")}</Badge>;
    if (status === "submitted") return <Badge className="bg-green-600">{t("pdvSubmitted")}</Badge>;
    if (status === "closed") return <Badge variant="default">{t("closed")}</Badge>;
    return <Badge variant="outline">{t("open")}</Badge>;
  };

  // POPDV summary by section
  const popdvSummary = POPDV_SECTIONS.map(sec => {
    const sectionEntries = entries.filter(e => e.popdv_section === sec.code);
    return {
      ...sec,
      baseTotal: sectionEntries.reduce((s, e) => s + Number(e.base_amount), 0),
      vatTotal: sectionEntries.reduce((s, e) => s + Number(e.vat_amount), 0),
      count: sectionEntries.length,
    };
  }).filter(s => s.count > 0 || ["3", "3a", "8a", "8b"].includes(s.code));

  if (isLoading) return <p className="p-6">{t("loading")}</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("pdvPeriods")}</h1>
        <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-2" />{t("newPdvPeriod")}</Button>
      </div>

      {!selectedPeriod ? (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("periodName")}</TableHead>
                <TableHead>{t("startDate")}</TableHead>
                <TableHead>{t("endDate")}</TableHead>
                <TableHead className="text-right">{t("pdvOutputVat")}</TableHead>
                <TableHead className="text-right">{t("pdvInputVat")}</TableHead>
                <TableHead className="text-right">{t("pdvLiability")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead>{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {periods.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">{t("noResults")}</TableCell></TableRow>
              ) : periods.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="font-semibold">{p.period_name}</TableCell>
                  <TableCell>{p.start_date}</TableCell>
                  <TableCell>{p.end_date}</TableCell>
                  <TableCell className="text-right font-mono">{fmt(p.output_vat)}</TableCell>
                  <TableCell className="text-right font-mono">{fmt(p.input_vat)}</TableCell>
                  <TableCell className="text-right font-mono font-bold">{fmt(p.vat_liability)}</TableCell>
                  <TableCell>{statusBadge(p.status)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setSelectedPeriod(p)} title={t("pdvViewDetails")}><Eye className="h-4 w-4" /></Button>
                      {p.status === "open" && (
                        <Button variant="ghost" size="icon" onClick={() => calculateMutation.mutate(p.id)} disabled={calculateMutation.isPending} title={t("pdvCalculate")}>
                          <Calculator className="h-4 w-4" />
                        </Button>
                      )}
                      {p.status === "calculated" && (
                        <>
                          <Button variant="ghost" size="icon" onClick={() => calculateMutation.mutate(p.id)} disabled={calculateMutation.isPending} title={t("pdvRecalculate")}>
                            <Calculator className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => submitMutation.mutate(p.id)} title={t("pdvSubmit")}>
                            <Send className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <>
          <Button variant="outline" onClick={() => setSelectedPeriod(null)}>← {t("back")}</Button>

          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">{selectedPeriod.period_name}</h2>
              <p className="text-sm text-muted-foreground">{selectedPeriod.start_date} — {selectedPeriod.end_date}</p>
            </div>
            <ExportButton
              data={entries.map(e => ({ ...e }))}
              columns={[
                { key: "popdv_section", label: t("popdvSection") },
                { key: "document_number", label: t("oiDocumentNumber") },
                { key: "document_date", label: t("date") },
                { key: "partner_name", label: t("partnerName" as any) },
                { key: "partner_pib", label: "PIB" },
                { key: "base_amount", label: t("pdvBaseAmount") },
                { key: "vat_amount", label: t("pdvVatAmount") },
                { key: "vat_rate", label: t("pdvVatRate") },
              ]}
              filename={`popdv_${selectedPeriod.period_name}`}
            />
            <DownloadPdfButton type="pdv_return" params={{ pdv_period_id: selectedPeriod.id }} />
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4">
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">{t("pdvOutputVat")}</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{fmt(selectedPeriod.output_vat)} RSD</p></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">{t("pdvInputVat")}</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{fmt(selectedPeriod.input_vat)} RSD</p></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">{t("pdvLiability")}</CardTitle></CardHeader><CardContent><p className={`text-2xl font-bold ${Number(selectedPeriod.vat_liability) >= 0 ? "text-red-600" : "text-green-600"}`}>{fmt(selectedPeriod.vat_liability)} RSD</p></CardContent></Card>
          </div>

          <Tabs defaultValue="popdv">
            <TabsList>
              <TabsTrigger value="popdv">{t("popdvForm")}</TabsTrigger>
              <TabsTrigger value="details">{t("pdvDetails")}</TabsTrigger>
            </TabsList>

            <TabsContent value="popdv" className="space-y-4">
              <h3 className="text-lg font-semibold">{t("popdvForm")} — {t("popdvSummary")}</h3>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("popdvSection")}</TableHead>
                      <TableHead>{t("description")}</TableHead>
                      <TableHead>{t("pdvDirection")}</TableHead>
                      <TableHead className="text-right">{t("pdvBaseAmount")}</TableHead>
                      <TableHead className="text-right">{t("pdvVatAmount")}</TableHead>
                      <TableHead className="text-right">{t("pdvEntryCount")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {popdvSummary.map(sec => (
                      <TableRow key={sec.code} className={sec.count === 0 ? "text-muted-foreground" : ""}>
                        <TableCell className="font-mono font-bold">{sec.code}</TableCell>
                        <TableCell>{sec.label}</TableCell>
                        <TableCell><Badge variant={sec.direction === "output" ? "default" : "destructive"}>{sec.direction === "output" ? t("pdvOutput") : t("pdvInput")}</Badge></TableCell>
                        <TableCell className="text-right font-mono">{fmt(sec.baseTotal)}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(sec.vatTotal)}</TableCell>
                        <TableCell className="text-right">{sec.count}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-bold bg-muted/50">
                      <TableCell colSpan={3} className="text-right">{t("pdvOutputVat")} (Σ):</TableCell>
                      <TableCell className="text-right font-mono">{fmt(popdvSummary.filter(s => s.direction === "output").reduce((a, s) => a + s.baseTotal, 0))}</TableCell>
                      <TableCell className="text-right font-mono">{fmt(selectedPeriod.output_vat)}</TableCell>
                      <TableCell />
                    </TableRow>
                    <TableRow className="font-bold bg-muted/50">
                      <TableCell colSpan={3} className="text-right">{t("pdvInputVat")} (Σ):</TableCell>
                      <TableCell className="text-right font-mono">{fmt(popdvSummary.filter(s => s.direction === "input").reduce((a, s) => a + s.baseTotal, 0))}</TableCell>
                      <TableCell className="text-right font-mono">{fmt(selectedPeriod.input_vat)}</TableCell>
                      <TableCell />
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="details" className="space-y-4">
              <h3 className="text-lg font-semibold">{t("pdvDetails")}</h3>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("popdvSection")}</TableHead>
                      <TableHead>{t("oiDocumentNumber")}</TableHead>
                      <TableHead>{t("date")}</TableHead>
                      <TableHead>{t("partnerName" as any)}</TableHead>
                      <TableHead>PIB</TableHead>
                      <TableHead className="text-right">{t("pdvBaseAmount")}</TableHead>
                      <TableHead className="text-right">{t("pdvVatAmount")}</TableHead>
                      <TableHead>{t("pdvVatRate")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.length === 0 ? (
                      <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">{t("noResults")}</TableCell></TableRow>
                    ) : entries.map(e => (
                      <TableRow key={e.id}>
                        <TableCell className="font-mono font-bold">{e.popdv_section}</TableCell>
                        <TableCell className="font-mono">{e.document_number}</TableCell>
                        <TableCell>{e.document_date}</TableCell>
                        <TableCell>{e.partner_name || "—"}</TableCell>
                        <TableCell className="font-mono">{e.partner_pib || "—"}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(Number(e.base_amount))}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(Number(e.vat_amount))}</TableCell>
                        <TableCell>{e.vat_rate}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}

      {/* Create Period Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("newPdvPeriod")}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div><Label>{t("periodName")}</Label><Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="Januar 2026" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>{t("startDate")}</Label><Input type="date" value={formStart} onChange={e => setFormStart(e.target.value)} /></div>
              <div><Label>{t("endDate")}</Label><Input type="date" value={formEnd} onChange={e => setFormEnd(e.target.value)} /></div>
            </div>
            {legalEntities.length > 0 && (
              <div>
                <Label>{t("legalEntity")}</Label>
                <Select value={formLegalEntityId} onValueChange={setFormLegalEntityId}>
                  <SelectTrigger><SelectValue placeholder={t("selectLegalEntity")} /></SelectTrigger>
                  <SelectContent>
                    {legalEntities.map(e => <SelectItem key={e.id} value={e.id}>{e.name} ({e.pib})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
