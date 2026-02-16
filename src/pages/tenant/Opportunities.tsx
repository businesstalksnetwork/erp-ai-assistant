import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/shared/PageHeader";

const STAGES = ["qualification", "proposal", "negotiation", "closed_won", "closed_lost"] as const;

interface OpportunityForm {
  title: string; partner_id: string | null; lead_id: string | null; contact_id: string | null;
  value: number; currency: string; probability: number; stage: string;
  expected_close_date: string; description: string; notes: string;
}

const emptyForm: OpportunityForm = {
  title: "", partner_id: null, lead_id: null, contact_id: null, value: 0, currency: "RSD",
  probability: 50, stage: "qualification", expected_close_date: "", description: "", notes: "",
};

export default function Opportunities() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<OpportunityForm>(emptyForm);

  const { data: opps = [], isLoading } = useQuery({
    queryKey: ["opportunities", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("opportunities")
        .select("*, partners(name), leads(name, first_name, last_name), contacts(first_name, last_name)")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: contactsList = [] } = useQuery({
    queryKey: ["contacts-list", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("contacts").select("id, first_name, last_name").eq("tenant_id", tenantId!).order("first_name");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const mutation = useMutation({
    mutationFn: async (f: OpportunityForm) => {
      const closedAt = (f.stage === "closed_won" || f.stage === "closed_lost") ? new Date().toISOString() : null;
      const payload = {
        ...f, tenant_id: tenantId!, closed_at: closedAt,
        partner_id: f.partner_id || null, lead_id: f.lead_id || null,
        contact_id: f.contact_id || null, expected_close_date: f.expected_close_date || null,
      };
      if (editId) {
        const { error } = await supabase.from("opportunities").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("opportunities").insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["opportunities"] }); setOpen(false); toast.success(t("success")); },
    onError: (e: Error) => toast.error(e.message),
  });

  const openAdd = () => { setEditId(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (o: any) => {
    setEditId(o.id);
    setForm({
      title: o.title, partner_id: o.partner_id, lead_id: o.lead_id, contact_id: o.contact_id,
      value: o.value, currency: o.currency, probability: o.probability, stage: o.stage,
      expected_close_date: o.expected_close_date || "", description: o.description || "", notes: o.notes || "",
    });
    setOpen(true);
  };

  const fmt = (n: number) => new Intl.NumberFormat("sr-RS", { style: "currency", currency: "RSD", maximumFractionDigits: 0 }).format(n);

  const stageColor = (s: string) => {
    if (s === "closed_won") return "default";
    if (s === "closed_lost") return "destructive";
    return "secondary";
  };

  // Group by stage for Kanban
  const grouped = STAGES.map(stage => ({
    stage,
    items: opps.filter((o: any) => o.stage === stage),
    total: opps.filter((o: any) => o.stage === stage).reduce((sum: number, o: any) => sum + (o.value || 0), 0),
  }));

  const getContactName = (o: any) => {
    if (o.contacts) return `${o.contacts.first_name} ${o.contacts.last_name || ""}`;
    if (o.leads) return o.leads.first_name || o.leads.name;
    if (o.partners) return o.partners.name;
    return "—";
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <PageHeader
        title={t("opportunities")}
        description={"Sales pipeline and deal tracking"}
        icon={TrendingUp}
        actions={<Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" />{t("addOpportunity")}</Button>}
      />

      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
          {grouped.map(g => (
            <div key={g.stage} className="space-y-3">
              <div className="flex items-center justify-between">
                <Badge variant={stageColor(g.stage) as any} className="text-xs">{t(g.stage as any)}</Badge>
                <span className="text-xs text-muted-foreground">{g.items.length}</span>
              </div>
              <div className="text-xs font-medium text-muted-foreground">{fmt(g.total)}</div>
              <div className="space-y-2">
                {g.items.map((o: any) => (
                  <Card key={o.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/crm/opportunities/${o.id}`)}>
                    <CardContent className="p-3">
                      <p className="font-medium text-sm truncate">{o.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">{getContactName(o)}</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-sm font-bold">{fmt(o.value)}</span>
                        <span className="text-xs text-muted-foreground">{o.probability}%</span>
                      </div>
                      {o.expected_close_date && (
                        <p className="text-xs text-muted-foreground mt-1">{o.expected_close_date}</p>
                      )}
                    </CardContent>
                  </Card>
                ))}
                {g.items.length === 0 && (
                  <div className="text-center text-xs text-muted-foreground py-4 border border-dashed rounded">{t("noResults")}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? t("editOpportunity") : t("addOpportunity")}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2"><Label>{t("title")} *</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
            <div className="grid gap-2"><Label>{t("description")}</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{t("contactPerson")}</Label>
                <Select value={form.contact_id || "__none"} onValueChange={v => setForm({ ...form, contact_id: v === "__none" ? null : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">—</SelectItem>
                    {contactsList.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name || ""}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>{t("stage")}</Label>
                <Select value={form.stage} onValueChange={v => setForm({ ...form, stage: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STAGES.map(s => <SelectItem key={s} value={s}>{t(s as any)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="grid gap-2"><Label>{t("value")} *</Label><Input type="number" value={form.value} onChange={e => setForm({ ...form, value: Number(e.target.value) })} /></div>
              <div className="grid gap-2">
                <Label>{t("currency")}</Label>
                <Select value={form.currency} onValueChange={v => setForm({ ...form, currency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RSD">RSD</SelectItem><SelectItem value="EUR">EUR</SelectItem><SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2"><Label>{t("probability")} (%)</Label><Input type="number" min={0} max={100} value={form.probability} onChange={e => setForm({ ...form, probability: Number(e.target.value) })} /></div>
            </div>
            <div className="grid gap-2"><Label>{t("expectedCloseDate")}</Label><Input type="date" value={form.expected_close_date} onChange={e => setForm({ ...form, expected_close_date: e.target.value })} /></div>
            <div className="grid gap-2"><Label>{t("notes")}</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => mutation.mutate(form)} disabled={!form.title || mutation.isPending}>
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
