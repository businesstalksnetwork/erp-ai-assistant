import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useLanguage } from "@/i18n/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Building, Save } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";

interface TenantSettings {
  company_logo?: string;
  default_currency?: string;
  timezone?: string;
  fiscal_year_start_month?: number;
}

const TIMEZONES = [
  "Europe/Belgrade",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Asia/Tokyo",
  "UTC",
];

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

export default function TenantProfile() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: tenant, isLoading } = useQuery({
    queryKey: ["tenant-profile", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("*")
        .eq("id", tenantId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const [name, setName] = useState("");
  const [settings, setSettings] = useState<TenantSettings>({});

  useEffect(() => {
    if (tenant) {
      setName(tenant.name);
      const s = (tenant.settings as TenantSettings) || {};
      setSettings({
        company_logo: s.company_logo || "",
        default_currency: s.default_currency || "RSD",
        timezone: s.timezone || "Europe/Belgrade",
        fiscal_year_start_month: s.fiscal_year_start_month || 1,
      });
    }
  }, [tenant]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const existingSettings = (tenant?.settings as Record<string, unknown>) || {};
      const { error } = await supabase
        .from("tenants")
        .update({
          name,
          settings: { ...existingSettings, ...settings },
        })
        .eq("id", tenantId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant-profile"] });
      toast({ title: t("success"), description: t("settingsSaved") });
    },
    onError: (err: any) => {
      toast({ title: t("error"), description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) return <div className="animate-pulse h-64 bg-muted rounded-lg" />;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("tenantProfile")}
        icon={Building}
        description={t("tenantProfileDesc")}
      />

      <Card>
        <CardHeader>
          <CardTitle>{t("companyInfo")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("companyName")}</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t("companyLogo")}</Label>
              <Input
                value={settings.company_logo || ""}
                onChange={(e) => setSettings((s) => ({ ...s, company_logo: e.target.value }))}
                placeholder="https://..."
              />
            </div>
            <div className="space-y-2">
              <Label>{t("defaultCurrency")}</Label>
              <Select
                value={settings.default_currency}
                onValueChange={(v) => setSettings((s) => ({ ...s, default_currency: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="RSD">RSD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="GBP">GBP</SelectItem>
                  <SelectItem value="CHF">CHF</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("timezone") || "Timezone"}</Label>
              <Select
                value={settings.timezone}
                onValueChange={(v) => setSettings((s) => ({ ...s, timezone: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("fiscalYearStartMonth")}</Label>
              <Select
                value={String(settings.fiscal_year_start_month || 1)}
                onValueChange={(v) => setSettings((s) => ({ ...s, fiscal_year_start_month: Number(v) }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m) => (
                    <SelectItem key={m} value={String(m)}>
                      {new Date(2024, m - 1).toLocaleString("default", { month: "long" })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              <Save className="h-4 w-4 mr-2" />
              {t("save")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
