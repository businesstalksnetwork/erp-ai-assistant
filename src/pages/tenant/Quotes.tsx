import { useLanguage } from "@/i18n/LanguageContext";
import { ActionGuard } from "@/components/ActionGuard";
import { useTenant } from "@/hooks/useTenant";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2, ArrowRight, FileText, AlertTriangle, History } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/shared/PageHeader";
import { ResponsiveTable, type ResponsiveColumn } from "@/components/shared/ResponsiveTable";
import { QuoteVersionHistory } from "@/components/quotes/QuoteVersionHistory";
import { DiscountApprovalBadge } from "@/components/quotes/DiscountApprovalBadge";
import { useAuth } from "@/hooks/useAuth";
import { useDiscountApproval } from "@/hooks/useDiscountApproval";

const STATUSES = ["draft", "sent", "accepted", "rejected", "expired"] as const;

interface QuoteForm {
  quote_number: string;
  opportunity_id: string | null;
  partner_id: string | null;
  partner_name: string;
  quote_date: string;
  valid_until: string;
  status: string;
  currency: string;
  notes: string;
  salesperson_id: string | null;
}

const emptyForm: QuoteForm = {
  quote_number: "", opportunity_id: null, partner_id: null, partner_name: "",
  quote_date: new Date().toISOString().split("T")[0], valid_until: "", status: "draft",
  currency: "RSD", notes: "", salesperson_id: null,
};

