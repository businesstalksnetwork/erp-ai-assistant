import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function MyAttendance() {
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const [month, setMonth] = useState(new Date());

  const monthStart = format(startOfMonth(month), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(month), "yyyy-MM-dd");

  const { data: employee } = useQuery({
    queryKey: ["my-employee", user?.id, tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("employees")
        .select("id")
        .eq("tenant_id", tenantId!)
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!tenantId && !!user,
  });

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["my-attendance", employee?.id, monthStart],
    queryFn: async () => {
      const { data } = await supabase
        .from("attendance_records")
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("employee_id", employee!.id)
        .gte("date", monthStart)
        .lte("date", monthEnd)
        .order("date");
      return data || [];
    },
    enabled: !!employee?.id && !!tenantId,
  });

  const statusColor = (s: string) => {
    if (s === "present" || s === "remote") return "default";
    if (s === "absent" || s === "sick") return "destructive";
    return "outline";
  };

  const totalHours = records.reduce((sum: number, r: any) => sum + (r.hours_worked || 0), 0);

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Moja evidencija prisustva</h1>

      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setMonth(subMonths(month, 1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="font-medium">{format(month, "MMMM yyyy")}</span>
        <Button variant="ghost" size="icon" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <span className="text-sm text-muted-foreground ml-auto">Ukupno: {totalHours.toFixed(1)}h</span>
      </div>

      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Datum</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Dolazak</TableHead>
            <TableHead>Odlazak</TableHead>
            <TableHead>Sati</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {records.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Nema zapisa</TableCell></TableRow>
            ) : records.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell>{format(new Date(r.date), "dd.MM.yyyy")}</TableCell>
                <TableCell><Badge variant={statusColor(r.status)}>{r.status}</Badge></TableCell>
                <TableCell>{r.check_in || "—"}</TableCell>
                <TableCell>{r.check_out || "—"}</TableCell>
                <TableCell>{r.hours_worked?.toFixed(1) || "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}
