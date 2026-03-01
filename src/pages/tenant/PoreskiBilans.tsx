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

// PB-1 official line items — expanded to full ~70 AOP positions per Pravilnik
const PB1_LINES = [
  // I POSLOVNI PRIHODI
  { num: 1, label: "I POSLOVNI PRIHODI (AOP 1001-1010)", isHeader: true },
  { num: 2, label: "1. Prihodi od prodaje robe (AOP 1001)" },
  { num: 3, label: "2. Prihodi od prodaje proizvoda i usluga (AOP 1002)" },
  { num: 4, label: "3. Prihodi od aktiviranja učinaka (AOP 1003)" },
  { num: 5, label: "4. Povećanje vrednosti zaliha učinaka (AOP 1004)" },
  { num: 6, label: "5. Smanjenje vrednosti zaliha učinaka (AOP 1005)" },
  { num: 7, label: "6. Ostali poslovni prihodi (AOP 1006)" },
  // II POSLOVNI RASHODI
  { num: 8, label: "II POSLOVNI RASHODI (AOP 1007-1019)", isHeader: true },
  { num: 9, label: "1. Nabavna vrednost prodate robe (AOP 1007)" },
  { num: 10, label: "2. Troškovi materijala (AOP 1008)" },
  { num: 11, label: "3. Troškovi zarada, naknada zarada i ostali lični rashodi (AOP 1009)" },
  { num: 12, label: "4. Troškovi proizvodnih usluga (AOP 1010)" },
  { num: 13, label: "5. Troškovi amortizacije (AOP 1011)" },
  { num: 14, label: "6. Troškovi dugotrajne imovine (AOP 1012)" },
  { num: 15, label: "7. Nematerijalni troškovi (AOP 1013)" },
  { num: 16, label: "8. Ostali poslovni rashodi (AOP 1014)" },
  // III-IV POSLOVNI REZULTAT
  { num: 17, label: "III POSLOVNI DOBITAK (I - II) (AOP 1020)", isHeader: true },
  { num: 18, label: "IV POSLOVNI GUBITAK (II - I) (AOP 1021)", isHeader: true },
  // V-VI FINANSIJSKI
  { num: 19, label: "V FINANSIJSKI PRIHODI (AOP 1022-1028)", isHeader: true },
  { num: 20, label: "1. Prihodi od kamata (AOP 1022)" },
  { num: 21, label: "2. Pozitivne kursne razlike (AOP 1023)" },
  { num: 22, label: "3. Prihodi od učešća u kapitalu (AOP 1024)" },
  { num: 23, label: "4. Ostali finansijski prihodi (AOP 1025)" },
  { num: 24, label: "VI FINANSIJSKI RASHODI (AOP 1026-1032)", isHeader: true },
  { num: 25, label: "1. Rashodi kamata (AOP 1026)" },
  { num: 26, label: "2. Negativne kursne razlike (AOP 1027)" },
  { num: 27, label: "3. Ostali finansijski rashodi (AOP 1028)" },
  // VII-VIII OSTALI
  { num: 28, label: "VII OSTALI PRIHODI (AOP 1029)", isHeader: true },
  { num: 29, label: "VIII OSTALI RASHODI (AOP 1030)", isHeader: true },
  // IX-X REZULTAT
  { num: 30, label: "IX DOBITAK IZ REDOVNOG POSLOVANJA (AOP 1031)", isHeader: true },
  { num: 31, label: "X GUBITAK IZ REDOVNOG POSLOVANJA (AOP 1032)", isHeader: true },
  { num: 32, label: "XI NETO DOBITAK POSLOVANJA (AOP 1033)" },
  { num: 33, label: "XII NETO GUBITAK POSLOVANJA (AOP 1034)" },
  // KOREKCIJE — PORESKI BILANS SPECIFIČNE
  { num: 34, label: "XIII RASHODI KOJI SE NE PRIZNAJU (AOP 1035-1050)", isHeader: true },
  { num: 35, label: "1. Troškovi koji se ne priznaju u poreske svrhe (AOP 1035)" },
  { num: 36, label: "2. Ispravka vrednosti potraživanja (AOP 1036)" },
  { num: 37, label: "3. Reprezentacija preko 0.5% prihoda (AOP 1037)" },
  { num: 38, label: "4. Reklama i propaganda preko 10% prihoda (AOP 1038)" },
  { num: 39, label: "5. Članarine komorama i udruženjima (AOP 1039)" },
  { num: 40, label: "6. Porez na imovinu (AOP 1040)" },
  { num: 41, label: "7. Novčane kazne i penali (AOP 1041)" },
  { num: 42, label: "8. Donacije preko 5% prihoda (AOP 1042)" },
  { num: 43, label: "9. Rashodi po osnovu obezvređivanja (AOP 1043)" },
  { num: 44, label: "10. Ostali nepriznati rashodi (AOP 1044)" },
  { num: 45, label: "XIV PRIHODI KOJI SE NE UKLJUČUJU (AOP 1045-1048)", isHeader: true },
  { num: 46, label: "1. Dividende i učešća u dobiti (AOP 1045)" },
  { num: 47, label: "2. Ostali prihodi koji se ne oporezuju (AOP 1046)" },
  // KAPITALNI DOBICI/GUBICI
  { num: 48, label: "XV KAPITALNI DOBICI (AOP 1047)", isHeader: true },
  { num: 49, label: "XVI KAPITALNI GUBICI (AOP 1048)", isHeader: true },
  // TRANSFERNE CENE
  { num: 50, label: "XVII KOREKCIJA RASHODA ZA TRANSFERNE CENE (AOP 1049)" },
  { num: 51, label: "XVIII KOREKCIJA PRIHODA ZA TRANSFERNE CENE (AOP 1050)" },
  // AMORTIZACIJA
  { num: 52, label: "XIX AMORTIZACIJA PO PORESKIM PROPISIMA (čl. 10 ZPDPL) (AOP 1051)" },
  { num: 53, label: "XX AMORTIZACIJA PO RAČUNOVODSTVENIM PROPISIMA (AOP 1052)" },
  { num: 54, label: "XXI RAZLIKA U AMORTIZACIJI (XIX - XX) (AOP 1053)" },
  // TANKA KAPITALIZACIJA
  { num: 55, label: "XXII KAMATA IZNAD NORME (čl. 61-62 ZPDPL) (AOP 1054)" },
  // PRENOS GUBITKA
  { num: 56, label: "XXIII PRENOS PORESKOG GUBITKA (čl. 32 ZPDPL) (AOP 1055)" },
  { num: 57, label: "1. Gubitak iz prethodne 1. godine (AOP 1055a)" },
  { num: 58, label: "2. Gubitak iz prethodne 2. godine (AOP 1055b)" },
  { num: 59, label: "3. Gubitak iz prethodne 3. godine (AOP 1055c)" },
  { num: 60, label: "4. Gubitak iz prethodne 4. godine (AOP 1055d)" },
  { num: 61, label: "5. Gubitak iz prethodne 5. godine (AOP 1055e)" },
  // OPOREZIVA DOBIT / POREZ
  { num: 62, label: "XXIV OPOREZIVA DOBIT (AOP 1056)", isHeader: true },
  { num: 63, label: "XXV PORESKI KREDITI (čl. 48-50 ZPDPL) (AOP 1057)" },
  { num: 64, label: "1. Poreski kredit za ulaganja (AOP 1057a)" },
  { num: 65, label: "2. Poreski kredit za zapošljavanje (AOP 1057b)" },
  { num: 66, label: "3. Ostali poreski krediti (AOP 1057c)" },
  { num: 67, label: "XXVI PORESKA OSNOVICA (AOP 1058)", isHeader: true },
  { num: 68, label: "XXVII POREZ NA DOBIT (15%) (AOP 1059)", isHeader: true },
  { num: 69, label: "XXVIII AKONTACIJA POREZA ZA NAREDNI PERIOD (AOP 1060)" },
  { num: 70, label: "XXIX RAZLIKA ZA UPLATU/POVRAĆAJ (AOP 1061)" },
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

  // CR4-07: Use line 62 (AOP 1056 — oporeziva dobit) instead of line 33
  const taxBase = Math.max(0, getFinal(62));
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
                const isHeader = !!(line as any).isHeader;
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
