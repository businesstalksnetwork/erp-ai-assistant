import { useLanguage } from "@/i18n/LanguageContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Receipt, RefreshCw, CheckCircle, WifiOff, XCircle, TrendingUp, TrendingDown } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { format, subDays } from "date-fns";

interface Props {
  tenantId: string;
}

type FilterType = "signed" | "offline" | "failed";

export function FiscalReceiptStatusWidget({ tenantId }: Props) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [retrying, setRetrying] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<FilterType | null>(null);

  const todayStr = new Date().toISOString().split("T")[0];
  const weekAgoStr = subDays(new Date(), 7).toISOString().split("T")[0];

  // --- Total counts ---
  const { data: signed = 0 } = useQuery({
    queryKey: ["fiscal-status-signed", tenantId],
    queryFn: async () => {
      const { count } = await supabase
        .from("fiscal_receipts")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .not("receipt_number", "like", "OFFLINE-%");
      return count || 0;
    },
    enabled: !!tenantId,
    staleTime: 1000 * 60 * 5,
  });

  const { data: offline = 0 } = useQuery({
    queryKey: ["fiscal-status-offline", tenantId],
    queryFn: async () => {
      const { count } = await supabase
        .from("fiscal_receipts")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .like("receipt_number", "OFFLINE-%");
      return count || 0;
    },
    enabled: !!tenantId,
    staleTime: 1000 * 60 * 5,
  });

  const { data: failed = 0 } = useQuery({
    queryKey: ["fiscal-status-failed", tenantId],
    queryFn: async () => {
      const { count } = await supabase
        .from("fiscal_receipts")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("verification_status", "failed");
      return count || 0;
    },
    enabled: !!tenantId,
    staleTime: 1000 * 60 * 5,
  });

  // --- Trend: today counts ---
  const { data: trends } = useQuery({
    queryKey: ["fiscal-trends", tenantId, todayStr],
    queryFn: async () => {
      const [tSigned, tOffline, tFailed, wSigned, wOffline, wFailed] = await Promise.all([
        supabase.from("fiscal_receipts").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).not("receipt_number", "like", "OFFLINE-%").gte("created_at", todayStr).then(r => r.count || 0),
        supabase.from("fiscal_receipts").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).like("receipt_number", "OFFLINE-%").gte("created_at", todayStr).then(r => r.count || 0),
        supabase.from("fiscal_receipts").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("verification_status", "failed").gte("created_at", todayStr).then(r => r.count || 0),
        supabase.from("fiscal_receipts").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).not("receipt_number", "like", "OFFLINE-%").gte("created_at", weekAgoStr).then(r => r.count || 0),
        supabase.from("fiscal_receipts").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).like("receipt_number", "OFFLINE-%").gte("created_at", weekAgoStr).then(r => r.count || 0),
        supabase.from("fiscal_receipts").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("verification_status", "failed").gte("created_at", weekAgoStr).then(r => r.count || 0),
      ]);
      const calcTrend = (today: number, week: number) => {
        const avg = week / 7;
        if (avg === 0) return today > 0 ? 100 : 0;
        return Math.round(((today - avg) / avg) * 100);
      };
      return {
        signed: calcTrend(tSigned, wSigned),
        offline: calcTrend(tOffline, wOffline),
        failed: calcTrend(tFailed, wFailed),
      };
    },
    enabled: !!tenantId,
    staleTime: 1000 * 60 * 10,
  });

  // --- Detail dialog query ---
  const { data: detailReceipts = [], isLoading: detailLoading } = useQuery({
    queryKey: ["fiscal-detail", tenantId, selectedFilter],
    queryFn: async () => {
      let query = supabase
        .from("fiscal_receipts")
        .select("id, receipt_number, total_amount, payment_method, created_at, verification_status")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(20);

      if (selectedFilter === "signed") {
        query = query.not("receipt_number", "like", "OFFLINE-%");
      } else if (selectedFilter === "offline") {
        query = query.like("receipt_number", "OFFLINE-%");
      } else if (selectedFilter === "failed") {
        query = query.eq("verification_status", "failed");
      }

      const { data } = await query;
      return data || [];
    },
    enabled: !!tenantId && !!selectedFilter,
  });

  const handleRetry = async () => {
    setRetrying(true);
    try {
      const { error } = await supabase.functions.invoke("fiscalize-retry-offline", {
        body: { tenant_id: tenantId },
      });
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["fiscal-status-offline"] });
      qc.invalidateQueries({ queryKey: ["fiscal-status-signed"] });
      toast({ title: t("offlineRetried") });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setRetrying(false);
    }
  };

  const total = signed + offline + failed;

  const TrendIndicator = ({ value }: { value: number | undefined }) => {
    if (value === undefined || value === 0) return null;
    const isUp = value > 0;
    return (
      <span className={`flex items-center gap-0.5 text-[10px] font-medium ${isUp ? "text-green-600 dark:text-green-400" : "text-destructive"}`}>
        {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
        {isUp ? "+" : ""}{value}%
      </span>
    );
  };

  const stats = [
    { key: "signed" as FilterType, label: t("signedReceipts") || "Signed", count: signed, icon: CheckCircle, color: "text-green-600 dark:text-green-400", trend: trends?.signed },
    { key: "offline" as FilterType, label: t("offlineReceipts"), count: offline, icon: WifiOff, color: "text-amber-600 dark:text-amber-400", trend: trends?.offline },
    { key: "failed" as FilterType, label: t("failedReceipts") || "Failed", count: failed, icon: XCircle, color: "text-destructive", trend: trends?.failed },
  ];

  const dialogTitle = selectedFilter === "signed"
    ? (t("signedReceipts") || "Signed Receipts")
    : selectedFilter === "offline"
      ? (t("offlineReceipts") || "Offline Receipts")
      : (t("failedReceipts") || "Failed Receipts");

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Receipt className="h-4 w-4 text-primary" />
            {t("fiscalReceiptStatus") || "Fiscal Receipt Status"}
          </CardTitle>
          {offline > 0 && (
            <Button variant="outline" size="sm" onClick={handleRetry} disabled={retrying}>
              <RefreshCw className={`h-4 w-4 mr-2 ${retrying ? "animate-spin" : ""}`} />
              {t("retryOffline")}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            {stats.map((s) => (
              <div
                key={s.key}
                className="flex flex-col items-center gap-1 p-3 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
                onClick={() => setSelectedFilter(s.key)}
              >
                <s.icon className={`h-5 w-5 ${s.color}`} />
                <span className="text-lg font-bold">{s.count}</span>
                <TrendIndicator value={s.trend} />
                <span className="text-xs text-muted-foreground">{s.label}</span>
              </div>
            ))}
          </div>
          {total > 0 && (
            <div className="mt-3 flex h-2 rounded-full overflow-hidden bg-muted">
              {signed > 0 && (
                <div className="bg-green-500" style={{ width: `${(signed / total) * 100}%` }} />
              )}
              {offline > 0 && (
                <div className="bg-amber-500" style={{ width: `${(offline / total) * 100}%` }} />
              )}
              {failed > 0 && (
                <div className="bg-destructive" style={{ width: `${(failed / total) * 100}%` }} />
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedFilter} onOpenChange={(open) => !open && setSelectedFilter(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
          </DialogHeader>
          {detailLoading ? (
            <p className="text-sm text-muted-foreground py-4">Loading...</p>
          ) : detailReceipts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">{t("noReceipts") || "No receipts found."}</p>
          ) : (
            <div className="max-h-[400px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("receiptNumber") || "Receipt #"}</TableHead>
                    <TableHead className="text-right">{t("totalAmount") || "Amount"}</TableHead>
                    <TableHead>{t("paymentMethod") || "Payment"}</TableHead>
                    <TableHead>{t("verificationStatus") || "Status"}</TableHead>
                    <TableHead>{t("date") || "Date"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detailReceipts.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">{r.receipt_number}</TableCell>
                      <TableCell className="text-right">
                        {Number(r.total_amount || 0).toLocaleString("sr-RS", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>{r.payment_method || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={r.verification_status === "failed" ? "destructive" : "secondary"}>
                          {r.verification_status || "—"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.created_at ? format(new Date(r.created_at), "dd.MM.yyyy HH:mm") : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
