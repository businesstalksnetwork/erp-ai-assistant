import { useState, useMemo } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatsBar, type StatItem } from "@/components/shared/StatsBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { MobileFilterBar } from "@/components/shared/MobileFilterBar";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingDown, DollarSign, Users, Truck, Landmark, Settings } from "lucide-react";
import { fmtNum } from "@/lib/utils";
import { format } from "date-fns";
import { AiAnalyticsNarrative } from "@/components/ai/AiAnalyticsNarrative";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

type ExpenseCategory = "all" | "salaries" | "suppliers" | "depreciation" | "operating";

function categorize(description: string, entryDesc: string, reference: string | null): ExpenseCategory {
  const combined = `${description} ${entryDesc} ${reference || ""}`.toLowerCase();
  if (combined.includes("plat") || combined.includes("bruto") || combined.includes("payroll") || combined.includes("doprin")) return "salaries";
  if (combined.includes("uf-") || combined.includes("supplier") || combined.includes("dobavljač")) return "suppliers";
  if (combined.includes("amortiz") || combined.includes("deprec") || combined.includes("fixed asset")) return "depreciation";
  return "operating";
}

export default function Expenses() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const [category, setCategory] = useState<ExpenseCategory>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["expenses", tenantId, dateFrom, dateTo],
    queryFn: async () => {
      if (!tenantId) return [];
      let query = supabase
        .from("journal_lines")
        .select(`
          id, debit, credit, description, sort_order,
          account:chart_of_accounts!inner(id, code, name, name_sr, account_type),
          journal_entry:journal_entries!inner(id, entry_number, entry_date, description, reference, status)
        `)
        .eq("account.account_type", "expense")
        .eq("journal_entry.status", "posted")
        .eq("journal_entry.tenant_id", tenantId)
        .gt("debit", 0);

      if (dateFrom) query = query.gte("journal_entry.entry_date", dateFrom);
      if (dateTo) query = query.lte("journal_entry.entry_date", dateTo);

      const { data, error } = await query;
      if (error) throw error;
      return data as any[];
    },
    enabled: !!tenantId,
  });

  const categorized = useMemo(() => {
    return entries.map((e) => ({
      ...e,
      category: categorize(
        e.description || "",
        e.journal_entry?.description || "",
        e.journal_entry?.reference || null
      ),
    }));
  }, [entries]);

  const filtered = useMemo(() => {
    if (category === "all") return categorized;
    return categorized.filter((e) => e.category === category);
  }, [categorized, category]);

  const totals = useMemo(() => {
    const t = { total: 0, salaries: 0, suppliers: 0, depreciation: 0, operating: 0 };
    for (const e of categorized) {
      const amt = Number(e.debit);
      t.total += amt;
      (t as any)[e.category] += amt;
    }
    return t;
  }, [categorized]);

  const monthlyData = useMemo(() => {
    const map = new Map<string, { month: string; salaries: number; suppliers: number; depreciation: number; operating: number }>();
    for (const e of categorized) {
      const d = e.journal_entry?.entry_date;
      if (!d) continue;
      const key = d.slice(0, 7);
      if (!map.has(key)) map.set(key, { month: key, salaries: 0, suppliers: 0, depreciation: 0, operating: 0 });
      (map.get(key)! as any)[e.category] += Number(e.debit);
    }
    return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));
  }, [categorized]);

  const stats: StatItem[] = [
    { label: t("totalExpenses"), value: fmtNum(totals.total) + " RSD", icon: TrendingDown, color: "text-destructive" },
    { label: t("salaryExpenses"), value: fmtNum(totals.salaries) + " RSD", icon: Users, color: "text-primary" },
    { label: t("supplierExpenses"), value: fmtNum(totals.suppliers) + " RSD", icon: Truck, color: "text-accent" },
    { label: t("operatingExpenses"), value: fmtNum(totals.operating) + " RSD", icon: Settings, color: "text-muted-foreground" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("expensesOverview")} description={t("allExpenses")} icon={TrendingDown} />

      <StatsBar stats={stats} />

      <MobileFilterBar
        filters={
          <>
            <div className="w-48">
              <Label>{t("expenseCategory")}</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as ExpenseCategory)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("allStatuses")}</SelectItem>
                  <SelectItem value="salaries">{t("salaryExpenses")}</SelectItem>
                  <SelectItem value="suppliers">{t("supplierExpenses")}</SelectItem>
                  <SelectItem value="depreciation">{t("runDepreciation")}</SelectItem>
                  <SelectItem value="operating">{t("operatingExpenses")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("startDate")}</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div>
              <Label>{t("endDate")}</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </>
        }
      />

      {tenantId && totals.total > 0 && (
        <AiAnalyticsNarrative
          tenantId={tenantId}
          contextType="expenses"
          data={{
            totalExpenses: Math.round(totals.total),
            salaries: Math.round(totals.salaries),
            suppliers: Math.round(totals.suppliers),
            depreciation: Math.round(totals.depreciation),
            operating: Math.round(totals.operating),
            salaryRatio: totals.total > 0 ? Number((totals.salaries / totals.total * 100).toFixed(1)) : 0,
            supplierRatio: totals.total > 0 ? Number((totals.suppliers / totals.total * 100).toFixed(1)) : 0,
            monthCount: monthlyData.length,
          }}
        />
      )}

      {/* Monthly Chart */}
      {monthlyData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("expensesOverview")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(v: number) => fmtNum(v) + " RSD"} />
                <Legend />
                <Bar dataKey="salaries" name={t("salaryExpenses")} fill="hsl(var(--primary))" stackId="a" />
                <Bar dataKey="suppliers" name={t("supplierExpenses")} fill="hsl(var(--accent))" stackId="a" />
                <Bar dataKey="depreciation" name={t("runDepreciation")} fill="hsl(var(--muted-foreground))" stackId="a" />
                <Bar dataKey="operating" name={t("operatingExpenses")} fill="hsl(var(--destructive))" stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Expense Table */}
      {isLoading ? (
        <p>{t("loading")}</p>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-muted-foreground">{t("noResults")}</CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("entryDate")}</TableHead>
                  <TableHead>{t("entryNumber")}</TableHead>
                  <TableHead>{t("description")}</TableHead>
                  <TableHead>{t("account")}</TableHead>
                  <TableHead>{t("expenseCategory")}</TableHead>
                  <TableHead className="text-right">{t("amount")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.slice(0, 500).map((line) => (
                  <TableRow key={line.id}>
                    <TableCell>
                      {line.journal_entry?.entry_date
                        ? format(new Date(line.journal_entry.entry_date), "dd.MM.yyyy")
                        : ""}
                    </TableCell>
                    <TableCell>{line.journal_entry?.entry_number}</TableCell>
                    <TableCell>{line.description || line.journal_entry?.description || ""}</TableCell>
                    <TableCell>{line.account?.code} — {line.account?.name}</TableCell>
                    <TableCell>{t(line.category === "salaries" ? "salaryExpenses" : line.category === "suppliers" ? "supplierExpenses" : line.category === "depreciation" ? "runDepreciation" : "operatingExpenses")}</TableCell>
                    <TableCell className="text-right font-medium">{fmtNum(Number(line.debit))} RSD</TableCell>
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
