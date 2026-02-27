import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, ArrowLeft, FileText, Plus, Trash2, Truck } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

interface LineForm {
  id?: string;
  product_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate_value: number;
}

const emptyLine: LineForm = { description: "", quantity: 1, unit_price: 0, tax_rate_value: 20 };

export default function SalesOrderDetail() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [lineOpen, setLineOpen] = useState(false);
  const [lineForm, setLineForm] = useState<LineForm>(emptyLine);
  const [editLineId, setEditLineId] = useState<string | null>(null);

  const { data: products = [] } = useQuery({
    queryKey: ["products", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("*, tax_rates(id, rate)")
        .eq("tenant_id", tenantId!)
        .eq("is_active", true)
        .order("name");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: order, isLoading } = useQuery({
    queryKey: ["sales-order-detail", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("sales_orders")
        .select("*, partners(name), quotes(quote_number, id), salespeople(first_name, last_name)")
        .eq("id", id!)
        .single();
      return data;
    },
    enabled: !!id,
  });

  const { data: lines = [], isLoading: linesLoading } = useQuery({
    queryKey: ["sales-order-lines", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("sales_order_lines")
        .select("*, products(name)")
        .eq("sales_order_id", id!)
        .order("sort_order");
      return data || [];
    },
    enabled: !!id,
  });

  const recalcTotals = async () => {
    const { data: currentLines } = await supabase.from("sales_order_lines").select("line_total, tax_amount, total_with_tax").eq("sales_order_id", id!);
    const subtotal = (currentLines || []).reduce((s, l) => s + (l.line_total || 0), 0);
    const taxAmount = (currentLines || []).reduce((s, l) => s + (l.tax_amount || 0), 0);
    const total = (currentLines || []).reduce((s, l) => s + (l.total_with_tax || 0), 0);
    await supabase.from("sales_orders").update({ subtotal, tax_amount: taxAmount, total }).eq("id", id!);
    qc.invalidateQueries({ queryKey: ["sales-order-detail", id] });
  };

  const lineMutation = useMutation({
    mutationFn: async (f: LineForm) => {
      const lineTotal = f.quantity * f.unit_price;
      const taxAmount = lineTotal * (f.tax_rate_value / 100);
      const totalWithTax = lineTotal + taxAmount;
      const payload = {
        sales_order_id: id!,
        product_id: f.product_id || null,
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
        const { error } = await supabase.from("sales_order_lines").update(payload).eq("id", editLineId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("sales_order_lines").insert([payload]);
        if (error) throw error;
      }
      await recalcTotals();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sales-order-lines", id] }); setLineOpen(false); toast.success(t("success")); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteLineMut = useMutation({
    mutationFn: async (lineId: string) => {
      const { error } = await supabase.from("sales_order_lines").delete().eq("id", lineId);
      if (error) throw error;
      await recalcTotals();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sales-order-lines", id] }); toast.success(t("success")); },
    onError: (e: Error) => toast.error(e.message),
  });

  const fmt = (n: number) =>
    new Intl.NumberFormat("sr-RS", { style: "currency", currency: order?.currency || "RSD" }).format(n);

  const statusColor = (s: string) => {
    if (s === "delivered") return "default";
    if (s === "cancelled") return "destructive";
    if (s === "shipped") return "outline";
    return "secondary";
  };

  const openAddLine = () => { setEditLineId(null); setLineForm(emptyLine); setLineOpen(true); };
  const openEditLine = (l: any) => {
    setEditLineId(l.id);
    setLineForm({ id: l.id, product_id: l.product_id || undefined, description: l.description, quantity: l.quantity, unit_price: l.unit_price, tax_rate_value: l.tax_rate_value });
    setLineOpen(true);
  };

  const handleProductSelect = (productId: string) => {
    if (productId === "__manual__") {
      setLineForm(f => ({ ...f, product_id: undefined }));
      return;
    }
    const product = products.find((p: any) => p.id === productId);
    if (product) {
      setLineForm(f => ({
        ...f,
        product_id: product.id,
        description: product.name,
        unit_price: product.default_sale_price || 0,
        tax_rate_value: product.tax_rates?.rate ?? f.tax_rate_value,
      }));
    }
  };

  const [autoPostInvoice, setAutoPostInvoice] = useState(true);

  const createInvoice = async () => {
    // Fetch SO lines to pass to invoice form
    const { data: soLines } = await supabase
      .from("sales_order_lines")
      .select("*, products(name)")
      .eq("sales_order_id", id!)
      .order("sort_order");

    // Update SO status to 'invoiced'
    await supabase.from("sales_orders").update({ status: "invoiced" }).eq("id", id!);
    qc.invalidateQueries({ queryKey: ["sales-order-detail", id] });

    navigate("/accounting/invoices/new", {
      state: {
        fromSalesOrder: {
          partner_id: order!.partner_id,
          partner_name: order!.partners?.name || order!.partner_name,
          currency: order!.currency,
          notes: `From Sales Order ${order!.order_number}`,
          sales_order_id: order!.id,
          autoPost: autoPostInvoice,
          lines: (soLines || []).map((l: any) => ({
            product_id: l.product_id,
            description: l.products?.name || l.description,
            quantity: l.quantity,
            unit_price: l.unit_price,
            tax_rate_value: l.tax_rate_value,
          })),
        },
      },
    });
  };

  const createDispatchNote = async () => {
    // Fetch SO lines for dispatch note
    const { data: soLines } = await supabase
      .from("sales_order_lines")
      .select("*, products(name)")
      .eq("sales_order_id", id!)
      .order("sort_order");
    navigate("/inventory/dispatch-notes", {
      state: {
        fromSalesOrder: {
          sales_order_id: order!.id,
          partner_id: order!.partner_id,
          partner_name: order!.partners?.name || order!.partner_name,
          order_number: order!.order_number,
          lines: (soLines || []).map((l: any) => ({
            product_id: l.product_id,
            description: l.products?.name || l.description,
            quantity: l.quantity,
            unit_price: l.unit_price,
          })),
        },
      },
    });
  };

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  if (!order) return <div className="text-center py-20 text-muted-foreground">{t("noResults")}</div>;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate("/sales/sales-orders")}>
            <ArrowLeft className="h-4 w-4 mr-1" />{t("back")}
          </Button>
          <h1 className="text-xl sm:text-2xl font-bold truncate">{order.order_number}</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap pl-9 sm:pl-0">
          <Badge variant={statusColor(order.status) as any}>{t(order.status as any) || order.status}</Badge>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 flex-wrap">
        {(order.status === "confirmed" || order.status === "delivered") && (
          <>
            <Button size="sm" variant="outline" onClick={createDispatchNote}>
              <Truck className="h-4 w-4 mr-1" /> {t("dispatchNotes")}
            </Button>
            <div className="flex items-center gap-2">
              <Checkbox
                id="autoPost"
                checked={autoPostInvoice}
                onCheckedChange={(v) => setAutoPostInvoice(!!v)}
              />
              <label htmlFor="autoPost" className="text-sm cursor-pointer">{"Auto-post"}</label>
            </div>
            <Button size="sm" onClick={createInvoice}>
              <FileText className="h-4 w-4 mr-1" /> {t("createInvoiceFromOrder")}
            </Button>
          </>
        )}
      </div>

      <Tabs defaultValue="overview">
        <div className="overflow-x-auto -mx-1 px-1">
          <TabsList className="w-max">
            <TabsTrigger value="overview">{t("overview")}</TabsTrigger>
            <TabsTrigger value="lines">Stavke ({lines.length})</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview">
          <Card>
            <CardHeader><CardTitle>{t("overview")}</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                <div><span className="text-muted-foreground">{t("partner")}:</span> <span className="font-medium">{order.partners?.name || order.partner_name || "—"}</span></div>
                <div>
                  <span className="text-muted-foreground">{t("quote")}:</span>{" "}
                  {order.quotes ? (
                    <Link to={`/sales/quotes/${order.quotes.id}`} className="font-medium text-primary hover:underline">
                      {order.quotes.quote_number}
                    </Link>
                  ) : <span className="font-medium">—</span>}
                </div>
                <div><span className="text-muted-foreground">{t("salesperson")}:</span> <span className="font-medium">{order.salespeople ? `${order.salespeople.first_name} ${order.salespeople.last_name}` : "—"}</span></div>
                <div><span className="text-muted-foreground">{t("orderDate")}:</span> <span className="font-medium">{order.order_date}</span></div>
                <div><span className="text-muted-foreground">{t("currency")}:</span> <span className="font-medium">{order.currency}</span></div>
                <div></div>
                <div><span className="text-muted-foreground">{t("subtotal")}:</span> <span className="font-medium">{fmt(order.subtotal || 0)}</span></div>
                <div><span className="text-muted-foreground">{t("taxAmount" as any)}:</span> <span className="font-medium">{fmt(order.tax_amount || 0)}</span></div>
                <div><span className="text-muted-foreground">{t("total")}:</span> <span className="font-semibold text-base">{fmt(order.total || 0)}</span></div>
              </div>
              {order.notes && <p className="mt-4 text-sm text-muted-foreground">{order.notes}</p>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="lines">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Stavke naloga</CardTitle>
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
                         <TableHead>Proizvod / Usluga</TableHead>
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
                            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); deleteLineMut.mutate(l.id); }}>
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
      </Tabs>

      {/* Line item dialog */}
      <Dialog open={lineOpen} onOpenChange={setLineOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editLineId ? "Izmeni stavku" : "Dodaj stavku"}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Proizvod / Usluga</Label>
              <Select value={lineForm.product_id || "__manual__"} onValueChange={handleProductSelect}>
                <SelectTrigger><SelectValue placeholder="Izaberi proizvod..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__manual__">Ručni unos</SelectItem>
                  {products.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2"><Label>{t("description")}</Label><Input value={lineForm.description} onChange={(e) => setLineForm({ ...lineForm, description: e.target.value })} placeholder="Opis stavke" /></div>
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
