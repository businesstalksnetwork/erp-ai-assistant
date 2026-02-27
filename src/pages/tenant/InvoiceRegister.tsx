import { useState, useMemo } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useLegalEntities } from "@/hooks/useLegalEntities";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ExportButton } from "@/components/ExportButton";
import { fmtNum } from "@/lib/utils";
import { FileText } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";

interface RegisterEntry {
  popdv_field: string;
  posting_date: string;
  posting_number: string;
  partner_code: string;
  partner_name: string;
  pib: string;
  document_number: string;
  document_date: string;
  vat_date: string;
  total_with_vat: number;
  fee_value: number;
  base_standard: number;
  vat_standard: number;
  base_reduced: number;
  vat_reduced: number;
  vat_non_deductible: number;
  efaktura_status: string;
}

export default function InvoiceRegister() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { entities: legalEntities } = useLegalEntities();

  const [periodStart, setPeriodStart] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [periodEnd, setPeriodEnd] = useState(() => {
    const d = new Date();
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return last.toISOString().split("T")[0];
  });
  const [legalEntityId, setLegalEntityId] = useState("");

  // Fetch OUTPUT register (izlazne)
  const { data: outputEntries = [], isLoading: loadingOutput } = useQuery({
    queryKey: ["invoice-register-output", tenantId, periodStart, periodEnd, legalEntityId],
    queryFn: async () => {
      let query = supabase.from("invoices")
        .select("id, invoice_number, invoice_date, vat_date, partner_name, partner_pib, status, total")
        .eq("tenant_id", tenantId!)
        .in("status", ["sent", "paid", "posted"])
        .gte("vat_date", periodStart)
        .lte("vat_date", periodEnd);
      if (legalEntityId && legalEntityId !== "__all") query = query.eq("legal_entity_id", legalEntityId);
      const { data: invoices } = await query;

      if (!invoices || invoices.length === 0) return [];

      const ids = invoices.map(i => i.id);
      const allLines: any[] = [];
      for (let i = 0; i < ids.length; i += 200) {
        const chunk = ids.slice(i, i + 200);
        const { data } = await supabase.from("invoice_lines")
          .select("invoice_id, popdv_field, line_total, tax_amount, tax_rate_value, total_with_tax, efaktura_category, vat_non_deductible")
          .in("invoice_id", chunk)
          .not("popdv_field", "is", null);
        if (data) allLines.push(...data);
      }

      const invoiceMap = Object.fromEntries(invoices.map(i => [i.id, i]));
      return allLines.map(l => {
        const inv = invoiceMap[l.invoice_id];
        const rate = Number(l.tax_rate_value || 0);
        return {
          popdv_field: l.popdv_field,
          posting_date: inv?.vat_date || inv?.invoice_date,
          posting_number: "",
          partner_code: "",
          partner_name: inv?.partner_name || "",
          pib: inv?.partner_pib || "",
          document_number: inv?.invoice_number || "",
          document_date: inv?.invoice_date,
          vat_date: inv?.vat_date || inv?.invoice_date,
          total_with_vat: Number(l.total_with_tax || 0),
          fee_value: 0,
          base_standard: rate === 20 ? Number(l.line_total) : 0,
          vat_standard: rate === 20 ? Number(l.tax_amount) : 0,
          base_reduced: rate === 10 ? Number(l.line_total) : 0,
          vat_reduced: rate === 10 ? Number(l.tax_amount) : 0,
          vat_non_deductible: Number(l.vat_non_deductible || 0),
          efaktura_status: l.efaktura_category || "",
        } as RegisterEntry;
      });
    },
    enabled: !!tenantId,
  });

  // Fetch INPUT register (ulazne)
  const { data: inputEntries = [], isLoading: loadingInput } = useQuery({
    queryKey: ["invoice-register-input", tenantId, periodStart, periodEnd, legalEntityId],
    queryFn: async () => {
      let query = supabase.from("supplier_invoices")
        .select("id, invoice_number, invoice_date, vat_date, supplier_id, supplier_name, status, total")
        .eq("tenant_id", tenantId!)
        .in("status", ["approved", "paid", "posted"])
        .gte("vat_date", periodStart)
        .lte("vat_date", periodEnd);
      if (legalEntityId && legalEntityId !== "__all") query = query.eq("legal_entity_id", legalEntityId);
      const { data: invoices } = await query;

      if (!invoices || invoices.length === 0) return [];

      // Fetch partner PIBs
      const supplierIds = [...new Set(invoices.map(i => i.supplier_id).filter(Boolean))] as string[];
      const pibMap: Record<string, string> = {};
      if (supplierIds.length > 0) {
        const { data: partners } = await supabase.from("partners").select("id, pib").in("id", supplierIds);
        if (partners) partners.forEach(p => { if (p.pib) pibMap[p.id] = p.pib; });
      }

      const ids = invoices.map(i => i.id);
      const allLines: any[] = [];
      for (let i = 0; i < ids.length; i += 200) {
        const chunk = ids.slice(i, i + 200);
        const { data } = await supabase.from("supplier_invoice_lines")
          .select("supplier_invoice_id, popdv_field, line_total, tax_amount, tax_rate_value, total_with_tax, efaktura_category, vat_non_deductible, fee_value")
          .in("supplier_invoice_id", chunk)
          .not("popdv_field", "is", null);
        if (data) allLines.push(...data);
      }

      const invoiceMap = Object.fromEntries(invoices.map(i => [i.id, i]));
      return allLines.map(l => {
        const inv = invoiceMap[l.supplier_invoice_id];
        const rate = Number(l.tax_rate_value || 0);
        return {
          popdv_field: l.popdv_field,
          posting_date: inv?.vat_date || inv?.invoice_date,
          posting_number: "",
          partner_code: "",
          partner_name: inv?.supplier_name || "",
          pib: (inv?.supplier_id && pibMap[inv.supplier_id]) || "",
          document_number: inv?.invoice_number || "",
          document_date: inv?.invoice_date,
          vat_date: inv?.vat_date || inv?.invoice_date,
          total_with_vat: Number(l.total_with_tax || 0),
          fee_value: Number(l.fee_value || 0),
          base_standard: rate === 20 ? Number(l.line_total) : 0,
          vat_standard: rate === 20 ? Number(l.tax_amount) : 0,
          base_reduced: rate === 10 ? Number(l.line_total) : 0,
          vat_reduced: rate === 10 ? Number(l.tax_amount) : 0,
          vat_non_deductible: Number(l.vat_non_deductible || 0),
          efaktura_status: l.efaktura_category || "",
        } as RegisterEntry;
      });
    },
    enabled: !!tenantId,
  });

  const renderRegister = (entries: RegisterEntry[], direction: "output" | "input") => {
    // Group by popdv_field
    const groups: Record<string, RegisterEntry[]> = {};
    for (const e of entries) {
      if (!groups[e.popdv_field]) groups[e.popdv_field] = [];
      groups[e.popdv_field].push(e);
    }

    const sortedFields = Object.keys(groups).sort();
    const fmt = fmtNum;

    return (
      <div className="space-y-4">
        {sortedFields.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">{t("noResults")}</p>
        ) : sortedFields.map(field => {
          const items = groups[field].sort((a, b) => a.vat_date.localeCompare(b.vat_date));
          const totalBase = items.reduce((s, e) => s + e.base_standard + e.base_reduced, 0);
          const totalVat = items.reduce((s, e) => s + e.vat_standard + e.vat_reduced, 0);
          const totalFee = items.reduce((s, e) => s + e.fee_value, 0);
          const totalNonDed = items.reduce((s, e) => s + e.vat_non_deductible, 0);

          return (
            <div key={field} className="rounded-md border">
              <div className="bg-muted/50 px-4 py-2 flex items-center gap-2">
                <Badge variant="outline" className="font-mono">{field}</Badge>
                <span className="text-sm font-semibold">Sekcija {field}</span>
                <span className="ml-auto text-xs text-muted-foreground">{items.length} stavki</span>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Datum PDV</TableHead>
                    <TableHead>Br. dokumenta</TableHead>
                    <TableHead>Partner</TableHead>
                    <TableHead>PIB</TableHead>
                    <TableHead className="text-right">Ukupno sa PDV</TableHead>
                    {direction === "input" && <TableHead className="text-right">Vr. naknade</TableHead>}
                    <TableHead className="text-right">Osn. OS</TableHead>
                    <TableHead className="text-right">PDV OS</TableHead>
                    <TableHead className="text-right">Osn. PS</TableHead>
                    <TableHead className="text-right">PDV PS</TableHead>
                    {direction === "input" && <TableHead className="text-right">PDV bez odb.</TableHead>}
                    <TableHead>eFaktura</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((e, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-sm">{e.vat_date}</TableCell>
                      <TableCell className="font-mono text-sm">{e.document_number}</TableCell>
                      <TableCell className="text-sm">{e.partner_name}</TableCell>
                      <TableCell className="font-mono text-sm">{e.pib || "—"}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{fmt(e.total_with_vat)}</TableCell>
                      {direction === "input" && <TableCell className="text-right font-mono text-sm">{e.fee_value > 0 ? fmt(e.fee_value) : ""}</TableCell>}
                      <TableCell className="text-right font-mono text-sm">{e.base_standard > 0 ? fmt(e.base_standard) : ""}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{e.vat_standard > 0 ? fmt(e.vat_standard) : ""}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{e.base_reduced > 0 ? fmt(e.base_reduced) : ""}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{e.vat_reduced > 0 ? fmt(e.vat_reduced) : ""}</TableCell>
                      {direction === "input" && <TableCell className="text-right font-mono text-sm text-destructive">{e.vat_non_deductible > 0 ? fmt(e.vat_non_deductible) : ""}</TableCell>}
                      <TableCell className="text-xs">{e.efaktura_status || "—"}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-bold bg-muted/30">
                    <TableCell colSpan={direction === "input" ? 5 : 4} className="text-right">Ukupno {field}:</TableCell>
                    {direction === "input" && <TableCell className="text-right font-mono">{totalFee > 0 ? fmt(totalFee) : ""}</TableCell>}
                    <TableCell className="text-right font-mono">{fmt(items.reduce((s, e) => s + e.base_standard, 0))}</TableCell>
                    <TableCell className="text-right font-mono">{fmt(items.reduce((s, e) => s + e.vat_standard, 0))}</TableCell>
                    <TableCell className="text-right font-mono">{fmt(items.reduce((s, e) => s + e.base_reduced, 0))}</TableCell>
                    <TableCell className="text-right font-mono">{fmt(items.reduce((s, e) => s + e.vat_reduced, 0))}</TableCell>
                    {direction === "input" && <TableCell className="text-right font-mono text-destructive">{totalNonDed > 0 ? fmt(totalNonDed) : ""}</TableCell>}
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          );
        })}

        {/* Grand total */}
        {sortedFields.length > 0 && (
          <Card>
            <CardContent className="pt-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div><p className="text-xs text-muted-foreground">Osnovica OS (20%)</p><p className="text-lg font-bold font-mono">{fmt(entries.reduce((s, e) => s + e.base_standard, 0))}</p></div>
                <div><p className="text-xs text-muted-foreground">PDV OS (20%)</p><p className="text-lg font-bold font-mono">{fmt(entries.reduce((s, e) => s + e.vat_standard, 0))}</p></div>
                <div><p className="text-xs text-muted-foreground">Osnovica PS (10%)</p><p className="text-lg font-bold font-mono">{fmt(entries.reduce((s, e) => s + e.base_reduced, 0))}</p></div>
                <div><p className="text-xs text-muted-foreground">PDV PS (10%)</p><p className="text-lg font-bold font-mono">{fmt(entries.reduce((s, e) => s + e.vat_reduced, 0))}</p></div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  const exportColumns = [
    { key: "popdv_field", label: "POPDV" },
    { key: "vat_date", label: "Datum PDV" },
    { key: "document_number", label: "Br. dokumenta" },
    { key: "partner_name", label: "Partner" },
    { key: "pib", label: "PIB" },
    { key: "total_with_vat", label: "Ukupno sa PDV" },
    { key: "fee_value", label: "Vr. naknade" },
    { key: "base_standard", label: "Osnovica OS" },
    { key: "vat_standard", label: "PDV OS" },
    { key: "base_reduced", label: "Osnovica PS" },
    { key: "vat_reduced", label: "PDV PS" },
    { key: "vat_non_deductible", label: "PDV bez odbitka" },
    { key: "efaktura_status", label: "eFaktura" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Knjiga računa"
        description="Knjiga izlaznih i ulaznih računa — grupisano po POPDV sekcijama"
        icon={FileText}
      />

      {/* Period filter */}
      <Card>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <Label>Period od</Label>
              <Input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} />
            </div>
            <div>
              <Label>Period do</Label>
              <Input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} />
            </div>
            {legalEntities.length > 1 && (
              <div>
                <Label>{t("legalEntity")}</Label>
                <Select value={legalEntityId} onValueChange={setLegalEntityId}>
                  <SelectTrigger><SelectValue placeholder="Sve" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all">Sve</SelectItem>
                    {legalEntities.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="output">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="output">Knjiga izlaznih računa</TabsTrigger>
            <TabsTrigger value="input">Knjiga ulaznih računa</TabsTrigger>
          </TabsList>
          <div className="flex gap-2">
            <ExportButton data={outputEntries} columns={exportColumns} filename={`knjiga_izlaznih_${periodStart}`} />
            <ExportButton data={inputEntries} columns={exportColumns} filename={`knjiga_ulaznih_${periodStart}`} />
          </div>
        </div>

        <TabsContent value="output">
          {loadingOutput ? <p className="text-center py-8">{t("loading")}</p> : renderRegister(outputEntries, "output")}
        </TabsContent>

        <TabsContent value="input">
          {loadingInput ? <p className="text-center py-8">{t("loading")}</p> : renderRegister(inputEntries, "input")}
        </TabsContent>
      </Tabs>
    </div>
  );
}
