import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, ArrowLeft, ArrowRight, Plus, Trash2, AlertTriangle, History } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { QuoteVersionHistory } from "@/components/quotes/QuoteVersionHistory";
import { DiscountApprovalBadge } from "@/components/quotes/DiscountApprovalBadge";

interface LineForm {
  id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate_value: number;
}

const emptyLine: LineForm = { description: "", quantity: 1, unit_price: 0, tax_rate_value: 20 };

export default function QuoteDetail() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [lineOpen, setLineOpen] = useState(false);
  const [lineForm, setLineForm] = useState<LineForm>(emptyLine);
  const [editLineId, setEditLineId] = useState<string | null>(null);
  const [vhOpen, setVhOpen] = useState(false);

  const { data: quote, isLoading } = useQuery({
    queryKey: ["quote-detail", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("quotes")
        .select("*, partners(name), opportunities(title), salespeople(first_name, last_name)")
        .eq("id", id!)
        .single();
      return data;
    },
    enabled: !!id,
  });

  const { data: lines = [], isLoading: linesLoading } = useQuery({
    queryKey: ["quote-lines", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("quote_lines")
        .select("*, products(name)")
        .eq("quote_id", id!)
        .order("sort_order");
      return data || [];
    },
    enabled: !!id,
  });

  const recalcTotals = async () => {
    const { data: currentLines } = await supabase.from("quote_lines").select("line_total, tax_amount, total_with_tax").eq("quote_id", id!);
    const subtotal = (currentLines || []).reduce((s, l) => s + (l.line_total || 0), 0);
    const taxAmount = (currentLines || []).reduce((s, l) => s + (l.tax_amount || 0), 0);
    const total = (currentLines || []).reduce((s, l) => s + (l.total_with_tax || 0), 0);
    await supabase.from("quotes").update({ subtotal, tax_amount: taxAmount, total }).eq("id", id!);
    qc.invalidateQueries({ queryKey: ["quote-detail", id] });
  };

  const lineMutation = useMutation({
    mutationFn: async (f: LineForm) => {
      const lineTotal = f.quantity * f.unit_price;
      const taxAmount = lineTotal * (f.tax_rate_value / 100);
      const totalWithTax = lineTotal + taxAmount;
      const payload = {
        quote_id: id!,
        description: f.description,
        quantity: f.quantity,
        unit_price: f.unit_price,
        tax_rate_value: f.tax_rate_value,
        line_total: lineTotal,
        tax_amount: taxAmount,
        total_with_tax: totalWithTax,
        sort_order: lines.length + 1,
      };
      if (editLineId) {
        const { error } = await supabase.from("quote_lines").update(payload).eq("id", editLineId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("quote_lines").insert([payload]);
        if (error) throw error;
      }
      await recalcTotals();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["quote-lines", id] }); setLineOpen(false); toast.success(t("success")); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteLine = useMutation({
    mutationFn: async (lineId: string) => {
      const { error } = await supabase.from("quote_lines").delete().eq("id", lineId);
      if (error) throw error;
      await recalcTotals();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["quote-lines", id] }); toast.success(t("success")); },
    onError: (e: Error) => toast.error(e.message),
  });

  const convertToSO = useMutation({
    mutationFn: async () => {
      const orderNumber = `SO-${Date.now().toString(36).toUpperCase()}`;
      const { data: so, error: soError } = await supabase.from("sales_orders").insert([{
        tenant_id: tenantId!,
        order_number: orderNumber,
        quote_id: quote!.id,
        partner_id: quote!.partner_id || null,
        partner_name: quote!.partners?.name || quote!.partner_name || "",
        order_date: new Date().toISOString().split("T")[0],
        status: "pending",
        currency: quote!.currency || "RSD",
        subtotal: quote!.subtotal || 0,
        tax_amount: quote!.tax_amount || 0,
        total: quote!.total || 0,
        notes: quote!.notes || "",
      }]).select("id").single();
      if (soError) throw soError;
      // Copy lines
      if (so) {
        const linePayloads = lines.map((l: any) => ({
          sales_order_id: so.id,
          product_id: l.product_id,
          description: l.description,
          quantity: l.quantity,
          unit_price: l.unit_price,
          tax_rate_value: l.tax_rate_value,
          tax_rate_id: l.tax_rate_id,
          line_total: l.line_total,
          tax_amount: l.tax_amount,
          total_with_tax: l.total_with_tax,
          sort_order: l.sort_order,
        }));
        if (linePayloads.length > 0) {
          await supabase.from("sales_order_lines").insert(linePayloads);
        }
      }
      if (quote!.status !== "accepted") {
        await supabase.from("quotes").update({ status: "accepted" }).eq("id", id!);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quote-detail", id] });
      toast.success(t("conversionSuccess"));
      navigate("/sales/sales-orders");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const fmt = (n: number) =>
    new Intl.NumberFormat("sr-RS", { style: "currency", currency: quote?.currency || "RSD" }).format(n);

  const statusColor = (s: string) => {
    if (s === "accepted") return "default";
    if (s === "rejected" || s === "expired") return "destructive";
    return "secondary";
  };

  const isExpiringSoon = () => {
    if (quote?.status !== "sent" || !quote?.valid_until) return false;
    const diff = (new Date(quote.valid_until).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 3;
  };

  const openAddLine = () => { setEditLineId(null); setLineForm(emptyLine); setLineOpen(true); };
  const openEditLine = (l: any) => {
    setEditLineId(l.id);
    setLineForm({ id: l.id, description: l.description, quantity: l.quantity, unit_price: l.unit_price, tax_rate_value: l.tax_rate_value });
    setLineOpen(true);
  };

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  if (!quote) return <div className="text-center py-20 text-muted-foreground">{t("noResults")}</div>;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate("/sales/quotes")}>
            <ArrowLeft className="h-4 w-4 mr-1" />{t("back")}
          </Button>
          <h1 className="text-xl sm:text-2xl font-bold truncate">{quote.quote_number}</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap pl-9 sm:pl-0">
          {(quote.current_version || 1) > 1 && <Badge variant="outline">v{quote.current_version}</Badge>}
          <Badge variant={statusColor(quote.status) as any}>{t(quote.status as any) || quote.status}</Badge>
          {quote.max_discount_pct > 0 && tenantId && (
            <DiscountApprovalBadge quoteId={quote.id} tenantId={tenantId} maxDiscountPct={quote.max_discount_pct} />
          )}
          {isExpiringSoon() && (
            <Badge variant="outline" className="text-amber-600 border-amber-400">
              <AlertTriangle className="h-3 w-3 mr-1" /> Ističe uskoro
            </Badge>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 flex-wrap">
        <Button variant="outline" size="sm" onClick={() => setVhOpen(true)}>
          <History className="h-4 w-4 mr-1" /> {t("versionHistory")}
        </Button>
        {quote.status === "accepted" && (
          <Button size="sm" onClick={() => convertToSO.mutate()} disabled={convertToSO.isPending}>
            <ArrowRight className="h-4 w-4 mr-1" /> {t("convertToSalesOrder")}
          </Button>
        )}
      </div>

      <Tabs defaultValue="overview">
        <div className="overflow-x-auto -mx-1 px-1">
          <TabsList className="w-max">
            <TabsTrigger value="overview">{t("overview")}</TabsTrigger>
            <TabsTrigger value="lines">Stavke ({lines.length})</TabsTrigger>
            <TabsTrigger value="versions">{t("versionHistory")}</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview">
          <Card>
            <CardHeader><CardTitle>{t("overview")}</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                <div><span className="text-muted-foreground">{t("partner")}:</span> <span className="font-medium">{quote.partners?.name || quote.partner_name || "—"}</span></div>
                <div><span className="text-muted-foreground">{t("opportunity")}:</span> <span className="font-medium">{quote.opportunities?.title || "—"}</span></div>
                <div><span className="text-muted-foreground">{t("salesperson")}:</span> <span className="font-medium">{quote.salespeople ? `${quote.salespeople.first_name} ${quote.salespeople.last_name}` : "—"}</span></div>
                <div><span className="text-muted-foreground">{t("quoteDate")}:</span> <span className="font-medium">{quote.quote_date}</span></div>
                <div><span className="text-muted-foreground">{t("validUntil")}:</span> <span className="font-medium">{quote.valid_until || "—"}</span></div>
                <div><span className="text-muted-foreground">{t("currency")}:</span> <span className="font-medium">{quote.currency}</span></div>
                <div><span className="text-muted-foreground">{t("subtotal")}:</span> <span className="font-medium">{fmt(quote.subtotal || 0)}</span></div>
                <div><span className="text-muted-foreground">{t("taxAmount" as any)}:</span> <span className="font-medium">{fmt(quote.tax_amount || 0)}</span></div>
                <div><span className="text-muted-foreground">{t("total")}:</span> <span className="font-semibold text-base">{fmt(quote.total || 0)}</span></div>
              </div>
              {quote.notes && <p className="mt-4 text-sm text-muted-foreground">{quote.notes}</p>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="lines">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Stavke ponude</CardTitle>
              <Button size="sm" onClick={openAddLine}><Plus className="h-4 w-4 mr-1" /> Dodaj stavku</Button>
            </CardHeader>
            <CardContent>
              {linesLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : lines.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">{t("noResults")}</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>{t("description")}</TableHead>
                        <TableHead className="text-right">{t("quantity")}</TableHead>
                        <TableHead className="text-right">{t("unitPrice")}</TableHead>
                        <TableHead className="text-right">PDV %</TableHead>
                        <TableHead className="text-right">{t("total")}</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lines.map((l: any, idx: number) => (
                        <TableRow key={l.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openEditLine(l)}>
                          <TableCell>{idx + 1}</TableCell>
                          <TableCell>{l.products?.name || l.description || "—"}</TableCell>
                          <TableCell className="text-right">{l.quantity}</TableCell>
                          <TableCell className="text-right">{fmt(l.unit_price)}</TableCell>
                          <TableCell className="text-right">{l.tax_rate_value}%</TableCell>
                          <TableCell className="text-right font-medium">{fmt(l.total_with_tax)}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); deleteLine.mutate(l.id); }}>
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="versions">
          <Card>
            <CardContent className="pt-6">
              <QuoteVersionHistory open={true} onOpenChange={() => {}} quoteId={id!} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Version history dialog */}
      {vhOpen && <QuoteVersionHistory open={vhOpen} onOpenChange={setVhOpen} quoteId={id!} />}

      {/* Line item dialog */}
      <Dialog open={lineOpen} onOpenChange={setLineOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editLineId ? "Izmeni stavku" : "Dodaj stavku"}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2"><Label>{t("description")}</Label><Input value={lineForm.description} onChange={(e) => setLineForm({ ...lineForm, description: e.target.value })} /></div>
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-2"><Label>{t("quantity")}</Label><Input type="number" min={0} value={lineForm.quantity} onChange={(e) => setLineForm({ ...lineForm, quantity: +e.target.value })} /></div>
              <div className="grid gap-2"><Label>{t("unitPrice")}</Label><Input type="number" min={0} step="0.01" value={lineForm.unit_price} onChange={(e) => setLineForm({ ...lineForm, unit_price: +e.target.value })} /></div>
              <div className="grid gap-2"><Label>PDV %</Label><Input type="number" min={0} value={lineForm.tax_rate_value} onChange={(e) => setLineForm({ ...lineForm, tax_rate_value: +e.target.value })} /></div>
            </div>
            <div className="text-sm text-muted-foreground">
              Ukupno: <span className="font-medium text-foreground">{fmt(lineForm.quantity * lineForm.unit_price * (1 + lineForm.tax_rate_value / 100))}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLineOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => lineMutation.mutate(lineForm)} disabled={!lineForm.description || lineMutation.isPending}>
              {lineMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
