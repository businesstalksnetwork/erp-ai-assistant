import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, CheckCircle, XCircle, AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

interface ConnectionInfo {
  name: string;
  table: string;
  isActive: boolean | null;
  lastSync: string | null;
  lastError: string | null;
  loading: boolean;
}

function useConnectionStatus(table: string, tenantId: string | null) {
  return useQuery({
    queryKey: ["integration-health", table, tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(table as any)
        .select("is_active, last_sync_at, last_error, updated_at")
        .eq("tenant_id", tenantId!)
        .maybeSingle();
      if (error) return null;
      return data as any;
    },
    enabled: !!tenantId,
    staleTime: 1000 * 60 * 2,
  });
}

export default function IntegrationHealth() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();

  const sef = useConnectionStatus("sef_connections", tenantId);
  const eotpremnica = useConnectionStatus("eotpremnica_connections", tenantId);
  const ebolovanje = useConnectionStatus("ebolovanje_connections", tenantId);

  const connections: ConnectionInfo[] = [
    {
      name: "SEF (eFaktura)",
      table: "sef_connections",
      isActive: sef.data?.is_active ?? null,
      lastSync: sef.data?.last_sync_at || sef.data?.updated_at || null,
      lastError: sef.data?.last_error || null,
      loading: sef.isLoading,
    },
    {
      name: "eOtpremnica",
      table: "eotpremnica_connections",
      isActive: eotpremnica.data?.is_active ?? null,
      lastSync: eotpremnica.data?.last_sync_at || eotpremnica.data?.updated_at || null,
      lastError: eotpremnica.data?.last_error || null,
      loading: eotpremnica.isLoading,
    },
    {
      name: "eBolovanje (RFZO)",
      table: "ebolovanje_connections",
      isActive: ebolovanje.data?.is_active ?? null,
      lastSync: ebolovanje.data?.last_sync_at || ebolovanje.data?.updated_at || null,
      lastError: ebolovanje.data?.last_error || null,
      loading: ebolovanje.isLoading,
    },
  ];

  const refetchAll = () => {
    sef.refetch();
    eotpremnica.refetch();
    ebolovanje.refetch();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            {t("integrations")} — Health Check
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Status pregleda svih konekcija ka eksternim servisima.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refetchAll}>
          <RefreshCw className="h-4 w-4 mr-1.5" />
          Osveži
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {connections.map((conn) => (
          <Card key={conn.table} className="relative overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center justify-between">
                {conn.name}
                {conn.loading ? (
                  <Badge variant="outline" className="text-muted-foreground">
                    <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                    Loading
                  </Badge>
                ) : conn.isActive === null ? (
                  <Badge variant="outline" className="text-muted-foreground">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Nije konfigurisano
                  </Badge>
                ) : conn.isActive ? (
                  <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Aktivno
                  </Badge>
                ) : (
                  <Badge variant="destructive">
                    <XCircle className="h-3 w-3 mr-1" />
                    Neaktivno
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Poslednja sinhronizacija:</span>
                <span className="font-medium">
                  {conn.lastSync ? format(new Date(conn.lastSync), "dd.MM.yyyy HH:mm") : "—"}
                </span>
              </div>
              {conn.lastError && (
                <div className="rounded-md bg-destructive/10 p-2 text-xs text-destructive">
                  {conn.lastError}
                </div>
              )}
            </CardContent>
            {conn.isActive && (
              <div className="absolute top-0 left-0 w-full h-0.5 bg-emerald-500" />
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
