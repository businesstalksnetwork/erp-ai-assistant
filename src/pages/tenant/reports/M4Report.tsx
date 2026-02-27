import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useLanguage } from "@/i18n/LanguageContext";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Download, FileText, RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function M4Report() {
  const { tenantId } = useTenant();
  const { t } = useLanguage();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [year, setYear] = useState(new Date().getFullYear() - 1);

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["m4-reports", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("m4_reports").select("*").eq("tenant_id", tenantId!).order("report_year", { ascending: false });
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Find existing report for selected year
  const currentReport = reports.find((r: any) => r.report_year === year);
  const employeeData: any[] = Array.isArray(currentReport?.generated_data) ? currentReport.generated_data as any[] : [];

  const generateMut = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("generate-m4-xml", {
        body: { tenant_id: tenantId, report_year: year, report_id: currentReport?.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      toast({ title: "M4 izveštaj generisan" });
      qc.invalidateQueries({ queryKey: ["m4-reports"] });
      if (data?.xml) {
        const blob = new Blob([data.xml], { type: "application/xml" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `M4_${year}.xml`;
        a.click();
        URL.revokeObjectURL(url);
      }
    },
    onError: (e: any) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const totalPioBase = employeeData.reduce((s: number, e: any) => s + (e.pio_base || 0), 0);
  const totalPioEmp = employeeData.reduce((s: number, e: any) => s + (e.pio_employee || 0), 0);
  const totalPioEr = employeeData.reduce((s: number, e: any) => s + (e.pio_employer || 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader title="M4 — Godišnji PIO izveštaj" description="Agregacija PIO doprinosa po zaposlenom za prijavu Fondu PIO" />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Generiši izveštaj</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-4">
            <div>
              <Label>Godina</Label>
              <Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-32" />
            </div>
            <Button onClick={() => generateMut.mutate()} disabled={generateMut.isPending}>
              {generateMut.isPending ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
              {currentReport ? "Ponovo generiši" : "Generiši M4"}
            </Button>
            {currentReport?.xml_data && (
              <Button variant="outline" onClick={() => {
                const blob = new Blob([currentReport.xml_data!], { type: "application/xml" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `M4_${year}.xml`;
                a.click();
                URL.revokeObjectURL(url);
              }}>
                <Download className="h-4 w-4 mr-2" /> Preuzmi XML
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {employeeData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pregled po zaposlenima — {year}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Zaposleni</TableHead>
                    <TableHead>JMBG</TableHead>
                    <TableHead className="text-right">Meseci</TableHead>
                    <TableHead className="text-right">Osnovica PIO</TableHead>
                    <TableHead className="text-right">PIO zaposleni</TableHead>
                    <TableHead className="text-right">PIO poslodavac</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employeeData.map((emp: any, idx: number) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{emp.full_name}</TableCell>
                      <TableCell className="font-mono text-xs">{emp.jmbg}</TableCell>
                      <TableCell className="text-right">{emp.months_worked}</TableCell>
                      <TableCell className="text-right">{Number(emp.pio_base).toLocaleString("sr-RS", { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-right">{Number(emp.pio_employee).toLocaleString("sr-RS", { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-right">{Number(emp.pio_employer).toLocaleString("sr-RS", { minimumFractionDigits: 2 })}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-semibold bg-muted/50">
                    <TableCell colSpan={3}>Ukupno ({employeeData.length} zaposlenih)</TableCell>
                    <TableCell className="text-right">{totalPioBase.toLocaleString("sr-RS", { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right">{totalPioEmp.toLocaleString("sr-RS", { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right">{totalPioEr.toLocaleString("sr-RS", { minimumFractionDigits: 2 })}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Previous reports */}
      {reports.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Prethodni izveštaji</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Godina</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Kreirano</TableHead>
                  <TableHead className="text-right">Akcije</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.report_year}</TableCell>
                    <TableCell><Badge variant={r.status === "generated" ? "default" : "secondary"}>{r.status}</Badge></TableCell>
                    <TableCell>{new Date(r.created_at).toLocaleDateString("sr-RS")}</TableCell>
                    <TableCell className="text-right">
                      {r.xml_data && (
                        <Button size="sm" variant="outline" onClick={() => {
                          const blob = new Blob([r.xml_data], { type: "application/xml" });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = `M4_${r.report_year}.xml`;
                          a.click();
                          URL.revokeObjectURL(url);
                        }}>
                          <Download className="h-3 w-3 mr-1" /> XML
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
