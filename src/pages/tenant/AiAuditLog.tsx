import { useState } from "react";
import { useTenant } from "@/hooks/useTenant";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/PageHeader";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShieldCheck } from "lucide-react";
import { format } from "date-fns";

const DECISION_COLORS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  approved: "default",
  rejected: "destructive",
  modified: "secondary",
  auto: "outline",
};

export default function AiAuditLog() {
  const { tenantId } = useTenant();
  const [moduleFilter, setModuleFilter] = useState("all");
  const [decisionFilter, setDecisionFilter] = useState("all");

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["ai-action-log", tenantId, moduleFilter, decisionFilter],
    queryFn: async () => {
      let q = supabase
        .from("ai_action_log" as any)
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false })
        .limit(200);
      if (moduleFilter !== "all") q = q.eq("module", moduleFilter);
      if (decisionFilter !== "all") q = q.eq("user_decision", decisionFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const modules = Array.from(new Set(logs.map((l: any) => l.module))).filter(Boolean);

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Revizijski dnevnik"
        icon={ShieldCheck}
        description="Pregled svih AI akcija za regulatornu usklađenost (PRD Sekcija 11.2)"
      />

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base">AI akcije ({logs.length})</CardTitle>
            <div className="flex gap-2">
              <Select value={moduleFilter} onValueChange={setModuleFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Modul" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Svi moduli</SelectItem>
                  {modules.map((m: any) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={decisionFilter} onValueChange={setDecisionFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Odluka" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Sve odluke</SelectItem>
                  <SelectItem value="approved">Odobreno</SelectItem>
                  <SelectItem value="rejected">Odbijeno</SelectItem>
                  <SelectItem value="modified">Izmenjeno</SelectItem>
                  <SelectItem value="auto">Automatski</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Učitavanje...</p>
          ) : logs.length === 0 ? (
            <div className="text-center py-12">
              <ShieldCheck className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">Nema zabeleženih AI akcija.</p>
              <p className="text-muted-foreground text-xs mt-1">AI akcije će se automatski beleži kada koristite AI funkcionalnosti.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vreme</TableHead>
                  <TableHead>Modul</TableHead>
                  <TableHead>Tip akcije</TableHead>
                  <TableHead>Odluka</TableHead>
                  <TableHead>Poverenje</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Obrazloženje</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log: any) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(log.created_at), "dd.MM.yyyy HH:mm")}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{log.module}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{log.action_type}</TableCell>
                    <TableCell>
                      {log.user_decision && (
                        <Badge variant={DECISION_COLORS[log.user_decision] || "outline"}>
                          {log.user_decision}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="tabular-nums text-sm">
                      {log.confidence_score != null
                        ? `${(log.confidence_score * 100).toFixed(0)}%`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{log.model_version || "—"}</TableCell>
                    <TableCell className="text-xs max-w-xs truncate text-muted-foreground">
                      {log.reasoning || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
