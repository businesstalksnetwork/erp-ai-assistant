import { useState } from "react";
import { ActionGuard } from "@/components/ActionGuard";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatsBar } from "@/components/shared/StatsBar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RotateCcw, Plus, Package, CheckCircle, Trash2, AlertTriangle } from "lucide-react";

export default function WmsReturns() {
  const { t, locale } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    warehouse_id: "", partner_id: "", return_type: "customer",
    reason: "", lines: [{ product_id: "", quantity: 1, condition: "good", disposition: "restock" }] as any[],
  });

  const { data: returns = [] } = useQuery({
    queryKey: ["wms-returns", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("wms_returns")
        .select("*, warehouses(name), partners(name)")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const { data: warehouses = [] } = useQuery({
    queryKey: ["wms-ret-warehouses", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("warehouses").select("id, name").eq("tenant_id", tenantId!).eq("is_active", true);
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: partners = [] } = useQuery({
    queryKey: ["wms-ret-partners", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("partners").select("id, name").eq("tenant_id", tenantId!).eq("is_active", true).limit(200);
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: products = [] } = useQuery({
    queryKey: ["wms-ret-products", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("id, name").eq("tenant_id", tenantId!).eq("is_active", true).limit(200);
      return data || [];
    },
    enabled: !!tenantId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const count = returns.length + 1;
      const totalQty = form.lines.reduce((s: number, l: any) => s + l.quantity, 0);
      const { data: ret, error } = await supabase.from("wms_returns").insert({
        tenant_id: tenantId!,
        return_number: `RET-${String(count).padStart(5, "0")}`,
        warehouse_id: form.warehouse_id || null,
        partner_id: form.partner_id || null,
        return_type: form.return_type,
        reason: form.reason || null,
        total_quantity: totalQty,
        received_by: user?.id,
        received_at: new Date().toISOString(),
      }).select("id").single();
      if (error) throw error;
      if (form.lines.length > 0) {
        await supabase.from("wms_return_lines").insert(
          form.lines.filter(l => l.product_id).map((l, i) => ({
            return_id: ret.id, tenant_id: tenantId!, product_id: l.product_id, quantity: l.quantity,
            condition: l.condition, disposition: l.disposition, sort_order: i,
          }))
        );
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wms-returns"] });
      toast({ title: t("success") });
      setCreateOpen(false);
      setForm({ warehouse_id: "", partner_id: "", return_type: "customer", reason: "", lines: [{ product_id: "", quantity: 1, condition: "good", disposition: "restock" }] });
    },
    onError: () => toast({ title: t("error"), variant: "destructive" }),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("wms_returns").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wms-returns"] });
      toast({ title: t("success") });
    },
  });

  const pending = returns.filter((r: any) => r.status === "pending").length;
  const inspecting = returns.filter((r: any) => r.status === "inspecting").length;
  const completed = returns.filter((r: any) => r.status === "completed").length;
  const totalQty = returns.reduce((s: number, r: any) => s + (r.total_quantity || 0), 0);

  const stats = [
    { label: locale === "sr" ? "Na čekanju" : "Pending", value: pending, icon: RotateCcw, color: "text-primary" },
    { label: locale === "sr" ? "Inspekcija" : "Inspecting", value: inspecting, icon: AlertTriangle, color: "text-amber-500" },
    { label: locale === "sr" ? "Završeno" : "Completed", value: completed, icon: CheckCircle, color: "text-green-500" },
    { label: locale === "sr" ? "Ukupno artikala" : "Total Items", value: totalQty, icon: Package, color: "text-primary" },
  ];

  const statusBadge = (s: string) => {
    const v: Record<string, "default" | "secondary" | "destructive" | "outline"> = { pending: "outline", inspecting: "secondary", restocked: "default", scrapped: "destructive", completed: "default" };
    return <Badge variant={v[s] || "outline"}>{s}</Badge>;
  };

  const addLine = () => setForm({ ...form, lines: [...form.lines, { product_id: "", quantity: 1, condition: "good", disposition: "restock" }] });
  const removeLine = (i: number) => setForm({ ...form, lines: form.lines.filter((_, idx) => idx !== i) });
  const updateLine = (i: number, field: string, val: any) => setForm({ ...form, lines: form.lines.map((l, idx) => idx === i ? { ...l, [field]: val } : l) });

  return (
    <div className="space-y-6">
      <PageHeader
        title={locale === "sr" ? "Povraćaji robe" : "Returns Processing"}
        description={locale === "sr" ? "Upravljanje povraćajima, inspekcijom i dispozicijom" : "Manage returns, inspection and disposition"}
        icon={RotateCcw}
        actions={<ActionGuard module="inventory" action="create"><Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-1" />{locale === "sr" ? "Novi povraćaj" : "New Return"}</Button></ActionGuard>}
      />

      <StatsBar stats={stats} />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>{t("type")}</TableHead>
                <TableHead>{locale === "sr" ? "Partner" : "Partner"}</TableHead>
                <TableHead>{t("warehouse")}</TableHead>
                <TableHead>{t("quantity")}</TableHead>
                <TableHead>{locale === "sr" ? "Razlog" : "Reason"}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead>{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {returns.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">{t("noResults")}</TableCell></TableRow>
              ) : returns.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.return_number}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px]">{r.return_type}</Badge></TableCell>
                  <TableCell>{r.partners?.name || "—"}</TableCell>
                  <TableCell>{r.warehouses?.name || "—"}</TableCell>
                  <TableCell>{r.total_quantity}</TableCell>
                  <TableCell className="max-w-[200px] truncate text-xs">{r.reason || "—"}</TableCell>
                  <TableCell>{statusBadge(r.status)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {r.status === "pending" && <Button size="sm" variant="outline" onClick={() => updateStatusMutation.mutate({ id: r.id, status: "inspecting" })}>{locale === "sr" ? "Inspekcija" : "Inspect"}</Button>}
                      {r.status === "inspecting" && <Button size="sm" onClick={() => updateStatusMutation.mutate({ id: r.id, status: "completed" })}><CheckCircle className="h-3 w-3 mr-1" />{locale === "sr" ? "Završi" : "Complete"}</Button>}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{locale === "sr" ? "Novi povraćaj" : "New Return"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label>{t("warehouse")}</Label>
                <Select value={form.warehouse_id} onValueChange={v => setForm({ ...form, warehouse_id: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{warehouses.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Partner</Label>
                <Select value={form.partner_id} onValueChange={v => setForm({ ...form, partner_id: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{partners.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("type")}</Label>
                <Select value={form.return_type} onValueChange={v => setForm({ ...form, return_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="customer">{locale === "sr" ? "Kupac" : "Customer"}</SelectItem>
                    <SelectItem value="supplier">{locale === "sr" ? "Dobavljač" : "Supplier"}</SelectItem>
                    <SelectItem value="internal">{locale === "sr" ? "Interni" : "Internal"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>{locale === "sr" ? "Razlog" : "Reason"}</Label><Textarea value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} /></div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label>{locale === "sr" ? "Stavke" : "Lines"}</Label>
                <Button size="sm" variant="outline" onClick={addLine}><Plus className="h-3 w-3 mr-1" />{t("addLine")}</Button>
              </div>
              {form.lines.map((line, i) => (
                <div key={i} className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Select value={line.product_id} onValueChange={v => updateLine(i, "product_id", v)}>
                      <SelectTrigger className="h-9"><SelectValue placeholder={t("product")} /></SelectTrigger>
                      <SelectContent>{products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="w-20"><Input className="h-9" type="number" min={1} value={line.quantity} onChange={e => updateLine(i, "quantity", Number(e.target.value))} /></div>
                  <div className="w-24">
                    <Select value={line.condition} onValueChange={v => updateLine(i, "condition", v)}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="good">Good</SelectItem>
                        <SelectItem value="damaged">Damaged</SelectItem>
                        <SelectItem value="defective">Defective</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-24">
                    <Select value={line.disposition} onValueChange={v => updateLine(i, "disposition", v)}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="restock">Restock</SelectItem>
                        <SelectItem value="scrap">Scrap</SelectItem>
                        <SelectItem value="repair">Repair</SelectItem>
                        <SelectItem value="quarantine">Quarantine</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => removeLine(i)}><Trash2 className="h-3 w-3" /></Button>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
