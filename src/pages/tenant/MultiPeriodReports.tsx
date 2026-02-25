import { useState, useMemo } from "react";
import { useTenant } from "@/hooks/useTenant";
import { useLegalEntities } from "@/hooks/useLegalEntities";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Columns } from "lucide-react";
import { fmtNum } from "@/lib/utils";

type ReportType = "income_statement" | "balance_sheet";

export default function MultiPeriodReports() {
  const { tenantId } = useTenant();
  const { entities } = useLegalEntities();
  const currentYear = new Date().getFullYear();
  const [year1, setYear1] = useState(currentYear - 1);
  const [year2, setYear2] = useState(currentYear);
  const [entityId, setEntityId] = useState<string>("all");
  const [reportType, setReportType] = useState<ReportType>("income_statement");

  const fetchYear = async (yr: number) => {
    let q = supabase
      .from("journal_lines")
      .select("account_code, debit, credit, journal_entries!inner(entry_date, status, tenant_id, legal_entity_id)")
      .eq("journal_entries.tenant_id", tenantId!)
      .eq("journal_entries.status", "posted")
      .gte("journal_entries.entry_date", `${yr}-01-01`)
      .lte("journal_entries.entry_date", `${yr}-12-31`);
    if (entityId !== "all") q = q.eq("journal_entries.legal_entity_id", entityId);
    const { data } = await q;
    return data || [];
  };

  const { data: data1 = [], isLoading: l1 } = useQuery({
    queryKey: ["mp-report", tenantId, year1, entityId],
    queryFn: () => fetchYear(year1),
    enabled: !!tenantId,
  });
  const { data: data2 = [], isLoading: l2 } = useQuery({
    queryKey: ["mp-report", tenantId, year2, entityId],
    queryFn: () => fetchYear(year2),
    enabled: !!tenantId,
  });

  const aggregate = (lines: any[], classFilter: string[]) => {
    let total = 0;
    lines.forEach((l: any) => {
      const cls = String(l.account_code || "")[0];
      if (classFilter.includes(cls)) {
        total += Number(l.credit || 0) - Number(l.debit || 0);
      }
    });
    return total;
  };

  const rows = useMemo(() => {
    if (reportType === "income_statement") {
      const rev1 = aggregate(data1, ["6"]);
      const rev2 = aggregate(data2, ["6"]);
      const exp1 = -aggregate(data1, ["5"]);
      const exp2 = -aggregate(data2, ["5"]);
      return [
        { label: "Prihodi (Klasa 6)", v1: rev1, v2: rev2 },
        { label: "Rashodi (Klasa 5)", v1: exp1, v2: exp2 },
        { label: "Neto rezultat", v1: rev1 - exp1, v2: rev2 - exp2 },
      ];
    } else {
      const assets1 = aggregate(data1, ["0", "1", "2"]);
      const assets2 = aggregate(data2, ["0", "1", "2"]);
      const equity1 = aggregate(data1, ["3"]);
      const equity2 = aggregate(data2, ["3"]);
      const liab1 = aggregate(data1, ["4"]);
      const liab2 = aggregate(data2, ["4"]);
      return [
        { label: "Aktiva (Klasa 0+1+2)", v1: -assets1, v2: -assets2 },
        { label: "Kapital (Klasa 3)", v1: equity1, v2: equity2 },
        { label: "Obaveze (Klasa 4)", v1: liab1, v2: liab2 },
      ];
    }
  }, [data1, data2, reportType]);

  const chartData = rows.map(r => ({ name: r.label, [year1]: Math.abs(r.v1), [year2]: Math.abs(r.v2) }));
  const isLoading = l1 || l2;

  return (
    <div className="space-y-6">
      <PageHeader title="Uporedni izveštaji" icon={Columns} description="Poređenje finansijskih izveštaja za dva perioda" />

      <div className="flex gap-4 flex-wrap">
        <Select value={reportType} onValueChange={v => setReportType(v as ReportType)}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="income_statement">Bilans uspeha</SelectItem>
            <SelectItem value="balance_sheet">Bilans stanja</SelectItem>
          </SelectContent>
        </Select>
        <Select value={String(year1)} onValueChange={v => setYear1(Number(v))}>
          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
          <SelectContent>{[2023, 2024, 2025, 2026].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
        </Select>
        <span className="self-center text-muted-foreground">vs</span>
        <Select value={String(year2)} onValueChange={v => setYear2(Number(v))}>
          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
          <SelectContent>{[2023, 2024, 2025, 2026].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
        </Select>
        {entities.length > 1 && (
          <Select value={entityId} onValueChange={setEntityId}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Pravno lice" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Sva</SelectItem>
              {entities.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {isLoading ? <Skeleton className="h-80 w-full" /> : (
        <>
          <Card>
            <CardHeader><CardTitle>Vizuelno poređenje</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={v => fmtNum(v)} />
                  <Tooltip formatter={(v: number) => fmtNum(v)} />
                  <Legend />
                  <Bar dataKey={year1} fill="hsl(var(--primary))" />
                  <Bar dataKey={year2} fill="hsl(var(--accent-foreground))" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pozicija</TableHead>
                    <TableHead className="text-right">{year1}</TableHead>
                    <TableHead className="text-right">{year2}</TableHead>
                    <TableHead className="text-right">Δ (RSD)</TableHead>
                    <TableHead className="text-right">Δ (%)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(r => {
                    const delta = r.v2 - r.v1;
                    const pct = r.v1 !== 0 ? (delta / Math.abs(r.v1)) * 100 : 0;
                    return (
                      <TableRow key={r.label}>
                        <TableCell className="font-medium">{r.label}</TableCell>
                        <TableCell className="text-right">{fmtNum(r.v1)}</TableCell>
                        <TableCell className="text-right">{fmtNum(r.v2)}</TableCell>
                        <TableCell className={`text-right ${delta >= 0 ? "text-green-600" : "text-red-600"}`}>{delta >= 0 ? "+" : ""}{fmtNum(delta)}</TableCell>
                        <TableCell className={`text-right ${delta >= 0 ? "text-green-600" : "text-red-600"}`}>{pct.toFixed(1)}%</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
