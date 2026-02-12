import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useLanguage } from "@/i18n/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, Eye, RotateCcw, Activity } from "lucide-react";
import { format } from "date-fns";

type EventStatus = "pending" | "processing" | "completed" | "failed";

const statusColors: Record<EventStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  processing: "bg-blue-100 text-blue-800 border-blue-200",
  completed: "bg-green-100 text-green-800 border-green-200",
  failed: "bg-red-100 text-red-800 border-red-200",
};

export default function EventMonitor() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [moduleFilter, setModuleFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  // Fetch events
  const { data: events = [], isLoading } = useQuery({
    queryKey: ["module-events", tenantId, statusFilter, moduleFilter, searchTerm],
    queryFn: async () => {
      if (!tenantId) return [];
      let query = supabase
        .from("module_events")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(100);

      if (statusFilter !== "all") query = query.eq("status", statusFilter);
      if (moduleFilter !== "all") query = query.eq("source_module", moduleFilter);
      if (searchTerm) query = query.ilike("event_type", `%${searchTerm}%`);

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
    refetchInterval: 10000,
  });

  // Fetch logs for selected event
  const { data: eventLogs = [] } = useQuery({
    queryKey: ["module-event-logs", selectedEventId],
    queryFn: async () => {
      if (!selectedEventId) return [];
      const { data, error } = await supabase
        .from("module_event_logs")
        .select("*, module_event_subscriptions(event_type, handler_module, handler_function)")
        .eq("event_id", selectedEventId)
        .order("executed_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedEventId,
  });

  // Retry mutation
  const retryMutation = useMutation({
    mutationFn: async (eventId: string) => {
      const { data, error } = await supabase.functions.invoke("process-module-event", {
        body: { event_id: eventId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: t("success"), description: t("eventRetried") });
      queryClient.invalidateQueries({ queryKey: ["module-events"] });
      queryClient.invalidateQueries({ queryKey: ["module-event-logs"] });
    },
    onError: (err: Error) => {
      toast({ title: t("error"), description: err.message, variant: "destructive" });
    },
  });

  // Stats
  const pendingCount = events.filter((e) => e.status === "pending").length;
  const failedCount = events.filter((e) => e.status === "failed").length;
  const completedCount = events.filter((e) => e.status === "completed").length;

  const modules = [...new Set(events.map((e) => e.source_module))];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold">{t("eventMonitor")}</h1>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => queryClient.invalidateQueries({ queryKey: ["module-events"] })}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          {t("refresh")}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("pending")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("completed")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-destructive">{t("failed")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{failedCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Input
          placeholder={t("search")}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-64"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allStatuses")}</SelectItem>
            <SelectItem value="pending">{t("pending")}</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="completed">{t("completed")}</SelectItem>
            <SelectItem value="failed">{t("failed")}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={moduleFilter} onValueChange={setModuleFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allTypes")}</SelectItem>
            {modules.map((m) => (
              <SelectItem key={m} value={m}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Events Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("eventType")}</TableHead>
                <TableHead>{t("sourceModule")}</TableHead>
                <TableHead>{t("entityType")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead>{t("retries")}</TableHead>
                <TableHead>{t("createdAt")}</TableHead>
                <TableHead>{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">{t("loading")}</TableCell>
                </TableRow>
              ) : events.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    {t("noResults")}
                  </TableCell>
                </TableRow>
              ) : (
                events.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="font-mono text-sm">{event.event_type}</TableCell>
                    <TableCell>{event.source_module}</TableCell>
                    <TableCell>{event.entity_type}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[event.status as EventStatus] || ""} variant="outline">
                        {event.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{event.retry_count}/{event.max_retries}</TableCell>
                    <TableCell className="text-sm">
                      {format(new Date(event.created_at), "dd.MM.yyyy HH:mm")}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setSelectedEventId(event.id)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {(event.status === "failed" || event.status === "pending") && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => retryMutation.mutate(event.id)}
                            disabled={retryMutation.isPending}
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Event Detail Dialog */}
      <Dialog open={!!selectedEventId} onOpenChange={(open) => !open && setSelectedEventId(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("eventDetails")}</DialogTitle>
          </DialogHeader>
          {selectedEventId && (() => {
            const event = events.find((e) => e.id === selectedEventId);
            if (!event) return null;
            return (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="font-medium">{t("eventType")}:</span> <span className="font-mono">{event.event_type}</span></div>
                  <div><span className="font-medium">{t("sourceModule")}:</span> {event.source_module}</div>
                  <div><span className="font-medium">{t("entityType")}:</span> {event.entity_type}</div>
                  <div><span className="font-medium">{t("status")}:</span> <Badge className={statusColors[event.status as EventStatus] || ""} variant="outline">{event.status}</Badge></div>
                  <div><span className="font-medium">{t("retries")}:</span> {event.retry_count}/{event.max_retries}</div>
                  <div><span className="font-medium">{t("createdAt")}:</span> {format(new Date(event.created_at), "dd.MM.yyyy HH:mm:ss")}</div>
                </div>

                {event.error_message && (
                  <div className="bg-destructive/10 p-3 rounded text-sm text-destructive">
                    <strong>{t("error")}:</strong> {event.error_message}
                  </div>
                )}

                <div>
                  <h4 className="font-medium mb-2">{t("payload")}</h4>
                  <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
                    {JSON.stringify(event.payload, null, 2)}
                  </pre>
                </div>

                {eventLogs.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">{t("processingLogs")}</h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("handler")}</TableHead>
                          <TableHead>{t("status")}</TableHead>
                          <TableHead>{t("date")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {eventLogs.map((log: Record<string, unknown>) => (
                          <TableRow key={log.id as string}>
                            <TableCell className="text-sm">
                              {(log.module_event_subscriptions as Record<string, string>)?.handler_module || "—"}
                            </TableCell>
                            <TableCell>
                              <Badge variant={log.status === "success" ? "default" : "destructive"}>
                                {log.status as string}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">
                              {format(new Date(log.executed_at as string), "HH:mm:ss")}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
