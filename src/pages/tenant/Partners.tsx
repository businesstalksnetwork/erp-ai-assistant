import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Pencil, Trash2 } from "lucide-react";
import { ExportButton } from "@/components/ExportButton";

interface Partner {
  id: string;
  tenant_id: string;
  name: string;
  pib: string | null;
  maticni_broj: string | null;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  country: string;
  type: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const emptyForm = {
  name: "",
  pib: "",
  maticni_broj: "",
  address: "",
  city: "",
  postal_code: "",
  country: "RS",
  type: "customer",
  is_active: true,
};

export default function Partners() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: partners = [], isLoading } = useQuery({
    queryKey: ["partners", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("partners")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("name");
      if (error) throw error;
      return data as Partner[];
    },
    enabled: !!tenantId,
  });

  const filtered = partners.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.pib && p.pib.includes(searchQuery));
    const matchesType = typeFilter === "all" || p.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        tenant_id: tenantId!,
        name: form.name,
        pib: form.pib || null,
        maticni_broj: form.maticni_broj || null,
        address: form.address || null,
        city: form.city || null,
        postal_code: form.postal_code || null,
        country: form.country,
        type: form.type,
        is_active: form.is_active,
      };
      if (editingPartner) {
        const { error } = await supabase.from("partners").update(payload).eq("id", editingPartner.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("partners").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partners"] });
      toast({ title: t("success") });
      closeDialog();
    },
    onError: (err: any) => toast({ title: t("error"), description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("partners").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partners"] });
      toast({ title: t("success") });
      setDeleteId(null);
    },
    onError: (err: any) => toast({ title: t("error"), description: err.message, variant: "destructive" }),
  });

  const openAdd = () => {
    setEditingPartner(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (p: Partner) => {
    setEditingPartner(p);
    setForm({
      name: p.name,
      pib: p.pib || "",
      maticni_broj: p.maticni_broj || "",
      address: p.address || "",
      city: p.city || "",
      postal_code: p.postal_code || "",
      country: p.country,
      type: p.type,
      is_active: p.is_active,
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingPartner(null);
    setForm(emptyForm);
  };

  const toggleActive = async (p: Partner) => {
    await supabase.from("partners").update({ is_active: !p.is_active }).eq("id", p.id);
    queryClient.invalidateQueries({ queryKey: ["partners"] });
  };

  const typeLabel = (type: string) => {
    const map: Record<string, string> = { customer: t("customer"), supplier: t("supplier"), both: t("both") };
    return map[type] || type;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t("partners")}</h1>
        <div className="flex gap-2">
          <ExportButton
            data={filtered}
            columns={[
              { key: "name", label: t("name") },
              { key: "pib", label: t("pib") },
              { key: "maticni_broj", label: t("maticniBroj") },
              { key: "address", label: t("address") },
              { key: "city", label: t("city") },
              { key: "country", label: t("country") },
              { key: "type", label: t("type") },
            ]}
            filename="partners"
          />
          <Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" /> {t("add")}</Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder={t("search")} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allTypes")}</SelectItem>
                <SelectItem value="customer">{t("customer")}</SelectItem>
                <SelectItem value="supplier">{t("supplier")}</SelectItem>
                <SelectItem value="both">{t("both")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("name")}</TableHead>
                <TableHead>{t("pib")}</TableHead>
                <TableHead>{t("city")}</TableHead>
                <TableHead>{t("type")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead className="text-right">{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center">{t("loading")}</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">{t("noResults")}</TableCell></TableRow>
              ) : (
                filtered.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>{p.pib || "—"}</TableCell>
                    <TableCell>{p.city || "—"}</TableCell>
                    <TableCell><Badge variant="outline">{typeLabel(p.type)}</Badge></TableCell>
                    <TableCell>
                      <Badge
                        variant={p.is_active ? "default" : "secondary"}
                        className="cursor-pointer"
                        onClick={() => toggleActive(p)}
                      >
                        {p.is_active ? t("active") : t("inactive")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => setDeleteId(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) closeDialog(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingPartner ? t("editPartner") : t("addPartner")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div>
              <Label>{t("name")} *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{t("pib")}</Label><Input value={form.pib} onChange={(e) => setForm({ ...form, pib: e.target.value })} /></div>
              <div><Label>{t("maticniBroj")}</Label><Input value={form.maticni_broj} onChange={(e) => setForm({ ...form, maticni_broj: e.target.value })} /></div>
            </div>
            <div><Label>{t("address")}</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>{t("city")}</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
              <div><Label>{t("postalCode")}</Label><Input value={form.postal_code} onChange={(e) => setForm({ ...form, postal_code: e.target.value })} /></div>
              <div><Label>{t("country")}</Label><Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} /></div>
            </div>
            <div>
              <Label>{t("type")}</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="customer">{t("customer")}</SelectItem>
                  <SelectItem value="supplier">{t("supplier")}</SelectItem>
                  <SelectItem value="both">{t("both")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>{t("cancel")}</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!form.name || saveMutation.isPending}>{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirm")}</AlertDialogTitle>
            <AlertDialogDescription>{t("deleteConfirmation")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)}>{t("delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
