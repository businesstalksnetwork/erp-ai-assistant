import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2, Search, MapPin, Layers, Package } from "lucide-react";
import { useNavigate } from "react-router-dom";

const ZONE_TYPES = ["receiving", "reserve", "forward_pick", "packing", "shipping", "quarantine", "returns"] as const;
const PICK_METHODS = ["each", "case", "pallet"] as const;
const BIN_TYPES = ["bin", "shelf", "pallet", "flow_rack"] as const;

type ZoneType = typeof ZONE_TYPES[number];
type PickMethod = typeof PICK_METHODS[number];
type BinType = typeof BIN_TYPES[number];

const emptyZoneForm = { name: "", code: "", zone_type: "reserve" as ZoneType, pick_method: "each" as PickMethod, is_active: true, sort_order: 0 };
const emptyAisleForm = { name: "", code: "", sort_order: 0 };
const emptyBinForm = {
  code: "", bin_type: "bin" as BinType, max_volume: "", max_weight: "", max_units: "",
  level: 1, accessibility_score: 5, is_active: true, sort_order: 0, aisle_id: "" as string | null,
};

export default function WmsZones() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { toast } = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [warehouseId, setWarehouseId] = useState<string>("");
  const [selectedZoneId, setSelectedZoneId] = useState<string>("");
  const [search, setSearch] = useState("");

  // Zone dialog
  const [zoneDialogOpen, setZoneDialogOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<any>(null);
  const [zoneForm, setZoneForm] = useState(emptyZoneForm);

  // Aisle dialog
  const [aisleDialogOpen, setAisleDialogOpen] = useState(false);
  const [editingAisle, setEditingAisle] = useState<any>(null);
  const [aisleForm, setAisleForm] = useState(emptyAisleForm);

  // Bin dialog
  const [binDialogOpen, setBinDialogOpen] = useState(false);
  const [editingBin, setEditingBin] = useState<any>(null);
  const [binForm, setBinForm] = useState(emptyBinForm);

  const { data: warehouses = [] } = useQuery({
    queryKey: ["warehouses", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("warehouses").select("id, name").eq("tenant_id", tenantId!).eq("is_active", true);
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const { data: zones = [] } = useQuery({
    queryKey: ["wms-zones", tenantId, warehouseId],
    queryFn: async () => {
      const { data, error } = await supabase.from("wms_zones").select("*").eq("tenant_id", tenantId!).eq("warehouse_id", warehouseId).order("sort_order");
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId && !!warehouseId,
  });

  const { data: aisles = [] } = useQuery({
    queryKey: ["wms-aisles", tenantId, selectedZoneId],
    queryFn: async () => {
      const { data, error } = await supabase.from("wms_aisles").select("*").eq("tenant_id", tenantId!).eq("zone_id", selectedZoneId).order("sort_order");
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId && !!selectedZoneId,
  });

  const { data: bins = [] } = useQuery({
    queryKey: ["wms-bins", tenantId, selectedZoneId],
    queryFn: async () => {
      const { data, error } = await supabase.from("wms_bins").select("*, wms_aisles(name)").eq("tenant_id", tenantId!).eq("zone_id", selectedZoneId).order("sort_order");
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId && !!selectedZoneId,
  });

  const { data: binStockCounts = {} } = useQuery({
    queryKey: ["wms-bin-stock-counts", tenantId, selectedZoneId],
    queryFn: async () => {
      // WMS-HIGH-3: Filter bin stock by selected zone's bins
      const binIds = (bins || []).map((b: any) => b.id);
      if (binIds.length === 0) return {};
      const { data, error } = await supabase.from("wms_bin_stock").select("bin_id, quantity").eq("tenant_id", tenantId!).in("bin_id", binIds);
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data || []).forEach((r: any) => { counts[r.bin_id] = (counts[r.bin_id] || 0) + Number(r.quantity); });
      return counts;
    },
    enabled: !!tenantId && !!selectedZoneId,
  });

  // Zone CRUD
  const zoneMutation = useMutation({
    mutationFn: async () => {
      const payload = { ...zoneForm, warehouse_id: warehouseId, tenant_id: tenantId! };
      if (editingZone) {
        const { error } = await supabase.from("wms_zones").update(zoneForm).eq("id", editingZone.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("wms_zones").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["wms-zones"] }); toast({ title: t("success") }); setZoneDialogOpen(false); },
    onError: () => toast({ title: t("error"), variant: "destructive" }),
  });

  // Aisle CRUD
  const aisleMutation = useMutation({
    mutationFn: async () => {
      const payload = { ...aisleForm, zone_id: selectedZoneId, tenant_id: tenantId! };
      if (editingAisle) {
        const { error } = await supabase.from("wms_aisles").update(aisleForm).eq("id", editingAisle.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("wms_aisles").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["wms-aisles"] }); toast({ title: t("success") }); setAisleDialogOpen(false); },
    onError: () => toast({ title: t("error"), variant: "destructive" }),
  });

  // Bin CRUD
  const binMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...binForm,
        max_volume: binForm.max_volume ? Number(binForm.max_volume) : null,
        max_weight: binForm.max_weight ? Number(binForm.max_weight) : null,
        max_units: binForm.max_units ? Number(binForm.max_units) : null,
        aisle_id: binForm.aisle_id || null,
        zone_id: selectedZoneId,
        warehouse_id: warehouseId,
        tenant_id: tenantId!,
      };
      if (editingBin) {
        const { tenant_id: _t, warehouse_id: _w, zone_id: _z, ...updatePayload } = payload;
        const { error } = await supabase.from("wms_bins").update(updatePayload).eq("id", editingBin.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("wms_bins").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["wms-bins"] }); toast({ title: t("success") }); setBinDialogOpen(false); },
    onError: () => toast({ title: t("error"), variant: "destructive" }),
  });

  const selectedZone = zones.find((z: any) => z.id === selectedZoneId);

  const getBinUtilColor = (binId: string, maxUnits: number | null) => {
    const qty = binStockCounts[binId] || 0;
    if (qty === 0) return "bg-muted text-muted-foreground";
    if (!maxUnits) return "bg-primary/20 text-primary";
    const pct = qty / maxUnits;
    if (pct >= 1) return "bg-destructive/20 text-destructive";
    if (pct >= 0.7) return "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400";
    return "bg-primary/20 text-primary";
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("wmsZones")}
        description={t("wmsZonesDesc")}
        icon={MapPin}
        actions={
          <Select value={warehouseId || "none"} onValueChange={(v) => { setWarehouseId(v === "none" ? "" : v); setSelectedZoneId(""); }}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder={t("selectWarehouse")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t("selectWarehouse")}</SelectItem>
              {warehouses.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
            </SelectContent>
          </Select>
        }
      />

      {!warehouseId ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">{t("selectWarehouse")}</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Zones list */}
          <Card className="lg:col-span-1">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">{t("zones")}</CardTitle>
              <Button size="sm" onClick={() => { setEditingZone(null); setZoneForm(emptyZoneForm); setZoneDialogOpen(true); }}>
                <Plus className="h-4 w-4 mr-1" />{t("add")}
              </Button>
            </CardHeader>
            <CardContent className="space-y-1">
              {zones.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">{t("noResults")}</p>
              ) : zones.map((z: any) => (
                <button
                  key={z.id}
                  onClick={() => setSelectedZoneId(z.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm text-left transition-colors ${selectedZoneId === z.id ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"}`}
                >
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 flex-shrink-0" />
                    <span>{z.name}</span>
                  </div>
                  <Badge variant="outline" className="text-[10px]">{z.zone_type}</Badge>
                </button>
              ))}
            </CardContent>
          </Card>

          {/* Zone detail: aisles + bins */}
          <Card className="lg:col-span-2">
            {!selectedZone ? (
              <CardContent className="py-12 text-center text-muted-foreground">{t("selectZone")}</CardContent>
            ) : (
              <>
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <div>
                    <CardTitle className="text-base">{selectedZone.name} ({selectedZone.code})</CardTitle>
                    <p className="text-xs text-muted-foreground">{selectedZone.zone_type} · {selectedZone.pick_method}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => { setEditingZone(selectedZone); setZoneForm({ name: selectedZone.name, code: selectedZone.code, zone_type: selectedZone.zone_type, pick_method: selectedZone.pick_method, is_active: selectedZone.is_active, sort_order: selectedZone.sort_order }); setZoneDialogOpen(true); }}>
                      <Pencil className="h-3 w-3 mr-1" />{t("edit")}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="bins">
                    <TabsList>
                      <TabsTrigger value="bins">{t("wmsBins")} ({bins.length})</TabsTrigger>
                      <TabsTrigger value="aisles">{t("wmsAisles")} ({aisles.length})</TabsTrigger>
                    </TabsList>
                    <TabsContent value="bins" className="mt-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="relative max-w-xs">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input placeholder={t("search")} value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-8" />
                        </div>
                        <Button size="sm" onClick={() => { setEditingBin(null); setBinForm(emptyBinForm); setBinDialogOpen(true); }}>
                          <Plus className="h-4 w-4 mr-1" />{t("addBin")}
                        </Button>
                      </div>
                      {bins.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-6">{t("noResults")}</p>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                          {bins.filter((b: any) => b.code.toLowerCase().includes(search.toLowerCase())).map((b: any) => (
                            <button
                              key={b.id}
                              onClick={() => navigate(`/inventory/wms/bins/${b.id}`)}
                              className={`p-3 rounded-lg border text-left transition-all hover:shadow-md ${getBinUtilColor(b.id, b.max_units)}`}
                            >
                              <div className="font-mono text-sm font-semibold">{b.code}</div>
                              <div className="text-[10px] mt-1 opacity-70">L{b.level} · {b.bin_type}</div>
                              <div className="text-xs mt-1 font-medium">{binStockCounts[b.id] || 0}{b.max_units ? `/${b.max_units}` : ""} units</div>
                            </button>
                          ))}
                        </div>
                      )}
                    </TabsContent>
                    <TabsContent value="aisles" className="mt-4">
                      <div className="flex justify-end mb-3">
                        <Button size="sm" onClick={() => { setEditingAisle(null); setAisleForm(emptyAisleForm); setAisleDialogOpen(true); }}>
                          <Plus className="h-4 w-4 mr-1" />{t("addAisle")}
                        </Button>
                      </div>
                      <Table>
                        <TableHeader><TableRow><TableHead>{t("name")}</TableHead><TableHead>{t("code")}</TableHead><TableHead>{t("sortOrder")}</TableHead><TableHead className="w-16" /></TableRow></TableHeader>
                        <TableBody>
                          {aisles.length === 0 ? (
                            <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">{t("noResults")}</TableCell></TableRow>
                          ) : aisles.map((a: any) => (
                            <TableRow key={a.id}>
                              <TableCell className="font-medium">{a.name}</TableCell>
                              <TableCell>{a.code}</TableCell>
                              <TableCell>{a.sort_order}</TableCell>
                              <TableCell>
                                <Button variant="ghost" size="icon" onClick={() => { setEditingAisle(a); setAisleForm({ name: a.name, code: a.code, sort_order: a.sort_order }); setAisleDialogOpen(true); }}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </>
            )}
          </Card>
        </div>
      )}

      {/* Zone Dialog */}
      <Dialog open={zoneDialogOpen} onOpenChange={setZoneDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingZone ? t("edit") : t("add")} {t("zones")}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div><Label>{t("name")}</Label><Input value={zoneForm.name} onChange={e => setZoneForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><Label>{t("code")}</Label><Input value={zoneForm.code} onChange={e => setZoneForm(f => ({ ...f, code: e.target.value }))} /></div>
            <div><Label>{t("zoneType")}</Label>
              <Select value={zoneForm.zone_type} onValueChange={(v: ZoneType) => setZoneForm(f => ({ ...f, zone_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ZONE_TYPES.map(zt => <SelectItem key={zt} value={zt}>{zt.replace("_", " ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>{t("pickMethod")}</Label>
              <Select value={zoneForm.pick_method} onValueChange={(v: PickMethod) => setZoneForm(f => ({ ...f, pick_method: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PICK_METHODS.map(pm => <SelectItem key={pm} value={pm}>{pm}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>{t("sortOrder")}</Label><Input type="number" value={zoneForm.sort_order} onChange={e => setZoneForm(f => ({ ...f, sort_order: Number(e.target.value) }))} /></div>
            <div className="flex items-center gap-2"><Switch checked={zoneForm.is_active} onCheckedChange={v => setZoneForm(f => ({ ...f, is_active: v }))} /><Label>{t("active")}</Label></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setZoneDialogOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => zoneMutation.mutate()} disabled={!zoneForm.name || !zoneForm.code || zoneMutation.isPending}>{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Aisle Dialog */}
      <Dialog open={aisleDialogOpen} onOpenChange={setAisleDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingAisle ? t("edit") : t("add")} {t("wmsAisles")}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div><Label>{t("name")}</Label><Input value={aisleForm.name} onChange={e => setAisleForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><Label>{t("code")}</Label><Input value={aisleForm.code} onChange={e => setAisleForm(f => ({ ...f, code: e.target.value }))} /></div>
            <div><Label>{t("sortOrder")}</Label><Input type="number" value={aisleForm.sort_order} onChange={e => setAisleForm(f => ({ ...f, sort_order: Number(e.target.value) }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAisleDialogOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => aisleMutation.mutate()} disabled={!aisleForm.name || !aisleForm.code || aisleMutation.isPending}>{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bin Dialog */}
      <Dialog open={binDialogOpen} onOpenChange={setBinDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingBin ? t("edit") : t("add")} Bin</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div><Label>{t("code")}</Label><Input value={binForm.code} onChange={e => setBinForm(f => ({ ...f, code: e.target.value }))} placeholder="A-01-03-B" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>{t("binType")}</Label>
                <Select value={binForm.bin_type} onValueChange={(v: BinType) => setBinForm(f => ({ ...f, bin_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{BIN_TYPES.map(bt => <SelectItem key={bt} value={bt}>{bt.replace("_", " ")}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>{t("wmsAisles")}</Label>
                <Select value={binForm.aisle_id || "none"} onValueChange={v => setBinForm(f => ({ ...f, aisle_id: v === "none" ? null : v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {aisles.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div><Label>{t("maxVolume")}</Label><Input type="number" value={binForm.max_volume} onChange={e => setBinForm(f => ({ ...f, max_volume: e.target.value }))} /></div>
              <div><Label>{t("maxWeight")}</Label><Input type="number" value={binForm.max_weight} onChange={e => setBinForm(f => ({ ...f, max_weight: e.target.value }))} /></div>
              <div><Label>{t("maxUnits")}</Label><Input type="number" value={binForm.max_units} onChange={e => setBinForm(f => ({ ...f, max_units: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>{t("level")}</Label><Input type="number" min={1} value={binForm.level} onChange={e => setBinForm(f => ({ ...f, level: Number(e.target.value) }))} /></div>
              <div><Label>{t("accessibilityScore")}</Label><Input type="number" min={1} max={10} value={binForm.accessibility_score} onChange={e => setBinForm(f => ({ ...f, accessibility_score: Number(e.target.value) }))} /></div>
            </div>
            <div className="flex items-center gap-2"><Switch checked={binForm.is_active} onCheckedChange={v => setBinForm(f => ({ ...f, is_active: v }))} /><Label>{t("active")}</Label></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBinDialogOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => binMutation.mutate()} disabled={!binForm.code || binMutation.isPending}>{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
