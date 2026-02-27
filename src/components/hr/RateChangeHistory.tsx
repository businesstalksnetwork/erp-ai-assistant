import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { History } from "lucide-react";

const formatDate = (d: string | null) => {
  if (!d) return "—";
  const dt = new Date(d);
  return `${dt.getDate().toString().padStart(2, "0")}.${(dt.getMonth() + 1).toString().padStart(2, "0")}.${dt.getFullYear()}`;
};

const formatNum = (n: number | null) =>
  n != null ? n.toLocaleString("sr-RS", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—";

interface Props {
  employeeId: string;
  tenantId: string;
}

export function RateChangeHistory({ employeeId, tenantId }: Props) {
  const { data: history = [] } = useQuery({
    queryKey: ["payroll-rate-history", employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payroll_rate_history" as any)
        .select("*")
        .eq("employee_id", employeeId)
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!employeeId && !!tenantId,
  });

  if (history.length === 0) return null;

  const rateTypeLabel = (rt: string) => {
    const map: Record<string, string> = {
      base_salary: "Osnovna plata",
      hourly_rate: "Satnica",
      bonus_rate: "Bonus",
    };
    return map[rt] || rt;
  };

  return (
    <Card className="mt-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <History className="h-4 w-4" />
          Istorija promena plata
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Datum</TableHead>
              <TableHead>Tip</TableHead>
              <TableHead className="text-right">Stara vrednost</TableHead>
              <TableHead className="text-right">Nova vrednost</TableHead>
              <TableHead className="text-right">Promena</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {history.map((h: any) => {
              const diff = (h.new_value || 0) - (h.old_value || 0);
              const pct = h.old_value ? ((diff / h.old_value) * 100).toFixed(1) : "—";
              return (
                <TableRow key={h.id}>
                  <TableCell>{formatDate(h.effective_date)}</TableCell>
                  <TableCell><Badge variant="outline">{rateTypeLabel(h.rate_type)}</Badge></TableCell>
                  <TableCell className="text-right font-mono">{formatNum(h.old_value)}</TableCell>
                  <TableCell className="text-right font-mono">{formatNum(h.new_value)}</TableCell>
                  <TableCell className="text-right">
                    <span className={diff > 0 ? "text-emerald-600" : diff < 0 ? "text-destructive" : ""}>
                      {diff > 0 ? "+" : ""}{formatNum(diff)} ({pct}%)
                    </span>
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
