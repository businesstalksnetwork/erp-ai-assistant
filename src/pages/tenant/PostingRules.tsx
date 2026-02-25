import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useLanguage } from "@/i18n/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { BookOpen, Save, Plus } from "lucide-react";

const MODULE_GROUPS = [
  { key: "pos", rules: ["pos_cash_receipt", "pos_card_receipt", "pos_revenue", "pos_output_vat", "pos_cogs", "pos_retail_inv", "pos_reverse_markup", "pos_embedded_vat"] },
  { key: "invoicing", rules: ["invoice_ar", "invoice_revenue", "invoice_output_vat", "invoice_cogs", "invoice_inventory"] },
  { key: "payroll", rules: ["payroll_gross_exp", "payroll_net_payable", "payroll_tax", "payroll_employee_contrib", "payroll_employer_exp", "payroll_employer_contrib", "payroll_bank"] },
];

const MODULE_GROUP_KEYS = ["pos", "invoicing", "payroll", "custom"];

type NewRuleForm = { rule_code: string; description: string; module_group: string; debit_account_code: string; credit_account_code: string };
const emptyRule: NewRuleForm = { rule_code: "", description: "", module_group: "custom", debit_account_code: "", credit_account_code: "" };

export default function PostingRules() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [edits, setEdits] = useState<Record<string, { debit?: string; credit?: string }>>({});
  const [addOpen, setAddOpen] = useState(false);
  const [newRule, setNewRule] = useState<NewRuleForm>(emptyRule);

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ["posting_rules", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posting_rule_catalog")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("rule_code");
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ["coa_codes", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("chart_of_accounts")
        .select("code, name")
        .eq("tenant_id", tenantId!)
        .eq("is_active", true)
        .order("code");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      for (const [ruleId, changes] of Object.entries(edits)) {
        const update: any = {};
        if (changes.debit !== undefined) update.debit_account_code = changes.debit;
        if (changes.credit !== undefined) update.credit_account_code = changes.credit;
        update.updated_at = new Date().toISOString();
        const { error } = await supabase.from("posting_rule_catalog").update(update).eq("id", ruleId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["posting_rules"] });
      setEdits({});
      toast({ title: t("success"), description: t("settingsSaved") });
    },
    onError: (e: any) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const addRuleMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("posting_rule_catalog").insert({
        tenant_id: tenantId!,
        rule_code: newRule.rule_code,
        description: newRule.description,
        debit_account_code: newRule.debit_account_code || null,
        credit_account_code: newRule.credit_account_code || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["posting_rules"] });
      setAddOpen(false);
      setNewRule(emptyRule);
      toast({ title: t("success") });
    },
    onError: (e: any) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const getVal = (rule: any, field: "debit" | "credit") => {
    const edit = edits[rule.id];
    if (edit && edit[field] !== undefined) return edit[field]!;
    return field === "debit" ? rule.debit_account_code || "" : rule.credit_account_code || "";
  };

  const setVal = (ruleId: string, field: "debit" | "credit", val: string) => {
    setEdits(prev => ({ ...prev, [ruleId]: { ...prev[ruleId], [field]: val } }));
  };

  const hasEdits = Object.keys(edits).length > 0;

  // Group rules: known module groups + "custom" for anything not matching
  const knownRuleCodes = MODULE_GROUPS.flatMap(g => g.rules);
  const customRules = rules.filter((r: any) => !knownRuleCodes.includes(r.rule_code));

  const AccountSelect = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <Select value={value || "__none__"} onValueChange={v => onChange(v === "__none__" ? "" : v)}>
      <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">—</SelectItem>
        {accounts.map(a => <SelectItem key={a.code} value={a.code}>{a.code} — {a.name}</SelectItem>)}
      </SelectContent>
    </Select>
  );

  const renderRuleTable = (groupRules: any[]) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("code")}</TableHead>
          <TableHead>{t("description")}</TableHead>
          <TableHead>{t("debit")}</TableHead>
          <TableHead>{t("credit")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {groupRules.map((rule: any) => (
          <TableRow key={rule.id}>
            <TableCell className="font-mono text-xs">{rule.rule_code}</TableCell>
            <TableCell className="text-sm">{rule.description}</TableCell>
            <TableCell><AccountSelect value={getVal(rule, "debit")} onChange={v => setVal(rule.id, "debit", v)} /></TableCell>
            <TableCell><AccountSelect value={getVal(rule, "credit")} onChange={v => setVal(rule.id, "credit", v)} /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><BookOpen className="h-6 w-6" />{t("postingRuleCatalog")}</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setNewRule(emptyRule); setAddOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />{t("addCustomRule")}
          </Button>
          {hasEdits && (
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              <Save className="h-4 w-4 mr-2" />{t("save")}
            </Button>
          )}
        </div>
      </div>

      {isLoading ? <p>{t("loading")}</p> : (
        <>
          {MODULE_GROUPS.map(group => {
            const groupRules = rules.filter((r: any) => group.rules.includes(r.rule_code));
            if (groupRules.length === 0) return null;
            return (
              <Card key={group.key}>
                <CardHeader><CardTitle className="text-base capitalize">{group.key === "pos" ? "POS" : group.key === "invoicing" ? t("invoices") : t("payroll")}</CardTitle></CardHeader>
                <CardContent>{renderRuleTable(groupRules)}</CardContent>
              </Card>
            );
          })}
          {customRules.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">{t("addCustomRule").replace("Dodaj ", "").replace("Add ", "")}</CardTitle></CardHeader>
              <CardContent>{renderRuleTable(customRules)}</CardContent>
            </Card>
          )}
        </>
      )}

      {/* ADD CUSTOM RULE DIALOG */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("addCustomRule")}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>{t("ruleCode")}</Label><Input value={newRule.rule_code} onChange={e => setNewRule(p => ({ ...p, rule_code: e.target.value }))} placeholder="custom_revenue" /></div>
              <div><Label>{t("moduleGroup")}</Label>
                <Select value={newRule.module_group} onValueChange={v => setNewRule(p => ({ ...p, module_group: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MODULE_GROUP_KEYS.map(k => <SelectItem key={k} value={k}>{k === "pos" ? "POS" : k}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>{t("description")}</Label><Input value={newRule.description} onChange={e => setNewRule(p => ({ ...p, description: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>{t("debit")}</Label>
                <Select value={newRule.debit_account_code || "__none__"} onValueChange={v => setNewRule(p => ({ ...p, debit_account_code: v === "__none__" ? "" : v }))}>
                  <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    {accounts.map(a => <SelectItem key={a.code} value={a.code}>{a.code} — {a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>{t("credit")}</Label>
                <Select value={newRule.credit_account_code || "__none__"} onValueChange={v => setNewRule(p => ({ ...p, credit_account_code: v === "__none__" ? "" : v }))}>
                  <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    {accounts.map(a => <SelectItem key={a.code} value={a.code}>{a.code} — {a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => addRuleMutation.mutate()} disabled={addRuleMutation.isPending || !newRule.rule_code || !newRule.description}>
              {t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
