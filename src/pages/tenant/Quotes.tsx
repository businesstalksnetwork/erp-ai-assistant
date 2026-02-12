import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
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
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

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
}

const emptyForm: QuoteForm = {
  quote_number: "", opportunity_id: null, partner_id: null, partner_name: "",
  quote_date: new Date().toISOString().split("T")[0], valid_until: "", status: "draft",
  currency: "RSD", notes: "",
};

export default function Quotes() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<QuoteForm>(emptyForm);

  const { data: quotes = [], isLoading } = useQuery({
    queryKey: ["quotes", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("quotes")
        .select("*, partners(name), opportunities(title)")
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

  const mutation = useMutation({
    mutationFn: async (f: QuoteForm) => {
      const payload = {
        ...f, tenant_id: tenantId!,
        partner_id: f.partner_id || null,
        opportunity_id: f.opportunity_id || null,
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

  const openAdd = () => { setEditId(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (q: any) => {
    setEditId(q.id);
    setForm({
      quote_number: q.quote_number, opportunity_id: q.opportunity_id, partner_id: q.partner_id,
      partner_name: q.partner_name, quote_date: q.quote_date, valid_until: q.valid_until || "",
      status: q.status, currency: q.currency, notes: q.notes || "",
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t("quotes")}</h1>
        <Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" />{t("addQuote")}</Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("quoteNumber")}</TableHead>
                <TableHead>{t("partner")}</TableHead>
                <TableHead>{t("opportunity")}</TableHead>
                <TableHead>{t("quoteDate")}</TableHead>
                <TableHead>{t("validUntil")}</TableHead>
                <TableHead className="text-right">{t("total")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead>{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
              ) : quotes.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">{t("noResults")}</TableCell></TableRow>
              ) : quotes.map((q: any) => (
                <TableRow key={q.id}>
                  <TableCell className="font-medium">{q.quote_number}</TableCell>
                  <TableCell>{q.partners?.name || q.partner_name || "—"}</TableCell>
                  <TableCell>{q.opportunities?.title || "—"}</TableCell>
                  <TableCell>{q.quote_date}</TableCell>
                  <TableCell>{q.valid_until || "—"}</TableCell>
                  <TableCell className="text-right">{fmt(q.total, q.currency)}</TableCell>
                  <TableCell><Badge variant={statusColor(q.status) as any}>{t(q.status as any) || q.status}</Badge></TableCell>
                  <TableCell><Button size="sm" variant="ghost" onClick={() => openEdit(q)}>{t("edit")}</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? t("editQuote") : t("addQuote")}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
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
            <div className="grid grid-cols-2 gap-4">
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
            <div className="grid grid-cols-3 gap-4">
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
            <div className="grid gap-2"><Label>{t("notes")}</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => mutation.mutate(form)} disabled={!form.quote_number || mutation.isPending}>
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
