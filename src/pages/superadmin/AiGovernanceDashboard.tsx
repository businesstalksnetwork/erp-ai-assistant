import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/PageHeader";
import { Brain, Activity, MessageSquare, Shield, Cpu, TrendingUp } from "lucide-react";

export default function AiGovernanceDashboard() {
  const { t } = useLanguage();
  const [tab, setTab] = useState("overview");

  // Token usage summary
  const { data: tokenUsage = [] } = useQuery({
    queryKey: ["ai_token_usage_summary"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_token_usage")
        .select("function_name, model, total_tokens, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

  // AI action log
  const { data: actionLog = [] } = useQuery({
    queryKey: ["ai_action_log_governance"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_action_log")
        .select("id, action_type, module, confidence_score, model_version, user_decision, created_at, tenant_id")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  // Prompt registry
  const { data: prompts = [] } = useQuery({
    queryKey: ["ai_prompt_registry_all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_prompt_registry")
        .select("id, function_name, prompt_key, model, version, is_active, confidence_auto_approve, confidence_flag_threshold, updated_at")
        .order("function_name");
      if (error) throw error;
      return data || [];
    },
  });

  // Aggregate stats
  const totalTokens = tokenUsage.reduce((s: number, r: any) => s + (r.total_tokens || 0), 0);
  const uniqueModels = [...new Set(tokenUsage.map((r: any) => r.model))];
  const avgConfidence = actionLog.length > 0
    ? actionLog.reduce((s: number, r: any) => s + (r.confidence_score || 0), 0) / actionLog.filter((r: any) => r.confidence_score).length
    : 0;

  const functionBreakdown = tokenUsage.reduce((acc: Record<string, number>, r: any) => {
    acc[r.function_name] = (acc[r.function_name] || 0) + (r.total_tokens || 0);
    return acc;
  }, {});
  const topFunctions = Object.entries(functionBreakdown)
    .sort((a, b) => (b[1] as number) - (a[1] as number))
    .slice(0, 10);

  const decisionBreakdown = actionLog.reduce((acc: Record<string, number>, r: any) => {
    const d = r.user_decision || "none";
    acc[d] = (acc[d] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <PageHeader title="AI Governance Dashboard" />

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Cpu className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{totalTokens.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Total Tokens Used</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Activity className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{actionLog.length}</p>
              <p className="text-xs text-muted-foreground">AI Actions (recent)</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <TrendingUp className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{(avgConfidence * 100).toFixed(1)}%</p>
              <p className="text-xs text-muted-foreground">Avg Confidence</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <MessageSquare className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{prompts.length}</p>
              <p className="text-xs text-muted-foreground">Registered Prompts</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">Token Usage</TabsTrigger>
          <TabsTrigger value="actions">Action Log</TabsTrigger>
          <TabsTrigger value="prompts">Prompt Registry</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card>
            <CardHeader><CardTitle className="text-base">Top Functions by Token Usage</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Function</TableHead>
                    <TableHead className="text-right">Tokens</TableHead>
                    <TableHead className="text-right">% of Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topFunctions.map(([fn, tokens]) => (
                    <TableRow key={fn}>
                      <TableCell className="font-mono text-sm">{fn}</TableCell>
                      <TableCell className="text-right">{(tokens as number).toLocaleString()}</TableCell>
                      <TableCell className="text-right">{totalTokens > 0 ? ((tokens as number) / totalTokens * 100).toFixed(1) : 0}%</TableCell>
                    </TableRow>
                  ))}
                  {topFunctions.length === 0 && (
                    <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6">No token usage data</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            {uniqueModels.map(model => (
              <Card key={model}>
                <CardContent className="p-3 text-center">
                  <p className="text-xs text-muted-foreground">Model</p>
                  <p className="text-sm font-medium">{model}</p>
                  <p className="text-lg font-bold">
                    {tokenUsage.filter((r: any) => r.model === model).reduce((s: number, r: any) => s + (r.total_tokens || 0), 0).toLocaleString()}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="actions">
          <div className="flex gap-2 mb-4">
            {Object.entries(decisionBreakdown).map(([decision, count]) => (
              <Badge key={decision} variant="outline" className="gap-1">
                {decision}: {count}
              </Badge>
            ))}
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Action</TableHead>
                    <TableHead>Module</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead className="text-right">Confidence</TableHead>
                    <TableHead>Decision</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {actionLog.map((a: any) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-mono text-xs">{a.action_type}</TableCell>
                      <TableCell>{a.module}</TableCell>
                      <TableCell className="text-xs">{a.model_version || "—"}</TableCell>
                      <TableCell className="text-right">
                        {a.confidence_score != null ? (
                          <Badge variant={a.confidence_score >= 0.85 ? "default" : a.confidence_score >= 0.5 ? "outline" : "destructive"}>
                            {(a.confidence_score * 100).toFixed(0)}%
                          </Badge>
                        ) : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={a.user_decision === "approved" ? "default" : a.user_decision === "rejected" ? "destructive" : "outline"}>
                          {a.user_decision || "auto"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                  {actionLog.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">No AI actions recorded</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="prompts">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Function</TableHead>
                    <TableHead>Key</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead className="text-right">Version</TableHead>
                    <TableHead className="text-right">Auto-approve ≥</TableHead>
                    <TableHead className="text-right">Flag ≥</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {prompts.map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs">{p.function_name}</TableCell>
                      <TableCell className="text-xs">{p.prompt_key}</TableCell>
                      <TableCell className="text-xs">{p.model}</TableCell>
                      <TableCell className="text-right">v{p.version}</TableCell>
                      <TableCell className="text-right">{(Number(p.confidence_auto_approve) * 100).toFixed(0)}%</TableCell>
                      <TableCell className="text-right">{(Number(p.confidence_flag_threshold) * 100).toFixed(0)}%</TableCell>
                      <TableCell>
                        <Badge variant={p.is_active ? "default" : "outline"}>
                          {p.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(p.updated_at).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                  {prompts.length === 0 && (
                    <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">No prompts registered yet</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
