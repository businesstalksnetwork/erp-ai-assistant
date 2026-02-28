import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useLegalEntities } from "@/hooks/useLegalEntities";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/PageHeader";
import { toast } from "@/hooks/use-toast";
import { Save, FileText } from "lucide-react";
import { fmtNum } from "@/lib/utils";

// PB-1 official line items (simplified — key positions)
const PB1_LINES = [
  { num: 1, label: "I POSLOVNI PRIHODI (klasa 6)" },
  { num: 2, label: "1. Prihodi od prodaje robe" },
  { num: 3, label: "2. Prihodi od prodaje proizvoda i usluga" },
  { num: 4, label: "3. Prihodi od aktiviranja učinaka" },
  { num: 5, label: "4. Povećanje vrednosti zaliha učinaka" },
  { num: 6, label: "5. Smanjenje vrednosti zaliha učinaka" },
  { num: 7, label: "6. Ostali poslovni prihodi" },
  { num: 8, label: "II POSLOVNI RASHODI (klasa 5)" },
  { num: 9, label: "1. Nabavna vrednost prodate robe" },
  { num: 10, label: "2. Troškovi materijala" },
  { num: 11, label: "3. Troškovi zarada i naknade zarada" },
  { num: 12, label: "4. Troškovi amortizacije" },
  { num: 13, label: "5. Ostali poslovni rashodi" },
  { num: 14, label: "III POSLOVNI DOBITAK (I - II)" },
  { num: 15, label: "IV POSLOVNI GUBITAK (II - I)" },
  { num: 16, label: "V FINANSIJSKI PRIHODI" },
  { num: 17, label: "VI FINANSIJSKI RASHODI" },
  { num: 18, label: "VII OSTALI PRIHODI" },
  { num: 19, label: "VIII OSTALI RASHODI" },
  { num: 20, label: "IX DOBITAK IZ REDOVNOG POSLOVANJA" },
  { num: 21, label: "X GUBITAK IZ REDOVNOG POSLOVANJA" },
  { num: 22, label: "XI NETO DOBITAK POSLOVANJA" },
  { num: 23, label: "XII NETO GUBITAK POSLOVANJA" },
  { num: 24, label: "XIII KAPITALNI DOBICI" },
  { num: 25, label: "XIV KAPITALNI GUBICI" },
  { num: 26, label: "XV KOREKCIJA RASHODA ZA TRANSFERNE CENE" },
  { num: 27, label: "XVI KOREKCIJA PRIHODA ZA TRANSFERNE CENE" },
  { num: 28, label: "XVII AMORTIZACIJA PO PORESKIM PROPISIMA" },
  { num: 29, label: "XVIII AMORTIZACIJA PO RAČUNOVODSTVENIM PROPISIMA" },
  { num: 30, label: "XIX RAZLIKA U AMORTIZACIJI (XVII - XVIII)" },
  { num: 31, label: "XX OPOREZIVA DOBIT" },
  { num: 32, label: "XXI PORESKI KREDITI" },
  { num: 33, label: "XXII PORESKA OSNOVICA" },
  { num: 34, label: "XXIII POREZ NA DOBIT (15%)" },
];

