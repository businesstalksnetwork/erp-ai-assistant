import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useLanguage } from "@/i18n/LanguageContext";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Download, Shield, UserCheck } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function EmployeeDataExport() {
  const { tenantId } = useTenant();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [exporting, setExporting] = useState(false);

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ["employees-export", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("employees")
        .select("id, full_name, jmbg, status")
        .eq("tenant_id", tenantId!)
        .order("full_name");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const exportData = async (format: "json" | "csv") => {
    if (!selectedEmployee || !tenantId) return;
    setExporting(true);

    try {
      // Fetch employee personal data
      const { data: employee } = await supabase
        .from("employees")
        .select("*")
        .eq("id", selectedEmployee)
        .single();
      if (!employee) throw new Error("Employee not found");

      // Fetch related data
      const [
        { data: attendance },
        { data: leaveRequests },
        { data: allowances },
        { data: payrollItems },
      ] = await Promise.all([
        supabase.from("attendance_records").select("*").eq("employee_id", selectedEmployee).eq("tenant_id", tenantId),
        supabase.from("leave_requests").select("*").eq("employee_id", selectedEmployee).eq("tenant_id", tenantId),
        supabase.from("allowances").select("*").eq("employee_id", selectedEmployee).eq("tenant_id", tenantId),
        supabase.from("payroll_items").select("*").eq("employee_id", selectedEmployee),
      ]);

      const exportPayload = {
        export_date: new Date().toISOString(),
        purpose: "PDPA Data Portability Request",
        personal_data: {
          full_name: employee.full_name,
          email: employee.email,
          phone: employee.phone,
          jmbg: employee.jmbg,
          address: employee.address,
          city: employee.city,
          bank_account_iban: employee.bank_account_iban,
          start_date: employee.start_date,
          end_date: employee.end_date,
          position: employee.position,
          department_id: employee.department_id,
          status: employee.status,
        },
        attendance_records: attendance || [],
        leave_requests: leaveRequests || [],
        allowances: allowances || [],
        payroll_history: (payrollItems || []).map((p: any) => ({
          payroll_run_id: p.payroll_run_id,
          gross_salary: p.gross_salary,
          net_salary: p.net_salary,
          income_tax: p.income_tax,
          pension_contribution: p.pension_contribution,
          health_contribution: p.health_contribution,
          working_days: p.working_days,
          created_at: p.created_at,
        })),
      };

      if (format === "json") {
        const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `employee_data_${employee.full_name.replace(/\s+/g, "_")}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        // CSV: flatten personal data + payroll
        const rows = [
          ["Field", "Value"],
          ...Object.entries(exportPayload.personal_data).map(([k, v]) => [k, String(v ?? "")]),
          ["", ""],
          ["--- Payroll History ---", ""],
          ["Payroll Run", "Gross", "Net", "Tax", "PIO", "Health", "Days"],
          ...(exportPayload.payroll_history).map((p: any) => [
            p.payroll_run_id, p.gross_salary, p.net_salary, p.income_tax,
            p.pension_contribution, p.health_contribution, p.working_days,
          ].map(String)),
        ];
        const csv = rows.map(r => r.join(",")).join("\n");
        const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `employee_data_${employee.full_name.replace(/\s+/g, "_")}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }

      toast({ title: `Podaci eksportovani (${format.toUpperCase()})` });
    } catch (e: any) {
      toast({ title: t("error"), description: e.message, variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Eksport podataka zaposlenog"
        description="PDPA — Pravo na prenosivost podataka (čl. 36 ZZPL)"
        icon={Shield}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <UserCheck className="h-4 w-4" />
            Izaberite zaposlenog za eksport
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-10" /> : (
            <div className="space-y-4">
              <div className="max-w-md">
                <Label>Zaposleni</Label>
                <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                  <SelectTrigger><SelectValue placeholder="Izaberite zaposlenog..." /></SelectTrigger>
                  <SelectContent>
                    {employees.map((e: any) => (
                      <SelectItem key={e.id} value={e.id}>{e.full_name} {e.jmbg ? `(${e.jmbg.slice(-4)})` : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedEmployee && (
                <div className="flex gap-2">
                  <Button onClick={() => exportData("json")} disabled={exporting}>
                    <Download className="h-4 w-4 mr-2" /> {exporting ? "Eksportovanje..." : "Eksportuj JSON"}
                  </Button>
                  <Button variant="outline" onClick={() => exportData("csv")} disabled={exporting}>
                    <Download className="h-4 w-4 mr-2" /> {exporting ? "Eksportovanje..." : "Eksportuj CSV"}
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4">
          <div className="text-sm text-muted-foreground space-y-2">
            <p><strong>Obuhvaćeni podaci:</strong></p>
            <ul className="list-disc list-inside space-y-1">
              <li>Lični podaci (ime, adresa, JMBG, kontakt)</li>
              <li>Podaci o zaposlenju (pozicija, odeljenje, ugovor)</li>
              <li>Evidencija prisustva</li>
              <li>Zahtevi za odsustvo</li>
              <li>Dodaci (topli obrok, prevoz, itd.)</li>
              <li>Istorija obračuna zarada</li>
            </ul>
            <p className="mt-3 text-xs">
              U skladu sa Zakonom o zaštiti podataka o ličnosti (ZZPL), svako lice ima pravo da dobije kopiju
              svojih ličnih podataka u strukturiranom, uobičajeno korišćenom i mašinski čitljivom obliku.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
