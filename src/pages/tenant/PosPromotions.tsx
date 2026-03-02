import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, Percent, Gift, Package, Tag, Ticket, Trash2, Pencil } from "lucide-react";

const PROMO_TYPES = [
  { value: "percentage", label: "Procenat popusta", icon: Percent },
  { value: "fixed_amount", label: "Fiksni iznos", icon: Tag },
  { value: "bogo", label: "BOGO (Kupi X dobij Y)", icon: Gift },
  { value: "bundle", label: "Paket cena", icon: Package },
  { value: "coupon", label: "Kupon kod", icon: Ticket },
];

export default function PosPromotions() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "", description: "", promotion_type: "percentage", discount_value: "",
    buy_quantity: "1", get_quantity: "1", applies_to: "all",
    coupon_code: "", max_uses: "", min_cart_value: "0", priority: "0",
    start_date: new Date().toISOString().slice(0, 10), end_date: "", is_active: true,
    required_tier: "",
  });

  const { data: promotions = [] } = useQuery({
    queryKey: ["promotions", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase.from("promotions").select("*").eq("tenant_id", tenantId).order("priority", { ascending: false });
      return data || [];
    },
    enabled: !!tenantId,
  });

  const resetForm = () => {
    setForm({ name: "", description: "", promotion_type: "percentage", discount_value: "",
      buy_quantity: "1", get_quantity: "1", applies_to: "all",
      coupon_code: "", max_uses: "", min_cart_value: "0", priority: "0",
      start_date: new Date().toISOString().slice(0, 10), end_date: "", is_active: true,
      required_tier: "" });
    setEditId(null);
  };

  const openEdit = (p: any) => {
    setEditId(p.id);
    setForm({
      name: p.name, description: p.description || "", promotion_type: p.promotion_type,
      discount_value: String(p.discount_value), buy_quantity: String(p.buy_quantity || 1),
      get_quantity: String(p.get_quantity || 1), applies_to: p.applies_to,
      coupon_code: p.coupon_code || "", max_uses: p.max_uses ? String(p.max_uses) : "",
      min_cart_value: String(p.min_cart_value || 0), priority: String(p.priority || 0),
      start_date: p.start_date?.slice(0, 10) || "", end_date: p.end_date?.slice(0, 10) || "",
      is_active: p.is_active, required_tier: p.required_tier || "",
    });
    setDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId) return;
      const payload = {
        tenant_id: tenantId,
        name: form.name,
        description: form.description || null,
        promotion_type: form.promotion_type,
        discount_value: parseFloat(form.discount_value) || 0,
        buy_quantity: parseInt(form.buy_quantity) || 1,
        get_quantity: parseInt(form.get_quantity) || 0,
        applies_to: form.applies_to,
        coupon_code: form.coupon_code || null,
        max_uses: form.max_uses ? parseInt(form.max_uses) : null,
        min_cart_value: parseFloat(form.min_cart_value) || 0,
        priority: parseInt(form.priority) || 0,
        start_date: form.start_date || new Date().toISOString(),
        end_date: form.end_date || null,
        is_active: form.is_active,
        required_tier: form.required_tier || null,
      };
      if (editId) {
        const { error } = await supabase.from("promotions").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("promotions").insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["promotions"] }); setDialogOpen(false); resetForm(); toast({ title: t("success") }); },
    onError: (e: any) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("promotions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["promotions"] }); toast({ title: t("success") }); },
  });

  const activeCount = promotions.filter((p: any) => p.is_active).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Promocije i kuponi</h1>
          <p className="text-sm text-muted-foreground">Upravljanje promocijama, BOGO ponudama, paketima i kupon kodovima.</p>
        </div>
        <Button onClick={() => { resetForm(); setDialogOpen(true); }}><Plus className="h-4 w-4 mr-1" />Nova promocija</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Ukupno</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{promotions.length}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Aktivne</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-primary">{activeCount}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Kuponi</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{promotions.filter((p: any) => p.promotion_type === "coupon").length}</p></CardContent></Card>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Naziv</TableHead>
            <TableHead>Tip</TableHead>
            <TableHead>Vrednost</TableHead>
            <TableHead>Važi od</TableHead>
            <TableHead>Važi do</TableHead>
            <TableHead>{t("status")}</TableHead>
            <TableHead>{t("actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {promotions.map((p: any) => {
            const typeInfo = PROMO_TYPES.find(t => t.value === p.promotion_type);
            return (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell><Badge variant="outline">{typeInfo?.label || p.promotion_type}</Badge></TableCell>
                <TableCell>
                  {p.promotion_type === "percentage" ? `${p.discount_value}%` :
                   p.promotion_type === "fixed_amount" ? `${p.discount_value} RSD` :
                   p.promotion_type === "bogo" ? `Kupi ${p.buy_quantity} dobij ${p.get_quantity}` :
                   p.promotion_type === "bundle" ? `Paket: ${p.bundle_price || p.discount_value} RSD` :
                   p.coupon_code || "—"}
                </TableCell>
                <TableCell className="text-sm">{p.start_date ? new Date(p.start_date).toLocaleDateString() : "—"}</TableCell>
                <TableCell className="text-sm">{p.end_date ? new Date(p.end_date).toLocaleDateString() : "∞"}</TableCell>
                <TableCell><Badge variant={p.is_active ? "default" : "secondary"}>{p.is_active ? "Aktivna" : "Neaktivna"}</Badge></TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(p)}><Pencil className="h-3 w-3" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => deleteMutation.mutate(p.id)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
          {promotions.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">{t("noResults")}</TableCell></TableRow>}
        </TableBody>
      </Table>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? "Izmeni promociju" : "Nova promocija"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Naziv</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><Label>Opis</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} /></div>
            <div>
              <Label>Tip promocije</Label>
              <Select value={form.promotion_type} onValueChange={v => setForm(f => ({ ...f, promotion_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PROMO_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {(form.promotion_type === "percentage" || form.promotion_type === "fixed_amount") && (
              <div><Label>{form.promotion_type === "percentage" ? "Popust (%)" : "Iznos popusta (RSD)"}</Label><Input type="number" value={form.discount_value} onChange={e => setForm(f => ({ ...f, discount_value: e.target.value }))} /></div>
            )}
            {form.promotion_type === "bogo" && (
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Kupi količinu</Label><Input type="number" value={form.buy_quantity} onChange={e => setForm(f => ({ ...f, buy_quantity: e.target.value }))} /></div>
                <div><Label>Dobij besplatno</Label><Input type="number" value={form.get_quantity} onChange={e => setForm(f => ({ ...f, get_quantity: e.target.value }))} /></div>
              </div>
            )}
            {form.promotion_type === "coupon" && (
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Kupon kod</Label><Input value={form.coupon_code} onChange={e => setForm(f => ({ ...f, coupon_code: e.target.value.toUpperCase() }))} /></div>
                <div><Label>Max korišćenja</Label><Input type="number" value={form.max_uses} onChange={e => setForm(f => ({ ...f, max_uses: e.target.value }))} /></div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Važi od</Label><Input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} /></div>
              <div><Label>Važi do</Label><Input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Min. vrednost korpe (RSD)</Label><Input type="number" value={form.min_cart_value} onChange={e => setForm(f => ({ ...f, min_cart_value: e.target.value }))} /></div>
              <div><Label>Prioritet</Label><Input type="number" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} /></div>
            </div>
            <div><Label>Potreban lojalti nivo</Label>
              <Select value={form.required_tier || "none"} onValueChange={v => setForm(f => ({ ...f, required_tier: v === "none" ? "" : v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Svi</SelectItem>
                  <SelectItem value="Bronze">Bronze</SelectItem>
                  <SelectItem value="Silver">Silver</SelectItem>
                  <SelectItem value="Gold">Gold</SelectItem>
                  <SelectItem value="Platinum">Platinum</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
              <Label>Aktivna</Label>
            </div>
          </div>
          <DialogFooter><Button onClick={() => saveMutation.mutate()} disabled={!form.name || saveMutation.isPending}>{editId ? "Sačuvaj" : "Kreiraj"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
