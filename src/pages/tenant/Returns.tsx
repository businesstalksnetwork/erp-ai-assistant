import { useLanguage } from "@/i18n/LanguageContext";
import { ActionGuard } from "@/components/ActionGuard";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { postWithRuleOrFallback } from "@/lib/postingHelper";

const RETURN_STATUSES = ["draft", "inspecting", "approved", "resolved", "cancelled"] as const;
const REASONS = ["defective", "wrong_item", "damaged", "not_needed", "other"] as const;
const INSPECTION_STATUSES = ["pending", "accepted", "rejected"] as const;
const CREDIT_STATUSES = ["draft", "issued", "applied"] as const;
const SHIPMENT_STATUSES = ["pending", "shipped", "acknowledged", "credited"] as const;

interface ReturnLine {
  product_id: string | null;
  description: string;
  quantity_returned: number;
  quantity_accepted: number;
  reason: string;
  inspection_status: string;
  notes: string;
}

interface ReturnForm {
  case_number: string;
  return_type: string;
  source_type: string;
  source_id: string;
  partner_id: string | null;
  status: string;
  notes: string;
  lines: ReturnLine[];
}

const emptyLine: ReturnLine = { product_id: null, description: "", quantity_returned: 1, quantity_accepted: 0, reason: "other", inspection_status: "pending", notes: "" };
const emptyForm: ReturnForm = {
  case_number: "", return_type: "customer", source_type: "invoice", source_id: "",
  partner_id: null, status: "draft", notes: "", lines: [{ ...emptyLine }],
};

interface CreditNoteForm {
  credit_number: string;
  return_case_id: string | null;
  invoice_id: string | null;
  amount: number;
  tax_amount: number;
  currency: string;
  status: string;
  notes: string;
}

const emptyCreditForm: CreditNoteForm = {
  credit_number: "", return_case_id: null, invoice_id: null,
  amount: 0, tax_amount: 0, currency: "RSD", status: "draft", notes: "",
};

interface ShipmentForm {
  shipment_number: string;
  return_case_id: string | null;
  purchase_order_id: string | null;
  warehouse_id: string | null;
  status: string;
  tracking_number: string;
  notes: string;
}

const emptyShipmentForm: ShipmentForm = {
  shipment_number: "", return_case_id: null, purchase_order_id: null,
  warehouse_id: null, status: "pending", tracking_number: "", notes: "",
};

