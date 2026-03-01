import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { BiPageLayout } from "@/components/shared/BiPageLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Shield, Eye, X, Loader2, Search } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import ReactMarkdown from "react-markdown";

interface Anomaly {
  id: string;
  type: "duplicate" | "weekend" | "round_number" | "unusual_vendor" | "outlier";
  severity: "high" | "medium" | "low";
  invoice_id: string;
  invoice_number: string;
  vendor_name: string;
  amount: number;
  date: string;
  description: string;
  confidence: number;
}

const severityColor: Record<string, string> = {
  high: "destructive",
  medium: "default",
  low: "secondary",
};

const typeLabels: Record<string, string> = {
  duplicate: "Duplicate",
  weekend: "Weekend",
  round_number: "Round Number",
  unusual_vendor: "Unusual Vendor",
  outlier: "Outlier",
};

export default function AiInvoiceAnomalyDetection() {
  const { tenantId } = useTenant();
  const queryClient = useQueryClient();
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["ai-invoice-anomalies", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("ai-invoice-anomaly", {
        body: { tenant_id: tenantId },
      });
      if (error) throw error;
      return data as { anomalies: Anomaly[]; narrative: string; summary: { total: number; high: number; medium: number; low: number } };
    },
    enabled: !!tenantId,
    staleTime: 1000 * 60 * 10,
  });

  const logAction = useMutation({
    mutationFn: async ({ anomalyId, action }: { anomalyId: string; action: string }) => {
      await supabase.from("ai_action_log").insert({
        tenant_id: tenantId!,
        module: "accounting",
        action_type: `anomaly_${action}`,
        input_data: { anomaly_id: anomalyId } as any,
        user_decision: action,
      });
    },
  });

  const handleDismiss = (id: string) => {
    setDismissed(prev => new Set(prev).add(id));
    logAction.mutate({ anomalyId: id, action: "dismissed" });
    toast({ title: "Anomaly dismissed" });
  };

  const handleInvestigate = (id: string) => {
    logAction.mutate({ anomalyId: id, action: "investigate" });
    toast({ title: "Marked for investigation" });
  };

  const anomalies = (data?.anomalies || []).filter(a => !dismissed.has(a.id) && (typeFilter === "all" || a.type === typeFilter));
  const summary = data?.summary || { total: 0, high: 0, medium: 0, low: 0 };

  return (
    <BiPageLayout
      title="AI Invoice Anomaly Detection"
      description="AI-powered screening for duplicate, unusual, and suspicious invoices"
      icon={AlertTriangle}
      stats={[
        { label: "Total Anomalies", value: summary.total, icon: AlertTriangle },
        { label: "High Severity", value: summary.high, icon: AlertTriangle, color: summary.high > 0 ? "text-destructive" : undefined },
        { label: "Medium", value: summary.medium, icon: Shield },
        { label: "Low", value: summary.low, icon: Eye },
      ]}
      actions={
        <Button onClick={() => refetch()} disabled={isLoading}>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
          Scan Invoices
        </Button>
      }
    >
      {data?.narrative && (
        <Card>
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Shield className="h-4 w-4" /> AI Executive Summary</CardTitle></CardHeader>
          <CardContent className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown>{data.narrative}</ReactMarkdown>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-3">
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Filter by type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {Object.entries(typeLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-3 text-muted-foreground">Analyzing invoices...</span>
        </div>
      )}

      <div className="grid gap-3">
        {anomalies.map(a => (
          <Card key={a.id} className="border-l-4" style={{ borderLeftColor: a.severity === "high" ? "hsl(var(--destructive))" : a.severity === "medium" ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))" }}>
            <CardContent className="py-4 flex items-start justify-between gap-4">
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={severityColor[a.severity] as any}>{a.severity.toUpperCase()}</Badge>
                  <Badge variant="outline">{typeLabels[a.type]}</Badge>
                  <span className="text-sm font-medium">{a.invoice_number}</span>
                  <span className="text-xs text-muted-foreground">{a.vendor_name}</span>
                </div>
                <p className="text-sm text-muted-foreground">{a.description}</p>
                <div className="flex gap-4 text-xs text-muted-foreground">
                  <span>Amount: {a.amount.toLocaleString("sr-Latn-RS")} RSD</span>
                  <span>Date: {a.date}</span>
                  <span>Confidence: {Math.round(a.confidence * 100)}%</span>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button size="sm" variant="outline" onClick={() => handleInvestigate(a.id)}>
                  <Eye className="h-3 w-3 mr-1" /> Investigate
                </Button>
                <Button size="sm" variant="ghost" onClick={() => handleDismiss(a.id)}>
                  <X className="h-3 w-3 mr-1" /> Dismiss
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {!isLoading && anomalies.length === 0 && (
          <Card><CardContent className="py-8 text-center text-muted-foreground">No anomalies detected. Click "Scan Invoices" to run analysis.</CardContent></Card>
        )}
      </div>
    </BiPageLayout>
  );
}
