import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { toast } from "sonner";
import { Save, BarChart3 } from "lucide-react";

const currentYear = new Date().getFullYear();

export default function BudgetVsActuals() {
  const { locale } = useLanguage();
  const { tenantId } = useTenant();
  const sr = locale === "sr";
  const qc = useQueryClient();
  const [year, setYear] = useState(String(currentYear));
  const [editingBudgets, setEditingBudgets] = useState<Record<string, number>>({});

  // Fetch accounts
  const { data: accounts } = useQuery({
    queryKey: ["budget-accounts", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data } = await supabase
        .from("chart_of_accounts")
        .select("id, code, name, name_sr, account_type")
        .eq("tenant_id", tenantId!)
        .in("account_type", ["revenue", "expense"])
        .eq("is_active", true)
        .order("code");
      return data || [];
    },
  });

  // Fetch budgets for year
  const { data: budgets, isLoading: loadingBudgets } = useQuery({
    queryKey: ["budgets", tenantId, year],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data } = await supabase
        .from("budgets")
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("fiscal_year", Number(year));
      return data || [];
    },
  });

  // Fetch actuals from journal lines
  const { data: actuals } = useQuery({
    queryKey: ["budget-actuals", tenantId, year],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data: lines } = await (supabase
        .from("journal_lines")
        .select("amount, side, account_id, journal:journal_entry_id(entry_date, status)") as any)
        .eq("tenant_id", tenantId!);

      const result: Record<string, number> = {};
      for (const line of (lines as any[]) || []) {
        if (line.journal?.status !== "posted") continue;
        const d = line.journal.entry_date;
        if (!d || !d.startsWith(year)) continue;
        const amt = Number(line.amount) || 0;
        const net = line.side === "debit" ? amt : -amt;
        result[line.account_id] = (result[line.account_id] || 0) + Math.abs(net);
      }
      return result;
    },
  });

  // Upsert budget
  const saveBudget = useMutation({
    mutationFn: async ({ accountId, amount }: { accountId: string; amount: number }) => {
      // Check if exists
      const { data: existing } = await supabase
        .from("budgets")
        .select("id")
        .eq("tenant_id", tenantId!)
        .eq("account_id", accountId)
        .eq("fiscal_year", Number(year))
        .eq("month", 0)
        .maybeSingle();

      if (existing) {
        await supabase.from("budgets").update({ amount }).eq("id", existing.id);
      } else {
        await supabase.from("budgets").insert({
          tenant_id: tenantId!, account_id: accountId, fiscal_year: Number(year), month: 1, amount,
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["budgets", tenantId, year] });
      toast.success(sr ? "Budžet sačuvan" : "Budget saved");
    },
  });

  const rows = (accounts || []).map(acct => {
    const budget = budgets?.find(b => b.account_id === acct.id);
    const budgetAmt = editingBudgets[acct.id] ?? budget?.amount ?? 0;
    const actual = actuals?.[acct.id] || 0;
    const variance = budgetAmt - actual;
    const variancePct = budgetAmt > 0 ? (variance / budgetAmt) * 100 : 0;
    return { ...acct, budget: budgetAmt, actual, variance, variancePct };
  });

  const chartData = rows.filter(r => r.budget > 0 || r.actual > 0).slice(0, 12).map(r => ({
    name: r.code,
    [sr ? "Budžet" : "Budget"]: r.budget,
    [sr ? "Stvarni" : "Actual"]: r.actual,
  }));

  return (
    <div className="space-y-6">
      <PageHeader title={sr ? "Budžet vs Stvarni" : "Budget vs Actuals"} actions={
        <Select value={year} onValueChange={setYear}>
          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[currentYear - 1, currentYear, currentYear + 1].map(y => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      } />

      {chartData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              {sr ? "Pregled" : "Overview"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey={sr ? "Budžet" : "Budget"} fill="hsl(220, 70%, 50%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey={sr ? "Stvarni" : "Actual"} fill="hsl(160, 60%, 45%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          {loadingBudgets ? <Skeleton className="h-60" /> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{sr ? "Šifra" : "Code"}</TableHead>
                  <TableHead>{sr ? "Konto" : "Account"}</TableHead>
                  <TableHead>{sr ? "Tip" : "Type"}</TableHead>
                  <TableHead className="text-right">{sr ? "Budžet" : "Budget"}</TableHead>
                  <TableHead className="text-right">{sr ? "Stvarni" : "Actual"}</TableHead>
                  <TableHead className="text-right">{sr ? "Razlika" : "Variance"}</TableHead>
                  <TableHead className="text-right">%</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.code}</TableCell>
                    <TableCell>{sr && r.name_sr ? r.name_sr : r.name}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{r.account_type}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        className="w-28 text-right h-8 inline-block"
                        value={editingBudgets[r.id] ?? r.budget}
                        onChange={e => setEditingBudgets(prev => ({ ...prev, [r.id]: Number(e.target.value) }))}
                      />
                    </TableCell>
                    <TableCell className="text-right font-medium">{r.actual.toLocaleString()}</TableCell>
                    <TableCell className={`text-right ${r.variance >= 0 ? "text-accent" : "text-destructive"}`}>
                      {r.variance.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right text-xs">{r.variancePct.toFixed(0)}%</TableCell>
                    <TableCell>
                      {editingBudgets[r.id] !== undefined && (
                        <Button size="sm" variant="ghost" onClick={() => saveBudget.mutate({ accountId: r.id, amount: editingBudgets[r.id] })}>
                          <Save className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </TableCell>
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
