import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus } from "lucide-react";

export default function PosSessions() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [openDialog, setOpenDialog] = useState(false);
  const [openingBalance, setOpeningBalance] = useState(0);
  const [selectedLocation, setSelectedLocation] = useState("");
  const [selectedSalesperson, setSelectedSalesperson] = useState("");
  const [selectedFiscalDevice, setSelectedFiscalDevice] = useState("");
  const [closeDialog, setCloseDialog] = useState<string | null>(null);
  const [closingBalance, setClosingBalance] = useState(0);
  const [locationFilter, setLocationFilter] = useState<string>("all");

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["pos_sessions", tenantId, locationFilter],
    queryFn: async () => {
      if (!tenantId) return [];
      let q = supabase.from("pos_sessions").select("*, locations(name), salespeople(first_name, last_name, code)").eq("tenant_id", tenantId).order("opened_at", { ascending: false });
      if (locationFilter !== "all") q = q.eq("location_id", locationFilter);
      const { data } = await q;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: locations = [] } = useQuery({
    queryKey: ["locations_shops", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("locations").select("id, name, type, default_warehouse_id").eq("tenant_id", tenantId!).in("type", ["shop", "branch"]);
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: salespeople = [] } = useQuery({
    queryKey: ["salespeople_active", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("salespeople").select("id, first_name, last_name, code").eq("tenant_id", tenantId!).eq("is_active", true);
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Fiscal devices for selected location
  const { data: locationFiscalDevices = [] } = useQuery({
    queryKey: ["fiscal_devices_for_location", tenantId, selectedLocation],
    queryFn: async () => {
      if (!selectedLocation) return [];
      const { data } = await supabase.from("fiscal_devices").select("id, device_name").eq("tenant_id", tenantId!).eq("location_id", selectedLocation).eq("is_active", true);
      return data || [];
    },
    enabled: !!tenantId && !!selectedLocation,
  });

  const openSession = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error("No tenant");
      const loc = locations.find((l: any) => l.id === selectedLocation);
      // Auto-select fiscal device if only one available
      const fiscalDeviceId = selectedFiscalDevice || (locationFiscalDevices.length === 1 ? locationFiscalDevices[0].id : null);
      await supabase.from("pos_sessions").insert({
        tenant_id: tenantId,
        opened_by: user?.id,
        opening_balance: openingBalance,
        location_id: selectedLocation || null,
        warehouse_id: loc?.default_warehouse_id || null,
        salesperson_id: selectedSalesperson || null,
        fiscal_device_id: fiscalDeviceId,
      } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pos_sessions"] });
      setOpenDialog(false);
      toast({ title: t("success") });
    },
  });

  const closeSession = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("pos_sessions").update({ status: "closed", closed_at: new Date().toISOString(), closing_balance: closingBalance }).eq("id", id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pos_sessions"] });
      queryClient.invalidateQueries({ queryKey: ["pos_sessions_active"] });
      setCloseDialog(null);
      toast({ title: t("success") });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("posSessions")}</h1>
        <div className="flex gap-2">
          <Select value={locationFilter} onValueChange={setLocationFilter}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allLocations")}</SelectItem>
              {locations.map((l: any) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={() => { setOpeningBalance(0); setSelectedLocation(""); setSelectedSalesperson(""); setSelectedFiscalDevice(""); setOpenDialog(true); }}>
            <Plus className="h-4 w-4 mr-2" />{t("openSession")}
          </Button>
        </div>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("location")}</TableHead>
            <TableHead>{t("salesperson")}</TableHead>
            <TableHead>{t("status")}</TableHead>
            <TableHead>{t("openingBalance")}</TableHead>
            <TableHead>{t("closingBalance")}</TableHead>
            <TableHead>{t("openedAt")}</TableHead>
            <TableHead>{t("closedAt")}</TableHead>
            <TableHead>{t("actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow><TableCell colSpan={8}>{t("loading")}</TableCell></TableRow>
          ) : sessions.map((s: any) => (
            <TableRow key={s.id}>
              <TableCell>{(s as any).locations?.name || "-"}</TableCell>
              <TableCell>{(s as any).salespeople ? `${(s as any).salespeople.first_name} ${(s as any).salespeople.last_name}` : "-"}</TableCell>
              <TableCell><Badge variant={s.status === "open" ? "default" : "secondary"}>{s.status === "open" ? t("open") : t("closed")}</Badge></TableCell>
              <TableCell>{Number(s.opening_balance).toFixed(2)}</TableCell>
              <TableCell>{s.closing_balance != null ? Number(s.closing_balance).toFixed(2) : "-"}</TableCell>
              <TableCell>{new Date(s.opened_at).toLocaleString()}</TableCell>
              <TableCell>{s.closed_at ? new Date(s.closed_at).toLocaleString() : "-"}</TableCell>
              <TableCell>
                {s.status === "open" && (
                  <Button size="sm" variant="outline" onClick={() => { setClosingBalance(0); setCloseDialog(s.id); }}>{t("closeSession")}</Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Open Session Dialog */}
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("openSession")}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div><Label>{t("location")}</Label>
              <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                <SelectTrigger><SelectValue placeholder={t("selectLocation")} /></SelectTrigger>
                <SelectContent>{locations.map((l: any) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>{t("salesperson")}</Label>
              <Select value={selectedSalesperson} onValueChange={setSelectedSalesperson}>
                <SelectTrigger><SelectValue placeholder={t("salesperson")} /></SelectTrigger>
                <SelectContent>{salespeople.map((sp: any) => <SelectItem key={sp.id} value={sp.id}>{sp.first_name} {sp.last_name} ({sp.code})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>{t("openingBalance")}</Label><Input type="number" value={openingBalance} onChange={e => setOpeningBalance(Number(e.target.value))} /></div>
            <div><Label>{t("selectFiscalDevice")}</Label>
              {locationFiscalDevices.length === 0 && selectedLocation && (
                <p className="text-xs text-destructive mt-1">{t("noFiscalDevicesWarning")}</p>
              )}
              {locationFiscalDevices.length > 0 && (
                <Select value={selectedFiscalDevice || (locationFiscalDevices.length === 1 ? locationFiscalDevices[0].id : "")} onValueChange={setSelectedFiscalDevice}>
                  <SelectTrigger><SelectValue placeholder={t("selectFiscalDevice")} /></SelectTrigger>
                  <SelectContent>{locationFiscalDevices.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.device_name}</SelectItem>)}</SelectContent>
                </Select>
              )}
            </div>
          </div>
          <DialogFooter><Button onClick={() => openSession.mutate()} disabled={!selectedLocation}>{t("open")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close Session Dialog */}
      <Dialog open={!!closeDialog} onOpenChange={() => setCloseDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("closeSession")}</DialogTitle></DialogHeader>
          <div><Label>{t("closingBalance")}</Label><Input type="number" value={closingBalance} onChange={e => setClosingBalance(Number(e.target.value))} /></div>
          <DialogFooter><Button onClick={() => closeDialog && closeSession.mutate(closeDialog)}>{t("close")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
