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
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { BookOpen, Save } from "lucide-react";

const MODULE_GROUPS = [
  { key: "pos", rules: ["pos_cash_receipt", "pos_card_receipt", "pos_revenue", "pos_output_vat", "pos_cogs", "pos_retail_inv", "pos_reverse_markup", "pos_embedded_vat"] },
  { key: "invoicing", rules: ["invoice_ar", "invoice_revenue", "invoice_output_vat", "invoice_cogs", "invoice_inventory"] },
  { key: "payroll", rules: ["payroll_gross_exp", "payroll_net_payable", "payroll_tax", "payroll_bank"] },
];

export default function PostingRules() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [edits, setEdits] = useState<Record<string, { debit?: string; credit?: string }>>({});

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

  const getVal = (rule: any, field: "debit" | "credit") => {
    const edit = edits[rule.id];
    if (edit && edit[field] !== undefined) return edit[field]!;
    return field === "debit" ? rule.debit_account_code || "" : rule.credit_account_code || "";
  };

  const setVal = (ruleId: string, field: "debit" | "credit", val: string) => {
    setEdits(prev => ({ ...prev, [ruleId]: { ...prev[ruleId], [field]: val } }));
  };

  const hasEdits = Object.keys(edits).length > 0;

  const AccountSelect = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <Select value={value || "__none__"} onValueChange={v => onChange(v === "__none__" ? "" : v)}>
      <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">—</SelectItem>
        {accounts.map(a => <SelectItem key={a.code} value={a.code}>{a.code} — {a.name}</SelectItem>)}
      </SelectContent>
    </Select>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><BookOpen className="h-6 w-6" />{t("postingRuleCatalog")}</h1>
        {hasEdits && (
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            <Save className="h-4 w-4 mr-2" />{t("save")}
          </Button>
        )}
      </div>

      {isLoading ? <p>{t("loading")}</p> : MODULE_GROUPS.map(group => {
        const groupRules = rules.filter((r: any) => group.rules.includes(r.rule_code));
        if (groupRules.length === 0) return null;
        return (
          <Card key={group.key}>
            <CardHeader><CardTitle className="text-base capitalize">{group.key === "pos" ? "POS" : group.key === "invoicing" ? t("invoices") : t("payroll")}</CardTitle></CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