export default function Quotes() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<QuoteForm>(emptyForm);
  const [versionHistoryQuoteId, setVersionHistoryQuoteId] = useState<string | null>(null);

  const { data: quotes = [], isLoading } = useQuery({
    queryKey: ["quotes", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("quotes")
        .select("*, partners(name), opportunities(title), salespeople(first_name, last_name)")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: partners = [] } = useQuery({
    queryKey: ["partners-list", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("partners").select("id, name").eq("tenant_id", tenantId!).eq("is_active", true).order("name");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: opportunities = [] } = useQuery({
    queryKey: ["opportunities-list", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("opportunities").select("id, title").eq("tenant_id", tenantId!).order("title");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: salespeople = [] } = useQuery({
    queryKey: ["salespeople-list", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("salespeople").select("id, first_name, last_name").eq("tenant_id", tenantId!).eq("is_active", true).order("first_name");
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Discount approval for the currently edited quote
  const editingQuote = editId ? quotes.find((q: any) => q.id === editId) : null;
  const editingDiscountPct = editingQuote?.max_discount_pct || 0;
  const { needsApproval, maxAllowed, approvalStatus, submitForApproval } = useDiscountApproval({
    tenantId,
    quoteId: editId,
    discountPct: editingDiscountPct,
  });

  const sendBlocked = needsApproval && approvalStatus !== "approved";

  const mutation = useMutation({
    mutationFn: async (f: QuoteForm) => {
      // Block sending if discount approval is needed
      if (f.status === "sent" && sendBlocked && editId) {
        if (approvalStatus === "none") {
          await submitForApproval();
        }
        throw new Error("Approval required before sending");
      }
      const payload = {
        ...f, tenant_id: tenantId!,
        partner_id: f.partner_id || null,
        opportunity_id: f.opportunity_id || null,
        salesperson_id: f.salesperson_id || null,
        valid_until: f.valid_until || null,
      };
      if (editId) {
        const { error } = await supabase.from("quotes").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("quotes").insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["quotes"] }); setOpen(false); toast.success(t("success")); },
    onError: (e: Error) => toast.error(e.message),
  });

  const convertToSOmutation = useMutation({
    mutationFn: async (q: any) => {
      const orderNumber = `SO-${Date.now().toString(36).toUpperCase()}`;
      const { data: soData, error: soError } = await supabase.from("sales_orders").insert([{
        tenant_id: tenantId!,
        order_number: orderNumber,
        quote_id: q.id,
        partner_id: q.partner_id || null,
        partner_name: q.partners?.name || q.partner_name || "",
        order_date: new Date().toISOString().split("T")[0],
        status: "pending",
        currency: q.currency || "RSD",
        subtotal: q.subtotal || 0,
        tax_amount: q.tax_amount || 0,
        total: q.total || 0,
        notes: q.notes || "",
        salesperson_id: q.salesperson_id || null,
      }]).select("id").single();
      if (soError) throw soError;

      // Copy quote_lines to sales_order_lines
      const { data: quoteLines } = await supabase.from("quote_lines").select("*").eq("quote_id", q.id).order("sort_order");
      if (quoteLines && quoteLines.length > 0 && soData) {
        const soLines = quoteLines.map((l: any, i: number) => ({
          sales_order_id: soData.id,
          product_id: l.product_id || null,
          description: l.description || "",
          quantity: l.quantity || 1,
          unit_price: l.unit_price || 0,
          total: (l.quantity || 1) * (l.unit_price || 0),
          sort_order: i,
        }));
        await supabase.from("sales_order_lines").insert(soLines);
      }

      if (q.status !== "accepted") {
        await supabase.from("quotes").update({ status: "accepted" }).eq("id", q.id);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quotes"] });
      qc.invalidateQueries({ queryKey: ["sales-orders"] });
      toast.success(t("conversionSuccess"));
      navigate("/sales/sales-orders");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createVersionMutation = useMutation({
    mutationFn: async (q: any) => {
      // Fetch quote lines for snapshot
      const { data: lines } = await supabase.from("quote_lines").select("*").eq("quote_id", q.id);
      const snapshot = { quote: q, lines: lines || [] };
      const newVersion = (q.current_version || 1) + 1;
      await supabase.from("quote_versions" as any).insert([{
        tenant_id: tenantId!, quote_id: q.id, version_number: q.current_version || 1,
        snapshot, created_by: user?.id,
      }]);
      await supabase.from("quotes").update({ current_version: newVersion, status: "draft" }).eq("id", q.id);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["quotes"] }); toast.success(t("snapshotCreated")); },
    onError: (e: Error) => toast.error(e.message),
  });

  const openAdd = () => { setEditId(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (q: any) => {
    setEditId(q.id);
    setForm({
      quote_number: q.quote_number, opportunity_id: q.opportunity_id, partner_id: q.partner_id,
      partner_name: q.partner_name, quote_date: q.quote_date, valid_until: q.valid_until || "",
      status: q.status, currency: q.currency, notes: q.notes || "", salesperson_id: q.salesperson_id || null,
    });
    setOpen(true);
  };

  const statusColor = (s: string) => {
    if (s === "accepted") return "default";
    if (s === "rejected" || s === "expired") return "destructive";
    return "secondary";
  };

  const fmt = (n: number, cur: string) =>
    new Intl.NumberFormat("sr-RS", { style: "currency", currency: cur }).format(n);

  const isExpiringSoon = (q: any) => {
    if (q.status !== "sent" || !q.valid_until) return false;
    const diff = (new Date(q.valid_until).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 3;
  };

  const columns: ResponsiveColumn<any>[] = [
    { key: "quote_number", label: t("quoteNumber"), primary: true, render: (q) => (
      <div className="flex items-center gap-1.5">
        <button className="text-primary hover:underline font-medium" onClick={(e) => { e.stopPropagation(); navigate(`/sales/quotes/${q.id}`); }}>
          {q.quote_number}
        </button>
        {(q.current_version || 1) > 1 && <Badge variant="outline" className="text-[10px] px-1">v{q.current_version}</Badge>}
        {isExpiringSoon(q) && <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
      </div>
    ) },
    { key: "partner", label: t("partner"), render: (q) => q.partners?.name || q.partner_name || "—" },
    { key: "salesperson", label: t("salesperson"), hideOnMobile: true, render: (q) => q.salespeople ? `${q.salespeople.first_name} ${q.salespeople.last_name}` : "—" },
    { key: "opportunity", label: t("opportunity"), hideOnMobile: true, render: (q) => q.opportunities?.title || "—" },
    { key: "quote_date", label: t("quoteDate"), render: (q) => q.quote_date },
    { key: "total", label: t("total"), align: "right" as const, render: (q) => fmt(q.total, q.currency) },
    { key: "status", label: t("status"), render: (q) => (
      <div className="flex items-center gap-1.5">
        <Badge variant={statusColor(q.status) as any}>{t(q.status as any) || q.status}</Badge>
        {q.max_discount_pct > 0 && tenantId && <DiscountApprovalBadge quoteId={q.id} tenantId={tenantId} maxDiscountPct={q.max_discount_pct} />}
      </div>
    ) },
    { key: "actions", label: t("actions"), showInCard: false, render: (q) => (
      <div className="flex gap-1">
        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openEdit(q); }}>{t("edit")}</Button>
        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setVersionHistoryQuoteId(q.id); }} title={t("versionHistory")}>
          <History className="h-3.5 w-3.5" />
        </Button>
        {(q.status === "sent" || q.status === "expired") && (
          <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); createVersionMutation.mutate(q); }} disabled={createVersionMutation.isPending}>
            {t("createNewVersion")}
          </Button>
        )}
        {q.status === "accepted" && (
          <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); convertToSOmutation.mutate(q); }} disabled={convertToSOmutation.isPending}>
            <ArrowRight className="h-3 w-3 mr-1" />{t("convertToSalesOrder")}
          </Button>
        )}
      </div>
    )},
  ];

  if (isLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("quotes")}
        description={t("quotes")}
        icon={FileText}
        actions={<ActionGuard module="sales" action="create"><Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" />{t("addQuote")}</Button></ActionGuard>}
      />

      <ResponsiveTable
        data={quotes}
        columns={columns}
        keyExtractor={(q) => q.id}
        emptyMessage={t("noResults")}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? t("editQuote") : t("addQuote")}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>{t("quoteNumber")} *</Label><Input value={form.quote_number} onChange={(e) => setForm({ ...form, quote_number: e.target.value })} /></div>
              <div className="grid gap-2">
                <Label>{t("status")}</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map(s => <SelectItem key={s} value={s}>{t(s as any) || s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{t("partner")}</Label>
                <Select value={form.partner_id || "__none"} onValueChange={(v) => { const p = partners.find((p: any) => p.id === v); setForm({ ...form, partner_id: v === "__none" ? null : v, partner_name: p?.name || form.partner_name }); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">—</SelectItem>
                    {partners.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>{t("opportunity")}</Label>
                <Select value={form.opportunity_id || "__none"} onValueChange={(v) => setForm({ ...form, opportunity_id: v === "__none" ? null : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">—</SelectItem>
                    {opportunities.map((o: any) => <SelectItem key={o.id} value={o.id}>{o.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="grid gap-2"><Label>{t("quoteDate")}</Label><Input type="date" value={form.quote_date} onChange={(e) => setForm({ ...form, quote_date: e.target.value })} /></div>
              <div className="grid gap-2"><Label>{t("validUntil")}</Label><Input type="date" value={form.valid_until} onChange={(e) => setForm({ ...form, valid_until: e.target.value })} /></div>
              <div className="grid gap-2">
                <Label>{t("currency")}</Label>
                <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RSD">RSD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>{t("salesperson")}</Label>
              <Select value={form.salesperson_id || "__none"} onValueChange={(v) => setForm({ ...form, salesperson_id: v === "__none" ? null : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">—</SelectItem>
                  {salespeople.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.first_name} {s.last_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2"><Label>{t("notes")}</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            {/* Discount approval warning */}
            {editId && needsApproval && (
              <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-700 p-3">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                <span className="text-sm text-amber-800 dark:text-amber-300">
                  {t("discountExceedsLimit" as any)} ({maxAllowed}%). {approvalStatus === "pending" ? t("pendingDiscountApproval" as any) : approvalStatus === "approved" ? t("approved") : ""}
                </span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => mutation.mutate(form)} disabled={!form.quote_number || mutation.isPending}>
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {versionHistoryQuoteId && (
        <QuoteVersionHistory
          open={!!versionHistoryQuoteId}
          onOpenChange={(o) => { if (!o) setVersionHistoryQuoteId(null); }}
          quoteId={versionHistoryQuoteId}
        />
      )}
    </div>
  );
}