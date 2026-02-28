import React, { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useLegalEntities } from "@/hooks/useLegalEntities";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ExportButton } from "@/components/ExportButton";
import { PrintButton } from "@/components/PrintButton";
import { DownloadPdfButton } from "@/components/DownloadPdfButton";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Scale, FileDown } from "lucide-react";
import { fmtNum } from "@/lib/utils";

// Serbian account class names — all 10 classes
const ACCOUNT_CLASSES: Record<string, { name: string; nameSr: string }> = {
  "0": { name: "Stalna imovina", nameSr: "Стална имовина" },
  "1": { name: "Zalihe i kratkotrajna imovina", nameSr: "Залихе и краткотрајна имовина" },
  "2": { name: "Kratkoročne obaveze i finansijski računi", nameSr: "Краткорочне обавезе и финансијски рачуни" },
  "3": { name: "Kapital", nameSr: "Капитал" },
  "4": { name: "Dugoročne obaveze i rezervisanja", nameSr: "Дугорочне обавезе и резервисања" },
  "5": { name: "Rashodi", nameSr: "Расходи" },
  "6": { name: "Prihodi", nameSr: "Приходи" },
  "7": { name: "Otvaranje i zaključak računa", nameSr: "Отварање и закључак рачуна" },
  "8": { name: "Vanbilansna evidencija", nameSr: "Ванбилансна евиденција" },
  "9": { name: "Obračun troškova i učinaka", nameSr: "Обрачун трошкова и учинака" },
};

