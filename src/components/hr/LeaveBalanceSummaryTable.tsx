import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Download } from "lucide-react";
import * as XLSX from "xlsx";

export default function LeaveBalanceSummaryTable({ year }: { year: number }) {
  const { locale } = useLanguage();
  const { tenantId } = useTenant();
  const sr = locale === "sr";

  const { data: balances = [], isLoading } = useQuery({
    queryKey: ["leave-balance-summary", tenantId, year],
    queryFn: async () => {
      const { data } = await supabase
        .from("annual_leave_balances")
        .select("*, employees!inner(first_name, last_name, department_id, departments(name))")
        .eq("tenant_id", tenantId!)
        .eq("year", year)
        .order("employees(last_name)");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const exportToExcel = () => {
    const rows = balances.map((b: any) => ({
      [sr ? "Zaposleni" : "Employee"]: `${b.employees?.first_name} ${b.employees?.last_name}`,
      [sr ? "Odeljenje" : "Department"]: b.employees?.departments?.name || "-",
      [sr ? "Pravo" : "Entitled"]: b.entitled_days,
      [sr ? "Preneseno" : "Carried Over"]: b.carried_over_days,
      [sr ? "Iskorišćeno" : "Used"]: b.used_days,
      [sr ? "Na čekanju" : "Pending"]: b.pending_days,
      [sr ? "Preostalo" : "Remaining"]: b.entitled_days + b.carried_over_days - b.used_days - b.pending_days,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Leave Balances");
    XLSX.writeFile(wb, `leave-balances-${year}.xlsx`);
  };

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center justify-between">
          {sr ? `Stanja godišnjih odmora ${year}` : `Leave Balances ${year}`}
          <Button size="sm" variant="outline" onClick={exportToExcel}><Download className="h-4 w-4 mr-1" />{sr ? "Excel" : "Export"}</Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{sr ? "Zaposleni" : "Employee"}</TableHead>
              <TableHead>{sr ? "Odeljenje" : "Department"}</TableHead>
              <TableHead className="text-right">{sr ? "Pravo" : "Entitled"}</TableHead>
              <TableHead className="text-right">{sr ? "Preneseno" : "Carried"}</TableHead>
              <TableHead className="text-right">{sr ? "Iskorišćeno" : "Used"}</TableHead>
              <TableHead className="text-right">{sr ? "Na čekanju" : "Pending"}</TableHead>
              <TableHead className="text-right">{sr ? "Preostalo" : "Remaining"}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {balances.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">{sr ? "Nema podataka" : "No data"}</TableCell></TableRow>
            ) : balances.map((b: any) => {
              const remaining = b.entitled_days + b.carried_over_days - b.used_days - b.pending_days;
              return (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">{b.employees?.first_name} {b.employees?.last_name}</TableCell>
                  <TableCell>{b.employees?.departments?.name || "—"}</TableCell>
                  <TableCell className="text-right">{b.entitled_days}</TableCell>
                  <TableCell className="text-right">{b.carried_over_days}</TableCell>
                  <TableCell className="text-right">{b.used_days}</TableCell>
                  <TableCell className="text-right">{b.pending_days > 0 ? <Badge variant="outline">{b.pending_days}</Badge> : 0}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant={remaining <= 3 ? "destructive" : remaining <= 10 ? "secondary" : "default"}>{remaining}</Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
