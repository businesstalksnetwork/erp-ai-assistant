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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Wifi, WifiOff, RefreshCw } from "lucide-react";

const emptyForm = { device_name: "", device_type: "pfr", ib_number: "", jid: "", api_url: "", pac: "", location_id: "", location_name: "", location_address: "", is_active: true };

export default function FiscalDevices() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState(emptyForm);
  const [testing, setTesting] = useState<string | null>(null);

  const { data: devices = [], isLoading } = useQuery({
    queryKey: ["fiscal_devices", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("fiscal_devices").select("*, locations(name)").eq("tenant_id", tenantId!);
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: locations = [] } = useQuery({
    queryKey: ["locations_shops", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("locations").select("id, name, type, address").eq("tenant_id", tenantId!).in("type", ["shop", "branch"]);
      return data || [];
    },
    enabled: !!tenantId,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = { ...form, location_id: form.location_id || null };
      if (editing) {
        const { error } = await supabase.from("fiscal_devices").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("fiscal_devices").insert({ ...payload, tenant_id: tenantId! });
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fiscal_devices"] }); toast({ title: t("success") }); setDialogOpen(false); },
    onError: () => toast({ title: t("error"), variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("fiscal_devices").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fiscal_devices"] }); toast({ title: t("success") }); setDeleteId(null); },
    onError: () => toast({ title: t("error"), variant: "destructive" }),
  });

  const testConnection = async (device: any) => {
    if (!device.api_url) { toast({ title: t("error"), description: "No PFR URL configured", variant: "destructive" }); return; }
    setTesting(device.id);
    try {
      const res = await fetch(`${device.api_url}/api/v3/status`, { method: "GET", signal: AbortSignal.timeout(5000) });
      if (res.ok) toast({ title: t("deviceConnected") });
      else toast({ title: t("deviceOffline"), variant: "destructive" });
    } catch {
      toast({ title: t("deviceOffline"), variant: "destructive" });
    } finally {
      setTesting(null);
    }
  };

  const openEdit = (d: any) => {
    setEditing(d);
    setForm({ device_name: d.device_name, device_type: d.device_type, ib_number: d.ib_number, jid: d.jid || "", api_url: d.api_url || "", pac: d.pac || "", location_id: d.location_id || "", location_name: d.location_name, location_address: d.location_address, is_active: d.is_active });
    setDialogOpen(true);
  };

  // Offline receipts query
  const { data: offlineReceipts = [] } = useQuery({
    queryKey: ["offline_receipts", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("fiscal_receipts").select("*, fiscal_devices(device_name)").eq("tenant_id", tenantId!).like("receipt_number", "OFFLINE-%");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const [retrying, setRetrying] = useState(false);
  const handleRetryOffline = async () => {
    setRetrying(true);
    try {
      const { data, error } = await supabase.functions.invoke("fiscalize-retry-offline", { body: { tenant_id: tenantId } });
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["offline_receipts"] });
      toast({ title: t("success"), description: t("offlineRetried") });
    } catch (err: any) {
      toast({ title: t("error"), description: err.message, variant: "destructive" });
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t("fiscalDevices")}</h1>
        <div className="flex gap-2">
          {offlineReceipts.length > 0 && (
            <Button variant="outline" onClick={handleRetryOffline} disabled={retrying}>
              <RefreshCw className={`h-4 w-4 mr-2 ${retrying ? "animate-spin" : ""}`} />
              {t("retryOffline")} ({offlineReceipts.length})
            </Button>
          )}
          <Button onClick={() => { setEditing(null); setForm(emptyForm); setDialogOpen(true); }}><Plus className="h-4 w-4 mr-2" />{t("add")}</Button>
        </div>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("name")}</TableHead>
              <TableHead>{t("type")}</TableHead>
              <TableHead>{t("location")}</TableHead>
              <TableHead>{t("ibNumber")}</TableHead>
              <TableHead>{t("pfrUrl")}</TableHead>
              <TableHead>{t("status")}</TableHead>
              <TableHead>{t("actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center">{t("loading")}</TableCell></TableRow>
            ) : devices.map((d: any) => (
              <TableRow key={d.id}>
                <TableCell className="font-medium">{d.device_name}</TableCell>
                <TableCell><Badge variant="outline">{d.device_type.toUpperCase()}</Badge></TableCell>
                <TableCell>{d.locations?.name || "-"}</TableCell>
                <TableCell className="font-mono text-xs">{d.ib_number || "-"}</TableCell>
                <TableCell className="text-xs max-w-32 truncate">{d.api_url || "-"}</TableCell>
                <TableCell><Badge variant={d.is_active ? "default" : "secondary"}>{d.is_active ? t("active") : t("inactive")}</Badge></TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => testConnection(d)} disabled={testing === d.id}>
                      {d.api_url ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4 text-muted-foreground" />}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(d)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteId(d.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? t("edit") : t("add")} {t("fiscalDevice")}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div><Label>{t("name")}</Label><Input value={form.device_name} onChange={e => setForm(f => ({ ...f, device_name: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>{t("type")}</Label>
                <Select value={form.device_type} onValueChange={v => setForm(f => ({ ...f, device_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pfr">PFR</SelectItem>
                    <SelectItem value="esir">ESIR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>{t("location")}</Label>
                <Select value={form.location_id} onValueChange={v => {
                  const loc = locations.find((l: any) => l.id === v);
                  setForm(f => ({ ...f, location_id: v, location_name: loc?.name || "", location_address: loc?.address || "" }));
                }}>
                  <SelectTrigger><SelectValue placeholder={t("selectLocation")} /></SelectTrigger>
                  <SelectContent>{locations.map((l: any) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>{t("ibNumber")}</Label><Input value={form.ib_number} onChange={e => setForm(f => ({ ...f, ib_number: e.target.value }))} /></div>
              <div><Label>JID</Label><Input value={form.jid} onChange={e => setForm(f => ({ ...f, jid: e.target.value }))} /></div>
            </div>
            <div><Label>{t("pfrUrl")}</Label><Input value={form.api_url} onChange={e => setForm(f => ({ ...f, api_url: e.target.value }))} placeholder="http://localhost:3333" /></div>
            <div><Label>{t("pacCode")}</Label><Input value={form.pac} onChange={e => setForm(f => ({ ...f, pac: e.target.value }))} /></div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
              <Label>{t("active")}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!form.device_name}>{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{t("confirm")}</AlertDialogTitle><AlertDialogDescription>{t("deleteConfirmation")}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)}>{t("delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
