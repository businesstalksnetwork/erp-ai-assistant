import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TableRow, TableCell } from "@/components/ui/table";
import { FileSpreadsheet, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/shared/PageHeader";
import { MobileFilterBar } from "@/components/shared/MobileFilterBar";
import { ResponsiveTable, type ResponsiveColumn } from "@/components/shared/ResponsiveTable";

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

const escapeXml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

interface PPPPORow {
  employee_id: string;
  name: string;
  jmbg: string;
  gross: number;
  net: number;
  tax: number;
  pio: number;
  health: number;
  unemployment: number;
  municipal: number;
}

export default function PPPPO() {
  const { tenantId } = useTenant();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [year, setYear] = useState(String(currentYear - 1));
  const tl = (key: string) => t(key) || key;

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

      const map = new Map<string, PPPPORow>();
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
      <JMBG>${escapeXml(r.jmbg)}</JMBG>
      <ImePrezime>${escapeXml(r.name)}</ImePrezime>
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

  const columns: ResponsiveColumn<PPPPORow>[] = [
    { key: "name", label: t("employee"), primary: true, sortable: true, sortValue: (r) => r.name, render: (r) => r.name },
    { key: "jmbg", label: "JMBG", hideOnMobile: true, render: (r) => <span className="font-mono">{r.jmbg}</span> },
    { key: "gross", label: "Bruto", align: "right", sortable: true, sortValue: (r) => r.gross, render: (r) => <span className="font-mono">{fmtNum(r.gross)}</span> },
    { key: "tax", label: "Porez", align: "right", sortable: true, sortValue: (r) => r.tax, render: (r) => <span className="font-mono">{fmtNum(r.tax)}</span> },
    { key: "pio", label: "PIO", align: "right", hideOnMobile: true, sortable: true, sortValue: (r) => r.pio, render: (r) => <span className="font-mono">{fmtNum(r.pio)}</span> },
    { key: "health", label: "Zdravstvo", align: "right", hideOnMobile: true, sortable: true, sortValue: (r) => r.health, render: (r) => <span className="font-mono">{fmtNum(r.health)}</span> },
    { key: "unemployment", label: "Nezaposlenost", align: "right", defaultVisible: false, sortable: true, sortValue: (r) => r.unemployment, render: (r) => <span className="font-mono">{fmtNum(r.unemployment)}</span> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={tl("ppppo")}
        icon={FileSpreadsheet}
        actions={
          <Button variant="outline" size="sm" onClick={generateXml} disabled={items.length === 0}>
            <Download className="h-4 w-4 mr-2" />XML
          </Button>
        }
      />

      <MobileFilterBar
        filters={
          <div>
            <Label>{t("year")}</Label>
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        }
      />

      <ResponsiveTable
        data={items}
        columns={columns}
        keyExtractor={(r) => r.employee_id}
        emptyMessage={t("noDataToExport")}
        enableExport
        exportFilename={`ppp-po-${year}`}
        enableColumnToggle
        renderFooter={items.length > 0 ? () => (
          <TableRow>
            <TableCell colSpan={2} className="text-right font-bold">{t("total")}:</TableCell>
            <TableCell className="text-right font-mono font-bold">{fmtNum(totals.gross)}</TableCell>
            <TableCell className="text-right font-mono font-bold">{fmtNum(totals.tax)}</TableCell>
            <TableCell className="text-right font-mono font-bold">{fmtNum(totals.pio)}</TableCell>
            <TableCell className="text-right font-mono font-bold">{fmtNum(totals.health)}</TableCell>
            <TableCell className="text-right font-mono font-bold">{fmtNum(totals.unemployment)}</TableCell>
          </TableRow>
        ) : undefined}
      />
    </div>
  );
}
