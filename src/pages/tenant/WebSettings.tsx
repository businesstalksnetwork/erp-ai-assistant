import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Globe, ShoppingBag, Code, Wifi, WifiOff, RefreshCw, Copy, Link as LinkIcon } from "lucide-react";
import { Link } from "react-router-dom";

type Platform = "shopify" | "woocommerce" | "custom";

interface ConnectionForm {
  platform: Platform;
  store_url: string;
  api_key: string;
  api_secret: string;
  access_token: string;
  webhook_secret: string;
  is_active: boolean;
}

const emptyForm: ConnectionForm = {
  platform: "shopify",
  store_url: "",
  api_key: "",
  api_secret: "",
  access_token: "",
  webhook_secret: "",
  is_active: false,
};

const platformIcons: Record<Platform, typeof Globe> = {
  shopify: ShoppingBag,
  woocommerce: Globe,
  custom: Code,
};

const platformLabels: Record<Platform, string> = {
  shopify: "Shopify",
  woocommerce: "WooCommerce",
  custom: "Custom API",
};

export default function WebSettings() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [dialog, setDialog] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<ConnectionForm>(emptyForm);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const { data: connections = [] } = useQuery({
    queryKey: ["web_connections", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("web_connections" as any)
        .select("*")
        .eq("tenant_id", tenantId!);
      return (data as any[]) || [];
    },
    enabled: !!tenantId,
  });

  // Fetch last sync log per connection
  const { data: syncLogs = [] } = useQuery({
    queryKey: ["web_sync_logs", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("web_sync_logs" as any)
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("started_at", { ascending: false })
        .limit(50);
      return (data as any[]) || [];
    },
    enabled: !!tenantId,
  });

  // Count web orders per connection
  const { data: webOrderCounts = {} } = useQuery({
    queryKey: ["web_order_counts", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("sales_orders")
        .select("web_connection_id")
        .eq("tenant_id", tenantId!)
        .eq("source", "web");
      const counts: Record<string, number> = {};
      (data || []).forEach((r: any) => {
        if (r.web_connection_id) counts[r.web_connection_id] = (counts[r.web_connection_id] || 0) + 1;
      });
      return counts;
    },
    enabled: !!tenantId,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        platform: form.platform,
        store_url: form.store_url,
        api_key: form.api_key,
        api_secret: form.api_secret || null,
        access_token: form.access_token || null,
        webhook_secret: form.webhook_secret || null,
        is_active: form.is_active,
      };
      if (editing) {
        const { error } = await supabase
          .from("web_connections" as any)
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("web_connections" as any)
          .insert({ ...payload, tenant_id: tenantId! });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["web_connections"] });
      toast({ title: t("success") });
      setDialog(false);
    },
    onError: () => toast({ title: t("error"), variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("web_connections" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["web_connections"] });
      toast({ title: t("success") });
      setDeleteConfirm(null);
    },
    onError: () => toast({ title: t("error"), variant: "destructive" }),
  });

  const syncMutation = useMutation({
    mutationFn: async (connectionId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("web-sync", {
        body: { tenant_id: tenantId, connection_id: connectionId, sync_type: "full" },
      });
      if (res.error) throw res.error;
      return res.data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["web_sync_logs"] });
      qc.invalidateQueries({ queryKey: ["web_connections"] });
      toast({ title: t("syncStatus"), description: `${data.products_synced} products synced (${data.status})` });
    },
    onError: () => toast({ title: t("error"), variant: "destructive" }),
  });

  const openAdd = () => { setEditing(null); setForm(emptyForm); setDialog(true); };
  const openEdit = (conn: any) => {
    setEditing(conn);
    setForm({
      platform: conn.platform, store_url: conn.store_url,
      api_key: conn.api_key || "", api_secret: conn.api_secret || "",
      access_token: conn.access_token || "", webhook_secret: conn.webhook_secret || "",
      is_active: conn.is_active,
    });
    setDialog(true);
  };
  const updateField = (key: keyof ConnectionForm, value: any) => setForm((f) => ({ ...f, [key]: value }));

  const getWebhookUrl = (connId: string) => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    return `${supabaseUrl}/functions/v1/web-order-import`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: t("copied") });
  };

  const getLastSyncForConnection = (connId: string) => {
    return syncLogs.find((l: any) => l.web_connection_id === connId);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("webSales")}</h1>
        <Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" />{t("addConnection")}</Button>
      </div>

      {connections.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
            <Globe className="h-12 w-12" />
            <p>{t("noWebConnections")}</p>
            <Button variant="outline" onClick={openAdd}><Plus className="h-4 w-4 mr-2" />{t("addConnection")}</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {connections.map((conn: any) => {
            const Icon = platformIcons[conn.platform as Platform] || Globe;
            const lastSync = getLastSyncForConnection(conn.id);
            const orderCount = (webOrderCounts as Record<string, number>)[conn.id] || 0;
            return (
              <Card key={conn.id}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Icon className="h-5 w-5" />
                    {platformLabels[conn.platform as Platform] || conn.platform}
                  </CardTitle>
                  <Badge variant={conn.is_active ? "default" : "secondary"}>
                    {conn.is_active ? (<><Wifi className="h-3 w-3 mr-1" />{t("active")}</>) : (<><WifiOff className="h-3 w-3 mr-1" />{t("inactive")}</>)}
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground truncate">{conn.store_url}</p>

                  {/* Sync info */}
                  {lastSync && (
                    <div className="text-xs space-y-1">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t("lastSync")}</span>
                        <span>{new Date(lastSync.started_at).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t("syncStatus")}</span>
                        <Badge variant={lastSync.status === "success" ? "default" : lastSync.status === "partial" ? "secondary" : "destructive"} className="text-xs">
                          {lastSync.status} ({lastSync.products_synced})
                        </Badge>
                      </div>
                    </div>
                  )}

                  {/* Web orders count */}
                  {orderCount > 0 && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{t("webOrders")}</span>
                      <Link to="/sales/sales-orders" className="text-primary hover:underline flex items-center gap-1">
                        <LinkIcon className="h-3 w-3" />{orderCount}
                      </Link>
                    </div>
                  )}

                  {/* Webhook URL */}
                  <div className="text-xs">
                    <span className="text-muted-foreground">{t("webhookUrl")}:</span>
                    <div className="flex items-center gap-1 mt-1">
                      <code className="text-xs bg-muted px-1 py-0.5 rounded truncate flex-1">{getWebhookUrl(conn.id)}</code>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(getWebhookUrl(conn.id))}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  {conn.last_error && (
                    <p className="text-xs text-destructive truncate">{conn.last_error}</p>
                  )}

                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" size="sm" onClick={() => syncMutation.mutate(conn.id)} disabled={syncMutation.isPending}>
                      <RefreshCw className={`h-3.5 w-3.5 mr-1 ${syncMutation.isPending ? "animate-spin" : ""}`} />
                      {syncMutation.isPending ? t("syncing") : t("syncNow")}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => openEdit(conn)}>
                      <Pencil className="h-3.5 w-3.5 mr-1" />{t("edit")}
                    </Button>
                    <Button variant="outline" size="sm" className="text-destructive" onClick={() => setDeleteConfirm(conn.id)}>
                      <Trash2 className="h-3.5 w-3.5 mr-1" />{t("delete")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? t("editConnection") : t("addConnection")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label>{t("platform")}</Label>
              <Select value={form.platform} onValueChange={(v) => updateField("platform", v as Platform)} disabled={!!editing}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="shopify">Shopify</SelectItem>
                  <SelectItem value="woocommerce">WooCommerce</SelectItem>
                  <SelectItem value="custom">{t("customApi")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("storeUrl")}</Label>
              <Input value={form.store_url} onChange={(e) => updateField("store_url", e.target.value)}
                placeholder={form.platform === "shopify" ? "mystore.myshopify.com" : form.platform === "woocommerce" ? "https://mystore.com" : "https://api.mystore.com"} />
            </div>
            {form.platform === "shopify" && (
              <>
                <div><Label>API Key</Label><Input value={form.api_key} onChange={(e) => updateField("api_key", e.target.value)} /></div>
                <div><Label>{t("accessToken")}</Label><Input value={form.access_token} onChange={(e) => updateField("access_token", e.target.value)} type="password" /></div>
              </>
            )}
            {form.platform === "woocommerce" && (
              <>
                <div><Label>{t("consumerKey")}</Label><Input value={form.api_key} onChange={(e) => updateField("api_key", e.target.value)} placeholder="ck_..." /></div>
                <div><Label>{t("consumerSecret")}</Label><Input value={form.api_secret} onChange={(e) => updateField("api_secret", e.target.value)} type="password" placeholder="cs_..." /></div>
              </>
            )}
            {form.platform === "custom" && (
              <>
                <div><Label>API Key</Label><Input value={form.api_key} onChange={(e) => updateField("api_key", e.target.value)} /></div>
                <div><Label>{t("webhookSecret")}</Label><Input value={form.webhook_secret} onChange={(e) => updateField("webhook_secret", e.target.value)} type="password" /></div>
              </>
            )}
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={(v) => updateField("is_active", v)} />
              <Label>{t("active")}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(false)}>{t("cancel")}</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!form.store_url}>{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("deleteConfirmation")}</DialogTitle></DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>{t("cancel")}</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm)}>{t("delete")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
