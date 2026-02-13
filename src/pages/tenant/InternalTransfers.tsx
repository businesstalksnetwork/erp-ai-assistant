import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Search, Trash2, Truck, PackageCheck, FileText } from "lucide-react";

const statusVariant: Record<string, string> = {
  draft: "secondary", confirmed: "default", in_transit: "default", delivered: "default", cancelled: "destructive",
};

export default function InternalTransfers() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ from_warehouse_id: "", to_warehouse_id: "", notes: "" });
  const [items, setItems] = useState<{ product_id: string; quantity_sent: number }[]>([]);

  const { data: transfers = [] } = useQuery({
    queryKey: ["internal_transfers", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("internal_transfers")
        .select("*, from_wh:from_warehouse_id(name), to_wh:to_warehouse_id(name)")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const { data: warehouses = [] } = useQuery({
    queryKey: ["warehouses_active", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("warehouses").select("id, name").eq("tenant_id", tenantId!).eq("is_active", true);
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products_list", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("id, name, sku").eq("tenant_id", tenantId!).eq("is_active", true);
      return data || [];
    },
    enabled: !!tenantId,
  });

  const getNextNumber = () => {
    const nums = transfers.map((t: any) => parseInt(t.transfer_number?.replace(/\D/g, "") || "0"));
    const max = nums.length > 0 ? Math.max(...nums) : 0;
    return `IT-${String(max + 1).padStart(4, "0")}`;
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data: transfer, error } = await supabase.from("internal_transfers").insert({
        tenant_id: tenantId!, transfer_number: getNextNumber(),
        from_warehouse_id: form.from_warehouse_id, to_warehouse_id: form.to_warehouse_id,
        status: "draft", notes: form.notes, created_by: user?.id,
      }).select().single();
      if (error) throw error;
      if (items.length > 0) {
        const { error: itemsErr } = await supabase.from("internal_transfer_items").insert(
          items.filter(i => i.product_id && i.quantity_sent > 0).map(i => ({
            transfer_id: transfer.id, product_id: i.product_id, quantity_sent: i.quantity_sent,
          }))
        );
        if (itemsErr) throw itemsErr;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["internal_transfers"] }); toast({ title: t("success") }); setDialogOpen(false); setItems([]); },
    onError: (e: any) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const confirmMutation = useMutation({
    mutationFn: async (transferId: string) => {
      const { error } = await supabase.rpc("confirm_internal_transfer", { p_transfer_id: transferId });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["internal_transfers"] }); toast({ title: t("transferConfirmed") }); },
    onError: (e: any) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const printOtpremnica = async (transfer: any) => {
    // Fetch transfer items for display
    const { data: tItems } = await supabase
      .from("internal_transfer_items")
      .select("*, products(name, sku, unit_of_measure)")
      .eq("transfer_id", transfer.id);

    const fromWh = warehouses.find((w: any) => w.id === transfer.from_warehouse_id);
    const toWh = warehouses.find((w: any) => w.id === transfer.to_warehouse_id);

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
      body{font-family:Arial,sans-serif;font-size:12px;margin:40px}
      h1{font-size:20px;text-align:center}
      .info{display:flex;justify-content:space-between;margin:20px 0}
      .info div{width:45%}
      table{width:100%;border-collapse:collapse;margin:20px 0}
      th,td{border:1px solid #333;padding:8px;text-align:left}
      th{background:#f0f0f0}
      td.right{text-align:right}
      .signatures{display:flex;justify-content:space-between;margin-top:60px}
      .sig-line{width:200px;border-top:1px solid #333;text-align:center;padding-top:4px}
    </style></head><body>
    <h1>INTERNA OTPREMNICA</h1>
    <p style="text-align:center">Broj: ${transfer.transfer_number} | Datum: ${new Date(transfer.created_at).toLocaleDateString("sr-RS")}</p>
    <div class="info">
      <div><strong>Od (magacin):</strong><br>${fromWh?.name || "—"}</div>
      <div><strong>Za (lokacija):</strong><br>${toWh?.name || "—"}</div>
    </div>
    <table>
      <thead><tr><th>#</th><th>Proizvod</th><th>Šifra</th><th>JM</th><th class="right">Količina</th></tr></thead>
      <tbody>${(tItems || []).map((item: any, i: number) => `
        <tr><td>${i+1}</td><td>${(item.products as any)?.name || ""}</td><td>${(item.products as any)?.sku || ""}</td><td>${(item.products as any)?.unit_of_measure || "kom"}</td><td class="right">${item.quantity_sent}</td></tr>
      `).join("")}</tbody>
    </table>
    ${transfer.notes ? `<p><strong>Napomena:</strong> ${transfer.notes}</p>` : ""}
    <div class="signatures">
      <div><div class="sig-line">Predao</div></div>
      <div><div class="sig-line">Prevezao</div></div>
      <div><div class="sig-line">Primio</div></div>
    </div>
    </body></html>`;

    const win = window.open("", "_blank");
    if (win) { win.document.write(html); win.document.close(); win.print(); }
  };

  const addItem = () => setItems(prev => [...prev, { product_id: "", quantity_sent: 1 }]);
  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));

  const filtered = transfers.filter((t: any) =>
    t.transfer_number?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t("internalTransfers")}</h1>
        <Button onClick={() => { setDialogOpen(true); setItems([{ product_id: "", quantity_sent: 1 }]); setForm({ from_warehouse_id: "", to_warehouse_id: "", notes: "" }); }}>
          <Plus className="h-4 w-4 mr-2" />{t("add")}
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder={t("search")} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("transferNumber")}</TableHead>
                <TableHead>{t("fromWarehouse")}</TableHead>
                <TableHead>{t("toWarehouse")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead>{t("createdAt")}</TableHead>
                <TableHead>{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((tr: any) => (
                <TableRow key={tr.id}>
                  <TableCell className="font-medium">{tr.transfer_number}</TableCell>
                  <TableCell>{(tr.from_wh as any)?.name || "—"}</TableCell>
                  <TableCell>{(tr.to_wh as any)?.name || "—"}</TableCell>
                  <TableCell><Badge variant={(statusVariant[tr.status] || "secondary") as any}>{t(tr.status as any) || tr.status}</Badge></TableCell>
                  <TableCell>{new Date(tr.created_at).toLocaleDateString("sr-RS")}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {tr.status === "draft" && (
                        <Button variant="outline" size="sm" onClick={() => confirmMutation.mutate(tr.id)} disabled={confirmMutation.isPending}>
                          <Truck className="h-3 w-3 mr-1" />{t("confirmAndShip")}
                        </Button>
                      )}
                      {(tr.status === "confirmed" || tr.status === "in_transit" || tr.status === "delivered") && (
                        <Button variant="outline" size="sm" onClick={() => printOtpremnica(tr)}>
                          <FileText className="h-3 w-3 mr-1" />{t("printOtpremnica")}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">{t("noResults")}</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Transfer Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("internalTransfer")}</DialogTitle>
            <DialogDescription />
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>{t("fromWarehouse")}</Label>
                <Select value={form.from_warehouse_id} onValueChange={v => setForm(f => ({ ...f, from_warehouse_id: v }))}>
                  <SelectTrigger><SelectValue placeholder={t("warehouse")} /></SelectTrigger>
                  <SelectContent>{warehouses.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>{t("toWarehouse")}</Label>
                <Select value={form.to_warehouse_id} onValueChange={v => setForm(f => ({ ...f, to_warehouse_id: v }))}>
                  <SelectTrigger><SelectValue placeholder={t("warehouse")} /></SelectTrigger>
                  <SelectContent>{warehouses.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>{t("notes")}</Label><Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{t("lineItems")}</Label>
                <Button variant="outline" size="sm" onClick={addItem}><Plus className="h-3 w-3 mr-1" />{t("addLine")}</Button>
              </div>
              {items.map((item, idx) => (
                <div key={idx} className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Select value={item.product_id} onValueChange={v => setItems(prev => prev.map((it, i) => i === idx ? { ...it, product_id: v } : it))}>
                      <SelectTrigger><SelectValue placeholder={t("selectProduct")} /></SelectTrigger>
                      <SelectContent>{products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name} {p.sku ? `(${p.sku})` : ""}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="w-24">
                    <Input type="number" min={1} value={item.quantity_sent} onChange={e => setItems(prev => prev.map((it, i) => i === idx ? { ...it, quantity_sent: Number(e.target.value) } : it))} />
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => removeItem(idx)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!form.from_warehouse_id || !form.to_warehouse_id || createMutation.isPending}>{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
