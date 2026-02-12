import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useLanguage } from "@/i18n/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plug, RefreshCw, FileText, Truck, CheckCircle, XCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Integrations() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // SEF Connection
  const { data: sefConn, isLoading: sefLoading } = useQuery({
    queryKey: ["sef_connection", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sef_connections")
        .select("*")
        .eq("tenant_id", tenantId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const [sefForm, setSefForm] = useState({ api_url: "", api_key: "", environment: "sandbox" });
  const [sefEditing, setSefEditing] = useState(false);

  const sefSaveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        tenant_id: tenantId!,
        api_url: sefForm.api_url,
        api_key_encrypted: sefForm.api_key,
        environment: sefForm.environment,
        is_active: true,
      };
      if (sefConn) {
        const { error } = await supabase.from("sef_connections").update(payload).eq("id", sefConn.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("sef_connections").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sef_connection"] });
      toast({ title: t("success"), description: t("settingsSaved") });
      setSefEditing(false);
    },
    onError: (err: any) => toast({ title: t("error"), description: err.message, variant: "destructive" }),
  });

  const sefToggleMutation = useMutation({
    mutationFn: async (active: boolean) => {
      if (!sefConn) return;
      const { error } = await supabase.from("sef_connections").update({ is_active: active }).eq("id", sefConn.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sef_connection"] }),
  });

  const testSefMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("sef-submit", {
        body: { tenant_id: tenantId, test: true },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => toast({ title: t("success"), description: `SEF ${data.environment} — ${t("connectionActive")}` }),
    onError: (err: any) => toast({ title: t("error"), description: err.message, variant: "destructive" }),
  });

  // NBS Import
  const [nbsImporting, setNbsImporting] = useState(false);
  const handleNbsImport = async () => {
    setNbsImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("nbs-exchange-rates", {
        body: { tenant_id: tenantId },
      });
      if (error) throw error;
      toast({ title: t("success"), description: `${t("importExchangeRates")}: ${data.imported} (${data.date})` });
    } catch (err: any) {
      toast({ title: t("error"), description: err.message, variant: "destructive" });
    } finally {
      setNbsImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("integrations")}</h1>

      {/* SEF Connection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {t("sefConnection")}
            {sefConn?.is_active ? (
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 ml-2"><CheckCircle className="h-3 w-3 mr-1" />{t("connectionActive")}</Badge>
            ) : (
              <Badge variant="secondary" className="ml-2"><XCircle className="h-3 w-3 mr-1" />{t("connectionInactive")}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {sefConn && !sefEditing ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">{t("apiUrl")}:</span> <span className="font-mono">{sefConn.api_url || "—"}</span></div>
                <div><span className="text-muted-foreground">{t("environment")}:</span> <Badge variant="outline">{sefConn.environment}</Badge></div>
                <div><span className="text-muted-foreground">{t("lastSync")}:</span> {sefConn.last_sync_at ? new Date(sefConn.last_sync_at).toLocaleString() : "—"}</div>
                {sefConn.last_error && <div className="text-destructive text-xs">{sefConn.last_error}</div>}
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={sefConn.is_active} onCheckedChange={(v) => sefToggleMutation.mutate(v)} />
                <span className="text-sm">{sefConn.is_active ? t("connectionActive") : t("connectionInactive")}</span>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => { setSefForm({ api_url: sefConn.api_url, api_key: sefConn.api_key_encrypted, environment: sefConn.environment }); setSefEditing(true); }}>{t("edit")}</Button>
                <Button size="sm" variant="outline" onClick={() => testSefMutation.mutate()} disabled={!sefConn.is_active || testSefMutation.isPending}>{t("testConnection")}</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div><Label>{t("apiUrl")}</Label><Input value={sefForm.api_url} onChange={(e) => setSefForm(f => ({ ...f, api_url: e.target.value }))} placeholder="https://efaktura.mfin.gov.rs/api" /></div>
              <div><Label>{t("apiKey")}</Label><Input type="password" value={sefForm.api_key} onChange={(e) => setSefForm(f => ({ ...f, api_key: e.target.value }))} /></div>
              <div><Label>{t("environment")}</Label>
                <Select value={sefForm.environment} onValueChange={(v) => setSefForm(f => ({ ...f, environment: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sandbox">{t("sandbox")}</SelectItem>
                    <SelectItem value="production">{t("production")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => sefSaveMutation.mutate()} disabled={sefSaveMutation.isPending}>{t("save")}</Button>
                {sefConn && <Button variant="outline" onClick={() => setSefEditing(false)}>{t("cancel")}</Button>}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* NBS Exchange Rates */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><RefreshCw className="h-5 w-5" />{t("nbsExchangeRates")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">{t("importExchangeRates")}</p>
          <Button onClick={handleNbsImport} disabled={nbsImporting}>
            <RefreshCw className={`h-4 w-4 mr-2 ${nbsImporting ? "animate-spin" : ""}`} />
            {t("importNow")}
          </Button>
        </CardContent>
      </Card>

      {/* eOtpremnica */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Truck className="h-5 w-5" />{t("eotpremnica")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">{t("dispatchNotes")}</p>
          <Button variant="outline" onClick={() => navigate("/inventory/dispatch-notes")}>{t("view")} →</Button>
        </CardContent>
      </Card>
    </div>
  );
}
