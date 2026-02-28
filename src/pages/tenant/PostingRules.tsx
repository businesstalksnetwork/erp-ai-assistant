import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useChartOfAccounts } from "@/hooks/useChartOfAccounts";
import { useLanguage } from "@/i18n/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { BookOpen, Plus, AlertTriangle, ChevronDown, Play, Trash2, ArrowRightLeft, Sparkles } from "lucide-react";
import { PAYMENT_MODEL_KEYS, simulatePosting } from "@/lib/postingRuleEngine";
import { TAccountDisplay } from "@/components/posting-rules/TAccountDisplay";
import { RuleWizard } from "@/components/posting-rules/RuleWizard";

export default function PostingRules() {
  const { t, locale } = useLanguage();
  const { tenantId } = useTenant();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [testAmounts, setTestAmounts] = useState<Record<string, number>>({});
  const [testResults, setTestResults] = useState<Record<string, ReturnType<typeof simulatePosting>>>({});
  const [activeTab, setActiveTab] = useState("rules");

  // Queries
  const { data: models = [] } = useQuery({
    queryKey: ["payment_models"],
    queryFn: async () => {
      const { data, error } = await supabase.from("payment_models").select("*").order("code");
      if (error) throw error;
      return data;
    },
  });

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ["posting_rules_v2", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posting_rules")
        .select("*, posting_rule_lines(*)")
        .eq("tenant_id", tenantId!)
        .order("priority", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const { data: accounts = [] } = useChartOfAccounts<{ id: string; code: string; name: string }>({
    select: "id, code, name",
  });

  const { data: bankAccounts = [] } = useQuery({
    queryKey: ["bank_accounts_list", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("bank_accounts")
        .select("id, account_number, bank_name, gl_account_id")
        .eq("tenant_id", tenantId!)
        .eq("is_active", true)
        .order("account_number");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: mappings = [] } = useQuery({
    queryKey: ["account_mappings", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("account_mappings")
        .select("*, bank_accounts(account_number, bank_name), chart_of_accounts(code, name)")
        .eq("tenant_id", tenantId!)
        .order("created_at");
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Legacy rules
  const { data: legacyRules = [] } = useQuery({
    queryKey: ["posting_rules_legacy", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("posting_rule_catalog")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("rule_code");
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Mutations
  const createRuleMutation = useMutation({
    mutationFn: async (data: any) => {
      const { lines, ...ruleData } = data;
      const { data: rule, error } = await supabase
        .from("posting_rules")
        .insert({ ...ruleData, tenant_id: tenantId! })
        .select("id")
        .single();
      if (error) throw error;

      const lineInserts = lines.map((line: any, i: number) => ({
        posting_rule_id: rule.id,
        tenant_id: tenantId!,
        line_number: i + 1,
        side: line.side,
        account_source: line.account_source,
        account_id: line.account_id,
        dynamic_source: line.dynamic_source,
        amount_source: line.amount_source,
        amount_factor: line.amount_factor,
        description_template: line.description_template || "",
        is_tax_line: line.is_tax_line,
      }));
      const { error: lineError } = await supabase.from("posting_rule_lines").insert(lineInserts);
      if (lineError) throw lineError;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["posting_rules_v2"] });
      setWizardOpen(false);
      toast({ title: t("success") });
    },
    onError: (e: any) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const deleteRuleMutation = useMutation({
    mutationFn: async (ruleId: string) => {
      const { error } = await supabase.from("posting_rules").delete().eq("id", ruleId).eq("tenant_id", tenantId!);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["posting_rules_v2"] });
      toast({ title: t("success") });
    },
    onError: (e: any) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  // Seed default rules
  const seedMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("seed_default_posting_rules", { p_tenant_id: tenantId! });
      if (error) throw error;
      return data;
    },
    onSuccess: (count) => {
      qc.invalidateQueries({ queryKey: ["posting_rules_v2"] });
      toast({ title: t("success"), description: `${count} ${t("postingRules").toLowerCase()}` });
    },
    onError: (e: any) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  // Seed extended rules
  const seedExtendedMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("seed_extended_posting_rules", { p_tenant_id: tenantId });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["posting_rules_v2"] });
      qc.invalidateQueries({ queryKey: ["payment_models"] });
      toast({ title: "Uspešno", description: "Proširena pravila knjiženja su generisana za sve nove tipove dokumenata." });
    },
    onError: (e: any) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  // Account mapping mutations
  const [addMappingOpen, setAddMappingOpen] = useState(false);
  const [newMapping, setNewMapping] = useState({ bank_account_id: "", gl_account_id: "", mapping_type: "PRIMARY" });

  const addMappingMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("account_mappings").insert({
        tenant_id: tenantId!,
        bank_account_id: newMapping.bank_account_id,
        gl_account_id: newMapping.gl_account_id,
        mapping_type: newMapping.mapping_type,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["account_mappings"] });
      setAddMappingOpen(false);
      setNewMapping({ bank_account_id: "", gl_account_id: "", mapping_type: "PRIMARY" });
      toast({ title: t("success") });
    },
    onError: (e: any) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const deleteMappingMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("account_mappings").delete().eq("id", id).eq("tenant_id", tenantId!);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["account_mappings"] });
      toast({ title: t("success") });
    },
    onError: (e: any) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  // Group rules by payment model
  const rulesByModel = new Map<string, typeof rules>();
  for (const rule of rules) {
    const key = rule.payment_model_id;
    if (!rulesByModel.has(key)) rulesByModel.set(key, []);
    rulesByModel.get(key)!.push(rule);
  }

  // Coverage check
  const modelsWithoutRules = models.filter((m) => !rulesByModel.has(m.id));

  const handleTestRule = (ruleId: string, ruleLines: any[]) => {
    const amount = testAmounts[ruleId] || 10000;
    const result = simulatePosting(ruleLines, amount);
    setTestResults((prev) => ({ ...prev, [ruleId]: result }));
  };

  const getModelName = (model: any) => {
    const key = PAYMENT_MODEL_KEYS[model.code];
    return key ? t(key as any) : (locale === "sr" ? model.name_sr : model.name_en);
  };

  const directionBadge = (dir: string) => {
    const map: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
      IN: { label: t("directionIn"), variant: "default" },
      OUT: { label: t("directionOut"), variant: "secondary" },
      INTERNAL: { label: t("directionInternal"), variant: "outline" },
      NONE: { label: t("directionNone"), variant: "outline" },
    };
    const m = map[dir] || map.NONE;
    return <Badge variant={m.variant} className="text-[10px]">{m.label}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BookOpen className="h-6 w-6" /> {t("postingRuleCatalog")}
        </h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => seedExtendedMutation.mutate()} disabled={seedExtendedMutation.isPending}>
            <Sparkles className="h-4 w-4 mr-2" />Generiši pravila
          </Button>
          <Button onClick={() => setWizardOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> {t("addPostingRule")}
          </Button>
        </div>
      </div>

      {/* Coverage Warning */}
      {modelsWithoutRules.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {t("noCoverageWarning")}: {modelsWithoutRules.map((m) => getModelName(m)).join(", ")}
          </AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="rules">{t("postingRules")} ({rules.length})</TabsTrigger>
          <TabsTrigger value="models">{t("paymentModels")} ({models.length})</TabsTrigger>
          <TabsTrigger value="mappings"><ArrowRightLeft className="h-3.5 w-3.5 mr-1" />{t("accountMappings")}</TabsTrigger>
          {legacyRules.length > 0 && <TabsTrigger value="legacy">{t("legacyRules")}</TabsTrigger>}
        </TabsList>

        {/* RULES TAB */}
        <TabsContent value="rules" className="space-y-4">
          {isLoading ? (
            <p className="text-muted-foreground">{t("loading")}</p>
          ) : rules.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center space-y-4">
                <p className="text-muted-foreground">{t("coverageWarning")}</p>
                <Button onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}>
                  <Sparkles className="h-4 w-4 mr-2" />
                  {locale === "sr" ? "Generiši standardna srpska pravila" : "Generate standard Serbian rules"}
                </Button>
              </CardContent>
            </Card>
          ) : (
            models.map((model) => {
              const modelRules = rulesByModel.get(model.id);
              if (!modelRules || modelRules.length === 0) return null;
              return (
                <Card key={model.id}>
                  <Collapsible defaultOpen>
                    <CollapsibleTrigger asChild>
                      <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-base">{getModelName(model)}</CardTitle>
                            {directionBadge(model.direction)}
                            <Badge variant="outline" className="text-[10px]">{modelRules.length} {t("postingRules").toLowerCase()}</Badge>
                          </div>
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="space-y-4">
                        {modelRules.map((rule: any) => (
                          <div key={rule.id} className="border rounded-lg p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm">{rule.name}</span>
                                {rule.is_default && <Badge variant="secondary" className="text-[10px]">{t("isDefaultRule")}</Badge>}
                                {rule.currency && <Badge variant="outline" className="text-[10px]">{rule.currency}</Badge>}
                                {!rule.is_active && <Badge variant="destructive" className="text-[10px]">{t("inactive")}</Badge>}
                              </div>
                              <div className="flex items-center gap-1">
                                <Input
                                  type="number"
                                  className="w-24 h-7 text-xs"
                                  placeholder={t("testAmount")}
                                  value={testAmounts[rule.id] || ""}
                                  onChange={(e) => setTestAmounts((p) => ({ ...p, [rule.id]: parseFloat(e.target.value) || 0 }))}
                                />
                                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleTestRule(rule.id, rule.posting_rule_lines)}>
                                  <Play className="h-3 w-3 mr-1" />{t("testRule")}
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteRuleMutation.mutate(rule.id)}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>

                            {rule.description && <p className="text-xs text-muted-foreground">{rule.description}</p>}

                            <TAccountDisplay lines={rule.posting_rule_lines || []} accounts={accounts} />

                            {/* Test Results */}
                            {testResults[rule.id] && (
                              <div className="border-t pt-2 mt-2">
                                <p className="text-xs font-semibold mb-1">{t("testRule")} — {(testAmounts[rule.id] || 10000).toLocaleString()} RSD</p>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                  <div>
                                    <p className="font-medium text-muted-foreground mb-1">{t("debitSide")}</p>
                                    {testResults[rule.id].filter((r) => r.side === "DEBIT").map((r, i) => (
                                      <div key={i} className="flex justify-between">
                                        <span>{r.source}</span>
                                        <span className="font-mono">{r.amount.toLocaleString()}</span>
                                      </div>
                                    ))}
                                  </div>
                                  <div>
                                    <p className="font-medium text-muted-foreground mb-1">{t("creditSide")}</p>
                                    {testResults[rule.id].filter((r) => r.side === "CREDIT").map((r, i) => (
                                      <div key={i} className="flex justify-between">
                                        <span>{r.source}</span>
                                        <span className="font-mono">{r.amount.toLocaleString()}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </CardContent>
                    </CollapsibleContent>
                  </Collapsible>
                </Card>
              );
            })
          )}
        </TabsContent>

        {/* PAYMENT MODELS TAB */}
        <TabsContent value="models">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("code")}</TableHead>
                    <TableHead>{t("name")}</TableHead>
                    <TableHead>{t("direction")}</TableHead>
                    <TableHead>{t("affectsBank")}</TableHead>
                    <TableHead>{t("requiresInvoice")}</TableHead>
                    <TableHead>{t("allowsPartial")}</TableHead>
                    <TableHead>{t("postingRules")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {models.map((m: any) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-mono text-xs">{m.code}</TableCell>
                      <TableCell className="text-sm">{getModelName(m)}</TableCell>
                      <TableCell>{directionBadge(m.direction)}</TableCell>
                      <TableCell>{m.affects_bank ? "✓" : "—"}</TableCell>
                      <TableCell>{m.requires_invoice ? "✓" : "—"}</TableCell>
                      <TableCell>{m.allows_partial ? "✓" : "—"}</TableCell>
                      <TableCell>
                        {rulesByModel.has(m.id) ? (
                          <Badge variant="default" className="text-[10px]">{rulesByModel.get(m.id)!.length}</Badge>
                        ) : (
                          <Badge variant="destructive" className="text-[10px]">0</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ACCOUNT MAPPINGS TAB */}
        <TabsContent value="mappings">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">{t("accountMappings")}</CardTitle>
                <CardDescription>
                  {locale === "sr" ? "Mapiranje bankovnih računa na konta glavne knjige" : "Map bank accounts to general ledger accounts"}
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => setAddMappingOpen(!addMappingOpen)}>
                <Plus className="h-4 w-4 mr-1" />{t("addMapping")}
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {addMappingOpen && (
                <div className="flex flex-wrap items-end gap-3 p-3 border rounded-md bg-muted/30">
                  <div className="min-w-[180px]">
                    <label className="text-xs font-medium">{t("bankAccountFilter")}</label>
                    <Select value={newMapping.bank_account_id || "__none__"} onValueChange={(v) => setNewMapping((p) => ({ ...p, bank_account_id: v === "__none__" ? "" : v }))}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">—</SelectItem>
                        {bankAccounts.map((b) => <SelectItem key={b.id} value={b.id}>{b.account_number} ({b.bank_name})</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="min-w-[180px]">
                    <label className="text-xs font-medium">{t("glAccount")}</label>
                    <Select value={newMapping.gl_account_id || "__none__"} onValueChange={(v) => setNewMapping((p) => ({ ...p, gl_account_id: v === "__none__" ? "" : v }))}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">—</SelectItem>
                        {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="min-w-[120px]">
                    <label className="text-xs font-medium">{t("mappingType")}</label>
                    <Select value={newMapping.mapping_type} onValueChange={(v) => setNewMapping((p) => ({ ...p, mapping_type: v }))}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PRIMARY">{t("primaryMapping")}</SelectItem>
                        <SelectItem value="CLEARING">{t("clearingMapping")}</SelectItem>
                        <SelectItem value="FEE">{t("feeMapping")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button size="sm" className="h-8" onClick={() => addMappingMutation.mutate()} disabled={!newMapping.bank_account_id || !newMapping.gl_account_id || addMappingMutation.isPending}>
                    {t("save")}
                  </Button>
                </div>
              )}
              {mappings.length === 0 && !addMappingOpen ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  {locale === "sr" ? "Nema mapiranja. Koristite GL konto na bankovnom računu." : "No mappings. Use the GL account on bank accounts."}
                </p>
              ) : mappings.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("bankAccountFilter")}</TableHead>
                      <TableHead>{t("glAccount")}</TableHead>
                      <TableHead>{t("mappingType")}</TableHead>
                      <TableHead>{t("validFromRule")}</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mappings.map((m: any) => (
                      <TableRow key={m.id}>
                        <TableCell className="text-sm">{m.bank_accounts?.account_number} ({m.bank_accounts?.bank_name})</TableCell>
                        <TableCell className="font-mono text-xs">{m.chart_of_accounts?.code} — {m.chart_of_accounts?.name}</TableCell>
                        <TableCell><Badge variant="outline" className="text-[10px]">{m.mapping_type}</Badge></TableCell>
                        <TableCell className="text-xs">{m.valid_from}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMappingMutation.mutate(m.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        {/* LEGACY RULES TAB */}
        {legacyRules.length > 0 && (
          <TabsContent value="legacy">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("legacyRules")}</CardTitle>
                <CardDescription>{t("legacyRulesNote")}</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("code")}</TableHead>
                      <TableHead>{t("description")}</TableHead>
                      <TableHead>{t("debitSide")}</TableHead>
                      <TableHead>{t("creditSide")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {legacyRules.map((rule: any) => (
                      <TableRow key={rule.id}>
                        <TableCell className="font-mono text-xs">{rule.rule_code}</TableCell>
                        <TableCell className="text-sm">{rule.description}</TableCell>
                        <TableCell className="font-mono text-xs">{rule.debit_account_code || "—"}</TableCell>
                        <TableCell className="font-mono text-xs">{rule.credit_account_code || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Rule Creation Wizard */}
      <RuleWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        models={models}
        accounts={accounts}
        bankAccounts={bankAccounts}
        onSave={(data) => createRuleMutation.mutate(data)}
        saving={createRuleMutation.isPending}
      />
    </div>
  );
}
