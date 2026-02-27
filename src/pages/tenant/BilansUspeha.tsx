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
import { TrendingUp, FileDown } from "lucide-react";
import { fmtNum } from "@/lib/utils";

// Serbian account class names
const ACCOUNT_CLASSES: Record<string, { name: string; nameSr: string }> = {
  "5": { name: "Rashodi", nameSr: "Расходи" },
  "6": { name: "Prihodi", nameSr: "Приходи" },
  "7": { name: "Otvaranje i zaključak", nameSr: "Отварање и закључак" },
  "8": { name: "Vanredni rashodi", nameSr: "Ванредни расходи" },
};

export default function BilansUspeha() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { entities: legalEntities } = useLegalEntities();
  const [dateFrom, setDateFrom] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0]);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split("T")[0]);
  const [legalEntityId, setLegalEntityId] = useState<string>("");
  const { toast } = useToast();
  const [aprExporting, setAprExporting] = useState(false);

  const handleAprXmlExport = async () => {
    setAprExporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-apr-xml", {
        body: { tenant_id: tenantId, report_type: "bilans_uspeha", year: new Date(dateTo).getFullYear(), legal_entity_id: legalEntityId || null },
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
    queryKey: ["bilans_uspeha", tenantId, dateFrom, dateTo, legalEntityId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase.rpc("get_bilans_uspeha" as any, {
        p_tenant_id: tenantId,
        p_date_from: dateFrom,
        p_date_to: dateTo,
        p_legal_entity_id: legalEntityId || null,
      });
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!tenantId,
  });

  const { data: totals } = useQuery({
    queryKey: ["bilans_uspeha_totals", tenantId, dateFrom, dateTo, legalEntityId],
    queryFn: async () => {
      if (!tenantId) return null;
      const { data, error } = await supabase.rpc("get_bilans_uspeha_totals" as any, {
        p_tenant_id: tenantId,
        p_date_from: dateFrom,
        p_date_to: dateTo,
        p_legal_entity_id: legalEntityId || null,
      });
      if (error) throw error;
      return (data && data[0]) || null;
    },
    enabled: !!tenantId,
  });

  const revenueLines = lines.filter((l) => l.account_class === "6");
  const expenseLines = lines.filter((l) => l.account_class === "5");

  // Group by section
  const revenueBySection = revenueLines.reduce((acc, line) => {
    const section = line.section || "50";
    if (!acc[section]) acc[section] = [];
    acc[section].push(line);
    return acc;
  }, {} as Record<string, any[]>);

  const expenseBySection = expenseLines.reduce((acc, line) => {
    const section = line.section || "60";
    if (!acc[section]) acc[section] = [];
    acc[section].push(line);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bilans uspeha"
        description="Извештај о приходима и расходима према српским рачуноводственим стандардима"
        icon={TrendingUp}
        actions={
          <div className="flex gap-2 print:hidden">
            <ExportButton
              data={lines.map((l) => ({
                code: l.account_code,
                name: l.account_name_sr || l.account_name,
                class: l.account_class,
                section: l.section,
                amount: l.amount,
              }))}
              columns={[
                { key: "code", label: "Konto" },
                { key: "name", label: "Naziv" },
                { key: "class", label: "Klasa" },
                { key: "section", label: "Sekcija" },
                { key: "amount", label: "Iznos", formatter: (v) => fmtNum(Number(v)) },
              ]}
              filename="bilans_uspeha"
            />
            <DownloadPdfButton
              type="bilans_uspeha"
              params={{
                tenant_id: tenantId,
                date_from: dateFrom,
                date_to: dateTo,
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
          <Label>{t("startDate")}</Label>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div>
          <Label>{t("endDate")}</Label>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
      </div>

      {isLoading ? (
        <p>{t("loading")}</p>
      ) : (
        <div className="space-y-6">
          {/* Prihodi (Revenue) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-bold">Класа 6: Приходи (Prihodi)</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Konto</TableHead>
                    <TableHead>Naziv računa</TableHead>
                    <TableHead className="text-right w-[150px]">Iznos (RSD)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.keys(revenueBySection)
                    .sort()
                    .map((section) => (
                      <React.Fragment key={section}>
                        <TableRow className="bg-muted/30">
                          <TableCell colSpan={3} className="font-semibold">
                            Sekcija {section}
                          </TableCell>
                        </TableRow>
                        {revenueBySection[section].map((line: any) => (
                          <TableRow key={line.account_code}>
                            <TableCell className="font-mono text-sm">{line.account_code}</TableCell>
                            <TableCell>{line.account_name_sr || line.account_name}</TableCell>
                            <TableCell className="text-right font-mono">
                              {fmtNum(Number(line.amount))}
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-muted/20">
                          <TableCell colSpan={2} className="font-semibold text-right">
                            Укупно секција {section}:
                          </TableCell>
                          <TableCell className="text-right font-bold font-mono">
                            {fmtNum(
                              revenueBySection[section].reduce((s: number, l: any) => s + Number(l.amount), 0)
                            )}
                          </TableCell>
                        </TableRow>
                      </React.Fragment>
                    ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={2} className="font-bold text-lg">
                      Укупно приходи:
                    </TableCell>
                    <TableCell className="text-right font-bold text-lg font-mono">
                      {fmtNum(totals?.total_revenue || 0)}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </CardContent>
          </Card>

          {/* Rashodi (Expenses) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-bold">Класа 5: Расходи (Rashodi)</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Konto</TableHead>
                    <TableHead>Naziv računa</TableHead>
                    <TableHead className="text-right w-[150px]">Iznos (RSD)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.keys(expenseBySection)
                    .sort()
                    .map((section) => (
                      <React.Fragment key={section}>
                        <TableRow className="bg-muted/30">
                          <TableCell colSpan={3} className="font-semibold">
                            Sekcija {section}
                          </TableCell>
                        </TableRow>
                        {expenseBySection[section].map((line: any) => (
                          <TableRow key={line.account_code}>
                            <TableCell className="font-mono text-sm">{line.account_code}</TableCell>
                            <TableCell>{line.account_name_sr || line.account_name}</TableCell>
                            <TableCell className="text-right font-mono">
                              {fmtNum(Number(line.amount))}
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-muted/20">
                          <TableCell colSpan={2} className="font-semibold text-right">
                            Укупно секција {section}:
                          </TableCell>
                          <TableCell className="text-right font-bold font-mono">
                            {fmtNum(
                              expenseBySection[section].reduce((s: number, l: any) => s + Number(l.amount), 0)
                            )}
                          </TableCell>
                        </TableRow>
                      </React.Fragment>
                    ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={2} className="font-bold text-lg">
                      Укупно расходи:
                    </TableCell>
                    <TableCell className="text-right font-bold text-lg font-mono">
                      {fmtNum(totals?.total_expenses || 0)}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </CardContent>
          </Card>

          {/* Net Income */}
          <Card>
            <CardContent className="p-6 flex items-center justify-between">
              <span className="text-xl font-bold">Нето резултат (Net Income):</span>
              <div className="flex items-center gap-3">
                <span className="text-2xl font-bold font-mono">
                  {fmtNum(totals?.net_income || 0)}
                </span>
                <Badge variant={totals && totals.net_income >= 0 ? "default" : "destructive"}>
                  {totals && totals.net_income >= 0 ? "Профит" : "Губитак"}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
