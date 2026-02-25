import { useState, useMemo } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { BookText } from "lucide-react";
import { fmtNum } from "@/lib/utils";

export default function KpoBook() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [quarter, setQuarter] = useState<string>("all");

  // Fetch invoices as income records
  const { data: invoices = [], isLoading: invLoading } = useQuery({
    queryKey: ["kpo-invoices", tenantId, year],
    queryFn: async () => {
      const { data } = await supabase
        .from("invoices")
        .select("id, invoice_number, invoice_date, total_amount, partner_name, status")
        .eq("tenant_id", tenantId!)
        .gte("invoice_date", `${year}-01-01`)
        .lte("invoice_date", `${year}-12-31`)
        .in("status", ["sent", "paid", "posted"])
        .order("invoice_date");
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Fetch expenses
  const { data: expenses = [], isLoading: expLoading } = useQuery({
    queryKey: ["kpo-expenses", tenantId, year],
    queryFn: async () => {
      const { data } = await supabase
        .from("supplier_invoices")
        .select("id, invoice_number, invoice_date, total_amount, partner_id, status, partners(name)")
        .eq("tenant_id", tenantId!)
        .gte("invoice_date", `${year}-01-01`)
        .lte("invoice_date", `${year}-12-31`)
        .in("status", ["approved", "paid", "posted"])
        .order("invoice_date");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const getQuarter = (dateStr: string) => Math.ceil((new Date(dateStr).getMonth() + 1) / 3);

  const filteredInv = useMemo(() => quarter === "all" ? invoices : invoices.filter((i: any) => getQuarter(i.invoice_date) === Number(quarter)), [invoices, quarter]);
  const filteredExp = useMemo(() => quarter === "all" ? expenses : expenses.filter((e: any) => getQuarter(e.invoice_date) === Number(quarter)), [expenses, quarter]);

  const totalIncome = filteredInv.reduce((s, i: any) => s + Number(i.total_amount), 0);
  const totalExpense = filteredExp.reduce((s, e: any) => s + Number(e.total_amount), 0);
  const isLoading = invLoading || expLoading;

  return (
    <div className="space-y-6">
      <PageHeader title="KPO Knjiga" icon={BookText} description="Knjiga prihoda i rashoda za paušalne obveznike" />

      <div className="flex gap-4 flex-wrap">
        <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>{[2026, 2025, 2024].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={quarter} onValueChange={setQuarter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Kvartal" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Cela godina</SelectItem>
            <SelectItem value="1">Q1 (Jan-Mar)</SelectItem>
            <SelectItem value="2">Q2 (Apr-Jun)</SelectItem>
            <SelectItem value="3">Q3 (Jul-Sep)</SelectItem>
            <SelectItem value="4">Q4 (Okt-Dec)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Ukupni prihodi</p><p className="text-2xl font-bold text-green-600">{fmtNum(totalIncome)}</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Ukupni rashodi</p><p className="text-2xl font-bold text-red-600">{fmtNum(totalExpense)}</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Neto rezultat</p><p className="text-2xl font-bold">{fmtNum(totalIncome - totalExpense)}</p></CardContent></Card>
      </div>

      {isLoading ? <Skeleton className="h-64 w-full" /> : (
        <>
          <Card>
            <CardHeader><CardTitle>Prihodi ({filteredInv.length})</CardTitle></CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>R.B.</TableHead>
                  <TableHead>Datum</TableHead>
                  <TableHead>Broj dokumenta</TableHead>
                  <TableHead>Partner</TableHead>
                  <TableHead className="text-right">Iznos (RSD)</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {filteredInv.map((inv: any, idx) => (
                    <TableRow key={inv.id}>
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell>{inv.invoice_date}</TableCell>
                      <TableCell>{inv.invoice_number}</TableCell>
                      <TableCell>{inv.partner_name || "—"}</TableCell>
                      <TableCell className="text-right font-medium">{fmtNum(Number(inv.total_amount))}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-semibold">
                    <TableCell colSpan={4}>UKUPNO PRIHODI</TableCell>
                    <TableCell className="text-right">{fmtNum(totalIncome)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Rashodi ({filteredExp.length})</CardTitle></CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>R.B.</TableHead>
                  <TableHead>Datum</TableHead>
                  <TableHead>Broj dokumenta</TableHead>
                  <TableHead>Dobavljač</TableHead>
                  <TableHead className="text-right">Iznos (RSD)</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {filteredExp.map((exp: any, idx) => (
                    <TableRow key={exp.id}>
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell>{exp.invoice_date}</TableCell>
                      <TableCell>{exp.invoice_number}</TableCell>
                      <TableCell>{(exp.partners as any)?.name || "—"}</TableCell>
                      <TableCell className="text-right font-medium">{fmtNum(Number(exp.total_amount))}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-semibold">
                    <TableCell colSpan={4}>UKUPNO RASHODI</TableCell>
                    <TableCell className="text-right">{fmtNum(totalExpense)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