export default function PoreskiBilans() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const { entities: legalEntities } = useLegalEntities();
  const qc = useQueryClient();
  const [year, setYear] = useState(new Date().getFullYear());
  const [legalEntityId, setLegalEntityId] = useState("");

  // Fetch or create submission
  const { data: submission } = useQuery({
    queryKey: ["pb1-submission", tenantId, year, legalEntityId],
    queryFn: async () => {
      if (!tenantId) return null;
      const { data, error } = await supabase
        .from("pb1_submissions")
        .select("*, pb1_line_values(*)")
        .eq("tenant_id", tenantId)
        .eq("year", year)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  // P3-16: Fetch tax depreciation for line 28 auto-population
  const { data: taxDepreciationTotal } = useQuery({
    queryKey: ["tax-depreciation-total", tenantId, year],
    queryFn: async (): Promise<number> => {
      if (!tenantId) return 0;
      const { data, error } = await supabase
        .from("fixed_asset_depreciation_schedules" as any)
        .select("tax_depreciation_amount")
        .eq("tenant_id", tenantId)
        .eq("year", year);
      if (error) return 0;
      return ((data as any[]) || []).reduce((sum: number, row: any) => sum + Number(row.tax_depreciation_amount || 0), 0);
    },
    enabled: !!tenantId,
  });

  const lineValues: Record<number, { auto_amount: number; manual_adjustment: number; notes: string }> = {};
  if (submission?.pb1_line_values) {
    for (const lv of submission.pb1_line_values as any[]) {
      lineValues[lv.line_number] = {
        auto_amount: Number(lv.auto_amount || 0),
        manual_adjustment: Number(lv.manual_adjustment || 0),
        notes: lv.notes || "",
      };
    }
  }

  const [adjustments, setAdjustments] = useState<Record<number, number>>({});

  const getAutoAmount = (lineNum: number) => {
    if (lineNum === 28) return taxDepreciationTotal || 0;
    return lineValues[lineNum]?.auto_amount || 0;
  };
  const getManualAdj = (lineNum: number) => adjustments[lineNum] ?? lineValues[lineNum]?.manual_adjustment ?? 0;
  const getFinal = (lineNum: number) => getAutoAmount(lineNum) + getManualAdj(lineNum);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId || !user) throw new Error("Missing context");

      // Upsert submission
      const { data: sub, error: subErr } = await supabase
        .from("pb1_submissions")
        .upsert({
          tenant_id: tenantId,
          year,
          legal_entity_id: legalEntityId || null,
          status: "draft",
        }, { onConflict: "tenant_id,year,legal_entity_id" })
        .select("id")
        .single();
      if (subErr) throw subErr;

      // Upsert line values
      const rows = PB1_LINES.map(line => ({
        submission_id: sub.id,
        tenant_id: tenantId,
        line_number: line.num,
        line_label: line.label,
        auto_amount: getAutoAmount(line.num),
        manual_adjustment: getManualAdj(line.num),
      }));

      const { error: lineErr } = await supabase
        .from("pb1_line_values")
        .upsert(rows, { onConflict: "submission_id,line_number" });
      if (lineErr) throw lineErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pb1-submission"] });
      toast({ title: t("success") });
    },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const taxBase = Math.max(0, getFinal(33));
  const taxAmount = Math.round(taxBase * 0.15 * 100) / 100;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Poreski bilans (PB-1)"
        description="Obrazac PB-1 — Poreski bilans obveznika poreza na dobit pravnih lica"
        icon={FileText}
        actions={
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            <Save className="h-4 w-4 mr-2" /> Sačuvaj
          </Button>
        }
      />

      <div className="flex flex-wrap gap-4 print:hidden">
        <div>
          <Label>Godina</Label>
          <Input type="number" className="w-24" value={year} onChange={e => setYear(+e.target.value)} />
        </div>
        <div>
          <Label>{t("legalEntity")}</Label>
          <Select value={legalEntityId} onValueChange={setLegalEntityId}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder={t("allLegalEntities")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">{t("allLegalEntities")}</SelectItem>
              {legalEntities.map(le => (
                <SelectItem key={le.id} value={le.id}>{le.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {submission && (
          <div className="flex items-end">
            <Badge variant={submission.status === "submitted" ? "default" : "secondary"}>
              {submission.status === "submitted" ? "Podnet" : "Nacrt"}
            </Badge>
          </div>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">R.br.</TableHead>
                <TableHead>Pozicija</TableHead>
                <TableHead className="text-right w-36">Iznos (auto)</TableHead>
                <TableHead className="text-right w-36">Korekcija</TableHead>
                <TableHead className="text-right w-36">Ukupno</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {PB1_LINES.map(line => {
                const isHeader = line.label.startsWith("I ") || line.label.startsWith("II ") || line.label.startsWith("III") ||
                  line.label.startsWith("IV") || line.label.startsWith("V") || line.label.startsWith("X") ||
                  line.label.startsWith("VI") || line.label.startsWith("VII") || line.label.startsWith("VIII") ||
                  line.label.startsWith("IX") || line.label.startsWith("XX") || line.label.startsWith("XXI") ||
                  line.label.startsWith("XXII") || line.label.startsWith("XXIII");
                return (
                  <TableRow key={line.num} className={isHeader ? "bg-muted/50 font-semibold" : ""}>
                    <TableCell className="font-mono text-sm">{line.num}</TableCell>
                    <TableCell className={isHeader ? "font-semibold" : "pl-8"}>{line.label}</TableCell>
                    <TableCell className="text-right font-mono">{fmtNum(getAutoAmount(line.num))}</TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        className="w-28 text-right h-8 ml-auto"
                        value={getManualAdj(line.num) || ""}
                        onChange={e => setAdjustments(prev => ({ ...prev, [line.num]: Number(e.target.value) || 0 }))}
                      />
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium">{fmtNum(getFinal(line.num))}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={4} className="text-right font-bold text-lg">Porez na dobit (15%):</TableCell>
                <TableCell className="text-right font-bold text-lg font-mono">{fmtNum(taxAmount)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
