import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { eachDayOfInterval, format } from "date-fns";

const WORK_LOG_TYPES = ["workday", "weekend", "holiday", "vacation", "sick_leave", "paid_leave", "unpaid_leave", "maternity_leave", "holiday_work", "slava"] as const;

export default function WorkLogsBulkEntry() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-01"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [saving, setSaving] = useState(false);
  const [grid, setGrid] = useState<Record<string, Record<string, string>>>({});

  const { data: employees = [] } = useQuery({
    queryKey: ["employees-active", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("employees").select("id, full_name").eq("tenant_id", tenantId!).eq("status", "active").order("full_name");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const dates = startDate && endDate ? eachDayOfInterval({ start: new Date(startDate), end: new Date(endDate) }) : [];

  const setCell = (empId: string, dateStr: string, type: string) => {
    setGrid(prev => ({ ...prev, [empId]: { ...prev[empId], [dateStr]: type } }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const rows: any[] = [];
      for (const [empId, dates] of Object.entries(grid)) {
        for (const [dateStr, type] of Object.entries(dates)) {
          if (type && type !== "__none") {
            rows.push({ tenant_id: tenantId!, employee_id: empId, date: dateStr, type, hours: 8, created_by: user?.id || null });
          }
        }
      }
      if (rows.length === 0) { toast.error(t("noResults")); return; }
      const { error } = await supabase.from("work_logs").upsert(rows, { onConflict: "employee_id,date" });
      if (error) throw error;
      toast.success(t("success"));
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t("bulkEntry")}</h1>
        <Button onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}{t("save")}</Button>
      </div>

      <div className="flex gap-4">
        <div className="grid gap-2"><Label>{t("startDate")}</Label><Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
        <div className="grid gap-2"><Label>{t("endDate")}</Label><Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} /></div>
      </div>

      <Card>
        <CardContent className="p-0 overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="p-2 text-left sticky left-0 bg-card min-w-[180px]">{t("employee")}</th>
                {dates.map(d => (
                  <th key={d.toISOString()} className="p-2 text-center min-w-[100px]">
                    <div>{format(d, "dd")}</div>
                    <div className="text-xs text-muted-foreground">{format(d, "EEE")}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {employees.map((emp: any) => (
                <tr key={emp.id} className="border-b">
                  <td className="p-2 sticky left-0 bg-card font-medium">{emp.full_name}</td>
                  {dates.map(d => {
                    const dateStr = format(d, "yyyy-MM-dd");
                    const val = grid[emp.id]?.[dateStr] || "__none";
                    return (
                      <td key={dateStr} className="p-1">
                        <Select value={val} onValueChange={v => setCell(emp.id, dateStr, v)}>
                          <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none">—</SelectItem>
                            {WORK_LOG_TYPES.map(tp => <SelectItem key={tp} value={tp}>{t(tp as any) || tp}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
