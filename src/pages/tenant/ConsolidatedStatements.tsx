import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useLegalEntities } from "@/hooks/useLegalEntities";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2 } from "lucide-react";

export default function ConsolidatedStatements() {
  const { tenantId } = useTenant();
  const { entities: legalEntities } = useLegalEntities();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(String(currentYear));

  // Fetch journal data per legal entity for class 5 (expenses), 6 (revenue), 0-4 (assets/liabilities)
  const { data: journalData = [], isLoading } = useQuery({
    queryKey: ["consolidated-statements", tenantId, year],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("journal_lines")
        .select(`
          debit, credit,
          account:account_id(code, name, account_class),
          journal_entry:journal_entry_id(entry_date, status, tenant_id, legal_entity_id)
        `)
        .eq("journal_entry.tenant_id", tenantId)
        .eq("journal_entry.status", "posted")
        .gte("journal_entry.entry_date", `${year}-01-01`)
        .lte("journal_entry.entry_date", `${year}-12-31`);
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Fetch intercompany eliminations
  const { data: icTransactions = [] } = useQuery({
    queryKey: ["ic-eliminations", tenantId, year],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("intercompany_transactions")
        .select("amount, status")
        .eq("tenant_id", tenantId)
        .gte("transaction_date", `${year}-01-01`)
        .lte("transaction_date", `${year}-12-31`);
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const icElimination = useMemo(() => {
    return icTransactions
      .filter((t: any) => t.status === "posted" || t.status === "eliminated")
      .reduce((s: number, t: any) => s + Number(t.amount || 0), 0);
  }, [icTransactions]);

  const consolidatedPL = useMemo(() => {
    const entityMap = new Map<string, { name: string; revenue: number; expenses: number }>();
    
    for (const le of legalEntities) {
      entityMap.set(le.id, { name: le.name, revenue: 0, expenses: 0 });
    }
    // Add "unknown" bucket
    entityMap.set("none", { name: "Bez pravnog lica", revenue: 0, expenses: 0 });

    for (const line of journalData) {
      const je = (line as any).journal_entry as any;
      const account = (line as any).account as any;
      if (!je || !account?.code) continue;
      const leId = je.legal_entity_id || "none";
      if (!entityMap.has(leId)) entityMap.set(leId, { name: leId, revenue: 0, expenses: 0 });
      const entry = entityMap.get(leId)!;
      const code = account.code;
      if (code.startsWith("6")) {
        entry.revenue += Number(line.credit || 0) - Number(line.debit || 0);
      } else if (code.startsWith("5")) {
        entry.expenses += Number(line.debit || 0) - Number(line.credit || 0);
      }
    }

    return Array.from(entityMap.entries())
      .map(([id, v]) => ({ id, ...v, profit: v.revenue - v.expenses }))
      .filter(r => r.revenue !== 0 || r.expenses !== 0);
  }, [journalData, legalEntities]);

  const totalRevenue = consolidatedPL.reduce((s, r) => s + r.revenue, 0);
  const totalExpenses = consolidatedPL.reduce((s, r) => s + r.expenses, 0);
  const consolidatedProfit = totalRevenue - totalExpenses - icElimination;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader
        title="Konsolidovani finansijski izveštaji"
        description="Kombinovani P&L i bilans za sva pravna lica sa eliminacijom intercompany transakcija"
      />

      <div className="flex gap-4 items-end">
        <div>
          <Label>Godina</Label>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[currentYear, currentYear - 1, currentYear - 2].map(y => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4 text-center">
          <p className="text-xs text-muted-foreground">Konsolidovani prihodi</p>
          <p className="text-lg font-bold">{Math.round(totalRevenue).toLocaleString("sr-RS")} RSD</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-xs text-muted-foreground">Konsolidovani rashodi</p>
          <p className="text-lg font-bold">{Math.round(totalExpenses).toLocaleString("sr-RS")} RSD</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-xs text-muted-foreground">IC eliminacija</p>
          <p className="text-lg font-bold text-muted-foreground">{Math.round(icElimination).toLocaleString("sr-RS")} RSD</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-xs text-muted-foreground">Konsolidovana dobit</p>
          <p className={`text-lg font-bold ${consolidatedProfit >= 0 ? "text-primary" : "text-destructive"}`}>
            {Math.round(consolidatedProfit).toLocaleString("sr-RS")} RSD
          </p>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4" /> P&L po pravnim licima
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Učitavanje...</p>
          ) : consolidatedPL.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nema podataka za izabranu godinu.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pravno lice</TableHead>
                  <TableHead className="text-right">Prihodi</TableHead>
                  <TableHead className="text-right">Rashodi</TableHead>
                  <TableHead className="text-right">Dobit/Gubitak</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {consolidatedPL.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="text-right">{Math.round(r.revenue).toLocaleString("sr-RS")}</TableCell>
                    <TableCell className="text-right">{Math.round(r.expenses).toLocaleString("sr-RS")}</TableCell>
                    <TableCell className={`text-right font-semibold ${r.profit >= 0 ? "text-primary" : "text-destructive"}`}>
                      {Math.round(r.profit).toLocaleString("sr-RS")}
                    </TableCell>
                  </TableRow>
                ))}
                {icElimination > 0 && (
                  <TableRow>
                    <TableCell className="font-medium text-muted-foreground italic">IC eliminacija</TableCell>
                    <TableCell className="text-right text-muted-foreground">—</TableCell>
                    <TableCell className="text-right text-muted-foreground">—</TableCell>
                    <TableCell className="text-right text-muted-foreground font-semibold">-{Math.round(icElimination).toLocaleString("sr-RS")}</TableCell>
                  </TableRow>
                )}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell className="font-bold">KONSOLIDOVANO</TableCell>
                  <TableCell className="text-right font-bold">{Math.round(totalRevenue).toLocaleString("sr-RS")}</TableCell>
                  <TableCell className="text-right font-bold">{Math.round(totalExpenses).toLocaleString("sr-RS")}</TableCell>
                  <TableCell className={`text-right font-bold ${consolidatedProfit >= 0 ? "text-primary" : "text-destructive"}`}>
                    {Math.round(consolidatedProfit).toLocaleString("sr-RS")}
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
