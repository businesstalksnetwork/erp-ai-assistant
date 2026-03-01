import { useState } from "react";
import { ActionGuard } from "@/components/ActionGuard";
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
import { Search, Plus, Minus, Trash2, ShoppingCart, Receipt, RefreshCw, Undo2, Printer, ClipboardList, Split, Tag, Star } from "lucide-react";
import { PosPinDialog } from "@/components/pos/PosPinDialog";
import { ReceiptReprintDialog } from "@/components/pos/ReceiptReprintDialog";
import { CashChangeCalculator } from "@/components/pos/CashChangeCalculator";
import { SplitPaymentDialog } from "@/components/pos/SplitPaymentDialog";
import { PosXReportDialog } from "@/components/pos/PosXReportDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { EntitySelector } from "@/components/shared/EntitySelector";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface CartItem {
  product_id: string;
  name: string;
  unit_price: number;
  quantity: number;
  tax_rate: number;
}

interface IdentifiedSeller {
  id: string;
  first_name: string;
  last_name: string;
}

interface RefundItem {
  name: string;
  quantity: number;
  maxQuantity: number;
  unit_price: number;
  tax_rate: number;
  selected: boolean;
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
  const [buyerPartnerId, setBuyerPartnerId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [voucherType, setVoucherType] = useState<string | null>(null);
  const [lastReceipt, setLastReceipt] = useState<{ number: string; qr?: string } | null>(null);
  const [identifiedSeller, setIdentifiedSeller] = useState<IdentifiedSeller | null>(null);

  // Refund state
  const [refundMode, setRefundMode] = useState(false);
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  const [selectedOriginalTx, setSelectedOriginalTx] = useState<any>(null);
  const [refundItems, setRefundItems] = useState<RefundItem[]>([]);
  const [reprintDialogOpen, setReprintDialogOpen] = useState(false);
  const [xReportOpen, setXReportOpen] = useState(false);
  const [splitPaymentOpen, setSplitPaymentOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // POS-01: Discount override state
  const [discountDialogOpen, setDiscountDialogOpen] = useState(false);
  const [discountItemId, setDiscountItemId] = useState<string | null>(null);
  const [discountPct, setDiscountPct] = useState("");
  const [discountReason, setDiscountReason] = useState("");

  // POS-04: Loyalty integration state
  const [loyaltySearch, setLoyaltySearch] = useState("");
  const [loyaltyMember, setLoyaltyMember] = useState<any>(null);

  const { data: activeSession } = useQuery({
    queryKey: ["pos_sessions_active", tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      const { data } = await supabase.from("pos_sessions").select("*, locations(name), salespeople(first_name, last_name)").eq("tenant_id", tenantId).eq("status", "open").eq("opened_by", user?.id).order("opened_at", { ascending: false }).limit(1).maybeSingle();
      return data;
    },
    enabled: !!tenantId,
  });

  // Resolve fiscal device: prefer session's fiscal_device_id, fallback to location query
  const sessionFiscalDeviceId = (activeSession as any)?.fiscal_device_id;

  // Fetch salespeople at this location for PIN verification
  const { data: locationSalespeople = [] } = useQuery({
    queryKey: ["location-salespeople", tenantId, activeSession?.location_id],
    queryFn: async () => {
      if (!tenantId || !activeSession?.location_id) return [];
      const { data } = await (supabase.from("salespeople") as any)
        .select("id, first_name, last_name, pos_pin")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .eq("location_id", activeSession.location_id);
      return data || [];
    },
    enabled: !!tenantId && !!activeSession?.location_id,
  });

  // Fetch location's price list for location-specific pricing
  const { data: locationPrices = [] } = useQuery({
    queryKey: ["location-retail-prices", tenantId, activeSession?.location_id],
    queryFn: async () => {
      if (!activeSession?.location_id) return [];
      const { data: loc } = await supabase.from("locations").select("default_price_list_id").eq("id", activeSession.location_id).single();
      if (!loc?.default_price_list_id) return [];
      const { data } = await supabase.from("retail_prices").select("product_id, retail_price").eq("price_list_id", loc.default_price_list_id);
      return data || [];
    },
    enabled: !!tenantId && !!activeSession?.location_id,
  });

  // Fetch default retail price list as fallback
  const { data: defaultRetailPrices = [] } = useQuery({
    queryKey: ["default_retail_prices", tenantId],
    queryFn: async () => {
      const { data: defaultList } = await supabase
        .from("retail_price_lists")
        .select("id")
        .eq("tenant_id", tenantId!)
        .eq("is_default", true)
        .maybeSingle();
      if (!defaultList) return [];
      const { data } = await supabase.from("retail_prices").select("product_id, retail_price").eq("price_list_id", defaultList.id);
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["product_categories_pos", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase.from("product_categories").select("id, name").eq("tenant_id", tenantId).order("name");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase.from("products").select("id, name, default_sale_price, default_retail_price, barcode, sku, category_id, tax_rates(rate)").eq("tenant_id", tenantId).eq("is_active", true);
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: fiscalDevices = [] } = useQuery({
    queryKey: ["fiscal_devices_location", tenantId, activeSession?.location_id, sessionFiscalDeviceId],
    queryFn: async () => {
      // If session has a bound fiscal device, use it directly
      if (sessionFiscalDeviceId) {
        const { data } = await supabase.from("fiscal_devices").select("*").eq("id", sessionFiscalDeviceId).eq("is_active", true);
        return data || [];
      }
      if (!activeSession?.location_id) return [];
      const { data } = await supabase.from("fiscal_devices").select("*").eq("tenant_id", tenantId!).eq("location_id", activeSession.location_id).eq("is_active", true);
      return data || [];
    },
    enabled: !!tenantId && !!activeSession?.location_id,
  });

  // Recent transactions for refund selection
  const { data: recentTransactions = [] } = useQuery({
    queryKey: ["pos_recent_transactions", tenantId, activeSession?.location_id],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase.from("pos_transactions")
        .select("id, transaction_number, fiscal_receipt_number, total, items, created_at, receipt_type, payment_method")
        .eq("tenant_id", tenantId)
        .eq("receipt_type", "sale")
        .in("status", ["fiscalized", "completed"])
        .order("created_at", { ascending: false })
        .limit(50);
      return data || [];
    },
    enabled: !!tenantId && refundMode,
  });

  // GAP 4: Partners for buyer linkage
  const { data: partners = [] } = useQuery({
    queryKey: ["partners_for_pos", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("partners").select("id, name, pib").eq("tenant_id", tenantId!).eq("is_active", true).order("name");
      return data || [];
    },
    enabled: !!tenantId,
  });
  const partnerOptions = partners.map((p: any) => ({ value: p.id, label: p.name, sublabel: p.pib || "" }));

  // POS-04: Loyalty member lookup
  const lookupLoyaltyMember = async (searchVal: string) => {
    if (!tenantId || !searchVal.trim()) return;
    const q = searchVal.trim();
    const { data } = await (supabase
      .from("loyalty_members") as any)
      .select("*, loyalty_programs(name, points_per_currency)")
      .eq("tenant_id", tenantId)
      .or(`phone.ilike.%${q}%,card_number.ilike.%${q}%`)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();
    if (data) {
      setLoyaltyMember(data);
      toast({ title: `Lojalti: ${data.first_name || data.partner_id || ""}`, description: `${data.points_balance || 0} bodova • ${data.current_tier || "Bronze"}` });
    } else {
      toast({ title: t("error"), description: "Član lojalti programa nije pronađen", variant: "destructive" });
    }
  };

  // POS-01: Submit discount override request
  const submitDiscountOverride = async () => {
    if (!tenantId || !discountItemId) return;
    const item = cart.find(c => c.product_id === discountItemId);
    if (!item) return;
    const pct = parseFloat(discountPct) || 0;
    if (pct <= 0 || pct > 100) { toast({ title: t("error"), description: "Nevažeći procenat popusta", variant: "destructive" }); return; }
    const overridePrice = item.unit_price * (1 - pct / 100);
    const { error } = await supabase.from("pos_discount_overrides").insert({
      tenant_id: tenantId,
      product_name: item.name,
      original_price: item.unit_price,
      override_price: overridePrice,
      discount_pct: pct,
      reason: discountReason || null,
      requested_by: user?.id,
      status: "pending",
    });
    if (error) { toast({ title: t("error"), description: error.message, variant: "destructive" }); return; }
    toast({ title: "Zahtev za popust poslat", description: `${item.name}: ${pct}% popust čeka odobrenje` });
    setDiscountDialogOpen(false);
    setDiscountItemId(null);
    setDiscountPct("");
    setDiscountReason("");
  };

  const filteredProducts = products.filter((p: any) => {
    const matchesSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.barcode?.includes(search) || p.sku?.includes(search);
    const matchesCategory = !selectedCategory || (p as any).category_id === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const addToCart = (p: any) => {
    // Price resolution: location list → default retail list → product default_retail_price → default_sale_price
    const locPrice = locationPrices.find((lp: any) => lp.product_id === p.id);
    const defaultRetailEntry = defaultRetailPrices.find((rp: any) => rp.product_id === p.id);
    const price = locPrice ? Number(locPrice.retail_price)
      : defaultRetailEntry ? Number(defaultRetailEntry.retail_price)
      : (Number(p.default_retail_price) > 0 ? Number(p.default_retail_price) : Number(p.default_sale_price));
    setCart(prev => {
      const existing = prev.find(c => c.product_id === p.id);
      if (existing) return prev.map(c => c.product_id === p.id ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, { product_id: p.id, name: p.name, unit_price: price, quantity: 1, tax_rate: Number(p.tax_rates?.rate) || 20 }];
    });
  };

  const updateQty = (productId: string, delta: number) => {
    setCart(prev => prev.map(c => c.product_id === productId ? { ...c, quantity: Math.max(1, c.quantity + delta) } : c));
  };

  const removeFromCart = (productId: string) => setCart(prev => prev.filter(c => c.product_id !== productId));

  // Serbian retail prices are PDV-inclusive — extract tax from inclusive price
  const total = cart.reduce((s, c) => s + c.unit_price * c.quantity, 0);
  const taxAmount = cart.reduce((s, c) => s + (c.unit_price * c.quantity * c.tax_rate) / (100 + c.tax_rate), 0);
  const subtotal = total - taxAmount;

  // Open refund dialog for a specific transaction
  const openRefundDialog = async (tx: any) => {
    setSelectedOriginalTx(tx);

    // CR-CRIT-3: Query prior refunds to prevent unlimited re-refunds
    const { data: priorRefunds } = await supabase
      .from("pos_transactions")
      .select("items")
      .eq("original_transaction_id", tx.id)
      .eq("receipt_type", "refund")
      .neq("status", "voided");

    // Sum already-refunded quantities per item name
    const refundedQtyMap: Record<string, number> = {};
    (priorRefunds || []).forEach((ref: any) => {
      ((ref.items as any[]) || []).forEach((item: any) => {
        refundedQtyMap[item.name] = (refundedQtyMap[item.name] || 0) + (item.quantity || 0);
      });
    });

    const items = (tx.items as any[] || []).map((item: any) => {
      const alreadyRefunded = refundedQtyMap[item.name] || 0;
      const remaining = Math.max(0, item.quantity - alreadyRefunded);
      return {
        name: item.name,
        quantity: remaining,
        maxQuantity: remaining,
        unit_price: item.unit_price,
        tax_rate: item.tax_rate || 20,
        selected: remaining > 0,
      };
    }).filter(i => i.maxQuantity > 0);

    if (items.length === 0) {
      toast({ title: t("error"), description: "All items have already been refunded", variant: "destructive" });
      return;
    }

    setRefundItems(items);
    setRefundDialogOpen(true);
  };

  // Process refund
  const processRefund = useMutation({
    mutationFn: async () => {
      if (!tenantId || !activeSession || !selectedOriginalTx) throw new Error("Missing data");

      // GAP 7: Block refund if original has no fiscal receipt number
      if (!selectedOriginalTx.fiscal_receipt_number) {
        throw new Error(t("noFiscalReceipt" as any));
      }

      const selectedItems = refundItems.filter(i => i.selected && i.quantity > 0);
      if (selectedItems.length === 0) throw new Error("No items selected for refund");

      // CR-CRIT-4: Extract tax from inclusive price (same as sale calculation)
      const refundTotal = selectedItems.reduce((s, i) => s + i.unit_price * i.quantity, 0);
      const refundTax = selectedItems.reduce((s, i) => s + (i.unit_price * i.quantity * i.tax_rate) / (100 + i.tax_rate), 0);
      const refundSubtotal = refundTotal - refundTax;

      const { data: seqNum } = await supabase.rpc("next_invoice_number" as any, {
        p_tenant_id: tenantId,
        p_prefix: "REF-",
      });
      const txNum = seqNum || `REF-${Date.now()}`;

      // Create refund transaction
      const { data: tx, error: txErr } = await supabase.from("pos_transactions").insert({
        session_id: activeSession.id,
        tenant_id: tenantId,
        transaction_number: txNum,
        items: selectedItems.map(i => ({
          name: i.name,
          quantity: i.quantity,
          unit_price: i.unit_price,
          tax_rate: i.tax_rate,
        })) as any,
        subtotal: refundSubtotal,
        tax_amount: refundTax,
        total: refundTotal,
        payment_method: selectedOriginalTx.payment_method || "cash",
        receipt_type: "refund",
        original_transaction_id: selectedOriginalTx.id,
        status: "pending_fiscal",
        location_id: activeSession.location_id || null,
        warehouse_id: activeSession.warehouse_id || null,
        salesperson_id: identifiedSeller?.id || activeSession.salesperson_id || null,
      } as any).select().single();

      if (txErr || !tx) throw new Error(txErr?.message || "Failed to create refund");

      // Fiscalize refund receipt
      if (fiscalDevices.length > 0) {
        try {
          const { data: result, error: fiscalErr } = await supabase.functions.invoke("fiscalize-receipt", {
            body: {
              transaction_id: tx.id,
              tenant_id: tenantId,
              device_id: fiscalDevices[0].id,
              items: selectedItems.map(i => ({
                name: i.name,
                quantity: i.quantity,
                unit_price: i.unit_price,
                tax_rate: i.tax_rate,
                total_amount: i.unit_price * i.quantity,
              })),
              payments: [{ amount: refundTotal, method: selectedOriginalTx.payment_method || "cash" }],
              receipt_type: "refund",
              transaction_type: "refund",
              referent_receipt_number: selectedOriginalTx.fiscal_receipt_number,
              referent_receipt_date: selectedOriginalTx.created_at ? new Date(selectedOriginalTx.created_at).toISOString().split("T")[0] : undefined,
            },
          });

          if (fiscalErr) throw fiscalErr;

          if (result?.receipt_number) {
            setLastReceipt({ number: result.receipt_number, qr: result.qr_code_url });
            await supabase.from("pos_transactions").update({ status: "fiscalized" }).eq("id", tx.id);
          }
        } catch (e) {
          console.error("Refund fiscalization failed:", e);
          await supabase.from("pos_transactions").update({ status: "fiscal_failed" }).eq("id", tx.id);
          throw new Error("Fiskalizacija povraćaja nije uspela.");
        }
      } else {
        await supabase.from("pos_transactions").update({ status: "fiscalized" }).eq("id", tx.id);
      }

      // Restore physical stock for refunded items
      const warehouseId = activeSession.warehouse_id;
      if (warehouseId) {
        for (const item of selectedItems) {
          const product = products.find((p: any) => p.name === item.name);
          if (product?.id) {
            try {
              await supabase.rpc("adjust_inventory_stock", {
                p_tenant_id: tenantId,
                p_product_id: product.id,
                p_warehouse_id: warehouseId,
                p_quantity: item.quantity,
                p_reference: `POS refund ${txNum}`,
              });
            } catch (e) {
              console.warn("Stock restoration failed for product:", product.id, e);
            }
          }
        }
      }

      // GAP 3: Bridge cash refund to cash register
      if ((selectedOriginalTx.payment_method || "cash") === "cash") {
        try {
          await supabase.from("cash_register").insert({
            tenant_id: tenantId,
            entry_number: `POS-REF-${tx.transaction_number}`,
            entry_date: new Date().toISOString().split("T")[0],
            direction: "out",
            amount: refundTotal,
            description: `POS refund ${tx.transaction_number}`,
            created_by: user?.id || null,
            pos_transaction_id: tx.id,
            source: "pos",
          } as any);
        } catch (e) {
          console.warn("Cash register bridge failed for refund:", e);
        }
      }

      return tx;
    },
    onSuccess: () => {
      setRefundDialogOpen(false);
      setSelectedOriginalTx(null);
      setRefundItems([]);
      queryClient.invalidateQueries({ queryKey: ["pos_transactions"] });
      queryClient.invalidateQueries({ queryKey: ["pos_recent_transactions"] });
      toast({ title: t("refundSuccess") });
    },
    onError: (e: any) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const completeSale = useMutation({
    mutationFn: async () => {
      if (!tenantId || !activeSession) throw new Error("No active session");
      const txNum = `POS-${Date.now()}`;

      // Step 1: Insert transaction with pending_fiscal status
      const { data: tx, error: txErr } = await supabase.from("pos_transactions").insert({
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
        salesperson_id: identifiedSeller?.id || activeSession.salesperson_id || null,
        buyer_id: buyerId || null,
        buyer_partner_id: buyerPartnerId || null,
        receipt_type: "sale",
        status: "pending_fiscal",
        voucher_type: voucherType || null,
      } as any).select().single();

      if (txErr || !tx) throw new Error(txErr?.message || "Failed to create transaction");

      // Step 2: Fiscalize first (if fiscal device available)
      let fiscalized = false;
      let offlineReceipt = false;

      if (fiscalDevices.length > 0) {
        try {
          const { data: result, error: fiscalErr } = await supabase.functions.invoke("fiscalize-receipt", {
            body: {
              transaction_id: tx.id,
              tenant_id: tenantId,
              device_id: fiscalDevices[0].id,
              items: cart.map(c => ({
                name: c.name,
                quantity: c.quantity,
                unit_price: c.unit_price,
                tax_rate: voucherType === "multi_purpose" ? 0 : c.tax_rate,
                total_amount: c.unit_price * c.quantity,
              })),
              payments: [{ amount: total, method: paymentMethod }],
              buyer_id: buyerId || null,
              receipt_type: "normal",
              transaction_type: "sale",
              voucher_type: voucherType || null,
            },
          });

          if (fiscalErr) throw fiscalErr;

          if (result?.receipt_number) {
            setLastReceipt({ number: result.receipt_number, qr: result.qr_code_url });
            fiscalized = true;
            offlineReceipt = !!result.offline;

            await supabase.from("pos_transactions")
              .update({ status: "fiscalized" })
              .eq("id", tx.id);
          }
        } catch (e) {
          console.error("Fiscalization failed:", e);
          await supabase.from("pos_transactions")
            .update({ status: "fiscal_failed" })
            .eq("id", tx.id);
          throw new Error("Fiskalizacija nije uspela. Transakcija nije proknjižena.");
        }
      } else {
        fiscalized = true;
        await supabase.from("pos_transactions")
          .update({ status: "fiscalized" })
          .eq("id", tx.id);
      }

      // Step 3: Only post accounting after successful fiscalization
      if (fiscalized) {
        // Step 3a: Atomically consume FIFO layers + deduct stock via RPC
        const warehouseId = activeSession.warehouse_id;
        if (warehouseId) {
          const posItems = cart
            .filter((item) => item.product_id)
            .map((item) => ({
              product_id: item.product_id,
              quantity: item.quantity,
              name: item.name,
            }));

          // P1-03 FIX: Removed redundant complete_pos_transaction call.
          // Stock deduction is handled atomically by process_pos_sale below.
        }

        // Step 3b: Post accounting entry
        try {
          await supabase.rpc("process_pos_sale", {
            p_transaction_id: tx.id,
            p_tenant_id: tenantId,
          });
        } catch (e) {
          console.error("POS accounting failed:", e);
          toast({ title: "Upozorenje", description: "Fiskalni račun je izdat ali knjiženje nije uspelo. Kontaktirajte administratora.", variant: "destructive" });
        }

        // GAP 3: Bridge cash sale to cash register
        if (paymentMethod === "cash") {
          try {
            await supabase.from("cash_register").insert({
              tenant_id: tenantId,
              entry_number: `POS-${txNum}`,
              entry_date: new Date().toISOString().split("T")[0],
              direction: "in",
              amount: total,
              description: `POS sale ${txNum}`,
              created_by: user?.id || null,
              pos_transaction_id: tx.id,
              source: "pos",
            } as any);
          } catch (e) {
            console.warn("Cash register bridge failed:", e);
          }
        }
      }

      return tx;
    },
    onSuccess: (tx: any) => {
      // Accrue loyalty points if buyer partner is linked
      if (buyerPartnerId && tx?.total) {
        supabase.rpc("accrue_loyalty_points", {
          p_tenant_id: tenantId!,
          p_partner_id: buyerPartnerId,
          p_amount: tx.total,
          p_reference_type: "pos_sale",
          p_reference_id: tx.id,
        }).then(({ data }) => {
          if (data && typeof data === "object" && (data as any).ok && (data as any).points > 0) {
            toast({ title: `${t("pointsEarned" as any)}: +${(data as any).points}` });
          }
        });
      }
      setCart([]);
      setCustomerName("");
      setBuyerId("");
      setBuyerPartnerId(null);
      queryClient.invalidateQueries({ queryKey: ["pos_transactions"] });
      toast({ title: t("posTransactionComplete") });
    },
    onError: (e: any) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  // No active session
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

  // PIN gate
  const hasPinSalespeople = locationSalespeople.filter((sp: any) => sp.pos_pin);
  if (hasPinSalespeople.length > 0 && !identifiedSeller) {
    return (
      <PosPinDialog
        salespeople={hasPinSalespeople}
        onIdentified={(sp) => setIdentifiedSeller({ id: sp.id, first_name: sp.first_name, last_name: sp.last_name })}
      />
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 h-[calc(100vh-8rem)]">
      {/* Product Grid / Refund List */}
      <div className="flex-1 flex flex-col space-y-4">
        {/* Session info bar */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
          <Badge variant="outline">{(activeSession as any).locations?.name || t("location")}</Badge>
          {(activeSession as any).salespeople && (
            <Badge variant="outline">{(activeSession as any).salespeople.first_name} {(activeSession as any).salespeople.last_name}</Badge>
          )}
          {fiscalDevices.length > 0 && <Badge variant="default" className="text-xs">{t("fiscalDevice")}: {fiscalDevices[0].device_name}</Badge>}
          {identifiedSeller && (
            <Badge variant="secondary">
              {identifiedSeller.first_name} {identifiedSeller.last_name}
            </Badge>
          )}
          {hasPinSalespeople.length > 0 && identifiedSeller && (
            <Button size="sm" variant="ghost" className="gap-1" onClick={() => setIdentifiedSeller(null)}>
              <RefreshCw className="h-3 w-3" />
              {t("switchSeller")}
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="gap-1"
            onClick={() => setReprintDialogOpen(true)}
          >
            <Printer className="h-3 w-3" />
            {t("receiptReprint" as any) || "Reprint"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1"
            onClick={() => setXReportOpen(true)}
          >
            <ClipboardList className="h-3 w-3" />
            X-{t("report" as any) || "Izveštaj"}
          </Button>
          <ActionGuard module="pos" action="delete">
            <Button
              size="sm"
              variant={refundMode ? "destructive" : "outline"}
              className="ml-auto gap-1"
              onClick={() => setRefundMode(!refundMode)}
            >
              <Undo2 className="h-3 w-3" />
              {t("refundMode")}
            </Button>
          </ActionGuard>
        </div>

        {refundMode ? (
          /* Refund: show recent transactions */
          <div className="flex-1 overflow-y-auto space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{t("selectOriginalReceipt")}</p>
            {recentTransactions.length === 0 && (
              <p className="text-sm text-muted-foreground">{t("noReceiptsToRefund")}</p>
            )}
            {recentTransactions.map((tx: any) => (
              <Card key={tx.id} className="cursor-pointer hover:bg-accent transition-colors" onClick={() => openRefundDialog(tx)}>
                <CardContent className="p-3 flex items-center justify-between">
                  <div>
                    <p className="font-mono text-sm font-medium">{tx.transaction_number}</p>
                    <p className="text-xs text-muted-foreground">{new Date(tx.created_at).toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{Number(tx.total).toFixed(2)}</p>
                    <Badge variant="outline" className="text-xs">{tx.payment_method}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          /* Normal sale: product grid */
          <>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder={t("search")} value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            {/* POS-3: Category navigation bar */}
            {categories.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
                <Button size="sm" variant={!selectedCategory ? "default" : "outline"} onClick={() => setSelectedCategory(null)} className="shrink-0">
                  {t("all")}
                </Button>
                {categories.map((cat: any) => (
                  <Button key={cat.id} size="sm" variant={selectedCategory === cat.id ? "default" : "outline"} onClick={() => setSelectedCategory(cat.id)} className="shrink-0">
                    {cat.name}
                  </Button>
                ))}
              </div>
            )}
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
          </>
        )}
      </div>

      {/* Cart (only in sale mode) */}
      {!refundMode && (
        <Card className="w-full sm:w-96 flex flex-col">
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
                    <Button size="icon" variant="ghost" className="h-7 w-7" title="Zahtev za popust" onClick={() => { setDiscountItemId(item.product_id); setDiscountDialogOpen(true); }}><Tag className="h-3 w-3" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeFromCart(item.product_id)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t pt-4 mt-4 space-y-2">
              <Input placeholder={t("customerName")} value={customerName} onChange={e => setCustomerName(e.target.value)} />
              <EntitySelector
                options={partnerOptions}
                value={buyerPartnerId}
                onValueChange={(val) => {
                  setBuyerPartnerId(val);
                  if (val) {
                    const partner = partners.find((p: any) => p.id === val);
                    if (partner?.pib) setBuyerId(partner.pib);
                  }
                }}
                placeholder={t("selectBuyerPartner" as any)}
              />
              <Input placeholder={t("buyerId")} value={buyerId} onChange={e => setBuyerId(e.target.value)} />
              {/* POS-04: Loyalty member lookup */}
              <div className="flex gap-2">
                <Input
                  placeholder="Lojalti telefon / kartica"
                  value={loyaltySearch}
                  onChange={e => setLoyaltySearch(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") lookupLoyaltyMember(loyaltySearch); }}
                  className="flex-1"
                />
                <Button size="sm" variant="outline" onClick={() => lookupLoyaltyMember(loyaltySearch)}>
                  <Star className="h-3 w-3" />
                </Button>
              </div>
              {loyaltyMember && (
                <div className="p-2 rounded-md bg-accent/50 border text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium flex items-center gap-1"><Star className="h-3 w-3 text-warning" /> Lojalti član</span>
                    <Badge variant="outline" className="text-xs">{loyaltyMember.current_tier || "Bronze"}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Bodovi: <strong>{loyaltyMember.points_balance || 0}</strong></span>
                    <Button size="sm" variant="ghost" className="h-5 text-xs px-1" onClick={() => { setLoyaltyMember(null); setLoyaltySearch(""); }}>×</Button>
                  </div>
                </div>
              )}
              <div className="flex gap-2 flex-wrap">
                {["cash", "card", "wire_transfer", "voucher", "mobile"].map(m => (
                  <Button key={m} size="sm" variant={paymentMethod === m ? "default" : "outline"} onClick={() => {
                    setPaymentMethod(m);
                    if (m !== "voucher") setVoucherType(null);
                  }}>{t(m as any)}</Button>
                ))}
                <Button size="sm" variant="outline" className="gap-1" onClick={() => setSplitPaymentOpen(true)}>
                  <Split className="h-3 w-3" />{t("split" as any) || "Podeli"}
                </Button>
              </div>
              {paymentMethod === "voucher" && (
                <div className="flex gap-2">
                  <Button size="sm" variant={voucherType === "single_purpose" ? "default" : "outline"} onClick={() => setVoucherType("single_purpose")}>{t("singlePurpose")}</Button>
                  <Button size="sm" variant={voucherType === "multi_purpose" ? "default" : "outline"} onClick={() => setVoucherType("multi_purpose")}>{t("multiPurpose")}</Button>
                </div>
              )}
              {paymentMethod === "cash" && cart.length > 0 && (
                <CashChangeCalculator total={total} />
              )}
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span>{t("subtotal")}</span><span>{subtotal.toFixed(2)}</span></div>
                <div className="flex justify-between"><span>{t("taxAmount")}</span><span>{taxAmount.toFixed(2)}</span></div>
                <div className="flex justify-between font-bold text-lg"><span>{t("total")}</span><span>{total.toFixed(2)}</span></div>
              </div>
              <Button className="w-full" size="lg" disabled={cart.length === 0} onClick={() => completeSale.mutate()}>
                <Receipt className="h-4 w-4 mr-2" />{t("completeSale")}
              </Button>

              {lastReceipt && (
                <div className="p-3 rounded-md bg-accent text-sm space-y-1">
                  <p className="font-medium">{t("fiscalReceiptNumber")}: {lastReceipt.number}</p>
                  {lastReceipt.qr && <a href={lastReceipt.qr} target="_blank" rel="noopener noreferrer" className="text-primary underline text-xs">{t("qrCode")}</a>}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Refund Dialog */}
      <Dialog open={refundDialogOpen} onOpenChange={setRefundDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("refund")}: {selectedOriginalTx?.transaction_number}</DialogTitle>
            {selectedOriginalTx?.fiscal_receipt_number && (
              <p className="text-xs text-muted-foreground">{t("fiscalReceiptRef" as any)}: {selectedOriginalTx.fiscal_receipt_number}</p>
            )}
            {!selectedOriginalTx?.fiscal_receipt_number && (
              <p className="text-xs text-destructive">{t("noFiscalReceipt" as any)}</p>
            )}
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{t("refundItems")}</p>
            {refundItems.map((item, idx) => (
              <div key={idx} className="flex items-center gap-3 p-2 border rounded-md">
                <Checkbox
                  checked={item.selected}
                  onCheckedChange={(checked) => {
                    setRefundItems(prev => prev.map((it, i) => i === idx ? { ...it, selected: !!checked } : it));
                  }}
                />
                <div className="flex-1">
                  <p className="text-sm font-medium">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{item.unit_price.toFixed(2)} × </p>
                </div>
                <Input
                  type="number"
                  min={1}
                  max={item.maxQuantity}
                  value={item.quantity}
                  onChange={e => {
                    const val = Math.min(Math.max(1, parseInt(e.target.value) || 1), item.maxQuantity);
                    setRefundItems(prev => prev.map((it, i) => i === idx ? { ...it, quantity: val } : it));
                  }}
                  className="w-16 h-8 text-center"
                />
              </div>
            ))}
            <div className="border-t pt-3 space-y-1 text-sm">
              <div className="flex justify-between font-bold">
                <span>{t("total")}</span>
                <span>
                  {refundItems
                    .filter(i => i.selected)
                    .reduce((s, i) => s + i.unit_price * i.quantity, 0)
                    .toFixed(2)}
                </span>
              </div>
            </div>
            <Button
              className="w-full"
              variant="destructive"
              disabled={refundItems.filter(i => i.selected).length === 0 || processRefund.isPending}
              onClick={() => processRefund.mutate()}
            >
              <Undo2 className="h-4 w-4 mr-2" />
              {t("processRefund")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Receipt Reprint Dialog */}
      <ReceiptReprintDialog open={reprintDialogOpen} onOpenChange={setReprintDialogOpen} />
      <PosXReportDialog open={xReportOpen} onOpenChange={setXReportOpen} sessionId={activeSession?.id || null} />
      <SplitPaymentDialog open={splitPaymentOpen} onOpenChange={setSplitPaymentOpen} total={total} onConfirm={(payments) => { setPaymentMethod(payments[0]?.method || "cash"); completeSale.mutate(); }} />

      {/* POS-01: Discount Override Request Dialog */}
      <Dialog open={discountDialogOpen} onOpenChange={setDiscountDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Zahtev za popust</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {cart.find(c => c.product_id === discountItemId)?.name || ""}
              {" — "}
              {cart.find(c => c.product_id === discountItemId)?.unit_price.toFixed(2) || "0.00"} RSD
            </p>
            <div>
              <Label>Popust (%)</Label>
              <Input type="number" min={1} max={100} value={discountPct} onChange={e => setDiscountPct(e.target.value)} placeholder="npr. 15" />
            </div>
            <div>
              <Label>Razlog</Label>
              <Textarea value={discountReason} onChange={e => setDiscountReason(e.target.value)} placeholder="Razlog za popust..." rows={2} />
            </div>
            <Button className="w-full" onClick={submitDiscountOverride} disabled={!discountPct}>
              <Tag className="h-4 w-4 mr-2" />
              Pošalji zahtev
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
