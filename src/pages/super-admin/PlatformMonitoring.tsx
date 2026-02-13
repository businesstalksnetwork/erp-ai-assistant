import { useLanguage } from "@/i18n/LanguageContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { subHours, format } from "date-fns";

export default function PlatformMonitoring() {
  const { t } = useLanguage();
  const now = new Date();
  const oneHourAgo = subHours(now, 1).toISOString();
  const twentyFourHoursAgo = subHours(now, 24).toISOString();

  const { data: activeSessions = 0 } = useQuery({
    queryKey: ["platform-active-sessions"],
    queryFn: async () => {
      const { data } = await supabase
        .from("audit_log")
        .select("user_id")
        .gte("created_at", oneHourAgo);
      if (!data) return 0;
      return new Set(data.map((r) => r.user_id)).size;
    },
    refetchInterval: 30000,
  });

  const { data: apiCalls = 0 } = useQuery({
    queryKey: ["platform-api-calls"],
    queryFn: async () => {
      const { count } = await supabase
        .from("module_events")
        .select("id", { count: "exact", head: true })
        .gte("created_at", twentyFourHoursAgo);
      return count || 0;
    },
    refetchInterval: 30000,
  });

  const { data: errors24h = 0 } = useQuery({
    queryKey: ["platform-errors"],
    queryFn: async () => {
      const { count } = await supabase
        .from("module_events")
        .select("id", { count: "exact", head: true })
        .gte("created_at", twentyFourHoursAgo)
        .eq("status", "failed");
      return count || 0;
    },
    refetchInterval: 30000,
  });

  const { data: recentEvents = [] } = useQuery({
    queryKey: ["platform-recent-events"],
    queryFn: async () => {
      const { data } = await supabase
        .from("module_events")
        .select("id, created_at, tenant_id, event_type, source_module, status, error_message")
        .order("created_at", { ascending: false })
        .limit(20);
      return data || [];
    },
    refetchInterval: 30000,
  });

  const cards = [
    { label: t("activeSessions") || "Active Sessions", value: activeSessions },
    { label: t("apiCalls24h") || "API Calls (24h)", value: apiCalls },
    { label: t("errors24h") || "Errors (24h)", value: errors24h },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{t("platformMonitoring")}</h1>
      <div className="grid gap-4 md:grid-cols-3">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">{c.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{c.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t("systemEvents") || "System Events"}</CardTitle>
        </CardHeader>
        <CardContent>
          {recentEvents.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("noSystemEvents") || "No system events logged."}</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("timestamp") || "Timestamp"}</TableHead>
                    <TableHead>{t("sourceModule")}</TableHead>
                    <TableHead>{t("eventType") || "Event Type"}</TableHead>
                    <TableHead>{t("status")}</TableHead>
                    <TableHead>{t("errorMessage") || "Error"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentEvents.map((ev: any) => (
                    <TableRow key={ev.id}>
                      <TableCell className="text-xs whitespace-nowrap">
                        {format(new Date(ev.created_at), "yyyy-MM-dd HH:mm:ss")}
                      </TableCell>
                      <TableCell className="text-sm">{ev.source_module}</TableCell>
                      <TableCell className="text-sm">{ev.event_type}</TableCell>
                      <TableCell>
                        <Badge variant={ev.status === "failed" ? "destructive" : "secondary"}>
                          {ev.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                        {ev.error_message || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
