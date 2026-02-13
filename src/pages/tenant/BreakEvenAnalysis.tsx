import { useState, useMemo } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatsBar, type StatItem } from "@/components/shared/StatsBar";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine,
} from "recharts";
import { toast } from "sonner";
import { Target, DollarSign, TrendingUp, Percent } from "lucide-react";

export default function BreakEvenAnalysis() {
  const { locale } = useLanguage();
  const { tenantId } = useTenant();
  const sr = locale === "sr";
  const qc = useQueryClient();

  // Fetch expense accounts with is_variable_cost flag
  const { data: expenseAccounts, isLoading } = useQuery({
    queryKey: ["break-even-accounts", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data } = await supabase
        .from("chart_of_accounts")
        .select("id, code, name, name_sr, is_variable_cost")
        .eq("tenant_id", tenantId!)
        .eq("account_type", "expense")
        .eq("is_active", true)
        .order("code");
      return data || [];
    },
  });

  // Fetch actuals
  const { data: totals } = useQuery({
    queryKey: ["break-even-totals", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data: lines } = await (supabase
        .from("journal_lines")
        .select("amount, side, account_id, accounts:account_id(account_type, is_variable_cost), journal:journal_entry_id(status)") as any)
        .eq("tenant_id", tenantId!);

      let revenue = 0, fixedCosts = 0, variableCosts = 0;
      for (const line of (lines as any[]) || []) {
        if (line.journal?.status !== "posted") continue;
        const amt = Number(line.amount) || 0;
        if (line.accounts?.account_type === "revenue") {
          revenue += line.side === "credit" ? amt : -amt;
        } else if (line.accounts?.account_type === "expense") {
          const cost = line.side === "debit" ? amt : -amt;
          if (line.accounts?.is_variable_cost) variableCosts += cost;
          else fixedCosts += cost;
        }
      }
      return { revenue, fixedCosts, variableCosts };
    },
  });

  const toggleVariable = useMutation({
    mutationFn: async ({ id, isVariable }: { id: string; isVariable: boolean }) => {
      await supabase.from("chart_of_accounts").update({ is_variable_cost: isVariable }).eq("id", id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["break-even-accounts", tenantId] });
      qc.invalidateQueries({ queryKey: ["break-even-totals", tenantId] });
      toast.success(sr ? "Ažurirano" : "Updated");
    },
  });

  const rev = totals?.revenue || 0;
  const fc = totals?.fixedCosts || 0;
  const vc = totals?.variableCosts || 0;
  const contributionMargin = rev > 0 ? (rev - vc) / rev : 0;
  const breakEvenPoint = contributionMargin > 0 ? fc / contributionMargin : 0;

  const stats: StatItem[] = [
    { label: sr ? "Ukupan prihod" : "Total Revenue", value: `${Math.round(rev).toLocaleString()}`, icon: DollarSign, color: "text-accent" },
    { label: sr ? "Fiksni troškovi" : "Fixed Costs", value: `${Math.round(fc).toLocaleString()}`, icon: Target, color: "text-destructive" },
    { label: sr ? "Varijabilni troškovi" : "Variable Costs", value: `${Math.round(vc).toLocaleString()}`, icon: TrendingUp, color: "text-warning" },
    { label: sr ? "Tačka rentabilnosti" : "Break-Even Point", value: `${Math.round(breakEvenPoint).toLocaleString()} RSD`, icon: Percent, color: "text-primary" },
  ];

  // Chart data: from 0 to 2x revenue
  const chartData = useMemo(() => {
    const maxRev = Math.max(rev * 1.5, breakEvenPoint * 1.5, 100000);
    const steps = 20;
    return Array.from({ length: steps + 1 }, (_, i) => {
      const r = (maxRev / steps) * i;
      const vcRatio = rev > 0 ? vc / rev : 0.5;
      return {
        revenue: Math.round(r),
        [sr ? "Prihod" : "Revenue"]: Math.round(r),
        [sr ? "Ukupni troškovi" : "Total Costs"]: Math.round(fc + r * vcRatio),
        [sr ? "Fiksni" : "Fixed"]: Math.round(fc),
      };
    });
  }, [rev, fc, vc, breakEvenPoint, sr]);

  return (
    <div className="space-y-6">
      <PageHeader title={sr ? "Analiza tačke rentabilnosti" : "Break-Even Analysis"} />

      <StatsBar stats={stats} />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{sr ? "Grafik tačke rentabilnosti" : "Break-Even Chart"}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-80" /> : (
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="revenue" tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => v.toLocaleString()} />
                <Legend />
                <Line type="monotone" dataKey={sr ? "Prihod" : "Revenue"} stroke="hsl(160, 60%, 45%)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey={sr ? "Ukupni troškovi" : "Total Costs"} stroke="hsl(0, 72%, 51%)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey={sr ? "Fiksni" : "Fixed"} stroke="hsl(38, 92%, 50%)" strokeWidth={1.5} strokeDasharray="5 5" dot={false} />
                {breakEvenPoint > 0 && <ReferenceLine x={Math.round(breakEvenPoint)} stroke="hsl(220, 70%, 50%)" strokeDasharray="3 3" label={sr ? "BEP" : "BEP"} />}
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{sr ? "Klasifikacija troškova" : "Cost Classification"}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{sr ? "Šifra" : "Code"}</TableHead>
                <TableHead>{sr ? "Konto" : "Account"}</TableHead>
                <TableHead className="text-center">{sr ? "Varijabilni?" : "Variable?"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(expenseAccounts || []).map(acct => (
                <TableRow key={acct.id}>
                  <TableCell className="font-mono text-xs">{acct.code}</TableCell>
                  <TableCell>{sr && acct.name_sr ? acct.name_sr : acct.name}</TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={acct.is_variable_cost || false}
                      onCheckedChange={(checked) => toggleVariable.mutate({ id: acct.id, isVariable: checked })}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
