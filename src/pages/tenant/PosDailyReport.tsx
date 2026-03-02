import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FileText, DollarSign, CreditCard, Banknote, RotateCcw, Printer, Clock, Shield } from "lucide-react";

interface TaxGroup {
  rate: number;
  taxableBase: number;
  taxAmount: number;
  total: number;
}

export default function PosDailyReport() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [locationFilter, setLocationFilter] = useState<string>("all");
  const [reportDate, setReportDate] = useState(new Date().toISOString().split("T")[0]);
  const [openingFloat, setOpeningFloat] = useState<number>(0);
  const [actualCashCount, setActualCashCount] = useState<number | null>(null);

  const { data: locations = [] } = useQuery({
    queryKey: ["locations_shops", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("locations").select("id, name, type").eq("tenant_id", tenantId!).in("type", ["shop", "branch"]);
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ["pos_tx_daily", tenantId, locationFilter, reportDate],
    queryFn: async () => {
      let q = supabase.from("pos_transactions").select("*").eq("tenant_id", tenantId!).gte("created_at", `${reportDate}T00:00:00`).lt("created_at", `${reportDate}T23:59:59`);
      if (locationFilter !== "all") q = q.eq("location_id", locationFilter);
      const { data } = await q;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ["pos_sessions_daily", tenantId, locationFilter, reportDate],
    queryFn: async () => {
      let q = supabase.from("pos_sessions").select("*, profiles:opened_by(full_name)").eq("tenant_id", tenantId!).gte("opened_at", `${reportDate}T00:00:00`).lt("opened_at", `${reportDate}T23:59:59`);
      // GAP 5: also select fiscal_device_id from sessions
      if (locationFilter !== "all") q = q.eq("location_id", locationFilter);
      const { data } = await q;
      return (data as any[]) || [];
    },
    enabled: !!tenantId,
  });

  const { data: savedReports = [] } = useQuery({
    queryKey: ["pos_daily_reports", tenantId, locationFilter],
    queryFn: async () => {
      let q = supabase.from("pos_daily_reports").select("*").eq("tenant_id", tenantId!).order("report_date", { ascending: false }).limit(30);
      if (locationFilter !== "all") q = q.eq("location_id", locationFilter);
      const { data } = await q;
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Calculate live report from transactions
  const sales = transactions.filter((tx: any) => tx.receipt_type === "sale");
  const refunds = transactions.filter((tx: any) => tx.receipt_type === "refund");
  const totalSales = sales.reduce((s: number, tx: any) => s + Number(tx.total || 0), 0);
  const totalRefunds = refunds.reduce((s: number, tx: any) => s + Number(tx.total || 0), 0);
  const netSales = totalSales - totalRefunds;
  // CR12-05: Split payment aware bucketing
  const sumByMethod = (txList: any[], method: string) => txList.reduce((s: number, tx: any) => {
    const pd = tx.payment_details;
    if (Array.isArray(pd) && pd.length > 1) {
      return s + pd.filter((p: any) => p.method === method).reduce((ps: number, p: any) => ps + Number(p.amount || 0), 0);
    }
    return tx.payment_method === method ? s + Number(tx.total || 0) : s;
  }, 0);
  const cashTotal = sumByMethod(sales, "cash");
  const cashRefunds = sumByMethod(refunds, "cash");
  const cardTotal = sumByMethod(sales, "card");
  const otherTotal = totalSales - cashTotal - cardTotal;
  const expectedCash = cashTotal - cashRefunds;
  const cashVariance = actualCashCount !== null ? actualCashCount - (openingFloat + expectedCash) : null;

  // Tax breakdown from items JSONB
  const taxGroups: TaxGroup[] = (() => {
    const groups: Record<number, TaxGroup> = {};
    for (const tx of sales) {
      const items = (tx as any).items;
      if (!Array.isArray(items)) continue;
      for (const item of items) {
        const rate = Number(item.tax_rate || 0);
        const base = Number(item.unit_price || 0) * Number(item.quantity || 0);
        const tax = base * (rate / 100);
        if (!groups[rate]) groups[rate] = { rate, taxableBase: 0, taxAmount: 0, total: 0 };
        groups[rate].taxableBase += base;
        groups[rate].taxAmount += tax;
        groups[rate].total += base + tax;
      }
    }
    return Object.values(groups).sort((a, b) => b.rate - a.rate);
  })();

  // Shift summary: group transactions by session_id
  const shiftSummary = sessions.map((session: any) => {
    const sessionTx = sales.filter((tx: any) => tx.session_id === session.id);
    const sessionRefunds = refunds.filter((tx: any) => tx.session_id === session.id);
    return {
      id: session.id,
      cashier: (session.profiles as any)?.full_name || "—",
      openedAt: session.opened_at,
      closedAt: session.closed_at,
      salesCount: sessionTx.length,
      refundCount: sessionRefunds.length,
      totalSales: sessionTx.reduce((s: number, tx: any) => s + Number(tx.total || 0), 0),
    };
  });

  const generateReport = useMutation({
    mutationFn: async () => {
      const taxBreakdown = taxGroups.reduce((acc, g) => {
        acc[`${g.rate}%`] = { taxableBase: g.taxableBase, taxAmount: g.taxAmount, total: g.total };
        return acc;
      }, {} as Record<string, any>);
      // GAP 5: resolve fiscal_device_id from sessions
      const sessionDeviceIds = sessions
        .map((s: any) => s.fiscal_device_id)
        .filter(Boolean);
      const fiscalDeviceId = sessionDeviceIds.length > 0 ? sessionDeviceIds[0] : null;

      const { error } = await supabase.from("pos_daily_reports").insert({
        tenant_id: tenantId!,
        location_id: locationFilter !== "all" ? locationFilter : null,
        report_date: reportDate,
        total_sales: totalSales,
        total_refunds: totalRefunds,
        net_sales: netSales,
        cash_total: cashTotal,
        card_total: cardTotal,
        other_total: otherTotal,
        transaction_count: sales.length,
        refund_count: refunds.length,
        tax_breakdown: taxBreakdown,
        opening_float: openingFloat,
        actual_cash_count: actualCashCount,
        cash_variance: cashVariance,
        fiscal_device_id: fiscalDeviceId,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pos_daily_reports"] }); toast({ title: t("success") }); },
    onError: () => toast({ title: t("error"), variant: "destructive" }),
  });

  // GAP 6: Fetch PFR-signed Z-report journal
  const fetchPfrJournal = useMutation({
    mutationFn: async (reportId: string) => {
      const report = savedReports.find((r: any) => r.id === reportId);
      if (!report) throw new Error("Report not found");

      // Find fiscal device for this report's location
      let deviceId = (report as any).fiscal_device_id;
      if (!deviceId) {
        const locId = (report as any).location_id;
        if (locId) {
          const { data: devices } = await supabase.from("fiscal_devices").select("id").eq("tenant_id", tenantId!).eq("location_id", locId).eq("is_active", true).limit(1);
          deviceId = devices?.[0]?.id;
        }
      }
      if (!deviceId) throw new Error("No fiscal device found");

      const { data: result, error: fiscalErr } = await supabase.functions.invoke("fiscalize-receipt", {
        body: {
          tenant_id: tenantId,
          device_id: deviceId,
          journal_report: {
            date_from: `${(report as any).report_date}T00:00:00`,
            date_to: `${(report as any).report_date}T23:59:59`,
          },
        },
      });

      if (fiscalErr) throw fiscalErr;

      // Store PFR response
      await supabase.from("pos_daily_reports").update({
        pfr_journal_response: result,
        pfr_journal_fetched_at: new Date().toISOString(),
      } as any).eq("id", reportId);

      return result;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pos_daily_reports"] }); toast({ title: t("pfrJournalFetched") }); },
    onError: (e: any) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("dailyReport")}</h1>
        <div className="flex gap-2">
          <Select value={locationFilter} onValueChange={setLocationFilter}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allLocations")}</SelectItem>
              {locations.map((l: any) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="date" value={reportDate} onChange={e => setReportDate(e.target.value)} className="w-44" />
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><DollarSign className="h-8 w-8 text-primary" /><div><p className="text-2xl font-bold">{totalSales.toFixed(2)}</p><p className="text-sm text-muted-foreground">{t("totalSales")}</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><RotateCcw className="h-8 w-8 text-destructive" /><div><p className="text-2xl font-bold">{totalRefunds.toFixed(2)}</p><p className="text-sm text-muted-foreground">{t("totalRefunds")}</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><Banknote className="h-8 w-8 text-primary" /><div><p className="text-2xl font-bold">{cashTotal.toFixed(2)}</p><p className="text-sm text-muted-foreground">{t("cashTotal")}</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><CreditCard className="h-8 w-8 text-primary" /><div><p className="text-2xl font-bold">{cardTotal.toFixed(2)}</p><p className="text-sm text-muted-foreground">{t("cardTotal")}</p></div></div></CardContent></Card>
      </div>

      {/* Z-Report + Tax Breakdown side by side */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{t("zReport")} — {reportDate}</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="h-4 w-4 mr-2" />{t("printReceipt")}</Button>
              <Button size="sm" onClick={() => generateReport.mutate()} disabled={transactions.length === 0}><FileText className="h-4 w-4 mr-2" />{t("generateReport")}</Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span>{t("totalSales")}:</span><span className="font-bold">{totalSales.toFixed(2)}</span></div>
              <div className="flex justify-between"><span>{t("totalRefunds")}:</span><span className="font-bold text-destructive">-{totalRefunds.toFixed(2)}</span></div>
              <div className="flex justify-between border-t pt-2"><span className="font-bold">{t("netSales")}:</span><span className="font-bold text-lg">{netSales.toFixed(2)}</span></div>
              <div className="flex justify-between mt-2"><span>{t("cash")}:</span><span>{cashTotal.toFixed(2)}</span></div>
              <div className="flex justify-between"><span>{t("card")}:</span><span>{cardTotal.toFixed(2)}</span></div>
              <div className="flex justify-between"><span>{t("other")}:</span><span>{otherTotal.toFixed(2)}</span></div>
              <div className="flex justify-between border-t pt-2"><span>{t("transactions")}:</span><span>{sales.length} / {refunds.length} {t("refund")}</span></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t("taxBreakdown")}</CardTitle></CardHeader>
          <CardContent>
            {taxGroups.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noResults")}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("taxRate")}</TableHead>
                    <TableHead className="text-right">{t("taxableBase")}</TableHead>
                    <TableHead className="text-right">{t("taxAmount")}</TableHead>
                    <TableHead className="text-right">{t("total")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {taxGroups.map(g => (
                    <TableRow key={g.rate}>
                      <TableCell><Badge variant="outline">{g.rate}%</Badge></TableCell>
                      <TableCell className="text-right">{g.taxableBase.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{g.taxAmount.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-bold">{g.total.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Cash Reconciliation */}
      <Card>
        <CardHeader><CardTitle>{t("cashReconciliation")}</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 items-end">
            <div className="grid gap-1.5">
              <Label className="text-xs">{t("openingFloat")}</Label>
              <Input type="number" step="0.01" value={openingFloat} onChange={e => setOpeningFloat(Number(e.target.value))} />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">{t("expectedCash")}</Label>
              <Input value={expectedCash.toFixed(2)} readOnly className="bg-muted" />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">{t("actualCashCount")}</Label>
              <Input type="number" step="0.01" value={actualCashCount ?? ""} onChange={e => setActualCashCount(e.target.value ? Number(e.target.value) : null)} placeholder="0.00" />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">{t("cashVariance")}</Label>
              <Input
                value={cashVariance !== null ? cashVariance.toFixed(2) : "—"}
                readOnly
                className={`bg-muted ${cashVariance !== null && cashVariance !== 0 ? (cashVariance > 0 ? "text-green-600" : "text-destructive") : ""}`}
              />
            </div>
            <div className="text-xs text-muted-foreground self-center">
              = {t("actualCashCount")} − ({t("openingFloat")} + {t("expectedCash")})
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Shift Summary */}
      {shiftSummary.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" />{t("shiftSummary")}</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("cashier")}</TableHead>
                  <TableHead>{t("openedAt")}</TableHead>
                  <TableHead>{t("closedAt")}</TableHead>
                  <TableHead className="text-right">{t("totalSales")}</TableHead>
                  <TableHead className="text-right">{t("transactions")}</TableHead>
                  <TableHead className="text-right">{t("refund")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shiftSummary.map(s => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.cashier}</TableCell>
                    <TableCell>{s.openedAt ? new Date(s.openedAt).toLocaleTimeString() : "—"}</TableCell>
                    <TableCell>{s.closedAt ? new Date(s.closedAt).toLocaleTimeString() : <Badge variant="secondary">{t("active")}</Badge>}</TableCell>
                    <TableCell className="text-right font-bold">{s.totalSales.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{s.salesCount}</TableCell>
                    <TableCell className="text-right">{s.refundCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* History */}
      <Card>
        <CardHeader><CardTitle>{t("reportHistory")}</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("date")}</TableHead>
                <TableHead className="text-right">{t("totalSales")}</TableHead>
                <TableHead className="text-right">{t("totalRefunds")}</TableHead>
                <TableHead className="text-right">{t("netSales")}</TableHead>
                 <TableHead className="text-right">{t("transactions")}</TableHead>
                 <TableHead>{t("pfrZReport")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {savedReports.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell>{r.report_date}</TableCell>
                  <TableCell className="text-right">{Number(r.total_sales).toFixed(2)}</TableCell>
                  <TableCell className="text-right text-destructive">{Number(r.total_refunds).toFixed(2)}</TableCell>
                  <TableCell className="text-right font-bold">{Number(r.net_sales).toFixed(2)}</TableCell>
                  <TableCell className="text-right">{r.transaction_count}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {r.pfr_journal_response ? (
                        <Badge variant="default" className="text-xs gap-1"><Shield className="h-3 w-3" /> PFR</Badge>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => fetchPfrJournal.mutate(r.id)} disabled={fetchPfrJournal.isPending}>
                          <Shield className="h-3 w-3 mr-1" />{t("fetchPfrJournal")}
                        </Button>
                      )}
                    </div>
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