export default function BilansStanja() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { entities: legalEntities } = useLegalEntities();
  const { toast } = useToast();
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split("T")[0]);
  const [legalEntityId, setLegalEntityId] = useState<string>("");
  const [aprExporting, setAprExporting] = useState(false);

  const handleAprXmlExport = async () => {
    setAprExporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-apr-xml", {
        body: { tenant_id: tenantId, report_type: "bilans_stanja", year: new Date(asOfDate).getFullYear(), legal_entity_id: legalEntityId || null },
      });
      if (error) throw error;
      const blob = new Blob([data.xml], { type: "application/xml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = data.filename; a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast({ title: "Greška", description: e.message, variant: "destructive" });
    } finally { setAprExporting(false); }
  };

  const { data: lines = [], isLoading } = useQuery({
    queryKey: ["bilans_stanja", tenantId, asOfDate, legalEntityId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase.rpc("get_bilans_stanja" as any, {
        p_tenant_id: tenantId,
        p_as_of_date: asOfDate,
        p_legal_entity_id: legalEntityId || null,
      });
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!tenantId,
  });

  const { data: totals } = useQuery({
    queryKey: ["bilans_stanja_totals", tenantId, asOfDate, legalEntityId],
    queryFn: async () => {
      if (!tenantId) return null;
      const { data, error } = await supabase.rpc("get_bilans_stanja_totals" as any, {
        p_tenant_id: tenantId,
        p_as_of_date: asOfDate,
        p_legal_entity_id: legalEntityId || null,
      });
      if (error) throw error;
      return (data && (data as any[])[0]) || null;
    },
    enabled: !!tenantId,
  });

  // Group by class
  const linesByClass = lines.reduce((acc, line) => {
    const cls = line.account_class || "0";
    if (!acc[cls]) acc[cls] = [];
    acc[cls].push(line);
    return acc;
  }, {} as Record<string, any[]>);

  // Group by section within class
  const groupBySection = (classLines: any[]) => {
    return classLines.reduce((acc, line) => {
      const section = line.section || line.account_code.substring(0, 2);
      if (!acc[section]) acc[section] = [];
      acc[section].push(line);
      return acc;
    }, {} as Record<string, any[]>);
  };

  const renderClassSection = (classCode: string, classLines: any[]) => {
    const sections = groupBySection(classLines);
    const classInfo = ACCOUNT_CLASSES[classCode] || { name: `Klasa ${classCode}`, nameSr: `Класа ${classCode}` };
    const classTotal = classLines.reduce((s, l) => s + Number(l.balance), 0);

    return (
      <Card key={classCode}>
        <CardHeader>
          <CardTitle className="text-lg font-bold">
            Класа {classCode}: {classInfo.nameSr} ({classInfo.name})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Konto</TableHead>
                <TableHead>Naziv računa</TableHead>
                <TableHead className="text-right w-[150px]">Saldo (RSD)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.keys(sections)
                .sort()
                .map((section) => (
                  <React.Fragment key={section}>
                    <TableRow className="bg-muted/30">
                      <TableCell colSpan={3} className="font-semibold">
                        Sekcija {section}
                      </TableCell>
                    </TableRow>
                    {sections[section].map((line: any) => (
                      <TableRow key={line.account_code}>
                        <TableCell className="font-mono text-sm">{line.account_code}</TableCell>
                        <TableCell>{line.account_name_sr || line.account_name}</TableCell>
                        <TableCell className="text-right font-mono">
                          {fmtNum(Number(line.balance))}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/20">
                      <TableCell colSpan={2} className="font-semibold text-right">
                        Укупно секција {section}:
                      </TableCell>
                      <TableCell className="text-right font-bold font-mono">
                        {fmtNum(sections[section].reduce((s: number, l: any) => s + Number(l.balance), 0))}
                      </TableCell>
                    </TableRow>
                  </React.Fragment>
                ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={2} className="font-bold text-lg">
                  Укупно класа {classCode}:
                </TableCell>
                <TableCell className="text-right font-bold text-lg font-mono">
                  {fmtNum(classTotal)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>
    );
  };

  // Bug 3 fix: correct grouping — assets=0,1; equity=3; liabilities=2,4
  const assets = ["0", "1", "2"].map((cls) => linesByClass[cls] || []).flat();
  const equity = linesByClass["3"] || [];
  const liabilities = ["4"].map((cls) => linesByClass[cls] || []).flat();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bilans stanja"
        description="Извештај о финансијском стању према српским рачуноводственим стандардима"
        icon={Scale}
        actions={
          <div className="flex gap-2 print:hidden">
            <ExportButton
              data={lines.map((l) => ({
                code: l.account_code,
                name: l.account_name_sr || l.account_name,
                class: l.account_class,
                section: l.section,
                type: l.account_type,
                balance: l.balance,
              }))}
              columns={[
                { key: "code", label: "Konto" },
                { key: "name", label: "Naziv" },
                { key: "class", label: "Klasa" },
                { key: "section", label: "Sekcija" },
                { key: "type", label: "Tip" },
                { key: "balance", label: "Saldo", formatter: (v) => fmtNum(Number(v)) },
              ]}
              filename="bilans_stanja"
            />
            <DownloadPdfButton
              type="bilans_stanja"
              params={{
                tenant_id: tenantId,
                as_of_date: asOfDate,
                legal_entity_id: legalEntityId || null,
              }}
            />
            <Button variant="outline" size="sm" onClick={handleAprXmlExport} disabled={aprExporting}>
              <FileDown className="h-4 w-4 mr-2" />APR XML
            </Button>
            <PrintButton />
          </div>
        }
      />

      <div className="flex flex-wrap gap-4 print:hidden">
        <div>
          <Label>{t("legalEntity")}</Label>
          <Select value={legalEntityId} onValueChange={setLegalEntityId}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder={t("allLegalEntities")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">{t("allLegalEntities")}</SelectItem>
              {legalEntities.map((le) => (
                <SelectItem key={le.id} value={le.id}>
                  {le.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>{t("asOfDate")}</Label>
          <Input type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} />
        </div>
      </div>

      {isLoading ? (
        <p>{t("loading")}</p>
      ) : (
        <div className="space-y-6">
          {/* Assets */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold">АКТИВА (Aktiva)</h2>
            {["0", "1", "2"].map((cls) => linesByClass[cls] && renderClassSection(cls, linesByClass[cls]))}
            <Card>
              <CardContent className="p-4 bg-primary/5">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-lg">УКУПНО АКТИВА:</span>
                  <span className="font-bold text-lg font-mono">
                    {fmtNum(totals?.total_assets || 0)}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Liabilities and Equity */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold">ПАСИВА (Pasiva)</h2>
            {["3", "4"].map((cls) => linesByClass[cls] && renderClassSection(cls, linesByClass[cls]))}
            <Card>
              <CardContent className="p-4 bg-primary/5">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-lg">УКУПНО ПАСИВА:</span>
                  <span className="font-bold text-lg font-mono">
                    {fmtNum((totals?.total_liabilities || 0) + (totals?.total_equity || 0))}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Balance Validation */}
          <Card>
            <CardContent className="p-6 flex items-center justify-between">
              <span className="font-bold text-lg">Актива = Пасива</span>
              <div className="flex items-center gap-3">
                <span className="text-xl font-mono">
                  {fmtNum(totals?.total_assets || 0)} ={" "}
                  {fmtNum((totals?.total_liabilities || 0) + (totals?.total_equity || 0))}
                </span>
                <Badge variant={totals?.is_balanced ? "default" : "destructive"}>
                  {totals?.is_balanced ? "Уравнотежено" : "Неуравнотежено"}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
