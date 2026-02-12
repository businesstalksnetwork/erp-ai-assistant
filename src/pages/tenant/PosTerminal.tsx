import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Search, Plus, Minus, Trash2, ShoppingCart, Receipt } from "lucide-react";

interface CartItem {
  product_id: string;
  name: string;
  unit_price: number;
  quantity: number;
  tax_rate: number;
}

export default function PosTerminal() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [buyerId, setBuyerId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [lastReceipt, setLastReceipt] = useState<{ number: string; qr?: string } | null>(null);

  const { data: activeSession } = useQuery({
    queryKey: ["pos_sessions_active", tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      const { data } = await supabase.from("pos_sessions").select("*, locations(name), salespeople(first_name, last_name)").eq("tenant_id", tenantId).eq("status", "open").eq("opened_by", user?.id).order("opened_at", { ascending: false }).limit(1).maybeSingle();
      return data;
    },
    enabled: !!tenantId,
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase.from("products").select("id, name, default_sale_price, default_retail_price, barcode, sku").eq("tenant_id", tenantId).eq("is_active", true);
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: fiscalDevices = [] } = useQuery({
    queryKey: ["fiscal_devices_location", tenantId, activeSession?.location_id],
    queryFn: async () => {
      if (!activeSession?.location_id) return [];
      const { data } = await supabase.from("fiscal_devices").select("*").eq("tenant_id", tenantId!).eq("location_id", activeSession.location_id).eq("is_active", true);
      return data || [];
    },
    enabled: !!tenantId && !!activeSession?.location_id,
  });

  const filteredProducts = products.filter((p: any) =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.barcode?.includes(search) || p.sku?.includes(search)
  );

  const addToCart = (p: any) => {
    const price = Number(p.default_retail_price) > 0 ? Number(p.default_retail_price) : Number(p.default_sale_price);
    setCart(prev => {
      const existing = prev.find(c => c.product_id === p.id);
      if (existing) return prev.map(c => c.product_id === p.id ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, { product_id: p.id, name: p.name, unit_price: price, quantity: 1, tax_rate: 20 }];
    });
  };

  const updateQty = (productId: string, delta: number) => {
    setCart(prev => prev.map(c => c.product_id === productId ? { ...c, quantity: Math.max(1, c.quantity + delta) } : c));
  };

  const removeFromCart = (productId: string) => setCart(prev => prev.filter(c => c.product_id !== productId));

  const subtotal = cart.reduce((s, c) => s + c.unit_price * c.quantity, 0);
  const taxAmount = cart.reduce((s, c) => s + c.unit_price * c.quantity * (c.tax_rate / 100), 0);
  const total = subtotal + taxAmount;

  const completeSale = useMutation({
    mutationFn: async () => {
      if (!tenantId || !activeSession) throw new Error("No active session");
      const txNum = `POS-${Date.now()}`;
      const { data: tx } = await supabase.from("pos_transactions").insert({
        session_id: activeSession.id,
        tenant_id: tenantId,
        transaction_number: txNum,
        items: cart as any,
        subtotal,
        tax_amount: taxAmount,
        total,
        payment_method: paymentMethod,
        customer_name: customerName || null,
        location_id: activeSession.location_id || null,
        warehouse_id: activeSession.warehouse_id || null,
        salesperson_id: activeSession.salesperson_id || null,
        buyer_id: buyerId || null,
        receipt_type: "sale",
      }).select().single();

      // Auto-fiscalize if fiscal device available
      if (fiscalDevices.length > 0 && tx) {
        try {
          const { data: result } = await supabase.functions.invoke("fiscalize-receipt", {
            body: {
              transaction_id: tx.id,
              tenant_id: tenantId,
              device_id: fiscalDevices[0].id,
              items: cart.map(c => ({ name: c.name, quantity: c.quantity, unit_price: c.unit_price, tax_rate: c.tax_rate, total_amount: c.unit_price * c.quantity * (1 + c.tax_rate / 100) })),
              payments: [{ amount: total, method: paymentMethod }],
              buyer_id: buyerId || null,
              receipt_type: "normal",
              transaction_type: "sale",
            },
          });
          if (result?.receipt_number) {
            setLastReceipt({ number: result.receipt_number, qr: result.qr_code_url });
          }
        } catch (e) {
          console.error("Fiscalization failed:", e);
        }
      }

      return tx;
    },
    onSuccess: () => {
      setCart([]);
      setCustomerName("");
      setBuyerId("");
      queryClient.invalidateQueries({ queryKey: ["pos_transactions"] });
      toast({ title: t("posTransactionComplete") });
    },
    onError: (e: any) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  if (!activeSession) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Card className="max-w-md w-full">
          <CardHeader><CardTitle>{t("posTerminal")}</CardTitle></CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">{t("noActiveSession")}</p>
            <Button onClick={() => window.location.href = "/pos/sessions"}>{t("posSessions")}</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex gap-6 h-[calc(100vh-8rem)]">
      {/* Product Grid */}
      <div className="flex-1 flex flex-col space-y-4">
        {/* Session info bar */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <Badge variant="outline">{(activeSession as any).locations?.name || t("location")}</Badge>
          {(activeSession as any).salespeople && (
            <Badge variant="outline">{(activeSession as any).salespeople.first_name} {(activeSession as any).salespeople.last_name}</Badge>
          )}
          {fiscalDevices.length > 0 && <Badge variant="default" className="text-xs">{t("fiscalDevice")}: {fiscalDevices[0].device_name}</Badge>}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder={t("search")} value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex-1 overflow-y-auto grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {filteredProducts.map((p: any) => (
            <Card key={p.id} className="cursor-pointer hover:bg-accent transition-colors" onClick={() => addToCart(p)}>
              <CardContent className="p-4">
                <p className="font-medium text-sm truncate">{p.name}</p>
                <p className="text-lg font-bold text-primary">
                  {(Number(p.default_retail_price) > 0 ? Number(p.default_retail_price) : Number(p.default_sale_price)).toFixed(2)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Cart */}
      <Card className="w-96 flex flex-col">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2"><ShoppingCart className="h-5 w-5" />{t("cart")} ({cart.length})</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col">
          <div className="flex-1 overflow-y-auto space-y-2">
            {cart.map(item => (
              <div key={item.product_id} className="flex items-center gap-2 p-2 rounded-md border">
                <div className="flex-1">
                  <p className="text-sm font-medium truncate">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{item.unit_price.toFixed(2)} × {item.quantity}</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQty(item.product_id, -1)}><Minus className="h-3 w-3" /></Button>
                  <span className="w-6 text-center text-sm">{item.quantity}</span>
                  <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQty(item.product_id, 1)}><Plus className="h-3 w-3" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeFromCart(item.product_id)}><Trash2 className="h-3 w-3" /></Button>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t pt-4 mt-4 space-y-2">
            <Input placeholder={t("customerName")} value={customerName} onChange={e => setCustomerName(e.target.value)} />
            <Input placeholder={t("buyerId")} value={buyerId} onChange={e => setBuyerId(e.target.value)} />
            <div className="flex gap-2 flex-wrap">
              {["cash", "card", "wire_transfer", "voucher", "mobile"].map(m => (
                <Button key={m} size="sm" variant={paymentMethod === m ? "default" : "outline"} onClick={() => setPaymentMethod(m)}>{t(m as any)}</Button>
              ))}
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span>{t("subtotal")}</span><span>{subtotal.toFixed(2)}</span></div>
              <div className="flex justify-between"><span>{t("taxAmount")}</span><span>{taxAmount.toFixed(2)}</span></div>
              <div className="flex justify-between font-bold text-lg"><span>{t("total")}</span><span>{total.toFixed(2)}</span></div>
            </div>
            <Button className="w-full" size="lg" disabled={cart.length === 0} onClick={() => completeSale.mutate()}>
              <Receipt className="h-4 w-4 mr-2" />{t("completeSale")}
            </Button>

            {/* Last receipt info */}
            {lastReceipt && (
              <div className="p-3 rounded-md bg-accent text-sm space-y-1">
                <p className="font-medium">{t("fiscalReceiptNumber")}: {lastReceipt.number}</p>
                {lastReceipt.qr && <a href={lastReceipt.qr} target="_blank" rel="noopener noreferrer" className="text-primary underline text-xs">{t("qrCode")}</a>}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
