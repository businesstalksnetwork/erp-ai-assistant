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
import { Button } from "@/components/ui/button";
import { BookText, Download } from "lucide-react";
import { fmtNum } from "@/lib/utils";
import { format } from "date-fns";
import { exportToCsv } from "@/lib/exportCsv";

export default function KpoBook() {
  const { t, locale } = useLanguage();
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
        .select("id, invoice_number, invoice_date, total_amount, subtotal, tax_amount, partner_name, status")
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
        .select("id, invoice_number, invoice_date, total_amount, net_amount, vat_amount, partner_id, status, partners(name)")
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

  // Running totals for KPO format
  const incomeRows = useMemo(() => {
    let cumulative = 0;
    return filteredInv.map((inv: any, idx: number) => {
      const net = Number(inv.subtotal || inv.total_amount || 0);
      const vat = Number(inv.tax_amount || 0);
      const gross = Number(inv.total_amount || 0);
      cumulative += gross;
      return { rb: idx + 1, date: inv.invoice_date, docNumber: inv.invoice_number, partner: inv.partner_name || "—", net, vat, gross, cumulative };
    });
  }, [filteredInv]);

  const expenseRows = useMemo(() => {
    let cumulative = 0;
    return filteredExp.map((exp: any, idx: number) => {
      const net = Number(exp.net_amount || exp.total_amount || 0);
      const vat = Number(exp.vat_amount || 0);
      const gross = Number(exp.total_amount || 0);
      cumulative += gross;
      return { rb: idx + 1, date: exp.invoice_date, docNumber: exp.invoice_number, partner: (exp.partners as any)?.name || "—", net, vat, gross, cumulative };
    });
  }, [filteredExp]);

  const totalIncome = incomeRows.length > 0 ? incomeRows[incomeRows.length - 1].cumulative : 0;
  const totalExpense = expenseRows.length > 0 ? expenseRows[expenseRows.length - 1].cumulative : 0;
  const isLoading = invLoading || expLoading;

  const handleExportCsv = () => {
    const rows = [
      ...incomeRows.map(r => ({ Tip: "Prihod", RB: r.rb, Datum: r.date, BrojDokumenta: r.docNumber, Partner: r.partner, OsnovicaBezPDV: r.net, PDV: r.vat, UkupanIznos: r.gross, Kumulativno: r.cumulative })),
      ...expenseRows.map(r => ({ Tip: "Rashod", RB: r.rb, Datum: r.date, BrojDokumenta: r.docNumber, Partner: r.partner, OsnovicaBezPDV: r.net, PDV: r.vat, UkupanIznos: r.gross, Kumulativno: r.cumulative })),
    ];
    const cols = Object.keys(rows[0] || {}).map(k => ({ key: k as any, label: k }));
    exportToCsv(rows, cols, `KPO-knjiga-${year}`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="KPO Knjiga"
        icon={BookText}
        description="Knjiga prihoda i rashoda za paušalne obveznike (Pravilnik Sl. gl. RS 69/2023)"
        actions={
          <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={incomeRows.length === 0 && expenseRows.length === 0}>
            <Download className="h-4 w-4 mr-2" />CSV
          </Button>
        }
      />

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
        <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Ukupni prihodi</p><p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{fmtNum(totalIncome)}</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Ukupni rashodi</p><p className="text-2xl font-bold text-destructive">{fmtNum(totalExpense)}</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Neto rezultat</p><p className="text-2xl font-bold">{fmtNum(totalIncome - totalExpense)}</p></CardContent></Card>
      </div>

      {isLoading ? <Skeleton className="h-64 w-full" /> : (
        <>
          <Card>
            <CardHeader><CardTitle>I — Prihodi ({incomeRows.length})</CardTitle></CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="w-12">R.B.</TableHead>
                  <TableHead>Datum prometa</TableHead>
                  <TableHead>Broj dokumenta</TableHead>
                  <TableHead>Partner / Kupac</TableHead>
                  <TableHead className="text-right">Osnovica bez PDV</TableHead>
                  <TableHead className="text-right">PDV</TableHead>
                  <TableHead className="text-right">Ukupan iznos</TableHead>
                  <TableHead className="text-right">Kumulativno</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {incomeRows.map(r => (
                    <TableRow key={r.rb}>
                      <TableCell>{r.rb}</TableCell>
                      <TableCell>{format(new Date(r.date), "dd.MM.yyyy")}</TableCell>
                      <TableCell>{r.docNumber}</TableCell>
                      <TableCell>{r.partner}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtNum(r.net)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtNum(r.vat)}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{fmtNum(r.gross)}</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">{fmtNum(r.cumulative)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-semibold">
                    <TableCell colSpan={6}>UKUPNO PRIHODI</TableCell>
                    <TableCell className="text-right">{fmtNum(totalIncome)}</TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>II — Rashodi ({expenseRows.length})</CardTitle></CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="w-12">R.B.</TableHead>
                  <TableHead>Datum prometa</TableHead>
                  <TableHead>Broj dokumenta</TableHead>
                  <TableHead>Dobavljač</TableHead>
                  <TableHead className="text-right">Osnovica bez PDV</TableHead>
                  <TableHead className="text-right">PDV</TableHead>
                  <TableHead className="text-right">Ukupan iznos</TableHead>
                  <TableHead className="text-right">Kumulativno</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {expenseRows.map(r => (
                    <TableRow key={r.rb}>
                      <TableCell>{r.rb}</TableCell>
                      <TableCell>{format(new Date(r.date), "dd.MM.yyyy")}</TableCell>
                      <TableCell>{r.docNumber}</TableCell>
                      <TableCell>{r.partner}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtNum(r.net)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtNum(r.vat)}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{fmtNum(r.gross)}</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">{fmtNum(r.cumulative)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-semibold">
                    <TableCell colSpan={6}>UKUPNO RASHODI</TableCell>
                    <TableCell className="text-right">{fmtNum(totalExpense)}</TableCell>
                    <TableCell />
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
