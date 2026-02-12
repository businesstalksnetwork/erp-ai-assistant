import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, Search, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { format } from "date-fns";

const ENTITY_TYPES = ["invoices", "journal_entries", "partners", "products", "inventory_movements", "chart_of_accounts", "fiscal_periods"];
const ACTION_TYPES = ["insert", "update", "delete"];
const PAGE_SIZE = 50;

export default function AuditLog() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const [entityFilter, setEntityFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [searchText, setSearchText] = useState("");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);

  const { data: logs, isLoading } = useQuery({
    queryKey: ["audit-log", tenantId, entityFilter, actionFilter, page],
    queryFn: async () => {
      if (!tenantId) return [];
      let query = supabase
        .from("audit_log")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (entityFilter !== "all") query = query.eq("entity_type", entityFilter);
      if (actionFilter !== "all") query = query.eq("action", actionFilter);

      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!tenantId,
  });

  const { data: profiles } = useQuery({
    queryKey: ["audit-profiles", tenantId],
    queryFn: async () => {
      if (!tenantId) return {};
      const { data } = await supabase
        .from("tenant_members")
        .select("user_id")
        .eq("tenant_id", tenantId)
        .eq("status", "active");
      if (!data?.length) return {};
      const userIds = data.map(m => m.user_id);
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);
      const map: Record<string, string> = {};
      profs?.forEach(p => { map[p.id] = p.full_name || "Unknown"; });
      return map;
    },
    enabled: !!tenantId,
  });

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const actionColor = (action: string) => {
    if (action === "insert") return "default";
    if (action === "update") return "secondary";
    if (action === "delete") return "destructive";
    return "outline";
  };

  const filteredLogs = (logs ?? []).filter(log => {
    if (!searchText) return true;
    const s = searchText.toLowerCase();
    return (
      log.action?.toLowerCase().includes(s) ||
      log.entity_type?.toLowerCase().includes(s) ||
      (profiles?.[log.user_id ?? ""] ?? "").toLowerCase().includes(s)
    );
  });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{t("auditLog")}</h1>

      <Card>
        <CardHeader>
          <CardTitle>{t("auditLog")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("search")}
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={entityFilter} onValueChange={v => { setEntityFilter(v); setPage(0); }}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t("entityType")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allTypes")}</SelectItem>
                {ENTITY_TYPES.map(e => (
                  <SelectItem key={e} value={e}>{e.replace(/_/g, " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={actionFilter} onValueChange={v => { setActionFilter(v); setPage(0); }}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder={t("action")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allStatuses")}</SelectItem>
                {ACTION_TYPES.map(a => (
                  <SelectItem key={a} value={a}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredLogs.length === 0 ? (
            <p className="text-muted-foreground text-center py-10">{t("noResults")}</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>{t("date")}</TableHead>
                    <TableHead>{t("users")}</TableHead>
                    <TableHead>{t("action")}</TableHead>
                    <TableHead>{t("entityType")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map(log => {
                    const isExpanded = expandedRows.has(log.id);
                    return (
                      <Collapsible key={log.id} asChild open={isExpanded} onOpenChange={() => toggleRow(log.id)}>
                        <>
                          <CollapsibleTrigger asChild>
                            <TableRow className="cursor-pointer hover:bg-muted/50">
                              <TableCell>
                                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              </TableCell>
                              <TableCell className="text-sm">
                                {format(new Date(log.created_at), "yyyy-MM-dd HH:mm:ss")}
                              </TableCell>
                              <TableCell className="text-sm">
                                {profiles?.[log.user_id ?? ""] ?? (log.user_id ? log.user_id.slice(0, 8) + "…" : "System")}
                              </TableCell>
                              <TableCell>
                                <Badge variant={actionColor(log.action)}>{log.action}</Badge>
                              </TableCell>
                              <TableCell className="text-sm">
                                {(log.entity_type ?? "").replace(/_/g, " ")}
                              </TableCell>
                            </TableRow>
                          </CollapsibleTrigger>
                          <CollapsibleContent asChild>
                            <TableRow>
                              <TableCell colSpan={5} className="bg-muted/30 p-4">
                                <pre className="text-xs overflow-auto max-h-64 whitespace-pre-wrap font-mono">
                                  {JSON.stringify(log.details, null, 2)}
                                </pre>
                              </TableCell>
                            </TableRow>
                          </CollapsibleContent>
                        </>
                      </Collapsible>
                    );
                  })}
                </TableBody>
              </Table>

              {/* Pagination */}
              <div className="flex justify-between items-center pt-2">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                  {t("back")}
                </Button>
                <span className="text-sm text-muted-foreground">
                  {t("page")} {page + 1}
                </span>
                <Button variant="outline" size="sm" disabled={(logs?.length ?? 0) < PAGE_SIZE} onClick={() => setPage(p => p + 1)}>
                  {t("next")}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
