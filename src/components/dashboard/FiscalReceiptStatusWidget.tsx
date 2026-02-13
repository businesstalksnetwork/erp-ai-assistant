import { useLanguage } from "@/i18n/LanguageContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Receipt, RefreshCw, CheckCircle, WifiOff, XCircle } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface Props {
  tenantId: string;
}

export function FiscalReceiptStatusWidget({ tenantId }: Props) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [retrying, setRetrying] = useState(false);

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

  const stats = [
    { label: t("signedReceipts") || "Signed", count: signed, icon: CheckCircle, color: "text-green-600 dark:text-green-400" },
    { label: t("offlineReceipts"), count: offline, icon: WifiOff, color: "text-amber-600 dark:text-amber-400" },
    { label: t("failedReceipts") || "Failed", count: failed, icon: XCircle, color: "text-destructive" },
  ];

  return (
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
            <div key={s.label} className="flex flex-col items-center gap-1 p-3 rounded-lg bg-muted/50">
              <s.icon className={`h-5 w-5 ${s.color}`} />
              <span className="text-lg font-bold">{s.count}</span>
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
  );
}
