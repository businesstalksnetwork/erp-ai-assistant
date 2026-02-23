import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { useStatusWorkflow } from "@/hooks/useStatusWorkflow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Trash2, CheckCircle, Truck, ArrowRight, X, Send, Package } from "lucide-react";
import { format } from "date-fns";
import type { Database } from "@/integrations/supabase/types";

type DispatchNote = Database["public"]["Tables"]["dispatch_notes"]["Row"];
type DispatchNoteLine = Database["public"]["Tables"]["dispatch_note_lines"]["Row"];
type DispatchReceipt = Database["public"]["Tables"]["dispatch_receipts"]["Row"];

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  confirmed: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  in_transit: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  delivered: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

const nextStatus: Record<string, string> = {
  draft: "confirmed",
  confirmed: "in_transit",
  in_transit: "delivered",
};

export default function DispatchNoteDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [addLineOpen, setAddLineOpen] = useState(false);
  const [addReceiptOpen, setAddReceiptOpen] = useState(false);
  const [lineForm, setLineForm] = useState({ product_id: "", description: "", quantity: "1", unit: "kom", lot_number: "", serial_number: "" });
  const [receiptForm, setReceiptForm] = useState({ receipt_number: "", notes: "" });

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

  const statusMutation = useStatusWorkflow({ table: "dispatch_notes", queryKey: ["dispatch_notes"] });

  const { data: note, isLoading } = useQuery({
    queryKey: ["dispatch_notes", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dispatch_notes")
        .select("*, legal_entities(name)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data as DispatchNote & { legal_entities: { name: string } | null };
    },
    enabled: !!id,
  });

  const { data: lines = [] } = useQuery({
    queryKey: ["dispatch_note_lines", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dispatch_note_lines")
        .select("*, products(name)")
        .eq("dispatch_note_id", id!)
        .order("sort_order");
      if (error) throw error;
      return data as (DispatchNoteLine & { products: { name: string } | null })[];
    },
    enabled: !!id,
  });

  const { data: receipts = [] } = useQuery({
    queryKey: ["dispatch_receipts", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dispatch_receipts")
        .select("*")
        .eq("dispatch_note_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as DispatchReceipt[];
    },
    enabled: !!id,
  });

  const addLineMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("dispatch_note_lines").insert({
        dispatch_note_id: id!,
        product_id: lineForm.product_id || null,
        description: lineForm.description,
        quantity: Number(lineForm.quantity),
        unit: lineForm.unit || null,
        lot_number: lineForm.lot_number || null,
        serial_number: lineForm.serial_number || null,
        sort_order: lines.length,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dispatch_note_lines", id] });
      setAddLineOpen(false);
      setLineForm({ product_id: "", description: "", quantity: "1", unit: "kom", lot_number: "", serial_number: "" });
      toast({ title: t("success") });
    },
    onError: (err: any) => toast({ title: t("error"), description: err.message, variant: "destructive" }),
  });

  const deleteLineMutation = useMutation({
    mutationFn: async (lineId: string) => {
      const { error } = await supabase.from("dispatch_note_lines").delete().eq("id", lineId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dispatch_note_lines", id] });
      toast({ title: t("success") });
    },
    onError: (err: any) => toast({ title: t("error"), description: err.message, variant: "destructive" }),
  });

  const addReceiptMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("dispatch_receipts").insert({
        dispatch_note_id: id!,
        tenant_id: tenantId!,
        receipt_number: receiptForm.receipt_number || `REC-${Date.now()}`,
        notes: receiptForm.notes || null,
        received_by: user?.id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dispatch_receipts", id] });
      setAddReceiptOpen(false);
      setReceiptForm({ receipt_number: "", notes: "" });
      toast({ title: t("success") });
    },
    onError: (err: any) => toast({ title: t("error"), description: err.message, variant: "destructive" }),
  });

  if (isLoading || !note) return <p>{t("loading")}</p>;

  const isDraft = note.status === "draft";
  const canCreateReceipt = note.status === "in_transit" || note.status === "delivered";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/inventory/dispatch-notes")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{note.document_number}</h1>
          <p className="text-sm text-muted-foreground">
            {format(new Date(note.document_date), "dd.MM.yyyy")}
            {note.transport_reason && ` — ${note.transport_reason}`}
          </p>
        </div>
        <Badge className={statusColors[note.status] || ""}>{t(note.status as any)}</Badge>
        {note.eotpremnica_status && (
          <Badge variant="outline" className="text-xs">eOtp: {note.eotpremnica_status}</Badge>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 flex-wrap">
        {note.status === "confirmed" && (!note.eotpremnica_status || note.eotpremnica_status === "not_submitted") && (
          <Button size="sm" variant="outline" onClick={async () => {
            try {
              const { error } = await supabase.functions.invoke("eotpremnica-submit", {
                body: { dispatch_note_id: note.id, tenant_id: tenantId },
              });
              if (error) throw error;
              queryClient.invalidateQueries({ queryKey: ["dispatch_notes", id] });
              toast({ title: t("eotpremnicaSubmitted") });
            } catch (err: any) {
              toast({ title: t("error"), description: err.message, variant: "destructive" });
            }
          }}>
            <Send className="h-3 w-3 mr-1" />{t("submitApi")}
          </Button>
        )}
        {nextStatus[note.status] && (
          <Button size="sm" onClick={() => statusMutation.mutate({ id: note.id, newStatus: nextStatus[note.status] })}>
            {note.status === "draft" && <CheckCircle className="h-3 w-3 mr-1" />}
            {note.status === "confirmed" && <Truck className="h-3 w-3 mr-1" />}
            {note.status === "in_transit" && <ArrowRight className="h-3 w-3 mr-1" />}
            {t(nextStatus[note.status] === "confirmed" ? "confirmed" : nextStatus[note.status] === "in_transit" ? "inTransit" : "delivered" as any)}
          </Button>
        )}
        {note.status !== "delivered" && note.status !== "cancelled" && (
          <Button size="sm" variant="destructive" onClick={() => statusMutation.mutate({ id: note.id, newStatus: "cancelled" })}>
            <X className="h-3 w-3 mr-1" />{t("cancelled")}
          </Button>
        )}
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">{t("senderName")}</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1">
            <p className="font-medium">{note.sender_name || "—"}</p>
            {note.sender_pib && <p>PIB: {note.sender_pib}</p>}
            {note.sender_address && <p>{note.sender_address}</p>}
            {note.sender_city && <p>{note.sender_city}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">{t("receiverName")}</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1">
            <p className="font-medium">{note.receiver_name || "—"}</p>
            {note.receiver_pib && <p>PIB: {note.receiver_pib}</p>}
            {note.receiver_address && <p>{note.receiver_address}</p>}
            {note.receiver_city && <p>{note.receiver_city}</p>}
          </CardContent>
        </Card>
      </div>

      {note.vehicle_plate && (
        <Card>
          <CardContent className="pt-4 flex gap-6 text-sm">
            <span><strong>{t("vehiclePlate")}:</strong> {note.vehicle_plate}</span>
            {note.driver_name && <span><strong>{t("driverName")}:</strong> {note.driver_name}</span>}
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="lines">
        <TabsList>
          <TabsTrigger value="lines">{t("lineItems")} ({lines.length})</TabsTrigger>
          <TabsTrigger value="receipts">{t("receipts")} ({receipts.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="lines" className="space-y-4">
          {isDraft && (
            <Button size="sm" onClick={() => setAddLineOpen(true)}>
              <Plus className="h-3 w-3 mr-1" />{t("addLine")}
            </Button>
          )}
          {lines.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("noResults")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Proizvod</TableHead>
                  <TableHead>{t("quantity")}</TableHead>
                  <TableHead>{t("unitOfMeasure")}</TableHead>
                  <TableHead>{t("lotNumber")}</TableHead>
                  <TableHead>{t("serialNumber")}</TableHead>
                  {isDraft && <TableHead />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((line, i) => (
                  <TableRow key={line.id}>
                    <TableCell>{i + 1}</TableCell>
                    <TableCell>{line.products?.name || line.description}</TableCell>
                    <TableCell>{line.quantity}</TableCell>
                    <TableCell>{line.unit || "—"}</TableCell>
                    <TableCell>{line.lot_number || "—"}</TableCell>
                    <TableCell>{line.serial_number || "—"}</TableCell>
                    {isDraft && (
                      <TableCell>
                        <Button size="sm" variant="ghost" onClick={() => deleteLineMutation.mutate(line.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        <TabsContent value="receipts" className="space-y-4">
          {canCreateReceipt && (
            <Button size="sm" onClick={() => setAddReceiptOpen(true)}>
              <Package className="h-3 w-3 mr-1" />{t("createReceipt")}
            </Button>
          )}
          {receipts.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("noResults")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("receiptNumber")}</TableHead>
                  <TableHead>{t("receiptDate")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead>{t("notes")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receipts.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.receipt_number}</TableCell>
                    <TableCell>{format(new Date(r.receipt_date), "dd.MM.yyyy")}</TableCell>
                    <TableCell><Badge variant="outline">{r.status}</Badge></TableCell>
                    <TableCell>{r.notes || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>
      </Tabs>

      {/* Add Line Dialog */}
      <Dialog open={addLineOpen} onOpenChange={setAddLineOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("addLine")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Proizvod</Label>
              <Select value={lineForm.product_id || "__manual__"} onValueChange={(val) => {
                if (val === "__manual__") {
                  setLineForm(f => ({ ...f, product_id: "" }));
                } else {
                  const product = products.find((p: any) => p.id === val);
                  if (product) {
                    setLineForm(f => ({ ...f, product_id: product.id, description: product.name }));
                  }
                }
              }}>
                <SelectTrigger><SelectValue placeholder="Izaberi proizvod..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__manual__">Ručni unos</SelectItem>
                  {products.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>{t("description")}</Label><Input value={lineForm.description} onChange={(e) => setLineForm(f => ({ ...f, description: e.target.value }))} placeholder="Opis stavke" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{t("quantity")}</Label><Input type="number" value={lineForm.quantity} onChange={(e) => setLineForm(f => ({ ...f, quantity: e.target.value }))} /></div>
              <div><Label>{t("unitOfMeasure")}</Label><Input value={lineForm.unit} onChange={(e) => setLineForm(f => ({ ...f, unit: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{t("lotNumber")}</Label><Input value={lineForm.lot_number} onChange={(e) => setLineForm(f => ({ ...f, lot_number: e.target.value }))} /></div>
              <div><Label>{t("serialNumber")}</Label><Input value={lineForm.serial_number} onChange={(e) => setLineForm(f => ({ ...f, serial_number: e.target.value }))} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddLineOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => addLineMutation.mutate()} disabled={!lineForm.description || addLineMutation.isPending}>{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Receipt Dialog */}
      <Dialog open={addReceiptOpen} onOpenChange={setAddReceiptOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("createReceipt")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>{t("receiptNumber")}</Label><Input value={receiptForm.receipt_number} onChange={(e) => setReceiptForm(f => ({ ...f, receipt_number: e.target.value }))} placeholder="REC-001" /></div>
            <div><Label>{t("notes")}</Label><Textarea value={receiptForm.notes} onChange={(e) => setReceiptForm(f => ({ ...f, notes: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddReceiptOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => addReceiptMutation.mutate()} disabled={addReceiptMutation.isPending}>{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
