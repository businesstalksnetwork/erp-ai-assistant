import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useLanguage } from "@/i18n/LanguageContext";
import { useLegalEntities } from "@/hooks/useLegalEntities";
import { useApprovalCheck } from "@/hooks/useApprovalCheck";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Send, BookOpen, DollarSign, FileDown, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { ExportButton } from "@/components/ExportButton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  paid: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  overdue: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  cancelled: "bg-muted text-muted-foreground line-through",
};

const sefColors: Record<string, string> = {
  not_submitted: "bg-muted text-muted-foreground",
  submitted: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  polling: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  accepted: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

export default function Invoices() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [legalEntityFilter, setLegalEntityFilter] = useState<string>("all");
  const { entities: legalEntities } = useLegalEntities();
  const { checkApproval } = useApprovalCheck(tenantId, "invoice");
  const [pollingAll, setPollingAll] = useState(false);

  const handlePollAllSef = async () => {
    if (!tenantId) return;
    setPollingAll(true);
    try {
      const { data, error } = await supabase.functions.invoke("sef-poll-status", {
        body: { tenant_id: tenantId },
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast({ title: t("success"), description: `${t("pollAllSef")}: ${data?.polled || 0} ${t("checked")}` });
    } catch (err: any) {
      toast({ title: t("error"), description: err.message, variant: "destructive" });
    } finally {
      setPollingAll(false);
    }
  };

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["invoices", tenantId, legalEntityFilter],
    queryFn: async () => {
      let query = supabase
        .from("invoices")
        .select("*, legal_entities(name)")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false });
      if (legalEntityFilter !== "all") {
        query = query.eq("legal_entity_id", legalEntityFilter);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const [markPaidDialog, setMarkPaidDialog] = useState<string | null>(null);

  // Fetch warehouses for posting dialog
  const { data: warehouses = [] } = useQuery({
    queryKey: ["warehouses", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("warehouses").select("id, name").eq("tenant_id", tenantId!).eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const [postDialog, setPostDialog] = useState<string | null>(null);
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>("");

  // Post invoice: update status to sent + create journal entry + inventory movements
  // Model B: Post immediately, then queue SEF submission with requestId for idempotency
  const postMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      // Generate unique SEF request ID for idempotency
      const sefRequestId = crypto.randomUUID();

      // Update status to sent and store SEF request ID
      const { error: updateError } = await supabase
        .from("invoices")
        .update({ status: "sent", sef_request_id: sefRequestId })
        .eq("id", invoiceId);
      if (updateError) throw updateError;

      // Create journal entry + inventory movements via RPC
      const { error: rpcError } = await supabase.rpc("process_invoice_post", {
        p_invoice_id: invoiceId,
        p_default_warehouse_id: selectedWarehouse || null,
      });
      if (rpcError) throw rpcError;

      // Auto-submit to SEF (non-blocking, Model B: post first, SEF follow-up)
      try {
        await supabase.functions.invoke("sef-submit", {
          body: { invoice_id: invoiceId, tenant_id: tenantId, request_id: sefRequestId },
        });
      } catch (sefErr) {
        console.error("SEF auto-submit failed (will retry):", sefErr);
        // Not fatal in Model B — user can retry via "Retry SEF" button
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast({ title: t("success"), description: t("invoicePostedWithJournal") });
      setPostDialog(null);
      setSelectedWarehouse("");
    },
    onError: (err: any) => toast({ title: t("error"), description: err.message, variant: "destructive" }),
  });

  // Mark as paid: update status + create payment journal entry
  const markPaidMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      const { error: updateError } = await supabase
        .from("invoices")
        .update({ status: "paid" })
        .eq("id", invoiceId);
      if (updateError) throw updateError;

      const { error: rpcError } = await supabase.rpc("create_journal_from_invoice", {
        p_invoice_id: invoiceId,
      });
      if (rpcError) throw rpcError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast({ title: t("success"), description: t("invoiceMarkedPaid") });
      setMarkPaidDialog(null);
    },
    onError: (err: any) => toast({ title: t("error"), description: err.message, variant: "destructive" }),
  });

  // SEF retry mutation — reuses existing requestId for idempotent retry (Critical Fix 1)
  // A new requestId is only generated if the invoice has no existing one (e.g. rejected terminal state)
  const sefMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      const invoice = invoices.find(i => i.id === invoiceId);
      const existingRequestId = (invoice as any)?.sef_request_id;
      // Only generate new requestId if previous was definitively rejected or missing
      const sefStatus = invoice?.sef_status;
      const requestId = (sefStatus === "rejected" || !existingRequestId)
        ? crypto.randomUUID()
        : existingRequestId;
      // Update only if we generated a new one
      if (requestId !== existingRequestId) {
        await supabase.from("invoices").update({ sef_request_id: requestId }).eq("id", invoiceId);
      }
      const { data, error } = await supabase.functions.invoke("sef-submit", {
        body: { invoice_id: invoiceId, tenant_id: tenantId, request_id: requestId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast({ title: t("success"), description: t("sefSubmitted") });
    },
    onError: (err: any) => toast({ title: t("error"), description: err.message, variant: "destructive" }),
  });

  const filtered = invoices.filter((inv) => {
    const matchesSearch =
      !search ||
      inv.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
      inv.partner_name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || inv.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("invoices")}</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePollAllSef} disabled={pollingAll}>
            <RefreshCw className={`h-4 w-4 mr-2 ${pollingAll ? "animate-spin" : ""}`} />
            {t("pollAllSef")}
          </Button>
          <ExportButton
            data={filtered}
            columns={[
              { key: "invoice_number", label: t("invoiceNumber") },
              { key: "invoice_date", label: t("invoiceDate") },
              { key: "partner_name", label: t("partner") },
              { key: "subtotal", label: t("subtotal"), formatter: (v) => Number(v).toFixed(2) },
              { key: "tax_amount", label: t("taxAmount"), formatter: (v) => Number(v).toFixed(2) },
              { key: "total", label: t("total"), formatter: (v) => Number(v).toFixed(2) },
              { key: "currency", label: t("currency") },
              { key: "status", label: t("status") },
            ]}
            filename="invoices"
          />
          <Button onClick={() => navigate("/accounting/invoices/new")}>
            <Plus className="h-4 w-4 mr-2" />
            {t("newInvoice")}
          </Button>
        </div>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allStatuses")}</SelectItem>
            <SelectItem value="draft">{t("draft")}</SelectItem>
            <SelectItem value="sent">{t("sent")}</SelectItem>
            <SelectItem value="paid">{t("paid")}</SelectItem>
            <SelectItem value="overdue">{t("overdue")}</SelectItem>
            <SelectItem value="cancelled">{t("cancelled")}</SelectItem>
          </SelectContent>
        </Select>
        {legalEntities.length > 1 && (
          <Select value={legalEntityFilter} onValueChange={setLegalEntityFilter}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allLegalEntities")}</SelectItem>
              {legalEntities.map(e => <SelectItem key={e.id} value={e.id}>{e.name} ({e.pib})</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {isLoading ? (
        <p>{t("loading")}</p>
      ) : filtered.length === 0 ? (
        <p className="text-muted-foreground">{t("noResults")}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("invoiceNumber")}</TableHead>
              <TableHead>{t("invoiceDate")}</TableHead>
              <TableHead>{t("partner")}</TableHead>
              {legalEntities.length > 1 && <TableHead>{t("legalEntity")}</TableHead>}
              <TableHead className="text-right">{t("total")}</TableHead>
              <TableHead>{t("status")}</TableHead>
              <TableHead>SEF</TableHead>
              <TableHead>{t("actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((inv) => (
              <TableRow key={inv.id} className="cursor-pointer" onClick={() => navigate(`/accounting/invoices/${inv.id}`)}>
                <TableCell className="font-medium">{inv.invoice_number}</TableCell>
                <TableCell>{format(new Date(inv.invoice_date), "dd.MM.yyyy")}</TableCell>
                <TableCell>{inv.partner_name}</TableCell>
                {legalEntities.length > 1 && <TableCell>{(inv as any).legal_entities?.name || "—"}</TableCell>}
                <TableCell className="text-right font-mono">
                  {Number(inv.total).toLocaleString("sr-RS", { minimumFractionDigits: 2 })} {inv.currency}
                </TableCell>
                <TableCell>
                  <Badge className={statusColors[inv.status] || ""}>{t(inv.status as any)}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={sefColors[inv.sef_status] || ""}>{inv.sef_status.replace("_", " ")}</Badge>
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <div className="flex gap-1">
                    {inv.status === "draft" && (
                      <Button size="sm" variant="outline" onClick={() => {
                        const inv2 = invoices.find(i => i.id === inv.id);
                        checkApproval(inv.id, Number(inv2?.total || 0), () => setPostDialog(inv.id));
                      }}>
                        <BookOpen className="h-3 w-3 mr-1" />
                        {t("postInvoice")}
                      </Button>
                    )}
                    {inv.status === "sent" && (
                      <Button size="sm" variant="outline" onClick={() => setMarkPaidDialog(inv.id)}>
                        <DollarSign className="h-3 w-3 mr-1" />
                        {t("paid")}
                      </Button>
                    )}
                    {inv.status === "sent" && (inv.sef_status === "not_submitted" || inv.sef_status === "rejected") && (
                      <Button size="sm" variant="outline" onClick={() => sefMutation.mutate(inv.id)}>
                        <Send className="h-3 w-3 mr-1" />
                        {inv.sef_status === "rejected" ? "Retry SEF" : "SEF"}
                      </Button>
                    )}
                    {inv.status === "sent" && (inv.sef_status === "submitted" || inv.sef_status === "polling") && (
                      <Button size="sm" variant="outline" onClick={async (e) => {
                        e.stopPropagation();
                        try {
                          const { data, error } = await supabase.functions.invoke("sef-poll-status", {
                            body: { tenant_id: tenantId, invoice_id: inv.id },
                          });
                          if (error) throw error;
                          queryClient.invalidateQueries({ queryKey: ["invoices"] });
                          toast({ title: t("success"), description: data?.status || "Polled" });
                        } catch (err: any) {
                          toast({ title: t("error"), description: err.message, variant: "destructive" });
                        }
                      }}>
                        <RefreshCw className="h-3 w-3 mr-1" />
                        {t("pollStatus")}
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Post Invoice Dialog */}
      <Dialog open={!!postDialog} onOpenChange={() => setPostDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("postInvoice")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t("postInvoiceDescription")}</p>
          <div>
            <Label>{t("warehouse")} ({t("optional")})</Label>
            <Select value={selectedWarehouse} onValueChange={setSelectedWarehouse}>
              <SelectTrigger><SelectValue placeholder={t("selectWarehouse")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">{t("noWarehouse")}</SelectItem>
                {warehouses.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">{t("warehouseHint")}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPostDialog(null)}>{t("cancel")}</Button>
            <Button onClick={() => postDialog && postMutation.mutate(postDialog)} disabled={postMutation.isPending}>
              {t("postInvoice")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark Paid Dialog */}
      <Dialog open={!!markPaidDialog} onOpenChange={() => setMarkPaidDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("markAsPaid")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t("markAsPaidDescription")}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMarkPaidDialog(null)}>{t("cancel")}</Button>
            <Button onClick={() => markPaidDialog && markPaidMutation.mutate(markPaidDialog)} disabled={markPaidMutation.isPending}>
              {t("confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
