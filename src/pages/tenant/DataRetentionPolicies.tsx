import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Clock, AlertTriangle, CheckCircle2, Play } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";

const ENTITY_TYPES = [
  { value: "contact", label: "Kontakti / Contacts", retention: 5 },
  { value: "employee", label: "Zaposleni / Employees", retention: 10 },
  { value: "lead", label: "Lidovi / Leads", retention: 3 },
  { value: "invoice", label: "Fakture / Invoices", retention: 10 },
  { value: "journal_entry", label: "Nalozi / Journal Entries", retention: 10 },
  { value: "partner", label: "Partneri / Partners", retention: 10 },
];

const ACTION_TYPES = [
  { value: "flag", label: "Označi / Flag" },
  { value: "archive", label: "Arhiviraj / Archive" },
  { value: "anonymize", label: "Anonimizuj / Anonymize" },
];

export default function DataRetentionPolicies() {
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const { t, locale } = useLanguage();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [newEntity, setNewEntity] = useState("contact");
  const [newYears, setNewYears] = useState("5");
  const [newAction, setNewAction] = useState("flag");

  const { data: policies = [] } = useQuery({
    queryKey: ["data-retention-policies", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("data_retention_policies")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("entity_type");
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const { data: logs = [] } = useQuery({
    queryKey: ["data-retention-log", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("data_retention_log")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("executed_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const addPolicy = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error("No tenant");
      const { error } = await supabase.from("data_retention_policies").insert({
        tenant_id: tenantId,
        entity_type: newEntity,
        retention_years: Number(newYears),
        action_type: newAction,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["data-retention-policies"] });
      toast({ title: t("success") });
      setAddOpen(false);
    },
    onError: (e: any) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const togglePolicy = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase.from("data_retention_policies").update({ is_active: isActive }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["data-retention-policies"] }),
  });

  const runEnforcement = useMutation({
    mutationFn: async (policyId: string) => {
      const policy = policies.find((p: any) => p.id === policyId);
      if (!policy || !tenantId) throw new Error("Policy not found");

      const cutoffDate = new Date();
      cutoffDate.setFullYear(cutoffDate.getFullYear() - policy.retention_years);
      const cutoff = cutoffDate.toISOString().split("T")[0];

      let flaggedCount = 0;
      const entityType = policy.entity_type;

      if (entityType === "contact") {
        const { data } = await supabase
          .from("contacts")
          .select("id")
          .eq("tenant_id", tenantId)
          .lt("created_at", cutoff)
          .is("anonymized_at", null)
          .limit(100);
        flaggedCount = data?.length || 0;
        for (const item of data || []) {
          if (policy.action_type === "flag") {
            await supabase.from("contacts").update({ data_retention_expiry: cutoff } as any).eq("id", item.id);
          }
          await supabase.from("data_retention_log").insert({
            tenant_id: tenantId,
            entity_type: entityType,
            entity_id: item.id,
            action_taken: policy.action_type === "flag" ? "flagged" : policy.action_type,
            policy_id: policyId,
            executed_by: user?.id || null,
          });
        }
      } else if (entityType === "employee") {
        const { data } = await supabase
          .from("employees")
          .select("id")
          .eq("tenant_id", tenantId)
          .lt("created_at", cutoff)
          .is("anonymized_at", null)
          .limit(100);
        flaggedCount = data?.length || 0;
        for (const item of data || []) {
          if (policy.action_type === "flag") {
            await supabase.from("employees").update({ data_retention_expiry: cutoff } as any).eq("id", item.id);
          }
          await supabase.from("data_retention_log").insert({
            tenant_id: tenantId,
            entity_type: entityType,
            entity_id: item.id,
            action_taken: "flagged",
            policy_id: policyId,
            executed_by: user?.id || null,
          });
        }
      }

      return flaggedCount;
    },
    onSuccess: (count) => {
      qc.invalidateQueries({ queryKey: ["data-retention-log"] });
      toast({ title: t("success"), description: `${count} ${locale === "sr" ? "zapisa obrađeno" : "records processed"}` });
    },
    onError: (e: any) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const entityLabel = (type: string) => ENTITY_TYPES.find(e => e.value === type)?.label || type;
  const actionLabel = (type: string) => ACTION_TYPES.find(a => a.value === type)?.label || type;

  return (
    <div className="space-y-6">
      <PageHeader
        title={locale === "sr" ? "Politike zadržavanja podataka" : "Data Retention Policies"}
        icon={Clock}
        description={locale === "sr" ? "ZZPL — automatsko označavanje/arhiviranje zapisa po isteku roka čuvanja" : "PDPA compliance — auto-flag/archive records past retention period"}
      />

      <Tabs defaultValue="policies">
        <TabsList>
          <TabsTrigger value="policies">{locale === "sr" ? "Politike" : "Policies"}</TabsTrigger>
          <TabsTrigger value="log">{locale === "sr" ? "Evidencija" : "Execution Log"}</TabsTrigger>
        </TabsList>

        <TabsContent value="policies" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4 mr-2" /> {locale === "sr" ? "Nova politika" : "New Policy"}
            </Button>
          </div>

          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{locale === "sr" ? "Tip entiteta" : "Entity Type"}</TableHead>
                    <TableHead>{locale === "sr" ? "Rok (godine)" : "Retention (years)"}</TableHead>
                    <TableHead>{locale === "sr" ? "Akcija" : "Action"}</TableHead>
                    <TableHead>{locale === "sr" ? "Aktivna" : "Active"}</TableHead>
                    <TableHead>{t("actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {policies.map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell>{entityLabel(p.entity_type)}</TableCell>
                      <TableCell>{p.retention_years} {locale === "sr" ? "god." : "yr"}</TableCell>
                      <TableCell><Badge variant="outline">{actionLabel(p.action_type)}</Badge></TableCell>
                      <TableCell>
                        <Switch checked={p.is_active} onCheckedChange={v => togglePolicy.mutate({ id: p.id, isActive: v })} />
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" onClick={() => runEnforcement.mutate(p.id)} disabled={!p.is_active || runEnforcement.isPending}>
                          <Play className="h-3 w-3 mr-1" /> {locale === "sr" ? "Pokreni" : "Run"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {policies.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">{t("noResults")}</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="log" className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{locale === "sr" ? "Tip" : "Type"}</TableHead>
                    <TableHead>{locale === "sr" ? "ID entiteta" : "Entity ID"}</TableHead>
                    <TableHead>{locale === "sr" ? "Akcija" : "Action"}</TableHead>
                    <TableHead>{locale === "sr" ? "Datum" : "Date"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((l: any) => (
                    <TableRow key={l.id}>
                      <TableCell><Badge variant="outline">{l.entity_type}</Badge></TableCell>
                      <TableCell className="font-mono text-xs">{l.entity_id?.slice(0, 8)}...</TableCell>
                      <TableCell>
                        {l.action_taken === "flagged" && <Badge variant="secondary"><AlertTriangle className="h-3 w-3 mr-1" /> Flagged</Badge>}
                        {l.action_taken === "archived" && <Badge><CheckCircle2 className="h-3 w-3 mr-1" /> Archived</Badge>}
                        {l.action_taken === "anonymized" && <Badge variant="destructive">Anonymized</Badge>}
                      </TableCell>
                      <TableCell>{format(new Date(l.executed_at), "dd.MM.yyyy HH:mm")}</TableCell>
                    </TableRow>
                  ))}
                  {logs.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">{t("noResults")}</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{locale === "sr" ? "Nova politika zadržavanja" : "New Retention Policy"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{locale === "sr" ? "Tip entiteta" : "Entity Type"}</Label>
              <Select value={newEntity} onValueChange={setNewEntity}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ENTITY_TYPES.map(e => (
                    <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{locale === "sr" ? "Rok čuvanja (godine)" : "Retention Period (years)"}</Label>
              <Input type="number" min="1" max="50" value={newYears} onChange={e => setNewYears(e.target.value)} />
            </div>
            <div>
              <Label>{locale === "sr" ? "Akcija po isteku" : "Action on Expiry"}</Label>
              <Select value={newAction} onValueChange={setNewAction}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ACTION_TYPES.map(a => (
                    <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => addPolicy.mutate()} disabled={addPolicy.isPending}>
              {addPolicy.isPending ? t("saving") : t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
