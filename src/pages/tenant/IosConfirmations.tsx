import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2, Send, CheckCircle2, AlertTriangle, FileText } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/PageHeader";
import { ResponsiveTable, ResponsiveColumn } from "@/components/shared/ResponsiveTable";
import { fmtNum } from "@/lib/utils";

interface IosForm {
  partner_id: string;
  legal_entity_id: string;
  as_of_date: string;
  currency: string;
  notes: string;
}

const EMPTY: IosForm = { partner_id: "", legal_entity_id: "", as_of_date: new Date().toISOString().split("T")[0], currency: "RSD", notes: "" };

const STATUS_COLORS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "outline", sent: "secondary", confirmed: "default", disputed: "destructive", expired: "secondary",
};

export default function IosConfirmations() {
  const { t, locale } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const qc = useQueryClient();
  const sr = locale === "sr";
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<IosForm>(EMPTY);
  const [balancePreview, setBalancePreview] = useState<any>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: confirmations = [], isLoading } = useQuery({
    queryKey: ["ios-confirmations", tenantId, statusFilter],
    queryFn: async () => {
      let q = supabase
        .from("ios_confirmations" as any)
        .select("*, partners(name), legal_entities(name)")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false });
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as any[];
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

  const { data: legalEntities = [] } = useQuery({
    queryKey: ["legal-entities", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("legal_entities").select("id, name").eq("tenant_id", tenantId!).order("name");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const fetchBalance = async (partnerId: string) => {
    if (!partnerId || !tenantId) return;
    setLoadingBalance(true);
    try {
      const { data, error } = await supabase.rpc("get_partner_ios_balance" as any, {
        p_tenant_id: tenantId, p_partner_id: partnerId, p_as_of_date: form.as_of_date,
        p_legal_entity_id: form.legal_entity_id === "__all__" ? null : (form.legal_entity_id || null),
      });
      if (error) throw error;
      setBalancePreview(data?.[0] || null);
    } catch { setBalancePreview(null); }
    setLoadingBalance(false);
  };

  const getNextNumber = () => {
    const year = new Date().getFullYear();
    const count = confirmations.filter((c: any) => c.confirmation_number?.startsWith(`IOS-${year}`)).length;
    return `IOS-${year}-${String(count + 1).padStart(4, "0")}`;
  };

  const createMutation = useMutation({
    mutationFn: async (f: IosForm) => {
      const { error } = await supabase.from("ios_confirmations" as any).insert({
        tenant_id: tenantId!,
        partner_id: f.partner_id,
        legal_entity_id: f.legal_entity_id === "__all__" ? null : (f.legal_entity_id || null),
        confirmation_number: getNextNumber(),
        as_of_date: f.as_of_date,
        our_receivable: balancePreview?.receivable_total || 0,
        our_payable: balancePreview?.payable_total || 0,
        currency: f.currency,
        notes: f.notes || null,
        created_by: user?.id,
        status: "draft",
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ios-confirmations"] }); setOpen(false); toast.success(t("success")); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, dispute_reason }: { id: string; status: string; dispute_reason?: string }) => {
      const updates: any = { status, updated_at: new Date().toISOString() };
      if (status === "sent") updates.sent_at = new Date().toISOString();
      if (status === "confirmed") updates.confirmed_at = new Date().toISOString();
      if (dispute_reason) updates.dispute_reason = dispute_reason;
      const { error } = await supabase.from("ios_confirmations" as any).update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ios-confirmations"] }); toast.success(t("success")); },
  });

  const columns: ResponsiveColumn<any>[] = [
    { key: "number", label: sr ? "Broj" : "Number", primary: true, render: (r) => <span className="font-mono font-medium">{r.confirmation_number}</span> },
    { key: "partner", label: t("partner"), render: (r) => r.partners?.name },
    { key: "date", label: sr ? "Na dan" : "As Of", render: (r) => r.as_of_date },
    { key: "receivable", label: sr ? "Potraživanje" : "Receivable", align: "right", render: (r) => <span className="font-mono">{fmtNum(Number(r.our_receivable))}</span> },
    { key: "payable", label: sr ? "Obaveza" : "Payable", align: "right", render: (r) => <span className="font-mono">{fmtNum(Number(r.our_payable))}</span> },
    { key: "status", label: t("status"), render: (r) => (
      <Badge variant={STATUS_COLORS[r.status] || "outline"}>
        {r.status === "draft" ? (sr ? "Nacrt" : "Draft") :
         r.status === "sent" ? (sr ? "Poslato" : "Sent") :
         r.status === "confirmed" ? (sr ? "Potvrđeno" : "Confirmed") :
         r.status === "disputed" ? (sr ? "Osporeno" : "Disputed") :
         sr ? "Isteklo" : "Expired"}
      </Badge>
    )},
    { key: "actions", label: "", showInCard: false, render: (r) => (
      <div className="flex gap-1">
        {r.status === "draft" && (
          <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); updateStatus.mutate({ id: r.id, status: "sent" }); }}>
            <Send className="h-3 w-3 mr-1" />{sr ? "Pošalji" : "Send"}
          </Button>
        )}
        {r.status === "sent" && (
          <>
            <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); updateStatus.mutate({ id: r.id, status: "confirmed" }); }}>
              <CheckCircle2 className="h-3 w-3 mr-1" />{sr ? "Potvrdi" : "Confirm"}
            </Button>
            <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); updateStatus.mutate({ id: r.id, status: "disputed", dispute_reason: "Pending review" }); }}>
              <AlertTriangle className="h-3 w-3 mr-1" />{sr ? "Ospori" : "Dispute"}
            </Button>
          </>
        )}
      </div>
    )},
  ];

  // Summary stats
  const totalSent = confirmations.filter((c: any) => c.status === "sent").length;
  const totalConfirmed = confirmations.filter((c: any) => c.status === "confirmed").length;
  const totalDisputed = confirmations.filter((c: any) => c.status === "disputed").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title={sr ? "IOS Potvrda salda" : "IOS Balance Confirmations"}
        description={sr ? "Izvod otvorenih stavki — slanje i praćenje potvrda salda sa partnerima" : "Statement of Open Items — send and track balance confirmations with partners"}
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4 text-center">
          <p className="text-2xl font-bold">{confirmations.length}</p>
          <p className="text-xs text-muted-foreground">{sr ? "Ukupno" : "Total"}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 text-center">
          <p className="text-2xl font-bold text-accent-foreground">{totalSent}</p>
          <p className="text-xs text-muted-foreground">{sr ? "Poslato" : "Sent"}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 text-center">
          <p className="text-2xl font-bold text-primary">{totalConfirmed}</p>
          <p className="text-xs text-muted-foreground">{sr ? "Potvrđeno" : "Confirmed"}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 text-center">
          <p className="text-2xl font-bold text-destructive">{totalDisputed}</p>
          <p className="text-xs text-muted-foreground">{sr ? "Osporeno" : "Disputed"}</p>
        </CardContent></Card>
      </div>

      {/* Filters + actions */}
      <div className="flex items-center justify-between">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{sr ? "Svi statusi" : "All Statuses"}</SelectItem>
            <SelectItem value="draft">{sr ? "Nacrt" : "Draft"}</SelectItem>
            <SelectItem value="sent">{sr ? "Poslato" : "Sent"}</SelectItem>
            <SelectItem value="confirmed">{sr ? "Potvrđeno" : "Confirmed"}</SelectItem>
            <SelectItem value="disputed">{sr ? "Osporeno" : "Disputed"}</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" onClick={() => { setForm(EMPTY); setBalancePreview(null); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" />{sr ? "Nova potvrda" : "New Confirmation"}
        </Button>
      </div>

      <Card><CardContent className="p-0">
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <ResponsiveTable data={confirmations} columns={columns} keyExtractor={(r) => r.id} />
        )}
      </CardContent></Card>

      {/* Create dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{sr ? "Nova IOS potvrda salda" : "New IOS Balance Confirmation"}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>{t("partner")} *</Label>
              <Select value={form.partner_id} onValueChange={(v) => { setForm({ ...form, partner_id: v }); fetchBalance(v); }}>
                <SelectTrigger><SelectValue placeholder={sr ? "Izaberite partnera" : "Select partner"} /></SelectTrigger>
                <SelectContent>{partners.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{sr ? "Na dan" : "As of Date"}</Label>
                <Input type="date" value={form.as_of_date} onChange={(e) => setForm({ ...form, as_of_date: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>{sr ? "Pravno lice" : "Legal Entity"}</Label>
                <Select value={form.legal_entity_id} onValueChange={(v) => setForm({ ...form, legal_entity_id: v })}>
                  <SelectTrigger><SelectValue placeholder={sr ? "Sva" : "All"} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">{sr ? "Sva" : "All"}</SelectItem>
                    {legalEntities.map((le: any) => <SelectItem key={le.id} value={le.id}>{le.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Balance preview */}
            {loadingBalance && <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>}
            {balancePreview && (
              <Card className="bg-muted/50">
                <CardContent className="pt-4 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">{sr ? "Naša potraživanja" : "Our Receivables"}</p>
                    <p className="text-lg font-bold font-mono">{fmtNum(Number(balancePreview.receivable_total))} {form.currency}</p>
                    <p className="text-xs text-muted-foreground">{balancePreview.open_invoices} {sr ? "otvorenih faktura" : "open invoices"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{sr ? "Naše obaveze" : "Our Payables"}</p>
                    <p className="text-lg font-bold font-mono">{fmtNum(Number(balancePreview.payable_total))} {form.currency}</p>
                    <p className="text-xs text-muted-foreground">{balancePreview.open_bills} {sr ? "otvorenih računa" : "open bills"}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid gap-2">
              <Label>{sr ? "Napomena" : "Notes"}</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => createMutation.mutate(form)} disabled={!form.partner_id || createMutation.isPending}>
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                <><FileText className="h-4 w-4 mr-1" />{sr ? "Kreiraj" : "Create"}</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
