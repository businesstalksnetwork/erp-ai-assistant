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
import { Plug, RefreshCw, Settings, FileText, Heart, Truck } from "lucide-react";

type ConnectionType = "sef" | "ebolovanje" | "eotpremnica";

export default function IntegrationSupport() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all tenants
  const { data: tenants = [] } = useQuery({
    queryKey: ["all-tenants-integrations"],
    queryFn: async () => {
      const { data: allTenants, error } = await supabase.from("tenants").select("id, name, status").order("name");
      if (error) throw error;

      const [{ data: sefConns }, { data: ebolConns }, { data: eotpConns }] = await Promise.all([
        supabase.from("sef_connections").select("*"),
        supabase.from("ebolovanje_connections").select("*"),
        supabase.from("eotpremnica_connections").select("*"),
      ]);

      const sefMap = new Map((sefConns || []).map((c: any) => [c.tenant_id, c]));
      const ebolMap = new Map((ebolConns || []).map((c: any) => [c.tenant_id, c]));
      const eotpMap = new Map((eotpConns || []).map((c: any) => [c.tenant_id, c]));

      return allTenants.map((t: any) => ({
        ...t,
        sef: sefMap.get(t.id) || null,
        ebol: ebolMap.get(t.id) || null,
        eotp: eotpMap.get(t.id) || null,
      }));
    },
  });

  // Config dialog state
  const [configDialog, setConfigDialog] = useState<{ tenant: any; type: ConnectionType } | null>(null);
  const [sefForm, setSefForm] = useState({ api_url: "", api_key: "", environment: "sandbox" });
  const [ebolForm, setEbolForm] = useState({ euprava_username: "", euprava_password: "", environment: "sandbox" });
  const [eotpForm, setEotpForm] = useState({ api_url: "", api_key: "", environment: "sandbox" });

  const openConfig = (tenant: any, type: ConnectionType) => {
    if (type === "sef") {
      const c = tenant.sef;
      setSefForm({ api_url: c?.api_url || "", api_key: c?.api_key_encrypted || "", environment: c?.environment || "sandbox" });
    } else if (type === "ebolovanje") {
      const c = tenant.ebol;
      setEbolForm({ euprava_username: c?.euprava_username || "", euprava_password: c?.euprava_password_encrypted || "", environment: c?.environment || "sandbox" });
    } else {
      const c = tenant.eotp;
      setEotpForm({ api_url: c?.api_url || "", api_key: c?.api_key_encrypted || "", environment: c?.environment || "sandbox" });
    }
    setConfigDialog({ tenant, type });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!configDialog) return;
      const { tenant, type } = configDialog;

      if (type === "sef") {
        const payload = { tenant_id: tenant.id, api_url: sefForm.api_url, api_key_encrypted: sefForm.api_key, environment: sefForm.environment, is_active: true };
        if (tenant.sef) {
          const { error } = await supabase.from("sef_connections").update(payload).eq("id", tenant.sef.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("sef_connections").insert(payload);
          if (error) throw error;
        }
      } else if (type === "ebolovanje") {
        const payload = { tenant_id: tenant.id, euprava_username: ebolForm.euprava_username, euprava_password_encrypted: ebolForm.euprava_password, environment: ebolForm.environment, is_active: true };
        if (tenant.ebol) {
          const { error } = await supabase.from("ebolovanje_connections").update(payload as any).eq("id", tenant.ebol.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("ebolovanje_connections").insert(payload as any);
          if (error) throw error;
        }
      } else {
        const payload = { tenant_id: tenant.id, api_url: eotpForm.api_url, api_key_encrypted: eotpForm.api_key, environment: eotpForm.environment, is_active: true };
        if (tenant.eotp) {
          const { error } = await supabase.from("eotpremnica_connections").update(payload as any).eq("id", tenant.eotp.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("eotpremnica_connections").insert(payload as any);
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-tenants-integrations"] });
      toast({ title: t("success"), description: t("settingsSaved") });
      setConfigDialog(null);
    },
    onError: (err: any) => toast({ title: t("error"), description: err.message, variant: "destructive" }),
  });

  // NBS Bulk Import
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

  const renderStatusBadge = (conn: any) => {
    if (!conn) return <Badge variant="secondary">{t("sefNotConfigured")}</Badge>;
    return conn.is_active
      ? <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">{t("active")}</Badge>
      : <Badge variant="secondary">{t("inactive")}</Badge>;
  };

  const renderConnectionTable = (
    icon: React.ReactNode,
    title: string,
    connKey: "sef" | "ebol" | "eotp",
    type: ConnectionType,
  ) => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">{icon}{title} — {t("tenants")}</CardTitle>
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
            {tenants.map((tenant: any) => {
              const conn = tenant[connKey];
              return (
                <TableRow key={tenant.id}>
                  <TableCell className="font-medium">{tenant.name}</TableCell>
                  <TableCell>{conn ? <Badge variant="outline">{conn.environment}</Badge> : "—"}</TableCell>
                  <TableCell>{renderStatusBadge(conn)}</TableCell>
                  <TableCell className="text-xs">{conn?.last_sync_at ? new Date(conn.last_sync_at).toLocaleString() : "—"}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" onClick={() => openConfig(tenant, type)}>
                      <Settings className="h-3 w-3 mr-1" />{t("configureForTenant")}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("integrationSupport")}</h1>

      {renderConnectionTable(<FileText className="h-5 w-5" />, t("sefConnection"), "sef", "sef")}
      {renderConnectionTable(<Heart className="h-5 w-5" />, t("eBolovanjeConnection"), "ebol", "ebolovanje")}
      {renderConnectionTable(<Truck className="h-5 w-5" />, t("eOtpremnicaConnection"), "eotp", "eotpremnica")}

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
          <DialogHeader>
            <DialogTitle>
              {configDialog?.type === "sef" ? t("sefConfiguration") : configDialog?.type === "ebolovanje" ? t("eBolovanjeConnection") : t("eOtpremnicaConnection")} — {configDialog?.tenant?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {configDialog?.type === "sef" && (
              <>
                <div><Label>{t("apiUrl")}</Label><Input value={sefForm.api_url} onChange={(e) => setSefForm(f => ({ ...f, api_url: e.target.value }))} /></div>
                <div><Label>{t("apiKey")}</Label><Input type="password" value={sefForm.api_key} onChange={(e) => setSefForm(f => ({ ...f, api_key: e.target.value }))} /></div>
                <div><Label>{t("environment")}</Label>
                  <Select value={sefForm.environment} onValueChange={(v) => setSefForm(f => ({ ...f, environment: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="sandbox">{t("sandbox")}</SelectItem><SelectItem value="production">{t("production")}</SelectItem></SelectContent>
                  </Select>
                </div>
              </>
            )}
            {configDialog?.type === "ebolovanje" && (
              <>
                <div><Label>{t("eUpravaUsername")}</Label><Input value={ebolForm.euprava_username} onChange={(e) => setEbolForm(f => ({ ...f, euprava_username: e.target.value }))} /></div>
                <div><Label>{t("eUpravaPassword")}</Label><Input type="password" value={ebolForm.euprava_password} onChange={(e) => setEbolForm(f => ({ ...f, euprava_password: e.target.value }))} /></div>
                <div><Label>{t("environment")}</Label>
                  <Select value={ebolForm.environment} onValueChange={(v) => setEbolForm(f => ({ ...f, environment: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="sandbox">{t("sandbox")}</SelectItem><SelectItem value="production">{t("production")}</SelectItem></SelectContent>
                  </Select>
                </div>
              </>
            )}
            {configDialog?.type === "eotpremnica" && (
              <>
                <div><Label>{t("apiUrl")}</Label><Input value={eotpForm.api_url} onChange={(e) => setEotpForm(f => ({ ...f, api_url: e.target.value }))} /></div>
                <div><Label>{t("apiKey")}</Label><Input type="password" value={eotpForm.api_key} onChange={(e) => setEotpForm(f => ({ ...f, api_key: e.target.value }))} /></div>
                <div><Label>{t("environment")}</Label>
                  <Select value={eotpForm.environment} onValueChange={(v) => setEotpForm(f => ({ ...f, environment: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="sandbox">{t("sandbox")}</SelectItem><SelectItem value="production">{t("production")}</SelectItem></SelectContent>
                  </Select>
                </div>
              </>
            )}
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