export default function Returns() {
  const { t, locale } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const qc = useQueryClient();

  // Return Cases state
  const [rcOpen, setRcOpen] = useState(false);
  const [rcEditId, setRcEditId] = useState<string | null>(null);
  const [rcForm, setRcForm] = useState<ReturnForm>(emptyForm);

  // Credit Notes state
  const [cnOpen, setCnOpen] = useState(false);
  const [cnEditId, setCnEditId] = useState<string | null>(null);
  const [cnForm, setCnForm] = useState<CreditNoteForm>(emptyCreditForm);

  // Supplier Return Shipments state
  const [srOpen, setSrOpen] = useState(false);
  const [srEditId, setSrEditId] = useState<string | null>(null);
  const [srForm, setSrForm] = useState<ShipmentForm>(emptyShipmentForm);

  // Queries
  const { data: returnCases = [], isLoading: rcLoading } = useQuery({
    queryKey: ["return-cases", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("return_cases").select("*, partners(name)").eq("tenant_id", tenantId!).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: creditNotes = [], isLoading: cnLoading } = useQuery({
    queryKey: ["credit-notes", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("credit_notes").select("*, return_cases(case_number)").eq("tenant_id", tenantId!).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: shipments = [], isLoading: srLoading } = useQuery({
    queryKey: ["supplier-return-shipments", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("supplier_return_shipments").select("*, return_cases(case_number)").eq("tenant_id", tenantId!).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: partners = [] } = useQuery({
    queryKey: ["partners-all", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("partners").select("id, name, type").eq("tenant_id", tenantId!).eq("is_active", true).order("name");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products-list", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("id, name, default_purchase_price, default_sale_price").eq("tenant_id", tenantId!).eq("is_active", true).order("name");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: warehouses = [] } = useQuery({
    queryKey: ["warehouses-list", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("warehouses").select("id, name").eq("tenant_id", tenantId!).eq("is_active", true).order("name");
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Post accounting entries when a return case is resolved
  const postReturnAccounting = async (caseId: string, returnType: string, lines: ReturnLine[]) => {
    if (!tenantId) return;
    const entryDate = new Date().toISOString().split("T")[0];
    const acceptedLines = lines.filter(l => l.quantity_accepted > 0 && l.product_id);

    if (acceptedLines.length === 0) return;

    // Bug 8 fix: Try to find the source warehouse from the linked invoice/sales order
    let restockWarehouse = warehouses[0];
    try {
      const { data: rc } = await supabase.from("return_cases").select("source_type, source_id").eq("id", caseId).eq("tenant_id", tenantId).single();
      if (rc?.source_id && rc.source_id !== "00000000-0000-0000-0000-000000000000") {
        let warehouseId: string | null = null;
        if (rc.source_type === "sales_order") {
          const { data: so } = await supabase.from("sales_orders").select("warehouse_id").eq("id", rc.source_id).eq("tenant_id", tenantId).single();
          warehouseId = so?.warehouse_id ?? null;
        } else if (rc.source_type === "invoice") {
          // Invoices don't have warehouse_id; try to find a linked sales order
          const { data: so } = await supabase.from("sales_orders").select("warehouse_id").eq("invoice_id", rc.source_id).eq("tenant_id", tenantId).limit(1).maybeSingle();
          warehouseId = so?.warehouse_id ?? null;
        }
        if (warehouseId) {
          const match = warehouses.find((w: any) => w.id === warehouseId);
          if (match) restockWarehouse = match;
        }
      }
    } catch { /* fall back to warehouses[0] */ }

    if (returnType === "customer") {
      // Customer return: restock inventory + COGS reversal + credit note journal
      for (const line of acceptedLines) {
        const product = products.find((p: any) => p.id === line.product_id);
        const unitCost = product?.default_purchase_price || 0;
        const unitPrice = product?.default_sale_price || 0;
        const costValue = line.quantity_accepted * unitCost;
        const revenueValue = line.quantity_accepted * unitPrice;

      // Restock inventory atomically via batch RPC
        if (restockWarehouse) {
          await supabase.rpc("batch_adjust_inventory_stock", {
            p_tenant_id: tenantId,
            p_adjustments: [{
              product_id: line.product_id!,
              warehouse_id: restockWarehouse.id,
              quantity: line.quantity_accepted,
              movement_type: "in",
              reference: `RET-${caseId}`,
              notes: `Return restock - ${caseId}`,
              created_by: user?.id || null,
            }],
            p_reference: `RET-${caseId}`,
          });
        }

        // COGS reversal: Debit 1200 (Inventory) / Credit 7000 (COGS)
        if (costValue > 0) {
          await postWithRuleOrFallback({
            tenantId: tenantId!, userId: user?.id || null, entryDate,
            modelCode: "CUSTOMER_RETURN_RESTOCK", amount: costValue,
            description: `Return Restock - ${product?.name || line.product_id}`,
            reference: `RET-RESTOCK-${caseId}`,
            context: {},
            fallbackLines: [
              { accountCode: "1200", debit: costValue, credit: 0, description: `Restock inventory`, sortOrder: 0 },
              { accountCode: "7000", debit: 0, credit: costValue, description: `Reverse COGS`, sortOrder: 1 },
            ],
          });
        }

        // Credit note journal: Debit 4000 (Revenue) / Credit 1200 (AR)
        if (revenueValue > 0) {
          await postWithRuleOrFallback({
            tenantId: tenantId!, userId: user?.id || null, entryDate,
            modelCode: "CUSTOMER_RETURN_CREDIT", amount: revenueValue,
            description: `Credit Note - ${product?.name || line.product_id}`,
            reference: `RET-CN-${caseId}`,
            context: {},
            fallbackLines: [
              { accountCode: "4000", debit: revenueValue, credit: 0, description: `Reverse revenue`, sortOrder: 0 },
              { accountCode: "2040", debit: 0, credit: revenueValue, description: `Credit AR`, sortOrder: 1 },
            ],
          });
        }
      }
    } else {
      // Supplier return: Debit 2100 (AP) / Credit 1200 (Inventory)
      let totalValue = 0;
      for (const line of acceptedLines) {
        const product = products.find((p: any) => p.id === line.product_id);
        totalValue += line.quantity_accepted * (product?.default_purchase_price || 0);
      }

      if (totalValue > 0) {
        await postWithRuleOrFallback({
          tenantId: tenantId!, userId: user?.id || null, entryDate,
          modelCode: "SUPPLIER_RETURN", amount: totalValue,
          description: `Supplier Return - ${caseId}`,
          reference: `RET-SUPP-${caseId}`,
          context: {},
          fallbackLines: [
            { accountCode: "2200", debit: totalValue, credit: 0, description: `Clear AP for return`, sortOrder: 0 },
            { accountCode: "1200", debit: 0, credit: totalValue, description: `Remove returned inventory`, sortOrder: 1 },
          ],
        });
      }
    }
  };

  // Return case mutation
  const rcMutation = useMutation({
    mutationFn: async (f: ReturnForm) => {
      const payload = {
        tenant_id: tenantId!, case_number: f.case_number, return_type: f.return_type,
        source_type: f.source_type, source_id: f.source_id || "00000000-0000-0000-0000-000000000000",
        partner_id: f.partner_id || null, status: f.status, notes: f.notes || null,
      };
      let caseId = rcEditId;
      const previousStatus = rcEditId ? returnCases.find((rc: any) => rc.id === rcEditId)?.status : null;

      if (rcEditId) {
        const { error } = await supabase.from("return_cases").update(payload).eq("id", rcEditId);
        if (error) throw error;
        await supabase.from("return_lines").delete().eq("return_case_id", rcEditId);
      } else {
        const { data, error } = await supabase.from("return_cases").insert([payload]).select("id").single();
        if (error) throw error;
        caseId = data.id;
      }
      if (f.lines.length > 0) {
        const lines = f.lines.map((l, i) => ({
          return_case_id: caseId!, tenant_id: tenantId!, product_id: l.product_id || null,
          description: l.description, quantity_returned: l.quantity_returned,
          quantity_accepted: l.quantity_accepted, reason: l.reason,
          inspection_status: l.inspection_status, notes: l.notes || null, sort_order: i,
        }));
        const { error } = await supabase.from("return_lines").insert(lines);
        if (error) throw error;
      }

      // Post accounting entries when status changes to "resolved"
      if (f.status === "resolved" && previousStatus !== "resolved" && caseId) {
        await postReturnAccounting(caseId, f.return_type, f.lines);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["return-cases"] });
      const wasResolved = rcForm.status === "resolved";
      toast.success(wasResolved ? (t("returnPosted" as any) || t("success")) : t("success"));
      setRcOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Credit note mutation - creates reversal journal entry when status changes to "issued"
  const cnMutation = useMutation({
    mutationFn: async (f: CreditNoteForm) => {
      const previousStatus = cnEditId ? creditNotes.find((cn: any) => cn.id === cnEditId)?.status : null;
      const payload = {
        tenant_id: tenantId!, credit_number: f.credit_number,
        return_case_id: f.return_case_id || null, invoice_id: f.invoice_id || null,
        amount: f.amount, currency: f.currency, status: f.status, notes: f.notes || null,
        issued_at: f.status === "issued" ? new Date().toISOString() : null,
      };
      if (cnEditId) {
        const { error } = await supabase.from("credit_notes").update(payload).eq("id", cnEditId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("credit_notes").insert([payload]).select("id").single();
        if (error) throw error;
      }

      // Create reversal journal entry when credit note is issued
      if (f.status === "issued" && previousStatus !== "issued" && f.amount > 0 && tenantId) {
        const entryDate = new Date().toISOString().split("T")[0];
        const taxAmt = f.tax_amount || 0;
        const netAmt = f.amount - taxAmt;

        const fallbackLines: Array<{ accountCode: string; debit: number; credit: number; description: string; sortOrder: number }> = [
          { accountCode: "6000", debit: netAmt, credit: 0, description: `Reverse revenue - ${f.credit_number}`, sortOrder: 0 },
        ];
        // Bug 1 fix: add VAT reversal line when tax_amount > 0
        if (taxAmt > 0) {
          fallbackLines.push({ accountCode: "4700", debit: taxAmt, credit: 0, description: `Reverse output VAT - ${f.credit_number}`, sortOrder: 1 });
        }
        fallbackLines.push({ accountCode: "2040", debit: 0, credit: f.amount, description: `Credit AR - ${f.credit_number}`, sortOrder: fallbackLines.length });

        await postWithRuleOrFallback({
          tenantId: tenantId!,
          userId: user?.id || null,
          entryDate,
          modelCode: "CREDIT_NOTE_ISSUED", amount: f.amount,
          description: `Credit Note ${f.credit_number} - Revenue reversal`,
          reference: `CN-${f.credit_number}`,
          context: {},
          fallbackLines,
        });

        // Bug 2 fix: Restore inventory if credit note is linked to an invoice
        if (f.invoice_id) {
          try {
            const { data: invLines } = await supabase
              .from("invoice_lines")
              .select("product_id, quantity")
              .eq("invoice_id", f.invoice_id);
            if (invLines && invLines.length > 0) {
              const defaultWh = warehouses[0];
              if (defaultWh) {
                const adjustments = invLines
                  .filter(il => il.product_id && il.quantity > 0)
                  .map(il => ({
                    product_id: il.product_id,
                    warehouse_id: defaultWh.id,
                    quantity: il.quantity,
                    movement_type: "in",
                    notes: `Credit note inventory restore - ${f.credit_number}`,
                    created_by: user?.id || null,
                    reference: `CN-${f.credit_number}`,
                  }));
                if (adjustments.length > 0) {
                  await supabase.rpc("batch_adjust_inventory_stock", {
                    p_tenant_id: tenantId,
                    p_adjustments: adjustments,
                    p_reference: `CN-${f.credit_number}`,
                  });
                }
              }
            }
          } catch (e) {
            console.warn("[CreditNote] Inventory restore failed:", e);
          }
        }

        // Update matching open_item if it exists
        if (f.invoice_id) {
          const { data: openItem } = await supabase
            .from("open_items")
            .select("id, remaining_amount, paid_amount")
            .eq("document_id", f.invoice_id)
            .eq("tenant_id", tenantId)
            .single();
          if (openItem) {
            const newRemaining = Math.max(Number(openItem.remaining_amount) - f.amount, 0);
            if (Number(openItem.remaining_amount) < f.amount) {
              console.warn(`[CreditNote] Credit amount ${f.amount} exceeds remaining ${openItem.remaining_amount} on open item ${openItem.id}`);
            }
            const newPaid = Number(openItem.paid_amount) + f.amount;
            await supabase.from("open_items").update({
              remaining_amount: newRemaining,
              paid_amount: newPaid,
              status: newRemaining <= 0 ? "closed" : "partial",
              closed_at: newRemaining <= 0 ? new Date().toISOString() : null,
            }).eq("id", openItem.id);
          }
        }
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["credit-notes"] }); setCnOpen(false); toast.success(t("success")); },
    onError: (e: Error) => toast.error(e.message),
  });

  // Supplier return shipment mutation
  const srMutation = useMutation({
    mutationFn: async (f: ShipmentForm) => {
      const payload = {
        tenant_id: tenantId!, shipment_number: f.shipment_number,
        return_case_id: f.return_case_id || null, purchase_order_id: f.purchase_order_id || null,
        warehouse_id: f.warehouse_id || null, status: f.status,
        tracking_number: f.tracking_number || null, notes: f.notes || null,
        shipped_at: f.status === "shipped" ? new Date().toISOString() : null,
      };
      if (srEditId) {
        const { error } = await supabase.from("supplier_return_shipments").update(payload).eq("id", srEditId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("supplier_return_shipments").insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["supplier-return-shipments"] }); setSrOpen(false); toast.success(t("success")); },
    onError: (e: Error) => toast.error(e.message),
  });

  const openRcAdd = () => { setRcEditId(null); setRcForm(emptyForm); setRcOpen(true); };
  const openRcEdit = async (rc: any) => {
    setRcEditId(rc.id);
    const { data: lines } = await supabase.from("return_lines").select("*").eq("return_case_id", rc.id).order("sort_order");
    setRcForm({
      case_number: rc.case_number, return_type: rc.return_type, source_type: rc.source_type,
      source_id: rc.source_id, partner_id: rc.partner_id, status: rc.status, notes: rc.notes || "",
      lines: lines?.map(l => ({
        product_id: l.product_id, description: l.description, quantity_returned: l.quantity_returned,
        quantity_accepted: l.quantity_accepted, reason: l.reason, inspection_status: l.inspection_status, notes: l.notes || "",
      })) || [{ ...emptyLine }],
    });
    setRcOpen(true);
  };

  const statusColor = (s: string) => {
    if (s === "approved" || s === "resolved" || s === "issued" || s === "applied" || s === "acknowledged" || s === "credited") return "default";
    if (s === "cancelled" || s === "rejected") return "destructive";
    if (s === "inspecting" || s === "shipped") return "outline";
    return "secondary";
  };

  const fmt = (n: number, cur: string) => new Intl.NumberFormat("sr-RS", { style: "currency", currency: cur }).format(n);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("returns")}</h1>

      <Tabs defaultValue="cases">
        <TabsList>
          <TabsTrigger value="cases">{t("returnCases")}</TabsTrigger>
          <TabsTrigger value="credits">{t("creditNotes")}</TabsTrigger>
          <TabsTrigger value="shipments">{t("supplierReturns")}</TabsTrigger>
        </TabsList>

        {/* RETURN CASES TAB */}
        <TabsContent value="cases" className="space-y-4">
          <div className="flex justify-end">
            <ActionGuard module="inventory" action="create"><Button onClick={openRcAdd}><Plus className="h-4 w-4 mr-2" />{t("add")}</Button></ActionGuard>
          </div>
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>{t("returnType")}</TableHead>
                  <TableHead>{t("partner")}</TableHead>
                  <TableHead>{t("sourceDocument")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead>{t("createdAt")}</TableHead>
                  <TableHead>{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rcLoading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
                ) : returnCases.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">{t("noResults")}</TableCell></TableRow>
                ) : returnCases.map((rc: any) => (
                  <TableRow key={rc.id}>
                    <TableCell className="font-medium">{rc.case_number}</TableCell>
                    <TableCell>{t(rc.return_type as any)}</TableCell>
                    <TableCell>{rc.partners?.name || "—"}</TableCell>
                    <TableCell>{rc.source_type}</TableCell>
                    <TableCell><Badge variant={statusColor(rc.status) as any}>{t(rc.status as any) || rc.status}</Badge></TableCell>
                    <TableCell>{new Date(rc.created_at).toLocaleDateString()}</TableCell>
                    <TableCell><Button size="sm" variant="ghost" onClick={() => openRcEdit(rc)}>{t("edit")}</Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        {/* CREDIT NOTES TAB */}
        <TabsContent value="credits" className="space-y-4">
          <div className="flex justify-end">
            <ActionGuard module="inventory" action="create"><Button onClick={() => { setCnEditId(null); setCnForm(emptyCreditForm); setCnOpen(true); }}><Plus className="h-4 w-4 mr-2" />{t("add")}</Button></ActionGuard>
          </div>
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>{t("returnCase")}</TableHead>
                  <TableHead className="text-right">{t("creditAmount")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead>{t("createdAt")}</TableHead>
                  <TableHead>{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cnLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
                ) : creditNotes.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">{t("noResults")}</TableCell></TableRow>
                ) : creditNotes.map((cn: any) => (
                  <TableRow key={cn.id}>
                    <TableCell className="font-medium">{cn.credit_number}</TableCell>
                    <TableCell>{cn.return_cases?.case_number || "—"}</TableCell>
                    <TableCell className="text-right">{fmt(cn.amount, cn.currency)}</TableCell>
                    <TableCell><Badge variant={statusColor(cn.status) as any}>{t(cn.status as any) || cn.status}</Badge></TableCell>
                    <TableCell>{new Date(cn.created_at).toLocaleDateString()}</TableCell>
                    <TableCell><Button size="sm" variant="ghost" onClick={() => {
                      setCnEditId(cn.id);
                      setCnForm({ credit_number: cn.credit_number, return_case_id: cn.return_case_id, invoice_id: cn.invoice_id, amount: cn.amount, tax_amount: 0, currency: cn.currency, status: cn.status, notes: cn.notes || "" });
                      setCnOpen(true);
                    }}>{t("edit")}</Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        {/* SUPPLIER RETURN SHIPMENTS TAB */}
        <TabsContent value="shipments" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => { setSrEditId(null); setSrForm(emptyShipmentForm); setSrOpen(true); }}><Plus className="h-4 w-4 mr-2" />{t("add")}</Button>
          </div>
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>{t("returnCase")}</TableHead>
                  <TableHead>{t("trackingNumber")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead>{t("createdAt")}</TableHead>
                  <TableHead>{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {srLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
                ) : shipments.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">{t("noResults")}</TableCell></TableRow>
                ) : shipments.map((sr: any) => (
                  <TableRow key={sr.id}>
                    <TableCell className="font-medium">{sr.shipment_number}</TableCell>
                    <TableCell>{sr.return_cases?.case_number || "—"}</TableCell>
                    <TableCell>{sr.tracking_number || "—"}</TableCell>
                    <TableCell><Badge variant={statusColor(sr.status) as any}>{t(sr.status as any) || sr.status}</Badge></TableCell>
                    <TableCell>{new Date(sr.created_at).toLocaleDateString()}</TableCell>
                    <TableCell><Button size="sm" variant="ghost" onClick={() => {
                      setSrEditId(sr.id);
                      setSrForm({ shipment_number: sr.shipment_number, return_case_id: sr.return_case_id, purchase_order_id: sr.purchase_order_id, warehouse_id: sr.warehouse_id, status: sr.status, tracking_number: sr.tracking_number || "", notes: sr.notes || "" });
                      setSrOpen(true);
                    }}>{t("edit")}</Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      {/* RETURN CASE DIALOG */}
      <Dialog open={rcOpen} onOpenChange={setRcOpen}>
        <DialogContent className="w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{rcEditId ? t("edit") : t("add")} — {t("returnCase")}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2"><Label>{t("caseNumber")} *</Label><Input value={rcForm.case_number} onChange={(e) => setRcForm({ ...rcForm, case_number: e.target.value })} /></div>
              <div className="grid gap-2">
                <Label>{t("returnType")}</Label>
                <Select value={rcForm.return_type} onValueChange={(v) => setRcForm({ ...rcForm, return_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="customer">{t("customer")}</SelectItem>
                    <SelectItem value="supplier">{t("supplier")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>{t("status")}</Label>
                <Select value={rcForm.status} onValueChange={(v) => setRcForm({ ...rcForm, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RETURN_STATUSES.map(s => <SelectItem key={s} value={s}>{t(s as any) || s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label>{t("sourceDocument")}</Label>
                <Select value={rcForm.source_type} onValueChange={(v) => setRcForm({ ...rcForm, source_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="invoice">{t("invoices")}</SelectItem>
                    <SelectItem value="sales_order">{t("salesOrders")}</SelectItem>
                    <SelectItem value="purchase_order">{t("purchaseOrders")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>{t("partner")}</Label>
                <Select value={rcForm.partner_id || "__none"} onValueChange={(v) => setRcForm({ ...rcForm, partner_id: v === "__none" ? null : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">—</SelectItem>
                    {partners.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2"><Label>Source ID</Label><Input value={rcForm.source_id} onChange={(e) => setRcForm({ ...rcForm, source_id: e.target.value })} placeholder="UUID" /></div>
            </div>

            {/* Return lines */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">{t("lineItems")}</Label>
                <Button size="sm" variant="outline" onClick={() => setRcForm({ ...rcForm, lines: [...rcForm.lines, { ...emptyLine }] })}><Plus className="h-3 w-3 mr-1" />{t("addLine")}</Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("product")}</TableHead>
                    <TableHead className="w-20">{t("quantityReturned")}</TableHead>
                    <TableHead className="w-20">{t("quantityAccepted")}</TableHead>
                    <TableHead>{t("reason")}</TableHead>
                    <TableHead>{t("inspectionStatus")}</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rcForm.lines.map((line, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <Select value={line.product_id || "__none"} onValueChange={(v) => {
                          const lines = [...rcForm.lines];
                          lines[idx] = { ...lines[idx], product_id: v === "__none" ? null : v, description: products.find((p: any) => p.id === v)?.name || lines[idx].description };
                          setRcForm({ ...rcForm, lines });
                        }}>
                          <SelectTrigger className="h-8"><SelectValue placeholder={t("selectProduct")} /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none">{t("manual")}</SelectItem>
                            {products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell><Input className="h-8" type="number" value={line.quantity_returned} onChange={(e) => { const lines = [...rcForm.lines]; lines[idx] = { ...lines[idx], quantity_returned: +e.target.value }; setRcForm({ ...rcForm, lines }); }} /></TableCell>
                      <TableCell><Input className="h-8" type="number" value={line.quantity_accepted} onChange={(e) => { const lines = [...rcForm.lines]; lines[idx] = { ...lines[idx], quantity_accepted: +e.target.value }; setRcForm({ ...rcForm, lines }); }} /></TableCell>
                      <TableCell>
                        <Select value={line.reason} onValueChange={(v) => { const lines = [...rcForm.lines]; lines[idx] = { ...lines[idx], reason: v }; setRcForm({ ...rcForm, lines }); }}>
                          <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {REASONS.map(r => <SelectItem key={r} value={r}>{t(r as any) || r}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select value={line.inspection_status} onValueChange={(v) => { const lines = [...rcForm.lines]; lines[idx] = { ...lines[idx], inspection_status: v }; setRcForm({ ...rcForm, lines }); }}>
                          <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {INSPECTION_STATUSES.map(s => <SelectItem key={s} value={s}>{t(s as any) || s}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {rcForm.lines.length > 1 && (
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setRcForm({ ...rcForm, lines: rcForm.lines.filter((_, i) => i !== idx) })}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="grid gap-2"><Label>{t("notes")}</Label><Textarea value={rcForm.notes} onChange={(e) => setRcForm({ ...rcForm, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRcOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => rcMutation.mutate(rcForm)} disabled={!rcForm.case_number || rcMutation.isPending}>
              {rcMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CREDIT NOTE DIALOG */}
      <Dialog open={cnOpen} onOpenChange={setCnOpen}>
        <DialogContent className="w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{cnEditId ? t("edit") : t("add")} — {t("creditNote")}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2"><Label>{t("creditNumber")} *</Label><Input value={cnForm.credit_number} onChange={(e) => setCnForm({ ...cnForm, credit_number: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{t("returnCase")}</Label>
                <Select value={cnForm.return_case_id || "__none"} onValueChange={(v) => setCnForm({ ...cnForm, return_case_id: v === "__none" ? null : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">—</SelectItem>
                    {returnCases.map((rc: any) => <SelectItem key={rc.id} value={rc.id}>{rc.case_number}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>{t("status")}</Label>
                <Select value={cnForm.status} onValueChange={(v) => setCnForm({ ...cnForm, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CREDIT_STATUSES.map(s => <SelectItem key={s} value={s}>{t(s as any) || s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>{t("creditAmount")}</Label><Input type="number" value={cnForm.amount} onChange={(e) => setCnForm({ ...cnForm, amount: +e.target.value })} /></div>
              <div className="grid gap-2"><Label>{locale === "sr" ? "PDV iznos" : "Tax Amount"}</Label><Input type="number" value={cnForm.tax_amount} onChange={(e) => setCnForm({ ...cnForm, tax_amount: +e.target.value })} placeholder="0" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{t("currency")}</Label>
                <Select value={cnForm.currency} onValueChange={(v) => setCnForm({ ...cnForm, currency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RSD">RSD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>{locale === "sr" ? "Faktura ID" : "Invoice ID"}</Label>
                <Input value={cnForm.invoice_id || ""} onChange={(e) => setCnForm({ ...cnForm, invoice_id: e.target.value || null })} placeholder="UUID" />
              </div>
            </div>
            <div className="grid gap-2"><Label>{t("notes")}</Label><Textarea value={cnForm.notes} onChange={(e) => setCnForm({ ...cnForm, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCnOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => cnMutation.mutate(cnForm)} disabled={!cnForm.credit_number || cnMutation.isPending}>
              {cnMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SUPPLIER RETURN SHIPMENT DIALOG */}
      <Dialog open={srOpen} onOpenChange={setSrOpen}>
        <DialogContent className="w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{srEditId ? t("edit") : t("add")} — {t("supplierReturn")}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2"><Label>{t("shipmentNumber")} *</Label><Input value={srForm.shipment_number} onChange={(e) => setSrForm({ ...srForm, shipment_number: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{t("returnCase")}</Label>
                <Select value={srForm.return_case_id || "__none"} onValueChange={(v) => setSrForm({ ...srForm, return_case_id: v === "__none" ? null : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">—</SelectItem>
                    {returnCases.filter((rc: any) => rc.return_type === "supplier").map((rc: any) => <SelectItem key={rc.id} value={rc.id}>{rc.case_number}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>{t("warehouse")}</Label>
                <Select value={srForm.warehouse_id || "__none"} onValueChange={(v) => setSrForm({ ...srForm, warehouse_id: v === "__none" ? null : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">—</SelectItem>
                    {warehouses.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{t("status")}</Label>
                <Select value={srForm.status} onValueChange={(v) => setSrForm({ ...srForm, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SHIPMENT_STATUSES.map(s => <SelectItem key={s} value={s}>{t(s as any) || s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2"><Label>{t("trackingNumber")}</Label><Input value={srForm.tracking_number} onChange={(e) => setSrForm({ ...srForm, tracking_number: e.target.value })} /></div>
            </div>
            <div className="grid gap-2"><Label>{t("notes")}</Label><Textarea value={srForm.notes} onChange={(e) => setSrForm({ ...srForm, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSrOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => srMutation.mutate(srForm)} disabled={!srForm.shipment_number || srMutation.isPending}>
              {srMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
