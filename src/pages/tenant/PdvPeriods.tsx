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
import { Plus, Calculator, Eye, Send, FileDown, BookOpen, Lock, Unlock } from "lucide-react";
import { ExportButton } from "@/components/ExportButton";
import { fmtNum } from "@/lib/utils";
import { DownloadPdfButton } from "@/components/DownloadPdfButton";
import { aggregatePopdvPeriod, generatePpPdvXml, type PopdvPeriodResult, type PpPdvForm } from "@/lib/popdvAggregation";

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
  const [popdvResult, setPopdvResult] = useState<PopdvPeriodResult | null>(null);

  const { data: periods = [], isLoading } = useQuery({
    queryKey: ["pdv_periods", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("pdv_periods").select("*").eq("tenant_id", tenantId!).order("start_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
    staleTime: 1000 * 60 * 3,
  });

  const { data: entries = [] } = useQuery({
    queryKey: ["pdv_entries", selectedPeriod?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("pdv_entries").select("*").eq("pdv_period_id", selectedPeriod!.id).order("popdv_section, document_date");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedPeriod?.id,
    staleTime: 1000 * 60 * 3,
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

  // NEW: Use the aggregation engine
  const calculateMutation = useMutation({
    mutationFn: async (periodId: string) => {
      const period = periods.find(p => p.id === periodId);
      if (!period) throw new Error("Period not found");

      // Run aggregation engine
      const result = await aggregatePopdvPeriod(
        tenantId!, period.start_date, period.end_date,
        (period as any).legal_entity_id
      );

      // Clear existing entries and repopulate
      await supabase.from("pdv_entries").delete().eq("pdv_period_id", periodId);

      const pdvEntries: any[] = [];

      // Output entries
      for (const line of [...result.outputLines, ...result.reverseChargeLines]) {
        pdvEntries.push({
          tenant_id: tenantId!,
          pdv_period_id: periodId,
          popdv_section: line.popdv_field,
          document_type: "aggregated",
          document_id: null,
          document_number: `Σ ${line.entry_count} stavki`,
          document_date: period.end_date,
          partner_name: null,
          partner_pib: null,
          base_amount: line.total_base,
          vat_amount: line.total_vat,
          vat_rate: line.vat_os > 0 ? 20 : (line.vat_ps > 0 ? 10 : 0),
          direction: "output",
        });
      }

      // Input entries
      for (const line of result.inputLines) {
        pdvEntries.push({
          tenant_id: tenantId!,
          pdv_period_id: periodId,
          popdv_section: line.popdv_field,
          document_type: "aggregated",
          document_id: null,
          document_number: `Σ ${line.entry_count} stavki`,
          document_date: period.end_date,
          partner_name: null,
          partner_pib: null,
          base_amount: line.total_base,
          vat_amount: line.total_vat,
          vat_rate: line.vat_os > 0 ? 20 : (line.vat_ps > 0 ? 10 : 0),
          direction: "input",
        });
      }

      if (pdvEntries.length > 0) {
        const { error } = await supabase.from("pdv_entries").insert(pdvEntries);
        if (error) throw error;
      }

      // Store snapshot
      await supabase.from("popdv_snapshots").upsert({
        tenant_id: tenantId!,
        period_start: period.start_date,
        period_end: period.end_date,
        legal_entity_id: (period as any).legal_entity_id || null,
        popdv_data: result as any,
        pppdv_data: result.ppPdv as any,
        output_vat: result.section5.s5_7,
        input_vat: result.section8e.s8e_5,
        net_vat: result.section10,
      } as any, { onConflict: "tenant_id,period_start,period_end" });

      // Update period totals
      await supabase.from("pdv_periods").update({
        output_vat: result.section5.s5_7,
        input_vat: result.section8e.s8e_5,
        vat_liability: result.section10,
        status: "calculated",
      }).eq("id", periodId);

      setPopdvResult(result);
      return result;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["pdv_periods"] });
      qc.invalidateQueries({ queryKey: ["pdv_entries"] });
      toast({ title: t("pdvCalculated"), description: `Izlazni PDV: ${fmtNum(data.section5.s5_7)} | Ulazni PDV: ${fmtNum(data.section8e.s8e_5)}` });
    },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const submitMutation = useMutation({
    mutationFn: async (periodId: string) => {
      const { error } = await supabase.rpc("submit_pdv_period" as any, { p_pdv_period_id: periodId });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pdv_periods"] });
      toast({ title: t("pdvSubmitted") });
    },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const downloadPpPdvXml = async (period: any) => {
    try {
      const result = popdvResult || await aggregatePopdvPeriod(
        tenantId!, period.start_date, period.end_date, (period as any).legal_entity_id
      );

      // Get company info
      const le = legalEntities.find(e => e.id === (period as any).legal_entity_id) || legalEntities[0];
      const startDate = new Date(period.start_date);

      const xml = generatePpPdvXml(result.ppPdv, {
        pib: le?.pib || "",
        companyName: le?.name || "",
        periodStart: period.start_date,
        periodEnd: period.end_date,
        periodYear: startDate.getFullYear(),
        periodMonth: startDate.getMonth() + 1,
      });

      const blob = new Blob([xml], { type: "application/xml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `PP-PDV_${period.period_name.replace(/\s/g, "_")}.xml`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: t("success") });
    } catch (e: any) {
      toast({ title: t("error"), description: e.message, variant: "destructive" });
    }
  };

  const settlePdvMutation = useMutation({
    mutationFn: async (periodId: string) => {
      const { data, error } = await supabase.rpc("create_pdv_settlement_journal" as any, {
        p_pdv_period_id: periodId, p_tenant_id: tenantId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pdv_periods"] });
      toast({ title: "PDV knjiženje kreirano" });
    },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const generateTaxPaymentOrder = useMutation({
    mutationFn: async (period: any) => {
      const startDate = new Date(period.start_date);
      const { data, error } = await supabase.functions.invoke("generate-tax-payment-orders", {
        body: { tenant_id: tenantId, tax_type: "pdv", amount: period.vat_liability, period_month: startDate.getMonth() + 1, period_year: startDate.getFullYear() },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({ title: "Nalog za plaćanje generisan", description: `Poziv na broj: ${data?.paymentOrder?.reference || "—"}` });
    },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const toggleLockMutation = useMutation({
    mutationFn: async ({ id, lock }: { id: string; lock: boolean }) => {
      const { error } = await supabase.from("pdv_periods").update({ is_locked: lock } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pdv_periods"] }); toast({ title: t("success") }); },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const fmt = (n: number) => fmtNum(Number(n));

  const statusBadge = (status: string) => {
    if (status === "calculated") return <Badge className="bg-blue-600">{t("pdvCalculated")}</Badge>;
    if (status === "submitted") return <Badge className="bg-green-600">{t("pdvSubmitted")}</Badge>;
    if (status === "closed") return <Badge variant="default">{t("closed")}</Badge>;
    return <Badge variant="outline">{t("open")}</Badge>;
  };

  // Build POPDV summary from pdv_entries
  const popdvSummary = (() => {
    const groups: Record<string, { code: string; direction: string; baseTotal: number; vatTotal: number; count: number }> = {};
    for (const e of entries) {
      const code = e.popdv_section;
      if (!groups[code]) groups[code] = { code, direction: e.direction, baseTotal: 0, vatTotal: 0, count: 0 };
      groups[code].baseTotal += Number(e.base_amount || 0);
      groups[code].vatTotal += Number(e.vat_amount || 0);
      groups[code].count++;
    }
    return Object.values(groups).sort((a, b) => a.code.localeCompare(b.code));
  })();

  // PP-PDV display section
  const renderPpPdv = () => {
    if (!popdvResult) return null;
    const pp = popdvResult.ppPdv;
    const rows: Array<{ field: string; label: string; value: number }> = [
      { field: "001", label: "Oslobođeni promet sa pravom na odbitak", value: pp.field_001 },
      { field: "002", label: "Oslobođeni promet bez prava na odbitak", value: pp.field_002 },
      { field: "003", label: "Oporeziva osnovica (izlaz)", value: pp.field_003 },
      { field: "103", label: "Posebni postupci", value: pp.field_103 },
      { field: "005", label: "Ukupna izlazna osnovica", value: pp.field_005 },
      { field: "105", label: "UKUPAN IZLAZNI PDV", value: pp.field_105 },
      { field: "006", label: "Uvoz — osnovica", value: pp.field_006 },
      { field: "106", label: "Uvoz — PDV", value: pp.field_106 },
      { field: "007", label: "Nabavka od poljoprivrednika", value: pp.field_007 },
      { field: "107", label: "PDV nadoknada", value: pp.field_107 },
      { field: "008", label: "Ukupan ulazni PDV pre odbitka (8đ)", value: pp.field_008 },
      { field: "108", label: "Neodbivi PDV (sekcija 9)", value: pp.field_108 },
      { field: "009", label: "Ispravke odbitka (neto)", value: pp.field_009 },
      { field: "109", label: "UKUPAN ODBIVI ULAZNI PDV", value: pp.field_109 },
      { field: "110", label: "NETO PDV (izlaz - ulaz)", value: pp.field_110 },
      { field: "111", label: "Poreska obaveza", value: pp.field_111 },
      { field: "112", label: "Poreski kredit (pretplata)", value: pp.field_112 },
    ];

    return (
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileDown className="h-4 w-4" /> PP-PDV Poreska prijava
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px]">Polje</TableHead>
                <TableHead>Opis</TableHead>
                <TableHead className="text-right w-[150px]">Iznos (RSD)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(r => (
                <TableRow key={r.field} className={["105", "109", "110", "111", "112"].includes(r.field) ? "font-bold bg-muted/30" : ""}>
                  <TableCell className="font-mono">{r.field}</TableCell>
                  <TableCell>{r.label}</TableCell>
                  <TableCell className={`text-right font-mono ${r.field === "111" && r.value > 0 ? "text-destructive" : ""} ${r.field === "112" && r.value > 0 ? "text-green-600" : ""}`}>
                    {fmt(r.value)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    );
  };

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
                  <TableCell>{statusBadge(p.status)}{p.is_locked && <Badge variant="outline" className="ml-1 gap-1"><Lock className="h-3 w-3" />Zaključano</Badge>}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => { setSelectedPeriod(p); setPopdvResult(null); }} title={t("pdvViewDetails")}><Eye className="h-4 w-4" /></Button>
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
                      {p.is_locked ? (
                        <Button variant="ghost" size="icon" onClick={() => toggleLockMutation.mutate({ id: p.id, lock: false })} title="Otključaj"><Unlock className="h-4 w-4" /></Button>
                      ) : (p.status !== "open" && (
                        <Button variant="ghost" size="icon" onClick={() => toggleLockMutation.mutate({ id: p.id, lock: true })} title="Zaključaj"><Lock className="h-4 w-4" /></Button>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <>
          <Button variant="outline" onClick={() => { setSelectedPeriod(null); setPopdvResult(null); }}>← {t("back")}</Button>

          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-xl font-semibold">{selectedPeriod.period_name}</h2>
              <p className="text-sm text-muted-foreground">{selectedPeriod.start_date} — {selectedPeriod.end_date}</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <ExportButton
                data={entries.map(e => ({ ...e }))}
                columns={[
                  { key: "popdv_section", label: t("popdvSection") },
                  { key: "document_number", label: t("oiDocumentNumber") },
                  { key: "document_date", label: t("date") },
                  { key: "partner_name", label: t("partnerName") },
                  { key: "base_amount", label: t("pdvBaseAmount") },
                  { key: "vat_amount", label: t("pdvVatAmount") },
                ]}
                filename={`popdv_${selectedPeriod.period_name}`}
              />
              <DownloadPdfButton type="pdv_return" params={{ pdv_period_id: selectedPeriod.id }} />
              <Button variant="outline" size="sm" onClick={() => downloadPpPdvXml(selectedPeriod)}>
                <FileDown className="h-4 w-4 mr-2" />PP-PDV XML
              </Button>
              {selectedPeriod.status === "submitted" && (
                <Button variant="outline" size="sm" onClick={() => settlePdvMutation.mutate(selectedPeriod.id)} disabled={settlePdvMutation.isPending}>
                  <BookOpen className="h-4 w-4 mr-2" />Zatvori PDV
                </Button>
              )}
              {(selectedPeriod.status === "submitted" || selectedPeriod.status === "closed") && Number(selectedPeriod.vat_liability) > 0 && (
                <Button variant="outline" size="sm" onClick={() => generateTaxPaymentOrder.mutate(selectedPeriod)} disabled={generateTaxPaymentOrder.isPending}>
                  <FileDown className="h-4 w-4 mr-2" />Nalog za plaćanje
                </Button>
              )}
            </div>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">{t("pdvOutputVat")}</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{fmt(selectedPeriod.output_vat)} RSD</p></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">{t("pdvInputVat")}</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{fmt(selectedPeriod.input_vat)} RSD</p></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">{t("pdvLiability")}</CardTitle></CardHeader><CardContent><p className={`text-2xl font-bold ${Number(selectedPeriod.vat_liability) >= 0 ? "text-red-600" : "text-green-600"}`}>{fmt(selectedPeriod.vat_liability)} RSD</p></CardContent></Card>
          </div>

          <Tabs defaultValue="popdv">
            <TabsList>
              <TabsTrigger value="popdv">{t("popdvForm")}</TabsTrigger>
              <TabsTrigger value="pppdv">PP-PDV</TabsTrigger>
              <TabsTrigger value="details">{t("pdvDetails")}</TabsTrigger>
            </TabsList>

            <TabsContent value="popdv" className="space-y-4">
              <h3 className="text-lg font-semibold">{t("popdvForm")} — {t("popdvSummary")}</h3>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("popdvSection")}</TableHead>
                      <TableHead>{t("pdvDirection")}</TableHead>
                      <TableHead className="text-right">{t("pdvBaseAmount")}</TableHead>
                      <TableHead className="text-right">{t("pdvVatAmount")}</TableHead>
                      <TableHead className="text-right">{t("pdvEntryCount")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {popdvSummary.map(sec => (
                      <TableRow key={sec.code} className={sec.code.startsWith("3a") ? "bg-blue-50 dark:bg-blue-950/30" : ""}>
                        <TableCell className="font-mono font-bold">{sec.code}</TableCell>
                        <TableCell><Badge variant={sec.direction === "output" ? "default" : "destructive"}>{sec.direction === "output" ? t("pdvOutput") : t("pdvInput")}</Badge></TableCell>
                        <TableCell className="text-right font-mono">{fmt(sec.baseTotal)}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(sec.vatTotal)}</TableCell>
                        <TableCell className="text-right">{sec.count}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-bold bg-muted/50">
                      <TableCell className="text-right">{t("pdvOutputVat")} (Σ):</TableCell>
                      <TableCell />
                      <TableCell className="text-right font-mono">{fmt(popdvSummary.filter(s => s.direction === "output").reduce((a, s) => a + s.baseTotal, 0))}</TableCell>
                      <TableCell className="text-right font-mono">{fmt(selectedPeriod.output_vat)}</TableCell>
                      <TableCell />
                    </TableRow>
                    <TableRow className="font-bold bg-muted/50">
                      <TableCell className="text-right">{t("pdvInputVat")} (Σ):</TableCell>
                      <TableCell />
                      <TableCell className="text-right font-mono">{fmt(popdvSummary.filter(s => s.direction === "input").reduce((a, s) => a + s.baseTotal, 0))}</TableCell>
                      <TableCell className="text-right font-mono">{fmt(selectedPeriod.input_vat)}</TableCell>
                      <TableCell />
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="pppdv" className="space-y-4">
              {popdvResult ? renderPpPdv() : (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    <p>Pokrenite kalkulaciju da vidite PP-PDV formu.</p>
                    <Button className="mt-4" onClick={() => calculateMutation.mutate(selectedPeriod.id)} disabled={calculateMutation.isPending}>
                      <Calculator className="h-4 w-4 mr-2" />Kalkuliši POPDV
                    </Button>
                  </CardContent>
                </Card>
              )}
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
                      <TableHead>{t("partnerName")}</TableHead>
                      <TableHead className="text-right">{t("pdvBaseAmount")}</TableHead>
                      <TableHead className="text-right">{t("pdvVatAmount")}</TableHead>
                      <TableHead>{t("pdvVatRate")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">{t("noResults")}</TableCell></TableRow>
                    ) : entries.map(e => (
                      <TableRow key={e.id}>
                        <TableCell className="font-mono font-bold">{e.popdv_section}</TableCell>
                        <TableCell className="font-mono">{e.document_number}</TableCell>
                        <TableCell>{e.document_date}</TableCell>
                        <TableCell>{e.partner_name || "—"}</TableCell>
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
