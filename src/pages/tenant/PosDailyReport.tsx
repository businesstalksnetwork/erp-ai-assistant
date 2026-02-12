import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
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
import { FileText, DollarSign, CreditCard, Banknote, RotateCcw, Printer } from "lucide-react";

export default function PosDailyReport() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [locationFilter, setLocationFilter] = useState<string>("all");
  const [reportDate, setReportDate] = useState(new Date().toISOString().split("T")[0]);

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
  const cashTotal = sales.filter((tx: any) => tx.payment_method === "cash").reduce((s: number, tx: any) => s + Number(tx.total || 0), 0);
  const cardTotal = sales.filter((tx: any) => tx.payment_method === "card").reduce((s: number, tx: any) => s + Number(tx.total || 0), 0);
  const otherTotal = totalSales - cashTotal - cardTotal;

  const generateReport = useMutation({
    mutationFn: async () => {
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
        tax_breakdown: {},
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pos_daily_reports"] }); toast({ title: t("success") }); },
    onError: () => toast({ title: t("error"), variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t("dailyReport")}</h1>
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><DollarSign className="h-8 w-8 text-primary" /><div><p className="text-2xl font-bold">{totalSales.toFixed(2)}</p><p className="text-sm text-muted-foreground">{t("totalSales")}</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><RotateCcw className="h-8 w-8 text-destructive" /><div><p className="text-2xl font-bold">{totalRefunds.toFixed(2)}</p><p className="text-sm text-muted-foreground">{t("totalRefunds")}</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><Banknote className="h-8 w-8 text-primary" /><div><p className="text-2xl font-bold">{cashTotal.toFixed(2)}</p><p className="text-sm text-muted-foreground">{t("cashTotal")}</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><CreditCard className="h-8 w-8 text-primary" /><div><p className="text-2xl font-bold">{cardTotal.toFixed(2)}</p><p className="text-sm text-muted-foreground">{t("cardTotal")}</p></div></div></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t("zReport")} — {reportDate}</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4 mr-2" />{t("printReceipt")}</Button>
            <Button onClick={() => generateReport.mutate()} disabled={transactions.length === 0}><FileText className="h-4 w-4 mr-2" />{t("generateReport")}</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <div className="flex justify-between"><span>{t("totalSales")}:</span><span className="font-bold">{totalSales.toFixed(2)}</span></div>
              <div className="flex justify-between"><span>{t("totalRefunds")}:</span><span className="font-bold text-destructive">-{totalRefunds.toFixed(2)}</span></div>
              <div className="flex justify-between border-t pt-2"><span className="font-bold">{t("netSales")}:</span><span className="font-bold text-lg">{netSales.toFixed(2)}</span></div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between"><span>{t("cash")}:</span><span>{cashTotal.toFixed(2)}</span></div>
              <div className="flex justify-between"><span>{t("card")}:</span><span>{cardTotal.toFixed(2)}</span></div>
              <div className="flex justify-between"><span>{t("other")}:</span><span>{otherTotal.toFixed(2)}</span></div>
              <div className="flex justify-between border-t pt-2"><span>{t("transactions")}:</span><span>{sales.length} / {refunds.length} {t("refund")}</span></div>
            </div>
          </div>
        </CardContent>
      </Card>

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
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
