import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Download, AlertTriangle } from "lucide-react";
import * as XLSX from "xlsx";

// Bradford Factor = S² × D  (S = number of spells, D = total days absent)
function bradfordFactor(spells: number, totalDays: number) {
  return spells * spells * totalDays;
}

function bradfordSeverity(score: number): { label: string; variant: "default" | "secondary" | "destructive" | "outline" } {
  if (score >= 500) return { label: "High", variant: "destructive" };
  if (score >= 200) return { label: "Medium", variant: "secondary" };
  return { label: "Low", variant: "outline" };
}

export default function AbsenteeismReport({ year }: { year: number }) {
  const { locale } = useLanguage();
  const { tenantId } = useTenant();
  const sr = locale === "sr";

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["absenteeism-report", tenantId, year],
    queryFn: async () => {
      const { data } = await supabase
        .from("leave_requests")
        .select("*, employees!inner(first_name, last_name, department_id, departments(name))")
        .eq("tenant_id", tenantId!)
        .eq("status", "approved" as any)
        .gte("start_date", `${year}-01-01`)
        .lte("start_date", `${year}-12-31`)
        .order("start_date");
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Group by employee
  const empMap = new Map<string, { name: string; dept: string; spells: number; totalDays: number; sickDays: number }>();
  requests.forEach((r: any) => {
    const key = r.employee_id;
    const existing = empMap.get(key) || {
      name: `${r.employees?.first_name} ${r.employees?.last_name}`,
      dept: r.employees?.departments?.name || "—",
      spells: 0,
      totalDays: 0,
      sickDays: 0,
    };
    existing.spells++;
    existing.totalDays += r.total_days || 1;
    if (r.leave_type === "sick") existing.sickDays += r.total_days || 1;
    empMap.set(key, existing);
  });

  const employees = Array.from(empMap.entries())
    .map(([id, data]) => ({
      id,
      ...data,
      bradford: bradfordFactor(data.spells, data.totalDays),
    }))
    .sort((a, b) => b.bradford - a.bradford);

  const highRisk = employees.filter(e => e.bradford >= 500);

  const exportToExcel = () => {
    const rows = employees.map(e => ({
      [sr ? "Zaposleni" : "Employee"]: e.name,
      [sr ? "Odeljenje" : "Department"]: e.dept,
      [sr ? "Broj odsustva" : "Absence Spells"]: e.spells,
      [sr ? "Ukupno dana" : "Total Days"]: e.totalDays,
      [sr ? "Bolovanje" : "Sick Days"]: e.sickDays,
      "Bradford Factor": e.bradford,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Absenteeism");
    XLSX.writeFile(wb, `absenteeism-${year}.xlsx`);
  };

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      {highRisk.length > 0 && (
        <Card className="border-destructive/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              {sr ? "Upozorenje: Visok Bradford faktor" : "Warning: High Bradford Factor"}
            </CardTitle>
            <CardDescription>
              {sr
                ? `${highRisk.length} zaposlenih sa Bradford faktorom ≥ 500 zahteva pažnju.`
                : `${highRisk.length} employee(s) with Bradford Factor ≥ 500 require attention.`}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center justify-between">
            {sr ? "Izveštaj o izostancima" : "Absenteeism Report"}
            <Button size="sm" variant="outline" onClick={exportToExcel}><Download className="h-4 w-4 mr-1" />{sr ? "Excel" : "Export"}</Button>
          </CardTitle>
          <CardDescription>
            {sr
              ? "Bradford faktor: S² × D (S = broj odsustva, D = ukupni dani). Veći skor = češći kratki izostanci."
              : "Bradford Factor: S² × D (S = absence spells, D = total days). Higher score = frequent short absences."}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{sr ? "Zaposleni" : "Employee"}</TableHead>
                <TableHead>{sr ? "Odeljenje" : "Department"}</TableHead>
                <TableHead className="text-right">{sr ? "Odsustva" : "Spells"}</TableHead>
                <TableHead className="text-right">{sr ? "Ukupno dana" : "Total Days"}</TableHead>
                <TableHead className="text-right">{sr ? "Bolovanje" : "Sick Days"}</TableHead>
                <TableHead className="text-right">Bradford</TableHead>
                <TableHead>{sr ? "Rizik" : "Risk"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">{sr ? "Nema podataka" : "No data"}</TableCell></TableRow>
              ) : employees.map(e => {
                const severity = bradfordSeverity(e.bradford);
                return (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.name}</TableCell>
                    <TableCell>{e.dept}</TableCell>
                    <TableCell className="text-right">{e.spells}</TableCell>
                    <TableCell className="text-right">{e.totalDays}</TableCell>
                    <TableCell className="text-right">{e.sickDays}</TableCell>
                    <TableCell className="text-right font-mono font-bold">{e.bradford}</TableCell>
                    <TableCell><Badge variant={severity.variant}>{severity.label}</Badge></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
