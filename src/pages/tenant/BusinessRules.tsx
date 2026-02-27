import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useChartOfAccounts } from "@/hooks/useChartOfAccounts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Hash, Landmark, Settings2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useState, useEffect } from "react";

interface TenantSettings {
  invoice_prefix: string;
  invoice_next_seq: number;
  journal_prefix: string;
  journal_next_seq: number;
  default_receivable_account_id: string | null;
  default_revenue_account_id: string | null;
  default_tax_account_id: string | null;
  default_cash_account_id: string | null;
  default_cogs_account_id: string | null;
  default_currency: string;
  fiscal_year_start_month: number;
  journal_approval_threshold: number | null;
  auto_post_invoices: boolean;
}

const DEFAULT_SETTINGS: TenantSettings = {
  invoice_prefix: "INV",
  invoice_next_seq: 1,
  journal_prefix: "JE",
  journal_next_seq: 1,
  default_receivable_account_id: null,
  default_revenue_account_id: null,
  default_tax_account_id: null,
  default_cash_account_id: null,
  default_cogs_account_id: null,
  default_currency: "RSD",
  fiscal_year_start_month: 1,
  journal_approval_threshold: null,
  auto_post_invoices: false,
};

const MONTH_KEYS = [
  { value: 1, key: "monthJanuary" },
  { value: 4, key: "monthApril" },
  { value: 7, key: "monthJuly" },
  { value: 10, key: "monthOctober" },
] as const;

export default function BusinessRules() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<TenantSettings>(DEFAULT_SETTINGS);

  const { data: settingsRow, isLoading } = useQuery({
    queryKey: ["tenant-settings", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_settings")
        .select("*")
        .eq("tenant_id", tenantId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const { data: accounts = [] } = useChartOfAccounts<{ id: string; code: string; name: string; account_type: string }>({
    select: "id, code, name, account_type",
    queryKeySuffix: "rules",
  });

  useEffect(() => {
    if (settingsRow) {
      setForm({ ...DEFAULT_SETTINGS, ...(settingsRow.settings as Record<string, unknown>) } as TenantSettings);
    }
  }, [settingsRow]);

  const mutation = useMutation({
    mutationFn: async (settings: TenantSettings) => {
      const jsonSettings = JSON.parse(JSON.stringify(settings));
      if (settingsRow) {
        const { error } = await supabase
          .from("tenant_settings")
          .update({ settings: jsonSettings })
          .eq("tenant_id", tenantId!);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("tenant_settings")
          .insert([{ tenant_id: tenantId!, settings: jsonSettings }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant-settings", tenantId] });
      toast.success(t("settingsSaved"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const update = <K extends keyof TenantSettings>(key: K, value: TenantSettings[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const accountOptions = (types: string[]) =>
    accounts.filter((a) => types.includes(a.account_type));

  const AccountSelect = ({ value, onChange, types }: { value: string | null; onChange: (v: string | null) => void; types: string[] }) => (
    <Select value={value || "__none"} onValueChange={(v) => onChange(v === "__none" ? null : v)}>
      <SelectTrigger><SelectValue placeholder={t("selectAccount")} /></SelectTrigger>
      <SelectContent>
        <SelectItem value="__none">{t("noAccountSelected")}</SelectItem>
        {accountOptions(types).map((a) => (
          <SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("businessRules")}</h1>
        <Button onClick={() => mutation.mutate(form)} disabled={mutation.isPending}>
          {mutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t("saving")}</> : t("save")}
        </Button>
      </div>

      {/* Numbering */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Hash className="h-5 w-5" />{t("numbering")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>{t("invoicePrefix")}</Label>
            <Input value={form.invoice_prefix} onChange={(e) => update("invoice_prefix", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{t("invoiceNextSeq")}</Label>
            <Input type="number" min={1} value={form.invoice_next_seq} onChange={(e) => update("invoice_next_seq", Math.max(1, Number(e.target.value)))} />
          </div>
          <div className="space-y-2">
            <Label>{t("journalPrefix")}</Label>
            <Input value={form.journal_prefix} onChange={(e) => update("journal_prefix", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{t("journalNextSeq")}</Label>
            <Input type="number" min={1} value={form.journal_next_seq} onChange={(e) => update("journal_next_seq", Math.max(1, Number(e.target.value)))} />
          </div>
        </CardContent>
      </Card>

      {/* Default Accounts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Landmark className="h-5 w-5" />{t("defaultAccounts")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>{t("defaultReceivableAccount")}</Label>
            <AccountSelect value={form.default_receivable_account_id} onChange={(v) => update("default_receivable_account_id", v)} types={["asset"]} />
          </div>
          <div className="space-y-2">
            <Label>{t("defaultRevenueAccount")}</Label>
            <AccountSelect value={form.default_revenue_account_id} onChange={(v) => update("default_revenue_account_id", v)} types={["revenue"]} />
          </div>
          <div className="space-y-2">
            <Label>{t("defaultTaxAccount")}</Label>
            <AccountSelect value={form.default_tax_account_id} onChange={(v) => update("default_tax_account_id", v)} types={["liability"]} />
          </div>
          <div className="space-y-2">
            <Label>{t("defaultCashAccount")}</Label>
            <AccountSelect value={form.default_cash_account_id} onChange={(v) => update("default_cash_account_id", v)} types={["asset"]} />
          </div>
          <div className="space-y-2">
            <Label>{t("defaultCogsAccount")}</Label>
            <AccountSelect value={form.default_cogs_account_id} onChange={(v) => update("default_cogs_account_id", v)} types={["expense"]} />
          </div>
        </CardContent>
      </Card>

      {/* General Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Settings2 className="h-5 w-5" />{t("generalSettings")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>{t("defaultCurrency")}</Label>
            <Select value={form.default_currency} onValueChange={(v) => update("default_currency", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="RSD">RSD</SelectItem>
                <SelectItem value="EUR">EUR</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t("fiscalYearStartMonth")}</Label>
            <Select value={String(form.fiscal_year_start_month)} onValueChange={(v) => update("fiscal_year_start_month", Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MONTH_KEYS.map((m) => (
                  <SelectItem key={m.value} value={String(m.value)}>{t(m.key)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t("journalApprovalThreshold")}</Label>
            <Input
              type="number"
              min={0}
              placeholder={t("approvalThresholdHint")}
              value={form.journal_approval_threshold ?? ""}
              onChange={(e) => update("journal_approval_threshold", e.target.value ? Number(e.target.value) : null)}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <Label>{t("autoPostInvoices")}</Label>
              <p className="text-sm text-muted-foreground">{t("autoPostInvoicesHint")}</p>
            </div>
            <Switch checked={form.auto_post_invoices} onCheckedChange={(v) => update("auto_post_invoices", v)} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
