import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useLegalEntities } from "@/hooks/useLegalEntities";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { FileBarChart } from "lucide-react";
import { fmtNum } from "@/lib/utils";

export default function StatistickiAneks() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { entities } = useLegalEntities();
  const [year, setYear] = useState(new Date().getFullYear());
  const [entityId, setEntityId] = useState<string>("all");

  const { data: lines = [], isLoading } = useQuery({
    queryKey: ["statisticki-aneks", tenantId, year, entityId],
    queryFn: async () => {
      let q = supabase
        .from("journal_lines")
        .select("account_code, debit, credit, journal_entries!inner(entry_date, status, tenant_id, legal_entity_id)")
        .eq("journal_entries.tenant_id", tenantId!)
        .eq("journal_entries.status", "posted")
        .gte("journal_entries.entry_date", `${year}-01-01`)
        .lte("journal_entries.entry_date", `${year}-12-31`);
      if (entityId !== "all") q = q.eq("journal_entries.legal_entity_id", entityId);
      const { data } = await q;
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Group by account class (first digit)
  const classSummary: Record<string, { debit: number; credit: number }> = {};
  lines.forEach((l: any) => {
    const cls = String(l.account_code || "")[0] || "?";
    if (!classSummary[cls]) classSummary[cls] = { debit: 0, credit: 0 };
    classSummary[cls].debit += Number(l.debit || 0);
    classSummary[cls].credit += Number(l.credit || 0);
  });

  const classNames: Record<string, string> = {
    "0": "Klasa 0 — Upisani a neuplaćeni kapital i stalna imovina",
    "1": "Klasa 1 — Zalihe",
    "2": "Klasa 2 — Kratkoročna potraživanja, plasmani i gotovina",
    "3": "Klasa 3 — Kapital",
    "4": "Klasa 4 — Dugoročna rezervisanja i obaveze",
    "5": "Klasa 5 — Rashodi",
    "6": "Klasa 6 — Prihodi",
    "7": "Klasa 7 — Otvaranje i zaključak klasa",
    "8": "Klasa 8 — Vanbilansna evidencija",
    "9": "Klasa 9 — Obračun troškova i učinaka",
  };

  const sortedClasses = Object.entries(classSummary).sort(([a], [b]) => a.localeCompare(b));
  const totalDebit = sortedClasses.reduce((s, [, v]) => s + v.debit, 0);
  const totalCredit = sortedClasses.reduce((s, [, v]) => s + v.credit, 0);

  // Employee count and other stat data
  const { data: employeeCount = 0 } = useQuery({
    queryKey: ["emp-count-aneks", tenantId],
    queryFn: async () => {
      const { count } = await supabase
        .from("employees")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId!)
        .eq("status", "active")
        .eq("is_ghost", false);
      return count || 0;
    },
    enabled: !!tenantId,
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Statistički aneks" icon={FileBarChart} description="Dodatni podaci uz godišnje finansijske izveštaje za APR" />

      <div className="flex gap-4 flex-wrap">
        <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>{[2026, 2025, 2024, 2023].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
        </Select>
        {entities.length > 1 && (
          <Select value={entityId} onValueChange={setEntityId}>
            <SelectTrigger className="w-64"><SelectValue placeholder="Pravno lice" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Sva pravna lica</SelectItem>
              {entities.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Prosečan broj zaposlenih</p><p className="text-2xl font-bold">{employeeCount}</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Ukupan promet — duguje</p><p className="text-2xl font-bold">{fmtNum(totalDebit)}</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Ukupan promet — potražuje</p><p className="text-2xl font-bold">{fmtNum(totalCredit)}</p></CardContent></Card>
      </div>

      {isLoading ? <Skeleton className="h-64 w-full" /> : (
        <Card>
          <CardHeader><CardTitle>Promet po klasama konta</CardTitle></CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Klasa</TableHead>
                  <TableHead className="text-right">Duguje</TableHead>
                  <TableHead className="text-right">Potražuje</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedClasses.map(([cls, v]) => (
                  <TableRow key={cls}>
                    <TableCell className="font-medium">{classNames[cls] || `Klasa ${cls}`}</TableCell>
                    <TableCell className="text-right">{fmtNum(v.debit)}</TableCell>
                    <TableCell className="text-right">{fmtNum(v.credit)}</TableCell>
                    <TableCell className="text-right font-semibold">{fmtNum(v.debit - v.credit)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/50 font-semibold">
                  <TableCell>UKUPNO</TableCell>
                  <TableCell className="text-right">{fmtNum(totalDebit)}</TableCell>
                  <TableCell className="text-right">{fmtNum(totalCredit)}</TableCell>
                  <TableCell className="text-right">{fmtNum(totalDebit - totalCredit)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
