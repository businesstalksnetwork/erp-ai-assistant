import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useLanguage } from "@/i18n/LanguageContext";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { FileSpreadsheet, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

export default function PPPPO() {
  const { tenantId } = useTenant();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [year, setYear] = useState(String(currentYear - 1));
  const tl = (key: string) => (t as any)(key) || key;

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["ppppo", tenantId, year],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data: runs } = await supabase
        .from("payroll_runs")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("period_year", Number(year))
        .eq("status", "approved");
      if (!runs || runs.length === 0) return [];

      const runIds = runs.map((r: any) => r.id);
      const { data: payrollItems, error } = await supabase
        .from("payroll_items")
        .select("employee_id, gross_salary, net_salary, income_tax, pension_contribution, health_contribution, unemployment_contribution, municipal_tax, employees(first_name, last_name, jmbg)")
        .in("payroll_run_id", runIds);
      if (error) throw error;

      const map = new Map<string, any>();
      for (const pi of (payrollItems || [])) {
        const emp = pi.employee_id;
        if (!map.has(emp)) {
          map.set(emp, {
            employee_id: emp,
            name: (pi as any).employees ? `${(pi as any).employees.last_name} ${(pi as any).employees.first_name}` : emp,
            jmbg: (pi as any).employees?.jmbg || "",
            gross: 0, net: 0, tax: 0, pio: 0, health: 0, unemployment: 0, municipal: 0,
          });
        }
        const row = map.get(emp)!;
        row.gross += Number(pi.gross_salary) || 0;
        row.net += Number(pi.net_salary) || 0;
        row.tax += Number(pi.income_tax) || 0;
        row.pio += Number(pi.pension_contribution) || 0;
        row.health += Number(pi.health_contribution) || 0;
        row.unemployment += Number(pi.unemployment_contribution) || 0;
        row.municipal += Number(pi.municipal_tax) || 0;
      }
      return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
    },
    enabled: !!tenantId,
  });

  const totals = useMemo(() => items.reduce((s, r) => ({
    gross: s.gross + r.gross, net: s.net + r.net, tax: s.tax + r.tax,
    pio: s.pio + r.pio, health: s.health + r.health, unemployment: s.unemployment + r.unemployment,
    municipal: s.municipal + r.municipal,
  }), { gross: 0, net: 0, tax: 0, pio: 0, health: 0, unemployment: 0, municipal: 0 }), [items]);

  const fmtNum = (n: number) => n.toLocaleString("sr-RS", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const generateXml = () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<PPP-PO xmlns="urn:poreska-uprava:ppp-po" Godina="${year}">
  <PodaciOIsplatiocu>
    <PIB></PIB>
    <Naziv></Naziv>
  </PodaciOIsplatiocu>
  <PodaciOPrimaocima>
${items.map((r, i) => `    <Primalac RedniBroj="${i + 1}">
      <JMBG>${r.jmbg}</JMBG>
      <ImePrezime>${r.name}</ImePrezime>
      <BrutoDohodak>${r.gross.toFixed(2)}</BrutoDohodak>
      <Porez>${r.tax.toFixed(2)}</Porez>
      <PIO>${r.pio.toFixed(2)}</PIO>
      <Zdravstvo>${r.health.toFixed(2)}</Zdravstvo>
      <Nezaposlenost>${r.unemployment.toFixed(2)}</Nezaposlenost>
    </Primalac>`).join("\n")}
  </PodaciOPrimaocima>
</PPP-PO>`;
    const blob = new Blob([xml], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `PPP-PO-${year}.xml`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: t("exportSuccess") });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <FileSpreadsheet className="h-7 w-7 text-primary" />
        <h1 className="text-2xl font-bold">{tl("ppppo")}</h1>
      </div>

      <div className="flex flex-wrap gap-4 items-end">
        <div>
          <Label>{t("year")}</Label>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" size="sm" onClick={generateXml} disabled={items.length === 0}>
          <Download className="h-4 w-4 mr-2" />XML
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">Rb</TableHead>
                <TableHead>JMBG</TableHead>
                <TableHead>{t("employee")}</TableHead>
                <TableHead className="text-right">Bruto</TableHead>
                <TableHead className="text-right">Porez</TableHead>
                <TableHead className="text-right">PIO</TableHead>
                <TableHead className="text-right">Zdravstvo</TableHead>
                <TableHead className="text-right">Nezaposlenost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8">{t("loading")}...</TableCell></TableRow>
              ) : items.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">{t("noDataToExport")}</TableCell></TableRow>
              ) : items.map((r, i) => (
                <TableRow key={r.employee_id}>
                  <TableCell className="font-mono">{i + 1}</TableCell>
                  <TableCell className="font-mono">{r.jmbg}</TableCell>
                  <TableCell>{r.name}</TableCell>
                  <TableCell className="text-right font-mono">{fmtNum(r.gross)}</TableCell>
                  <TableCell className="text-right font-mono">{fmtNum(r.tax)}</TableCell>
                  <TableCell className="text-right font-mono">{fmtNum(r.pio)}</TableCell>
                  <TableCell className="text-right font-mono">{fmtNum(r.health)}</TableCell>
                  <TableCell className="text-right font-mono">{fmtNum(r.unemployment)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            {items.length > 0 && (
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={3} className="text-right font-bold">{t("total")}:</TableCell>
                  <TableCell className="text-right font-mono font-bold">{fmtNum(totals.gross)}</TableCell>
                  <TableCell className="text-right font-mono font-bold">{fmtNum(totals.tax)}</TableCell>
                  <TableCell className="text-right font-mono font-bold">{fmtNum(totals.pio)}</TableCell>
                  <TableCell className="text-right font-mono font-bold">{fmtNum(totals.health)}</TableCell>
                  <TableCell className="text-right font-mono font-bold">{fmtNum(totals.unemployment)}</TableCell>
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
