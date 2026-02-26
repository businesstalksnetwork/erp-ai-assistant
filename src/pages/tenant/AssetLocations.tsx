import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import { Plus, Pencil, Trash2, MapPin, Search } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface LocationRow {
  id: string;
  name: string;
  location_type: string;
  address: string | null;
  parent_id: string | null;
  cost_center_id: string | null;
  is_active: boolean;
}

export default function AssetLocations() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<LocationRow | null>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    name: "", location_type: "building", address: "", parent_id: "", cost_center_id: "",
  });

  const { data: locations = [], isLoading } = useQuery({
    queryKey: ["asset-locations-all", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("asset_locations")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("name");
      if (error) throw error;
      return data as LocationRow[];
    },
    enabled: !!tenantId,
  });

  const { data: costCenters = [] } = useQuery({
    queryKey: ["cost-centers", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase.from("cost_centers")
        .select("id, name, code")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .order("code");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const filtered = locations.filter((l) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return l.name.toLowerCase().includes(s) || l.address?.toLowerCase().includes(s) || l.location_type.toLowerCase().includes(s);
  });

  // Build parent lookup for display
  const parentMap = new Map(locations.map((l) => [l.id, l.name]));

  const openNew = () => {
    setEditing(null);
    setForm({ name: "", location_type: "building", address: "", parent_id: "", cost_center_id: "" });
    setDialogOpen(true);
  };

  const openEdit = (loc: LocationRow) => {
    setEditing(loc);
    setForm({
      name: loc.name,
      location_type: loc.location_type,
      address: loc.address || "",
      parent_id: loc.parent_id || "",
      cost_center_id: loc.cost_center_id || "",
    });
    setDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error("No tenant");
      const payload = {
        tenant_id: tenantId,
        name: form.name,
        location_type: form.location_type,
        address: form.address || null,
        parent_id: form.parent_id || null,
        cost_center_id: form.cost_center_id || null,
      };
      if (editing) {
        const { error } = await supabase.from("asset_locations").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("asset_locations").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(t("saved" as any));
      qc.invalidateQueries({ queryKey: ["asset-locations-all"] });
      setDialogOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("asset_locations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("deleted" as any));
      qc.invalidateQueries({ queryKey: ["asset-locations-all"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const typeLabel = (t2: string) => {
    switch (t2) {
      case "building": return t("locBuilding" as any);
      case "room": return t("locRoom" as any);
      case "warehouse": return t("locWarehouse" as any);
      case "floor": return t("locFloor" as any);
      case "site": return t("locSite" as any);
      default: return t2;
    }
  };

  return (
    <div className="space-y-4 p-1">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">{t("assetsLocationsTitle" as any)}</h1>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> {t("add" as any)}</Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder={t("search")} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("name" as any)}</TableHead>
              <TableHead>{t("type" as any)}</TableHead>
              <TableHead>{t("address" as any)}</TableHead>
              <TableHead>{t("locParent" as any)}</TableHead>
              <TableHead>{t("status")}</TableHead>
              <TableHead>{t("actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((loc) => (
              <TableRow key={loc.id}>
                <TableCell className="font-medium flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  {loc.name}
                </TableCell>
                <TableCell><Badge variant="outline">{typeLabel(loc.location_type)}</Badge></TableCell>
                <TableCell>{loc.address || "—"}</TableCell>
                <TableCell>{loc.parent_id ? parentMap.get(loc.parent_id) || "—" : "—"}</TableCell>
                <TableCell>
                  <Badge className={loc.is_active ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-muted text-muted-foreground"}>
                    {loc.is_active ? t("active") : t("inactive" as any)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(loc)}><Pencil className="h-4 w-4" /></Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{t("confirmDeleteRecord" as any)}</AlertDialogTitle>
                          <AlertDialogDescription>{loc.name}</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteMutation.mutate(loc.id)}>{t("delete" as any)}</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? t("edit" as any) : t("add" as any)} {t("assetsLocation" as any)}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div>
              <Label>{t("name" as any)}</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>{t("type" as any)}</Label>
              <Select value={form.location_type} onValueChange={(v) => setForm({ ...form, location_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="site">{t("locSite" as any)}</SelectItem>
                  <SelectItem value="building">{t("locBuilding" as any)}</SelectItem>
                  <SelectItem value="floor">{t("locFloor" as any)}</SelectItem>
                  <SelectItem value="room">{t("locRoom" as any)}</SelectItem>
                  <SelectItem value="warehouse">{t("locWarehouse" as any)}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("address" as any)}</Label>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div>
              <Label>{t("locParent" as any)}</Label>
              <Select value={form.parent_id} onValueChange={(v) => setForm({ ...form, parent_id: v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">({t("none" as any)})</SelectItem>
                  {locations.filter((l) => l.id !== editing?.id).map((l) => (
                    <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {costCenters.length > 0 && (
              <div>
                <Label>{t("costCenter" as any)}</Label>
                <Select value={form.cost_center_id} onValueChange={(v) => setForm({ ...form, cost_center_id: v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">({t("none" as any)})</SelectItem>
                    {costCenters.map((cc: any) => (
                      <SelectItem key={cc.id} value={cc.id}>{cc.code} — {cc.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.name}>
              {t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
