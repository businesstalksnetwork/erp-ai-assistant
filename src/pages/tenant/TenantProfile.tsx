import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useLanguage } from "@/i18n/LanguageContext";
import { useLegalEntities } from "@/hooks/useLegalEntities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Building, Save, Upload, Image } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { EntitySelector } from "@/components/shared/EntitySelector";

interface TenantSettings {
  company_logo?: string;
  default_currency?: string;
  timezone?: string;
  fiscal_year_start_month?: number;
  pib?: string;
  maticni_broj?: string;
  seal_url?: string;
  default_legal_entity_id?: string;
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
  const { entities: legalEntities } = useLegalEntities();

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
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (tenant) {
      setName(tenant.name);
      const s = (tenant.settings as TenantSettings) || {};
      setSettings({
        company_logo: s.company_logo || "",
        default_currency: s.default_currency || "RSD",
        timezone: s.timezone || "Europe/Belgrade",
        fiscal_year_start_month: s.fiscal_year_start_month || 1,
        pib: s.pib || "",
        maticni_broj: s.maticni_broj || "",
        seal_url: s.seal_url || "",
        default_legal_entity_id: s.default_legal_entity_id || "",
      });
    }
  }, [tenant]);

  const handleSealUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !tenantId) return;

    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${tenantId}/seal.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from("tenant-documents")
        .upload(path, file, { upsert: true });
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage
        .from("tenant-documents")
        .getPublicUrl(path);

      setSettings((s) => ({ ...s, seal_url: urlData.publicUrl }));
      toast({ title: t("success"), description: "Seal/stamp uploaded" });
    } catch (err: any) {
      toast({ title: t("error"), description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

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
              <Label>PIB (Poreski identifikacioni broj)</Label>
              <Input
                value={settings.pib || ""}
                onChange={(e) => setSettings((s) => ({ ...s, pib: e.target.value }))}
                placeholder="123456789"
                maxLength={9}
              />
            </div>
            <div className="space-y-2">
              <Label>MB (Matični broj)</Label>
              <Input
                value={settings.maticni_broj || ""}
                onChange={(e) => setSettings((s) => ({ ...s, maticni_broj: e.target.value }))}
                placeholder="12345678"
                maxLength={8}
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
            {legalEntities.length > 0 && (
              <div className="space-y-2">
                <Label>{"Podrazumevano pravno lice"}</Label>
                <EntitySelector
                  options={legalEntities.map((e) => ({
                    value: e.id,
                    label: e.name,
                    sublabel: e.pib ? `PIB: ${e.pib}` : undefined,
                  }))}
                  value={settings.default_legal_entity_id || null}
                  onValueChange={(v) => setSettings((s) => ({ ...s, default_legal_entity_id: v || "" }))}
                  placeholder={t("selectLegalEntity") || "Izaberite pravno lice"}
                />
              </div>
            )}
          </div>

          {/* Seal/Stamp Upload */}
          <div className="border rounded-lg p-4 space-y-3">
            <Label className="flex items-center gap-2">
              <Image className="h-4 w-4" />
              Pečat / Stamp
            </Label>
            <div className="flex items-center gap-4">
              {settings.seal_url && (
                <img src={settings.seal_url} alt="Company seal" className="h-16 w-16 object-contain rounded border" />
              )}
              <div>
                <label htmlFor="seal-upload">
                  <Button variant="outline" size="sm" asChild disabled={uploading}>
                    <span>
                      <Upload className="h-4 w-4 mr-2" />
                      {uploading ? "Uploading..." : "Upload Seal"}
                    </span>
                  </Button>
                </label>
                <input
                  id="seal-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleSealUpload}
                />
                <p className="text-xs text-muted-foreground mt-1">PNG or JPG, max 2MB</p>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} data-shortcut="save">
              <Save className="h-4 w-4 mr-2" />
              {t("save")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
