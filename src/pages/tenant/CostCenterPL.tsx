import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { PieChart as PieChartIcon } from "lucide-react";

export default function CostCenterPL() {
  const { tenantId } = useTenant();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(String(currentYear));

  const { data: costCenters = [] } = useQuery({
    queryKey: ["cost-centers", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("cost_centers")
        .select("id, code, name")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .order("code");
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: journalData = [], isLoading } = useQuery({
    queryKey: ["cost-center-pl", tenantId, year],
    queryFn: async () => {
      if (!tenantId) return [];
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;
      const { data, error } = await supabase
        .from("journal_lines")
        .select(`
          cost_center_id, debit, credit,
          account:account_id(code, name),
          journal_entry:journal_entry_id(entry_date, status, tenant_id)
        `)
        .not("cost_center_id", "is", null)
        .gte("journal_entry.entry_date", startDate)
        .lte("journal_entry.entry_date", endDate)
        .eq("journal_entry.status", "posted")
        .eq("journal_entry.tenant_id", tenantId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const summary = useMemo(() => {
    const map = new Map<string, { revenue: number; expense: number }>();
    for (const line of journalData) {
      const ccId = (line as any).cost_center_id;
      if (!ccId) continue;
      const account = (line as any).account as any;
      if (!account?.code) continue;
      const code = account.code;
      if (!map.has(ccId)) map.set(ccId, { revenue: 0, expense: 0 });
      const entry = map.get(ccId)!;
      // Class 6 = revenue (credit side), Class 5 = expense (debit side)
      if (code.startsWith("6")) {
        entry.revenue += Number(line.credit || 0) - Number(line.debit || 0);
      } else if (code.startsWith("5")) {
        entry.expense += Number(line.debit || 0) - Number(line.credit || 0);
      }
    }
    return costCenters.map((cc: any) => {
      const data = map.get(cc.id) || { revenue: 0, expense: 0 };
      return {
        id: cc.id,
        code: cc.code,
        name: cc.name,
        revenue: Math.round(data.revenue),
        expense: Math.round(data.expense),
        profit: Math.round(data.revenue - data.expense),
      };
    }).filter(r => r.revenue !== 0 || r.expense !== 0);
  }, [journalData, costCenters]);

  const totalRevenue = summary.reduce((s, r) => s + r.revenue, 0);
  const totalExpense = summary.reduce((s, r) => s + r.expense, 0);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader
        title="P&L po mestima troškova"
        description="Profitabilnost po cost center-ima na osnovu knjiženja"
      />

      <div className="flex gap-4 items-end">
        <div>
          <Label>Godina</Label>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[currentYear, currentYear - 1, currentYear - 2].map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {summary.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Grafikon profitabilnosti</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={summary}>
                <XAxis dataKey="code" />
                <YAxis />
                <Tooltip formatter={(v: number) => v.toLocaleString("sr-RS") + " RSD"} />
                <Legend />
                <Bar dataKey="revenue" name="Prihodi" fill="hsl(var(--primary))" />
                <Bar dataKey="expense" name="Rashodi" fill="hsl(var(--destructive))" />
                <Bar dataKey="profit" name="Dobit" fill="hsl(var(--accent))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <PieChartIcon className="h-4 w-4" /> Detaljan pregled
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Učitavanje...</p>
          ) : summary.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nema podataka za izabranu godinu.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Šifra</TableHead>
                  <TableHead>Mesto troška</TableHead>
                  <TableHead className="text-right">Prihodi</TableHead>
                  <TableHead className="text-right">Rashodi</TableHead>
                  <TableHead className="text-right">Dobit/Gubitak</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono">{r.code}</TableCell>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="text-right">{r.revenue.toLocaleString("sr-RS")}</TableCell>
                    <TableCell className="text-right">{r.expense.toLocaleString("sr-RS")}</TableCell>
                    <TableCell className={`text-right font-semibold ${r.profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {r.profit.toLocaleString("sr-RS")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={2} className="font-semibold">UKUPNO</TableCell>
                  <TableCell className="text-right font-semibold">{totalRevenue.toLocaleString("sr-RS")}</TableCell>
                  <TableCell className="text-right font-semibold">{totalExpense.toLocaleString("sr-RS")}</TableCell>
                  <TableCell className={`text-right font-bold ${(totalRevenue - totalExpense) >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {(totalRevenue - totalExpense).toLocaleString("sr-RS")}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
