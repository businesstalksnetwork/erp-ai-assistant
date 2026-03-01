import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClipboardList, Calculator, DollarSign } from "lucide-react";

interface PosXReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string | null;
}

export function PosXReportDialog({ open, onOpenChange, sessionId }: PosXReportDialogProps) {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const [cashCount, setCashCount] = useState<string>("");

  const { data: report, isLoading } = useQuery({
    queryKey: ["pos_x_report", tenantId, sessionId],
    queryFn: async () => {
      if (!tenantId || !sessionId) return null;

      const { data: transactions } = await supabase
        .from("pos_transactions")
        .select("total, payment_method, receipt_type, tax_amount, status")
        .eq("tenant_id", tenantId)
        .eq("session_id", sessionId)
        .in("status", ["fiscalized", "completed"]);

      if (!transactions) return null;

      const sales = transactions.filter((tx: any) => tx.receipt_type === "sale");
      const refunds = transactions.filter((tx: any) => tx.receipt_type === "refund");

      const totalSales = sales.reduce((s: number, tx: any) => s + Number(tx.total), 0);
      const totalRefunds = refunds.reduce((s: number, tx: any) => s + Number(tx.total), 0);
      const totalTax = sales.reduce((s: number, tx: any) => s + Number(tx.tax_amount || 0), 0);

      const byMethod: Record<string, { count: number; amount: number }> = {};
      sales.forEach((tx: any) => {
        const m = tx.payment_method || "cash";
        if (!byMethod[m]) byMethod[m] = { count: 0, amount: 0 };
        byMethod[m].count++;
        byMethod[m].amount += Number(tx.total);
      });

      const cashTotal = (byMethod["cash"]?.amount || 0) - refunds.filter((r: any) => r.payment_method === "cash").reduce((s: number, r: any) => s + Number(r.total), 0);

      return {
        salesCount: sales.length,
        totalSales,
        refundsCount: refunds.length,
        totalRefunds,
        netTotal: totalSales - totalRefunds,
        totalTax,
        byMethod,
        cashTotal,
      };
    },
    enabled: !!tenantId && !!sessionId && open,
  });

  const cashCountNum = parseFloat(cashCount) || 0;
  const variance = report ? cashCountNum - report.cashTotal : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            X-{t("report" as any) || "Izveštaj"} ({t("interim" as any) || "Privremeni"})
          </DialogTitle>
        </DialogHeader>

        {isLoading && <p className="text-sm text-muted-foreground py-4">{t("loading")}</p>}

        {report && (
          <div className="space-y-4">
            {/* Sales summary */}
            <div className="grid grid-cols-2 gap-3">
              <Card>
                <CardContent className="p-3 text-center">
                  <p className="text-xs text-muted-foreground">{t("sales" as any) || "Prodaje"}</p>
                  <p className="text-xl font-bold">{report.salesCount}</p>
                  <p className="text-sm font-mono">{report.totalSales.toFixed(2)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <p className="text-xs text-muted-foreground">{t("refunds" as any) || "Povraćaji"}</p>
                  <p className="text-xl font-bold">{report.refundsCount}</p>
                  <p className="text-sm font-mono text-destructive">-{report.totalRefunds.toFixed(2)}</p>
                </CardContent>
              </Card>
            </div>

            {/* By payment method */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{t("byPaymentMethod" as any) || "Po načinu plaćanja"}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {Object.entries(report.byMethod).map(([method, data]) => (
                  <div key={method} className="flex justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">{method}</Badge>
                      <span className="text-muted-foreground">×{data.count}</span>
                    </span>
                    <span className="font-mono">{data.amount.toFixed(2)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Net total */}
            <div className="flex justify-between font-bold text-lg border-t pt-3">
              <span>{t("netTotal" as any) || "Neto ukupno"}:</span>
              <span className="font-mono">{report.netTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{t("taxAmount")}:</span>
              <span className="font-mono">{report.totalTax.toFixed(2)}</span>
            </div>

            {/* Cash count */}
            <Card className="bg-muted/50">
              <CardContent className="p-3 space-y-2">
                <p className="text-sm font-medium flex items-center gap-2">
                  <Calculator className="h-4 w-4" />
                  {t("cashCount" as any) || "Prebrojavanje gotovine"}
                </p>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">{t("expectedCash" as any) || "Očekivano"}:</span>
                  <span className="font-mono font-bold">{report.cashTotal.toFixed(2)}</span>
                </div>
                <Input
                  type="number"
                  step="0.01"
                  placeholder={t("actualCashAmount" as any) || "Stvarni iznos gotovine..."}
                  value={cashCount}
                  onChange={(e) => setCashCount(e.target.value)}
                  className="font-mono"
                />
                {cashCountNum > 0 && (
                  <div className={`flex justify-between font-bold ${Math.abs(variance) < 0.01 ? "text-success" : "text-destructive"}`}>
                    <span>{t("variance" as any) || "Razlika"}:</span>
                    <span className="font-mono">
                      {variance >= 0 ? "+" : ""}{variance.toFixed(2)}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        <DialogFooter>
          <p className="text-xs text-muted-foreground mr-auto">
            {t("xReportNote" as any) || "* X-izveštaj ne zatvara smenu"}
          </p>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
