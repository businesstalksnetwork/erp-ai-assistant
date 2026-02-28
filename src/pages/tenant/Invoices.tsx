import { useState, useMemo } from "react";
import { ActionGuard } from "@/components/ActionGuard";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useLanguage } from "@/i18n/LanguageContext";
import { useLegalEntities } from "@/hooks/useLegalEntities";
import { useApprovalCheck } from "@/hooks/useApprovalCheck";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Send, BookOpen, DollarSign, RefreshCw, Receipt } from "lucide-react";
import { format } from "date-fns";
import { ExportButton } from "@/components/ExportButton";
import { fmtNum } from "@/lib/utils";
import { AiModuleInsights } from "@/components/shared/AiModuleInsights";
import { useDebounce } from "@/hooks/useDebounce";
import { usePaginatedQuery } from "@/hooks/usePaginatedQuery";
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/shared/PageHeader";
import { MobileFilterBar } from "@/components/shared/MobileFilterBar";
import { ResponsiveTable, type ResponsiveColumn } from "@/components/shared/ResponsiveTable";
import { MobileActionMenu, type ActionItem } from "@/components/shared/MobileActionMenu";

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
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get("filter") || "all");
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

  const debouncedSearch = useDebounce(search, 300);

  const { data: invoices = [], isLoading, page, setPage, hasMore } = usePaginatedQuery({
    queryKey: ["invoices", tenantId, legalEntityFilter],
    queryFn: async ({ from, to }) => {
      let query = supabase
        .from("invoices")
        .select("*, legal_entities(name)")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false })
        .range(from, to);
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

  const postMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      const sefRequestId = crypto.randomUUID();
      const warehouseId = selectedWarehouse && selectedWarehouse !== "__none__" ? selectedWarehouse : null;
      const { error: rpcError } = await supabase.rpc("process_invoice_post", {
        p_invoice_id: invoiceId,
        p_default_warehouse_id: warehouseId,
      });
      if (rpcError) throw rpcError;
      const { error: updateError } = await supabase
        .from("invoices")
        .update({ status: "sent", sef_request_id: sefRequestId })
        .eq("id", invoiceId);
      if (updateError) throw updateError;
      try {
        await supabase.functions.invoke("sef-submit", {
          body: { invoice_id: invoiceId, tenant_id: tenantId, request_id: sefRequestId },
        });
      } catch (sefErr) {
        console.error("SEF auto-submit failed (will retry):", sefErr);
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

  const markPaidMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      const { error: rpcError } = await supabase.rpc("create_journal_from_invoice", {
        p_invoice_id: invoiceId,
      });
      if (rpcError) throw rpcError;
      const { error: updateError } = await supabase
        .from("invoices")
        .update({ status: "paid" })
        .eq("id", invoiceId);
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast({ title: t("success"), description: t("invoiceMarkedPaid") });
      setMarkPaidDialog(null);
    },
    onError: (err: any) => toast({ title: t("error"), description: err.message, variant: "destructive" }),
  });

  const sefMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      const invoice = invoices.find(i => i.id === invoiceId);
      const existingRequestId = (invoice as any)?.sef_request_id;
      const sefStatus = invoice?.sef_status;
      const requestId = (sefStatus === "rejected" || !existingRequestId)
        ? crypto.randomUUID()
        : existingRequestId;
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

  const filtered = useMemo(() => invoices.filter((inv) => {
    const matchesSearch =
      !debouncedSearch ||
      inv.invoice_number.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      inv.partner_name.toLowerCase().includes(debouncedSearch.toLowerCase());
    const matchesStatus = statusFilter === "all" || inv.status === statusFilter;
    return matchesSearch && matchesStatus;
  }), [invoices, debouncedSearch, statusFilter]);

  const columns: ResponsiveColumn<any>[] = [
    { key: "invoice_number", label: t("invoiceNumber"), primary: true, render: (inv) => <span className="font-medium">{inv.invoice_number}</span> },
    { key: "invoice_date", label: t("invoiceDate"), render: (inv) => format(new Date(inv.invoice_date), "dd.MM.yyyy") },
    { key: "partner_name", label: t("partner"), render: (inv) => inv.partner_name },
    ...(legalEntities.length > 1 ? [{ key: "legal_entity", label: t("legalEntity"), hideOnMobile: true, render: (inv: any) => (inv as any).legal_entities?.name || "—" } as ResponsiveColumn<any>] : []),
    { key: "total", label: t("total"), align: "right" as const, render: (inv) => <span className="font-mono">{fmtNum(Number(inv.total))} {inv.currency}</span> },
    { key: "status", label: t("status"), render: (inv) => <Badge className={statusColors[inv.status] || ""}>{t(inv.status as any)}</Badge> },
    { key: "sef", label: "SEF", hideOnMobile: true, render: (inv) => <Badge variant="outline" className={sefColors[inv.sef_status] || ""}>{t(inv.sef_status as any)}</Badge> },
    { key: "actions", label: t("actions"), showInCard: false, render: (inv) => {
      const actions: ActionItem[] = [];
      if (inv.status === "draft") {
        actions.push({ label: t("postInvoice"), icon: <BookOpen className="h-3 w-3" />, onClick: () => {
          checkApproval(inv.id, Number(inv.total || 0), () => setPostDialog(inv.id));
        }});
      }
      if (inv.status === "sent") {
        actions.push({ label: t("paid"), icon: <DollarSign className="h-3 w-3" />, onClick: () => setMarkPaidDialog(inv.id) });
      }
      if (inv.status === "sent" && (inv.sef_status === "not_submitted" || inv.sef_status === "rejected")) {
        actions.push({ label: inv.sef_status === "rejected" ? "Retry SEF" : "SEF", icon: <Send className="h-3 w-3" />, onClick: () => sefMutation.mutate(inv.id) });
      }
      if (inv.status === "sent" && (inv.sef_status === "submitted" || inv.sef_status === "polling")) {
        actions.push({ label: t("pollStatus"), icon: <RefreshCw className="h-3 w-3" />, onClick: async () => {
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
        }});
      }
      return actions.length > 0 ? <MobileActionMenu actions={actions} /> : null;
    }},
  ];

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {tenantId && <AiModuleInsights tenantId={tenantId} module="accounting" compact />}
      <PageHeader
        title={t("invoices")}
        description={t("invoicesDesc")}
        icon={Receipt}
        actions={
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
            <ActionGuard module="accounting" action="create">
              <Button onClick={() => navigate("/accounting/invoices/new")}>
                <Plus className="h-4 w-4 mr-2" />
                {t("newInvoice")}
              </Button>
            </ActionGuard>
          </div>
        }
      />

      <MobileFilterBar
        search={<Input placeholder={t("search")} value={search} onChange={(e) => setSearch(e.target.value)} />}
        filters={
          <>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
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
          </>
        }
      />

      {isLoading ? (
        <p>{t("loading")}</p>
      ) : (
        <ResponsiveTable
          data={filtered}
          columns={columns}
          keyExtractor={(inv) => inv.id}
          onRowClick={(inv) => navigate(`/accounting/invoices/${inv.id}`)}
          emptyMessage={t("noResults")}
          mobileMode="card"
        />
      )}

      {/* Post Invoice Dialog */}
      <Dialog open={!!postDialog} onOpenChange={() => setPostDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("postInvoice")}</DialogTitle></DialogHeader>
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

      {/* Pagination */}
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious onClick={() => setPage(Math.max(0, page - 1))} className={page === 0 ? "pointer-events-none opacity-50" : "cursor-pointer"} />
          </PaginationItem>
          <PaginationItem>
            <span className="px-3 py-2 text-sm text-muted-foreground">{t("page")} {page + 1}</span>
          </PaginationItem>
          <PaginationItem>
            <PaginationNext onClick={() => hasMore && setPage(page + 1)} className={!hasMore ? "pointer-events-none opacity-50" : "cursor-pointer"} />
          </PaginationItem>
        </PaginationContent>
      </Pagination>

      {/* Mark Paid Dialog */}
      <Dialog open={!!markPaidDialog} onOpenChange={() => setMarkPaidDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("markAsPaid")}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{t("markAsPaidDescription")}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMarkPaidDialog(null)}>{t("cancel")}</Button>
            <Button onClick={() => markPaidDialog && markPaidMutation.mutate(markPaidDialog)} disabled={markPaidMutation.isPending}>
              {t("markAsPaid")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
