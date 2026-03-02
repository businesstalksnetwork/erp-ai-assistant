import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Brain, Package, TrendingUp, AlertTriangle, ShoppingCart, RefreshCw, CheckCircle } from "lucide-react";
import { fmtNum } from "@/lib/utils";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

export default function SupplierOrderPredictions() {
  const { locale } = useLanguage();
  const { tenantId } = useTenant();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const sr = locale === "sr";
  const t = (en: string, srText: string) => sr ? srText : en;
  const [selectedSupplier, setSelectedSupplier] = useState("all");
  const [selectedPredictions, setSelectedPredictions] = useState<Set<string>>(new Set());

  const { data: suppliers } = useQuery({
    queryKey: ["suppliers-predictions", tenantId],
    enabled: !!tenantId,
    queryFn: async (): Promise<any[]> => {
      const { data } = await (supabase as any)
        .from("partners")
        .select("id, name")
        .eq("tenant_id", tenantId!)
        .eq("is_supplier", true)
        .order("name");
      return data || [];
    },
  });

  const { data: predictions, isLoading } = useQuery({
    queryKey: ["order-predictions", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("supplier_order_predictions")
        .select("*, products(name, sku), partners:supplier_id(name)")
        .eq("tenant_id", tenantId!)
        .order("order_by_date");
      return data || [];
    },
  });

  const runPrediction = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("ai-ordering-prediction", {
        body: {
          tenant_id: tenantId,
          supplier_id: selectedSupplier !== "all" ? selectedSupplier : undefined,
          horizon_days: 30,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["order-predictions"] });
      toast.success(t(
        `Generated ${data.predictions?.length || 0} predictions`,
        `Generisano ${data.predictions?.length || 0} predikcija`
      ));
    },
    onError: () => toast.error(t("Prediction failed", "Predikcija neuspešna")),
  });

  const generatePO = useMutation({
    mutationFn: async () => {
      const selected = (predictions || []).filter((p: any) => selectedPredictions.has(p.id));
      if (selected.length === 0) throw new Error("No predictions selected");

      // Group by supplier
      const bySupplier = new Map<string, any[]>();
      for (const pred of selected) {
        const sid = pred.supplier_id;
        if (!bySupplier.has(sid)) bySupplier.set(sid, []);
        bySupplier.get(sid)!.push(pred);
      }

      let lastPoId = "";
      for (const [supplierId, preds] of bySupplier) {
        const supplierName = preds[0]?.partners?.name || "Unknown";
        const total = preds.reduce((a: number, p: any) => a + (p.estimated_value || 0), 0);

        // Create PO
        const { data: po, error: poErr } = await supabase
          .from("purchase_orders")
          .insert({
            tenant_id: tenantId!,
            supplier_id: supplierId,
            supplier_name: supplierName,
            order_number: `AUTO-${Date.now()}`,
            status: "draft",
            subtotal: total,
            total,
          })
          .select("id")
          .single();

        if (poErr) throw poErr;
        lastPoId = po.id;

        // Create PO lines
        const lines = preds.map((p: any) => ({
          tenant_id: tenantId!,
          purchase_order_id: po.id,
          product_id: p.product_id,
          product_name: p.products?.name || "Product",
          quantity: p.recommended_qty,
          unit_price: p.estimated_value / (p.recommended_qty || 1),
          total_price: p.estimated_value,
        }));

        await supabase.from("purchase_order_lines").insert(lines);

        // Update predictions
        for (const p of preds) {
          await (supabase as any)
            .from("supplier_order_predictions")
            .update({ status: "converted_to_po", purchase_order_id: po.id })
            .eq("id", p.id);
        }
      }

      return lastPoId;
    },
    onSuccess: (poId) => {
      qc.invalidateQueries({ queryKey: ["order-predictions"] });
      setSelectedPredictions(new Set());
      toast.success(t("Purchase order created!", "Narudžbenica kreirana!"));
      navigate("/purchasing/orders");
    },
    onError: (e: any) => toast.error(e.message || t("Failed to create PO", "Kreiranje narudžbenice neuspešno")),
  });

  const filtered = (predictions || []).filter((p: any) =>
    selectedSupplier === "all" || p.supplier_id === selectedSupplier
  );

  const summary = {
    total: filtered.length,
    avgConfidence: filtered.length > 0 ? filtered.reduce((a: number, p: any) => a + (p.confidence || 0), 0) / filtered.length : 0,
    totalValue: filtered.reduce((a: number, p: any) => a + (p.estimated_value || 0), 0),
    urgent: filtered.filter((p: any) => {
      const d = new Date(p.order_by_date);
      return d <= new Date(Date.now() + 7 * 86400000);
    }).length,
  };

  const togglePrediction = (id: string) => {
    setSelectedPredictions(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("AI Order Predictions", "AI Predikcije Narudžbi")}
        description={t("Smart reorder recommendations based on demand forecasting", "Pametne preporuke za naručivanje na osnovu prognoza potražnje")}
      />

      <div className="flex flex-wrap items-center gap-3">
        <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
          <SelectTrigger className="w-[250px]">
            <SelectValue placeholder={t("All Suppliers", "Svi dobavljači")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("All Suppliers", "Svi dobavljači")}</SelectItem>
            {(suppliers || []).map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={() => runPrediction.mutate()} disabled={runPrediction.isPending}>
          <Brain className="mr-2 h-4 w-4" />
          {runPrediction.isPending ? t("Analyzing...", "Analiza...") : t("Run Prediction", "Pokreni predikciju")}
        </Button>
        {selectedPredictions.size > 0 && (
          <Button variant="default" onClick={() => generatePO.mutate()} disabled={generatePO.isPending}>
            <ShoppingCart className="mr-2 h-4 w-4" />
            {t(`Create PO (${selectedPredictions.size})`, `Kreiraj narudžbenicu (${selectedPredictions.size})`)}
          </Button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("Total Predictions", "Ukupno predikcija")}</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{summary.total}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("Avg Confidence", "Prosečna pouzdanost")}</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{Math.round(summary.avgConfidence * 100)}%</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("Estimated Value", "Procenjena vrednost")}</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{fmtNum(summary.totalValue)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("Urgent (≤7 days)", "Hitno (≤7 dana)")}</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-destructive">{summary.urgent}</div></CardContent>
        </Card>
      </div>

      {/* Predictions Table */}
      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"></TableHead>
              <TableHead>{t("Product", "Proizvod")}</TableHead>
              <TableHead>{t("Supplier", "Dobavljač")}</TableHead>
              <TableHead className="text-right">{t("Stock", "Zaliha")}</TableHead>
              <TableHead className="text-right">{t("Avg Daily", "Dnevna potr.")}</TableHead>
              <TableHead className="text-right">{t("Lead Time", "Rok isporuke")}</TableHead>
              <TableHead className="text-right">{t("Reorder Pt", "Tačka narudžbe")}</TableHead>
              <TableHead className="text-right">{t("Rec. Qty", "Prep. kol.")}</TableHead>
              <TableHead>{t("Order By", "Naručiti do")}</TableHead>
              <TableHead>{t("Confidence", "Pouzdanost")}</TableHead>
              <TableHead>{t("Status", "Status")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((p: any) => {
              const isUrgent = new Date(p.order_by_date) <= new Date(Date.now() + 7 * 86400000);
              return (
                <TableRow key={p.id} className={isUrgent ? "bg-destructive/5" : ""}>
                  <TableCell>
                    {p.status === "pending" && (
                      <input
                        type="checkbox"
                        checked={selectedPredictions.has(p.id)}
                        onChange={() => togglePrediction(p.id)}
                        className="rounded border-border"
                      />
                    )}
                    {p.status === "converted_to_po" && <CheckCircle className="h-4 w-4 text-green-600" />}
                  </TableCell>
                  <TableCell className="font-medium">{p.products?.name || "—"}</TableCell>
                  <TableCell>{p.partners?.name || "—"}</TableCell>
                  <TableCell className="text-right">{Math.round(p.current_stock)}</TableCell>
                  <TableCell className="text-right">{(+p.avg_daily_demand).toFixed(1)}</TableCell>
                  <TableCell className="text-right">{p.lead_time_days}d</TableCell>
                  <TableCell className="text-right">{Math.round(p.reorder_point)}</TableCell>
                  <TableCell className="text-right font-semibold">{Math.round(p.recommended_qty)}</TableCell>
                  <TableCell>
                    <Badge variant={isUrgent ? "destructive" : "secondary"}>
                      {p.order_by_date}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={p.confidence >= 0.8 ? "default" : "secondary"}>
                      {Math.round(p.confidence * 100)}%
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={p.status === "converted_to_po" ? "default" : p.status === "pending" ? "secondary" : "outline"}>
                      {p.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                  {t("No predictions yet. Click 'Run Prediction' to analyze.", "Nema predikcija. Kliknite 'Pokreni predikciju'.")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
