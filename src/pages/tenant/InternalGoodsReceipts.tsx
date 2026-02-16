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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, PackageCheck, Eye } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

export default function InternalGoodsReceipts() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [reviewDialog, setReviewDialog] = useState<any>(null);
  const [receiptItems, setReceiptItems] = useState<any[]>([]);

  const { data: receipts = [] } = useQuery({
    queryKey: ["internal_goods_receipts", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("internal_goods_receipts")
        .select("*, internal_transfers(transfer_number, from_warehouse_id, to_warehouse_id), warehouses:receiving_warehouse_id(name)")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  // Auto-create receipts for in_transit transfers that don't have one yet
  const { data: inTransitTransfers = [] } = useQuery({
    queryKey: ["in_transit_transfers", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("internal_transfers")
        .select("id, transfer_number, to_warehouse_id, from_warehouse_id")
        .eq("tenant_id", tenantId!)
        .eq("status", "in_transit");
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const createReceiptMutation = useMutation({
    mutationFn: async (transfer: any) => {
      // Check if receipt already exists
      const { data: existing } = await supabase
        .from("internal_goods_receipts")
        .select("id")
        .eq("internal_transfer_id", transfer.id)
        .maybeSingle();
      if (existing) { toast({ title: t("receiptAlreadyExists") }); return; }

      const receiptNum = `IR-${String(Date.now()).slice(-6)}`;
      const { data: receipt, error } = await supabase
        .from("internal_goods_receipts")
        .insert({
          tenant_id: tenantId!, receipt_number: receiptNum,
          internal_transfer_id: transfer.id,
          receiving_warehouse_id: transfer.to_warehouse_id,
          status: "pending", received_by: user?.id,
        }).select().single();
      if (error) throw error;

      // Get transfer items and create receipt items
      const { data: transferItems } = await supabase
        .from("internal_transfer_items")
        .select("id, product_id, quantity_sent")
        .eq("transfer_id", transfer.id);

      if (transferItems && transferItems.length > 0) {
        await supabase.from("internal_goods_receipt_items").insert(
          transferItems.map((ti: any) => ({
            receipt_id: receipt.id, transfer_item_id: ti.id,
            product_id: ti.product_id, quantity_expected: ti.quantity_sent,
            quantity_received: ti.quantity_sent, // default to expected
          }))
        );
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["internal_goods_receipts"] }); toast({ title: t("success") }); },
    onError: (e: any) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const openReview = async (receipt: any) => {
    const { data: items } = await supabase
      .from("internal_goods_receipt_items")
      .select("*, products(name, sku)")
      .eq("receipt_id", receipt.id);
    setReceiptItems(items || []);
    setReviewDialog(receipt);
  };

  const updateItem = (itemId: string, field: string, value: any) => {
    setReceiptItems(prev => prev.map(i => i.id === itemId ? { ...i, [field]: value } : i));
  };

  const saveItemsMutation = useMutation({
    mutationFn: async () => {
      for (const item of receiptItems) {
        await supabase.from("internal_goods_receipt_items")
          .update({ quantity_received: item.quantity_received, discrepancy_notes: item.discrepancy_notes })
          .eq("id", item.id);
      }
    },
    onSuccess: () => toast({ title: t("success") }),
    onError: (e: any) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const confirmReceiptMutation = useMutation({
    mutationFn: async (receiptId: string) => {
      // First save items
      for (const item of receiptItems) {
        await supabase.from("internal_goods_receipt_items")
          .update({ quantity_received: item.quantity_received, discrepancy_notes: item.discrepancy_notes })
          .eq("id", item.id);
      }
      // Then confirm
      const { error } = await supabase.rpc("confirm_internal_receipt", { p_receipt_id: receiptId });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["internal_goods_receipts"] });
      qc.invalidateQueries({ queryKey: ["internal_transfers"] });
      qc.invalidateQueries({ queryKey: ["inventory-stock"] });
      toast({ title: t("receiptConfirmed") });
      setReviewDialog(null);
    },
    onError: (e: any) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const pendingTransfers = inTransitTransfers.filter((t: any) =>
    !receipts.some((r: any) => r.internal_transfer_id === t.id)
  );

  const filtered = receipts.filter((r: any) =>
    r.receipt_number?.toLowerCase().includes(search.toLowerCase()) ||
    (r.internal_transfers as any)?.transfer_number?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("internalReceipts")}</h1>
      </div>

      {/* Pending incoming transfers */}
      {pendingTransfers.length > 0 && (
        <Card className="border-amber-500/50 bg-accent/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("pendingIncoming")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pendingTransfers.map((tr: any) => (
                <div key={tr.id} className="flex items-center justify-between p-2 rounded border bg-background">
                  <span className="font-medium">{tr.transfer_number}</span>
                  <Button size="sm" onClick={() => createReceiptMutation.mutate(tr)} disabled={createReceiptMutation.isPending}>
                    <PackageCheck className="h-3 w-3 mr-1" />{t("createReceipt")}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder={t("search")} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("receiptNumber")}</TableHead>
                <TableHead>{t("transferNumber")}</TableHead>
                <TableHead>{t("warehouse")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead>{t("createdAt")}</TableHead>
                <TableHead>{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.receipt_number}</TableCell>
                  <TableCell>{(r.internal_transfers as any)?.transfer_number || "—"}</TableCell>
                  <TableCell>{(r.warehouses as any)?.name || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={r.status === "confirmed" ? "default" : "secondary"}>
                      {r.status === "confirmed" ? t("confirmed") : t("pending")}
                    </Badge>
                  </TableCell>
                  <TableCell>{new Date(r.created_at).toLocaleDateString("sr-RS")}</TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm" onClick={() => openReview(r)}>
                      <Eye className="h-3 w-3 mr-1" />{r.status === "pending" ? t("reviewAndConfirm") : t("view")}
                    </Button>
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

      {/* Review / Confirm Dialog */}
      <Dialog open={!!reviewDialog} onOpenChange={() => setReviewDialog(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t("internalReceipt")} — {reviewDialog?.receipt_number}</DialogTitle>
            <DialogDescription>{t("reviewReceiptDescription")}</DialogDescription>
          </DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("product")}</TableHead>
                <TableHead className="text-right">{t("quantityExpected")}</TableHead>
                <TableHead className="text-right">{t("quantityReceived")}</TableHead>
                <TableHead>{t("discrepancyNotes")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {receiptItems.map((item: any) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{(item.products as any)?.name} {(item.products as any)?.sku ? `(${(item.products as any).sku})` : ""}</TableCell>
                  <TableCell className="text-right font-mono">{Number(item.quantity_expected)}</TableCell>
                  <TableCell className="text-right">
                    {reviewDialog?.status === "pending" ? (
                      <Input type="number" className="w-20 ml-auto text-right" value={item.quantity_received}
                        onChange={e => updateItem(item.id, "quantity_received", Number(e.target.value))} />
                    ) : <span className="font-mono">{Number(item.quantity_received)}</span>}
                  </TableCell>
                  <TableCell>
                    {reviewDialog?.status === "pending" ? (
                      <Input value={item.discrepancy_notes || ""} placeholder={t("notes")}
                        onChange={e => updateItem(item.id, "discrepancy_notes", e.target.value)} />
                    ) : <span>{item.discrepancy_notes || "—"}</span>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {reviewDialog?.status === "pending" && (
            <DialogFooter>
              <Button variant="outline" onClick={() => saveItemsMutation.mutate()} disabled={saveItemsMutation.isPending}>{t("save")}</Button>
              <Button onClick={() => confirmReceiptMutation.mutate(reviewDialog.id)} disabled={confirmReceiptMutation.isPending}>
                <PackageCheck className="h-4 w-4 mr-2" />{t("confirmReceipt")}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
