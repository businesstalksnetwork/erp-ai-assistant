import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plug, RefreshCw, Settings } from "lucide-react";

export default function IntegrationSupport() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all tenants with their SEF connections
  const { data: tenants = [] } = useQuery({
    queryKey: ["all-tenants-sef"],
    queryFn: async () => {
      const { data: allTenants, error } = await supabase.from("tenants").select("id, name, status").order("name");
      if (error) throw error;

      const { data: connections } = await supabase.from("sef_connections").select("*");
      const connMap = new Map((connections || []).map((c: any) => [c.tenant_id, c]));

      return allTenants.map((t: any) => ({ ...t, sef: connMap.get(t.id) || null }));
    },
  });

  const [configDialog, setConfigDialog] = useState<any>(null);
  const [form, setForm] = useState({ api_url: "", api_key: "", environment: "sandbox" });

  const openConfig = (tenant: any) => {
    const sef = tenant.sef;
    setForm({
      api_url: sef?.api_url || "",
      api_key: sef?.api_key_encrypted || "",
      environment: sef?.environment || "sandbox",
    });
    setConfigDialog(tenant);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        tenant_id: configDialog.id,
        api_url: form.api_url,
        api_key_encrypted: form.api_key,
        environment: form.environment,
        is_active: true,
      };
      if (configDialog.sef) {
        const { error } = await supabase.from("sef_connections").update(payload).eq("id", configDialog.sef.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("sef_connections").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-tenants-sef"] });
      toast({ title: t("success"), description: t("settingsSaved") });
      setConfigDialog(null);
    },
    onError: (err: any) => toast({ title: t("error"), description: err.message, variant: "destructive" }),
  });

  const [bulkImporting, setBulkImporting] = useState(false);
  const handleBulkImport = async () => {
    setBulkImporting(true);
    let count = 0;
    for (const tenant of tenants.filter((t: any) => t.status === "active")) {
      try {
        await supabase.functions.invoke("nbs-exchange-rates", { body: { tenant_id: tenant.id } });
        count++;
      } catch {}
    }
    toast({ title: t("success"), description: `${t("bulkImportRates")}: ${count} ${t("tenants").toLowerCase()}` });
    setBulkImporting(false);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("integrationSupport")}</h1>

      {/* SEF Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Plug className="h-5 w-5" />{t("sefConnection")} — {t("tenants")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("tenantName")}</TableHead>
                <TableHead>{t("environment")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead>{t("lastSync")}</TableHead>
                <TableHead>{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tenants.map((tenant: any) => (
                <TableRow key={tenant.id}>
                  <TableCell className="font-medium">{tenant.name}</TableCell>
                  <TableCell>{tenant.sef ? <Badge variant="outline">{tenant.sef.environment}</Badge> : "—"}</TableCell>
                  <TableCell>
                    {tenant.sef ? (
                      tenant.sef.is_active
                        ? <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">{t("active")}</Badge>
                        : <Badge variant="secondary">{t("inactive")}</Badge>
                    ) : <Badge variant="secondary">{t("sefNotConfigured")}</Badge>}
                  </TableCell>
                  <TableCell className="text-xs">{tenant.sef?.last_sync_at ? new Date(tenant.sef.last_sync_at).toLocaleString() : "—"}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" onClick={() => openConfig(tenant)}>
                      <Settings className="h-3 w-3 mr-1" />{t("configureForTenant")}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* NBS Bulk Import */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><RefreshCw className="h-5 w-5" />{t("nbsExchangeRates")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Button onClick={handleBulkImport} disabled={bulkImporting}>
            <RefreshCw className={`h-4 w-4 mr-2 ${bulkImporting ? "animate-spin" : ""}`} />
            {t("bulkImportRates")}
          </Button>
        </CardContent>
      </Card>

      {/* Config Dialog */}
      <Dialog open={!!configDialog} onOpenChange={() => setConfigDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("sefConfiguration")} — {configDialog?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>{t("apiUrl")}</Label><Input value={form.api_url} onChange={(e) => setForm(f => ({ ...f, api_url: e.target.value }))} /></div>
            <div><Label>{t("apiKey")}</Label><Input type="password" value={form.api_key} onChange={(e) => setForm(f => ({ ...f, api_key: e.target.value }))} /></div>
            <div><Label>{t("environment")}</Label>
              <Select value={form.environment} onValueChange={(v) => setForm(f => ({ ...f, environment: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sandbox">{t("sandbox")}</SelectItem>
                  <SelectItem value="production">{t("production")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfigDialog(null)}>{t("cancel")}</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
