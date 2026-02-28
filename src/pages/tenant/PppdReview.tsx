import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Download, FileText, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

export default function PppdReview() {
  const { tenantId } = useTenant();
  const [selectedRunId, setSelectedRunId] = useState<string>("");

  const { data: payrollRuns = [] } = useQuery({
    queryKey: ["payroll-runs-for-pppd", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("payroll_runs")
        .select("id, run_name, period_month, period_year, status")
        .eq("tenant_id", tenantId)
        .in("status", ["paid", "approved"])
        .order("period_year", { ascending: false })
        .order("period_month", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["pppd-items", selectedRunId],
    queryFn: async () => {
      if (!selectedRunId) return [];
      const { data, error } = await supabase
        .from("payroll_items")
        .select(`
          id, employee_id, gross_salary, net_salary, tax_amount,
          pio_employee, pio_employer, health_employee, health_employer,
          unemployment_employee, unemployment_employer,
          ovp_code, ola_code, ben_code,
          employees(first_name, last_name, jmbg)
        `)
        .eq("payroll_run_id", selectedRunId)
        .order("created_at");
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedRunId,
  });

  const totalGross = items.reduce((s: number, i: any) => s + Number(i.gross_salary || 0), 0);
  const totalTax = items.reduce((s: number, i: any) => s + Number(i.tax_amount || 0), 0);
  const totalPio = items.reduce((s: number, i: any) => s + Number(i.pio_employee || 0) + Number(i.pio_employer || 0), 0);
  const totalHealth = items.reduce((s: number, i: any) => s + Number(i.health_employee || 0) + Number(i.health_employer || 0), 0);

  // Bug 7: OVP/OLA/BEN validation
  const validationIssues = useMemo(() => {
    const missingOvp = items.filter((i: any) => !i.ovp_code);
    const missingOla = items.filter((i: any) => !i.ola_code);
    const missingBen = items.filter((i: any) => !i.ben_code);
    return { missingOvp, missingOla, missingBen, hasIssues: missingOvp.length > 0 || missingOla.length > 0 || missingBen.length > 0 };
  }, [items]);

  const [xmlWarnings, setXmlWarnings] = useState<string[]>([]);

  const handleExportXml = async () => {
    if (!selectedRunId) return;
    const { data, error } = await supabase.functions.invoke("generate-pppd-xml", {
      body: { payroll_run_id: selectedRunId, tenant_id: tenantId },
    });
    if (error) {
      console.error(error);
      return;
    }
    const xmlContent = typeof data === "string" ? data : data?.xml || "";
    if (data?.warnings?.length) setXmlWarnings(data.warnings);
    const blob = new Blob([xmlContent], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `PPP-PD_${selectedRunId.slice(0, 8)}.xml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader
        title="PPP-PD Poreska prijava"
        description="Pregled i generisanje PPP-PD XML prijave za e-Porezi portal"
      />

      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div className="w-full sm:w-80">
          <Select value={selectedRunId} onValueChange={setSelectedRunId}>
            <SelectTrigger>
              <SelectValue placeholder="Izaberite obračunski period" />
            </SelectTrigger>
            <SelectContent>
              {payrollRuns.map((r: any) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.run_name || `${r.period_month}/${r.period_year}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {selectedRunId && items.length > 0 && (
          <Button onClick={handleExportXml}>
            <Download className="h-4 w-4 mr-2" /> Generiši XML
          </Button>
        )}
      </div>

      {/* Bug 7: Validation banner for missing OVP/OLA/BEN codes */}
      {selectedRunId && items.length > 0 && validationIssues.hasIssues && (
        <Card className="border-warning/50 bg-warning/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-warning mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="text-sm font-medium">Nedostaju obavezni kodovi za PPP-PD prijavu</p>
                <ul className="text-xs text-muted-foreground space-y-0.5 list-disc list-inside">
                  {validationIssues.missingOvp.length > 0 && (
                    <li>OVP (vrsta prihoda) nedostaje za {validationIssues.missingOvp.length} zaposlenih</li>
                  )}
                  {validationIssues.missingOla.length > 0 && (
                    <li>OLA kod nedostaje za {validationIssues.missingOla.length} zaposlenih</li>
                  )}
                  {validationIssues.missingBen.length > 0 && (
                    <li>BEN kod nedostaje za {validationIssues.missingBen.length} zaposlenih</li>
                  )}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {xmlWarnings.length > 0 && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-3">
            <p className="text-sm font-medium text-destructive mb-1">Upozorenja ({xmlWarnings.length})</p>
            <ul className="text-xs text-destructive/80 space-y-0.5 list-disc list-inside">
              {xmlWarnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </CardContent>
        </Card>
      )}

      {selectedRunId && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground">Ukupno bruto</p>
              <p className="text-lg font-bold">{totalGross.toLocaleString("sr-RS")} RSD</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground">Porez</p>
              <p className="text-lg font-bold">{totalTax.toLocaleString("sr-RS")} RSD</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground">PIO (ukupno)</p>
              <p className="text-lg font-bold">{totalPio.toLocaleString("sr-RS")} RSD</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground">Zdravstvo (ukupno)</p>
              <p className="text-lg font-bold">{totalHealth.toLocaleString("sr-RS")} RSD</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" /> Stavke prijave
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!selectedRunId ? (
            <p className="text-muted-foreground text-sm">Izaberite obračunski period za prikaz.</p>
          ) : isLoading ? (
            <p className="text-muted-foreground text-sm">Učitavanje...</p>
          ) : items.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nema stavki za izabrani period.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Zaposleni</TableHead>
                  <TableHead>JMBG</TableHead>
                  <TableHead>OVP</TableHead>
                  <TableHead className="text-right">Bruto</TableHead>
                  <TableHead className="text-right">Porez</TableHead>
                  <TableHead className="text-right">PIO</TableHead>
                  <TableHead className="text-right">Zdrav.</TableHead>
                  <TableHead className="text-right">Neto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item: any) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">
                      {(item.employees as any)?.first_name} {(item.employees as any)?.last_name}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{(item.employees as any)?.jmbg || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={item.ovp_code ? "outline" : "destructive"}>{item.ovp_code || "—"}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{Number(item.gross_salary || 0).toLocaleString("sr-RS")}</TableCell>
                    <TableCell className="text-right">{Number(item.tax_amount || 0).toLocaleString("sr-RS")}</TableCell>
                    <TableCell className="text-right">{(Number(item.pio_employee || 0) + Number(item.pio_employer || 0)).toLocaleString("sr-RS")}</TableCell>
                    <TableCell className="text-right">{(Number(item.health_employee || 0) + Number(item.health_employer || 0)).toLocaleString("sr-RS")}</TableCell>
                    <TableCell className="text-right font-semibold">{Number(item.net_salary || 0).toLocaleString("sr-RS")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
