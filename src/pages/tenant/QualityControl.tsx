import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatsBar } from "@/components/shared/StatsBar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ShieldCheck, Plus, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { ResponsiveTable, type ResponsiveColumn } from "@/components/shared/ResponsiveTable";

const CHECK_TYPES = ["incoming", "in_process", "final", "random"] as const;

export default function QualityControl() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    production_order_id: "", product_id: "", check_type: "in_process" as string,
    quantity_inspected: 0, quantity_passed: 0, quantity_failed: 0, notes: "",
  });

  const { data: checks = [] } = useQuery({
    queryKey: ["quality-checks", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quality_checks")
        .select("*, products(name), production_orders(order_number)")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const { data: productionOrders = [] } = useQuery({
    queryKey: ["qc-production-orders", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("production_orders").select("id, order_number, product_id, products(name)")
        .eq("tenant_id", tenantId!).in("status", ["in_progress", "planned"]);
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: products = [] } = useQuery({
    queryKey: ["qc-products", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("id, name").eq("tenant_id", tenantId!).eq("is_active", true).limit(200);
      return data || [];
    },
    enabled: !!tenantId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const count = checks.length + 1;
      const status = form.quantity_failed > 0 ? "failed" : form.quantity_inspected > 0 ? "passed" : "pending";
      const { error } = await supabase.from("quality_checks").insert({
        tenant_id: tenantId!,
        check_number: `QC-${String(count).padStart(5, "0")}`,
        production_order_id: form.production_order_id || null,
        product_id: form.product_id || null,
        check_type: form.check_type,
        status,
        inspector_id: user?.id,
        checked_at: form.quantity_inspected > 0 ? new Date().toISOString() : null,
        quantity_inspected: form.quantity_inspected,
        quantity_passed: form.quantity_passed,
        quantity_failed: form.quantity_failed,
        notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quality-checks"] });
      toast({ title: t("success") });
      setCreateOpen(false);
      setForm({ production_order_id: "", product_id: "", check_type: "in_process", quantity_inspected: 0, quantity_passed: 0, quantity_failed: 0, notes: "" });
    },
    onError: () => toast({ title: t("error"), variant: "destructive" }),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("quality_checks").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quality-checks"] });
      toast({ title: t("success") });
    },
  });

  const passed = checks.filter((c: any) => c.status === "passed").length;
  const failed = checks.filter((c: any) => c.status === "failed").length;
  const totalInspected = checks.reduce((s: number, c: any) => s + (c.quantity_inspected || 0), 0);
  const totalFailed = checks.reduce((s: number, c: any) => s + (c.quantity_failed || 0), 0);
  const overallDefectRate = totalInspected > 0 ? ((totalFailed / totalInspected) * 100).toFixed(1) : "0";

  const stats = [
    { label: t("totalChecks"), value: checks.length, icon: ShieldCheck, color: "text-primary" },
    { label: t("passedLabel"), value: passed, icon: CheckCircle, color: "text-green-500" },
    { label: t("failedLabel"), value: failed, icon: XCircle, color: "text-destructive" },
    { label: t("defectRate"), value: `${overallDefectRate}%`, icon: AlertTriangle, color: "text-amber-500" },
  ];

  const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = { passed: "default", failed: "destructive", pending: "outline", on_hold: "secondary" };

  const columns: ResponsiveColumn<any>[] = [
    { key: "number", label: "#", primary: true, sortable: true, sortValue: (c) => c.check_number, render: (c) => <span className="font-mono text-xs">{c.check_number}</span> },
    { key: "type", label: t("type"), sortable: true, sortValue: (c) => c.check_type, render: (c) => <Badge variant="outline" className="text-[10px]">{c.check_type}</Badge> },
    { key: "product", label: t("product"), sortable: true, sortValue: (c) => c.products?.name || "", render: (c) => c.products?.name || "—" },
    { key: "order", label: t("orderLabel"), hideOnMobile: true, render: (c) => <span className="text-xs">{c.production_orders?.order_number || "—"}</span> },
    { key: "inspected", label: t("inspectedLabel"), align: "right" as const, sortable: true, sortValue: (c) => c.quantity_inspected || 0, render: (c) => c.quantity_inspected },
    { key: "passed", label: t("passedLabel"), align: "right" as const, hideOnMobile: true, render: (c) => <span className="text-green-600">{c.quantity_passed}</span> },
    { key: "failed", label: t("failedLabel"), align: "right" as const, hideOnMobile: true, render: (c) => <span className="text-destructive">{c.quantity_failed}</span> },
    { key: "rate", label: t("ratePercent"), hideOnMobile: true, render: (c) => `${c.defect_rate || 0}%` },
    { key: "status", label: t("status"), sortable: true, sortValue: (c) => c.status, render: (c) => <Badge variant={statusVariant[c.status] || "outline"}>{c.status}</Badge> },
    { key: "actions", label: t("actions"), render: (c) => (
      <div className="flex gap-1">
        {c.status === "pending" && (
          <>
            <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); updateStatusMutation.mutate({ id: c.id, status: "passed" }); }}>
              <CheckCircle className="h-3 w-3" />
            </Button>
            <Button size="sm" variant="destructive" onClick={(e) => { e.stopPropagation(); updateStatusMutation.mutate({ id: c.id, status: "failed" }); }}>
              <XCircle className="h-3 w-3" />
            </Button>
          </>
        )}
      </div>
    )},
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("qualityControl")}
        description={t("qualityControlDesc")}
        icon={ShieldCheck}
        actions={<Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-1" />{t("newCheck")}</Button>}
      />

      <StatsBar stats={stats} />

      <ResponsiveTable
        data={checks}
        columns={columns}
        keyExtractor={(c) => c.id}
        emptyMessage={t("noResults")}
        enableExport
        exportFilename="quality-checks"
        enableColumnToggle
      />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="w-[95vw] sm:max-w-lg">
          <DialogHeader><DialogTitle>{t("newQualityCheck")}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>{t("productionOrderLabel")}</Label>
              <Select value={form.production_order_id} onValueChange={v => {
                const po = productionOrders.find((o: any) => o.id === v);
                setForm({ ...form, production_order_id: v, product_id: po?.product_id || form.product_id });
              }}>
                <SelectTrigger><SelectValue placeholder={t("selectOrderPlaceholder")} /></SelectTrigger>
                <SelectContent>{productionOrders.map((o: any) => <SelectItem key={o.id} value={o.id}>{o.order_number} — {o.products?.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("product")}</Label>
              <Select value={form.product_id} onValueChange={v => setForm({ ...form, product_id: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("type")}</Label>
              <Select value={form.check_type} onValueChange={v => setForm({ ...form, check_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CHECK_TYPES.map(ct => <SelectItem key={ct} value={ct}>{ct}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>{t("inspectedLabel")}</Label><Input type="number" min={0} value={form.quantity_inspected} onChange={e => setForm({ ...form, quantity_inspected: Number(e.target.value) })} /></div>
              <div><Label>{t("passedLabel")}</Label><Input type="number" min={0} value={form.quantity_passed} onChange={e => setForm({ ...form, quantity_passed: Number(e.target.value) })} /></div>
              <div><Label>{t("failedLabel")}</Label><Input type="number" min={0} value={form.quantity_failed} onChange={e => setForm({ ...form, quantity_failed: Number(e.target.value) })} /></div>
            </div>
            <div><Label>{t("notes")}</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
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
