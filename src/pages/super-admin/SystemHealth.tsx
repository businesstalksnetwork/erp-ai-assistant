/**
 * BC-03: Super Admin System Health Dashboard
 * ISO 22301 — Business Continuity: uptime monitoring, response times, system status.
 */
import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Database, HardDrive, Cpu, CheckCircle, XCircle, AlertTriangle } from "lucide-react";

interface HealthCheck {
  status: string;
  latency_ms: number;
  error?: string;
}

interface HealthResponse {
  status: string;
  timestamp: string;
  total_latency_ms: number;
  checks: Record<string, HealthCheck>;
}

export default function SystemHealth() {
  const { t } = useLanguage();
  const [refreshKey, setRefreshKey] = useState(0);

  const { data: health, isLoading, error } = useQuery<HealthResponse>({
    queryKey: ["system-health", refreshKey],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("health-check");
      if (error) throw error;
      return data as HealthResponse;
    },
    refetchInterval: 30000,
  });

  const statusIcon = (status: string) => {
    if (status === "healthy") return <CheckCircle className="h-5 w-5 text-primary" />;
    if (status === "degraded") return <AlertTriangle className="h-5 w-5 text-accent-foreground" />;
    if (status === "unconfigured") return <AlertTriangle className="h-5 w-5 text-muted-foreground" />;
    return <XCircle className="h-5 w-5 text-destructive" />;
  };

  const statusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      healthy: "default",
      degraded: "outline",
      unconfigured: "secondary",
      down: "destructive",
    };
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  const serviceIcon = (key: string) => {
    if (key === "database") return <Database className="h-5 w-5" />;
    if (key === "storage") return <HardDrive className="h-5 w-5" />;
    return <Cpu className="h-5 w-5" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("systemHealth") || "System Health"}</h1>
          <p className="text-sm text-muted-foreground">ISO 22301 — Business Continuity Monitoring</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setRefreshKey((k) => k + 1)} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? "animate-spin" : ""}`} />
          {t("refresh") || "Refresh"}
        </Button>
      </div>

      {/* Overall status */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {health ? statusIcon(health.status) : <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />}
              <div>
                <p className="font-semibold text-lg">
                  {health ? (health.status === "healthy" ? "All Systems Operational" : "System Degraded") : "Checking..."}
                </p>
                <p className="text-xs text-muted-foreground">
                  {health ? `Last check: ${new Date(health.timestamp).toLocaleString()} • ${health.total_latency_ms}ms` : ""}
                </p>
              </div>
            </div>
            {health && statusBadge(health.status)}
          </div>
        </CardContent>
      </Card>

      {/* Individual checks */}
      <div className="grid gap-4 md:grid-cols-3">
        {health?.checks &&
          Object.entries(health.checks).map(([key, check]) => (
            <Card key={key}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  {serviceIcon(key)}
                  {key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  {statusBadge(check.status)}
                  <span className="text-xs text-muted-foreground">{check.latency_ms}ms</span>
                </div>
                {check.error && (
                  <p className="text-xs text-destructive mt-2 truncate" title={check.error}>
                    {check.error}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-4">
            <p className="text-sm text-destructive">Failed to fetch health status: {String(error)}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
