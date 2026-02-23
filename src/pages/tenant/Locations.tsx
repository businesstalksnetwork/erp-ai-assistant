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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Search, Settings2 } from "lucide-react";

const emptyForm = { name: "", type: "office", address: "", city: "", is_active: true, default_warehouse_id: "", default_price_list_id: "", location_type_id: "" };
const emptyTypeForm = { name: "", code: "", has_warehouse: false, has_sellers: false, is_active: true };

export default function Locations() {
  const { t } = useLanguage();
  const { tenantId, isLoading: tenantLoading } = useTenant();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState(emptyForm);

  // Location Types management
  const [typesDialogOpen, setTypesDialogOpen] = useState(false);
  const [typeEditing, setTypeEditing] = useState<any>(null);
  const [typeForm, setTypeForm] = useState(emptyTypeForm);
  const [typeDeleteId, setTypeDeleteId] = useState<string | null>(null);

  const { data: locationTypes = [] } = useQuery({
    queryKey: ["location_types", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("location_types").select("*").eq("tenant_id", tenantId!).order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const { data: locations = [], isLoading } = useQuery({
    queryKey: ["locations", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("locations").select("*").eq("tenant_id", tenantId!);
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const { data: warehouses = [] } = useQuery({
    queryKey: ["warehouses_all", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("warehouses").select("id, name").eq("tenant_id", tenantId!);
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: priceLists = [] } = useQuery({
    queryKey: ["retail_price_lists", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("retail_price_lists").select("id, name").eq("tenant_id", tenantId!);
      return data || [];
    },
    enabled: !!tenantId,
  });

  const selectedType = locationTypes.find((lt: any) => lt.id === form.location_type_id);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        name: form.name,
        type: selectedType?.code || form.type,
        address: form.address,
        city: form.city,
        is_active: form.is_active,
        default_warehouse_id: form.default_warehouse_id || null,
        default_price_list_id: form.default_price_list_id || null,
        location_type_id: form.location_type_id || null,
      };
      if (editing) {
        const { error } = await supabase.from("locations").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("locations").insert({ ...payload, tenant_id: tenantId! });
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["locations", tenantId] }); toast({ title: t("success") }); closeDialog(); },
    onError: () => toast({ title: t("error"), variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("locations").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["locations", tenantId] }); toast({ title: t("success") }); setDeleteId(null); },
    onError: () => toast({ title: t("error"), variant: "destructive" }),
  });

  // Location Type mutations
  const saveTypeMutation = useMutation({
    mutationFn: async () => {
      if (typeEditing) {
        const { error } = await supabase.from("location_types").update(typeForm).eq("id", typeEditing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("location_types").insert({ ...typeForm, tenant_id: tenantId! });
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["location_types", tenantId] }); toast({ title: t("success") }); setTypeEditing(null); setTypeForm(emptyTypeForm); },
    onError: () => toast({ title: t("error"), variant: "destructive" }),
  });

  const deleteTypeMutation = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("location_types").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["location_types", tenantId] }); toast({ title: t("success") }); setTypeDeleteId(null); },
    onError: () => toast({ title: t("error"), variant: "destructive" }),
  });

  const openEdit = (loc: any) => {
    setEditing(loc);
    setForm({
      name: loc.name, type: loc.type, address: loc.address || "", city: loc.city || "",
      is_active: loc.is_active, default_warehouse_id: loc.default_warehouse_id || "",
      default_price_list_id: loc.default_price_list_id || "", location_type_id: loc.location_type_id || "",
    });
    setDialogOpen(true);
  };
  const openAdd = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true); };
  const closeDialog = () => { setDialogOpen(false); setEditing(null); };

  const getTypeName = (loc: any) => {
    if (loc.location_type_id) {
      const lt = locationTypes.find((t: any) => t.id === loc.location_type_id);
      return lt?.name || loc.type;
    }
    return loc.type;
  };

  const getWarehouseName = (loc: any) => {
    if (loc.default_warehouse_id) {
      const w = warehouses.find((w: any) => w.id === loc.default_warehouse_id);
      return w?.name || "";
    }
    return "";
  };

  const filtered = locations.filter((l: any) => l.name.toLowerCase().includes(search.toLowerCase()));

  if (tenantLoading || isLoading) return <div className="p-6">{t("loading")}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("locations")}</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setTypesDialogOpen(true)}>
            <Settings2 className="h-4 w-4 mr-2" />{t("manageTypes")}
          </Button>
          <Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" />{t("add")}</Button>
        </div>
      </div>
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder={t("search")} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("name")}</TableHead>
              <TableHead>{t("type")}</TableHead>
              <TableHead>{t("warehouse")}</TableHead>
              <TableHead>{t("address")}</TableHead>
              <TableHead>{t("city")}</TableHead>
              <TableHead>{t("status")}</TableHead>
              <TableHead className="w-24">{t("actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">{t("noResults")}</TableCell></TableRow>
            ) : filtered.map((l: any) => (
              <TableRow key={l.id}>
                <TableCell className="font-medium">{l.name}</TableCell>
                <TableCell><Badge variant="outline">{getTypeName(l)}</Badge></TableCell>
                <TableCell>{getWarehouseName(l) || "—"}</TableCell>
                <TableCell>{l.address}</TableCell>
                <TableCell>{l.city}</TableCell>
                <TableCell><Badge variant={l.is_active ? "default" : "secondary"}>{l.is_active ? t("active") : t("inactive")}</Badge></TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(l)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteId(l.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Add/Edit Location Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? t("edit") : t("add")} {t("location")}</DialogTitle>
            <DialogDescription />
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div><Label>{t("name")}</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><Label>{t("type")}</Label>
              <Select value={form.location_type_id || "none"} onValueChange={v => {
                const lt = locationTypes.find((t: any) => t.id === v);
                setForm(f => ({ ...f, location_type_id: v === "none" ? "" : v, type: lt?.code || f.type }));
              }}>
                <SelectTrigger><SelectValue placeholder={t("type")} /></SelectTrigger>
                <SelectContent>
                  {locationTypes.length === 0 && <SelectItem value="none">—</SelectItem>}
                  {locationTypes.filter((lt: any) => lt.is_active).map((lt: any) => (
                    <SelectItem key={lt.id} value={lt.id}>{lt.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>{t("address")}</Label><Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></div>
            <div><Label>{t("city")}</Label><Input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} /></div>
            {selectedType?.has_warehouse && (
              <>
                <div><Label>{t("warehouse")}</Label>
                  <Select value={form.default_warehouse_id || "none"} onValueChange={v => setForm(f => ({ ...f, default_warehouse_id: v === "none" ? "" : v }))}>
                    <SelectTrigger><SelectValue placeholder={t("selectWarehouse")} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      {warehouses.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>{t("retailPriceList")}</Label>
                  <Select value={form.default_price_list_id || "none"} onValueChange={v => setForm(f => ({ ...f, default_price_list_id: v === "none" ? "" : v }))}>
                    <SelectTrigger><SelectValue placeholder={t("retailPriceList")} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      {priceLists.map((pl: any) => <SelectItem key={pl.id} value={pl.id}>{pl.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
              <Label>{t("active")}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>{t("cancel")}</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!form.name || saveMutation.isPending}>{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Location */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{t("confirm")}</AlertDialogTitle><AlertDialogDescription>{t("deleteConfirmation")}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)}>{t("delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Manage Location Types Dialog */}
      <Dialog open={typesDialogOpen} onOpenChange={setTypesDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("manageTypes")}</DialogTitle>
            <DialogDescription>{t("locationTypesDescription")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Add/Edit type form */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 border rounded-lg bg-muted/30">
              <div><Label>{t("name")}</Label><Input value={typeForm.name} onChange={e => setTypeForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Prodavnica" /></div>
              <div><Label>{t("code")}</Label><Input value={typeForm.code} onChange={e => setTypeForm(f => ({ ...f, code: e.target.value }))} placeholder="e.g. shop" /></div>
              <div className="flex items-center gap-2">
                <Switch checked={typeForm.has_warehouse} onCheckedChange={v => setTypeForm(f => ({ ...f, has_warehouse: v }))} />
                <Label>{t("hasWarehouse")}</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={typeForm.has_sellers} onCheckedChange={v => setTypeForm(f => ({ ...f, has_sellers: v }))} />
                <Label>{t("hasSellers")}</Label>
              </div>
              <div className="col-span-2 flex justify-end gap-2">
                {typeEditing && <Button variant="outline" size="sm" onClick={() => { setTypeEditing(null); setTypeForm(emptyTypeForm); }}>{t("cancel")}</Button>}
                <Button size="sm" onClick={() => saveTypeMutation.mutate()} disabled={!typeForm.name || !typeForm.code || saveTypeMutation.isPending}>
                  {typeEditing ? t("save") : t("add")}
                </Button>
              </div>
            </div>

            {/* Types list */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("name")}</TableHead>
                  <TableHead>{t("code")}</TableHead>
                  <TableHead>{t("hasWarehouse")}</TableHead>
                  <TableHead>{t("hasSellers")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead className="w-20">{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {locationTypes.map((lt: any) => (
                  <TableRow key={lt.id}>
                    <TableCell className="font-medium">{lt.name}</TableCell>
                    <TableCell>{lt.code}</TableCell>
                    <TableCell>{lt.has_warehouse ? "✓" : "—"}</TableCell>
                    <TableCell>{lt.has_sellers ? "✓" : "—"}</TableCell>
                    <TableCell><Badge variant={lt.is_active ? "default" : "secondary"}>{lt.is_active ? t("active") : t("inactive")}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => { setTypeEditing(lt); setTypeForm({ name: lt.name, code: lt.code, has_warehouse: lt.has_warehouse, has_sellers: lt.has_sellers, is_active: lt.is_active }); }}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setTypeDeleteId(lt.id)}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {locationTypes.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">{t("noResults")}</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Type */}
      <AlertDialog open={!!typeDeleteId} onOpenChange={() => setTypeDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{t("confirm")}</AlertDialogTitle><AlertDialogDescription>{t("deleteConfirmation")}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => typeDeleteId && deleteTypeMutation.mutate(typeDeleteId)}>{t("delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
