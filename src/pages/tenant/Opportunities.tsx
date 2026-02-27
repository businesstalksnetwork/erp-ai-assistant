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
import { Plus, Loader2, TrendingUp, X } from "lucide-react";
import { toast } from "sonner";
import { useState, useMemo } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PageHeader } from "@/components/shared/PageHeader";
import { useOpportunityStages } from "@/hooks/useOpportunityStages";

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
  const [searchParams] = useSearchParams();
  const urlFilter = searchParams.get("filter");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<OpportunityForm>(emptyForm);
  const [selectedPartnerIds, setSelectedPartnerIds] = useState<string[]>([]);
  const { data: stages = [] } = useOpportunityStages();

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

  // Fetch tags for all opportunities
  const { data: allTags = [] } = useQuery({
    queryKey: ["opportunity-tags-all", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("opportunity_tags")
        .select("*")
        .eq("tenant_id", tenantId!);
      return data || [];
    },
    enabled: !!tenantId,
  });

  const getOppTags = useMemo(() => {
    const map = new Map<string, any[]>();
    allTags.forEach((t: any) => {
      const arr = map.get(t.opportunity_id) || [];
      arr.push(t);
      map.set(t.opportunity_id, arr);
    });
    return (oppId: string) => map.get(oppId) || [];
  }, [allTags]);

  const { data: contactsList = [] } = useQuery({
    queryKey: ["contacts-list", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("contacts").select("id, first_name, last_name").eq("tenant_id", tenantId!).order("first_name");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: partnersList = [] } = useQuery({
    queryKey: ["partners-list-opp", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("partners").select("id, name").eq("tenant_id", tenantId!).eq("is_active", true).order("name");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const mutation = useMutation({
    mutationFn: async (f: OpportunityForm) => {
      const wonStage = stages.find(s => s.is_won);
      const lostStage = stages.find(s => s.is_lost);
      const closedAt = (wonStage && f.stage === wonStage.code) || (lostStage && f.stage === lostStage.code) ? new Date().toISOString() : null;
      const payload = {
        ...f, tenant_id: tenantId!, closed_at: closedAt,
        partner_id: f.partner_id || null, lead_id: f.lead_id || null,
        contact_id: f.contact_id || null, expected_close_date: f.expected_close_date || null,
      };
      let oppId = editId;
      if (editId) {
        const { error } = await supabase.from("opportunities").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("opportunities").insert([payload]).select("id").single();
        if (error) throw error;
        oppId = data.id;
      }

      // Sync opportunity_partners junction
      if (oppId) {
        await supabase.from("opportunity_partners").delete().eq("opportunity_id", oppId);
        if (selectedPartnerIds.length > 0) {
          const rows = selectedPartnerIds.map(pid => ({
            opportunity_id: oppId!, partner_id: pid, tenant_id: tenantId!,
          }));
          await supabase.from("opportunity_partners").insert(rows);
        }
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["opportunities"] }); setOpen(false); toast.success(t("success")); },
    onError: (e: Error) => toast.error(e.message),
  });

  const openAdd = () => { setEditId(null); setForm(emptyForm); setSelectedPartnerIds([]); setOpen(true); };
  const openEdit = async (o: any) => {
    setEditId(o.id);
    setForm({
      title: o.title, partner_id: o.partner_id, lead_id: o.lead_id, contact_id: o.contact_id,
      value: o.value, currency: o.currency, probability: o.probability, stage: o.stage,
      expected_close_date: o.expected_close_date || "", description: o.description || "", notes: o.notes || "",
    });
    // Load linked partners
    const { data: linked } = await supabase.from("opportunity_partners").select("partner_id").eq("opportunity_id", o.id);
    setSelectedPartnerIds((linked || []).map((l: any) => l.partner_id));
    setOpen(true);
  };

  const fmt = (n: number) => new Intl.NumberFormat("sr-RS", { style: "currency", currency: "RSD", maximumFractionDigits: 0 }).format(n);

  const stageColor = (s: string) => {
    const stage = stages.find(st => st.code === s);
    if (stage?.is_won) return "default";
    if (stage?.is_lost) return "destructive";
    return "secondary";
  };

  // Filter at-risk opportunities when URL filter is set
  const filteredOpps = useMemo(() => {
    if (urlFilter === "at_risk") {
      return opps.filter((o: any) => {
        const isHighValue = Number(o.value) > 100000;
        const isLowProb = Number(o.probability) <= 30;
        return isHighValue && isLowProb;
      });
    }
    return opps;
  }, [opps, urlFilter]);

  // Group by stage for Kanban
  const grouped = useMemo(() => stages.map(stage => {
    const items = filteredOpps.filter((o: any) => o.stage === stage.code);
    return {
      stage: stage.code,
      label: stage.name_sr || stage.name,
      color: stage.color,
      items,
      total: items.reduce((sum: number, o: any) => sum + (o.value || 0), 0),
    };
  }), [stages, filteredOpps]);

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
        description={t("opportunitiesDesc")}
        icon={TrendingUp}
        actions={<Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" />{t("addOpportunity")}</Button>}
      />

      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="overflow-x-auto -mx-2 px-2 pb-2">
          <div className="flex gap-4 min-w-max lg:min-w-0 lg:grid lg:grid-cols-5">
          {grouped.map(g => (
            <div key={g.stage} className="space-y-3 min-w-[250px] lg:min-w-0">
              <div className="flex items-center justify-between">
                <Badge variant={stageColor(g.stage) as any} className="text-xs" style={g.color ? { backgroundColor: g.color, color: "#fff" } : undefined}>{g.label}</Badge>
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
                      {(o.won_amount > 0 || o.lost_amount > 0) && (
                        <div className="flex gap-2 mt-1 text-xs">
                          {o.won_amount > 0 && <span className="text-emerald-600 font-medium">✓ {fmt(o.won_amount)}</span>}
                          {o.lost_amount > 0 && <span className="text-destructive font-medium">✗ {fmt(o.lost_amount)}</span>}
                        </div>
                      )}
                      {o.expected_close_date && (
                        <p className="text-xs text-muted-foreground mt-1">{o.expected_close_date}</p>
                      )}
                      {getOppTags(o.id).length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {getOppTags(o.id).map((tag: any) => (
                            <Badge key={tag.id} className="text-[10px] px-1.5 py-0" style={{ backgroundColor: tag.color, color: "#fff" }}>
                              {tag.tag}
                            </Badge>
                          ))}
                        </div>
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
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? t("editOpportunity") : t("addOpportunity")}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2"><Label>{t("title")} *</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
            <div className="grid gap-2"><Label>{t("description")}</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
            {/* Multi-partner selector */}
            <div className="grid gap-2">
              <Label>{t("opportunityPartners")}</Label>
              <div className="border rounded-md p-3 space-y-2 max-h-40 overflow-y-auto">
                {partnersList.map((p: any) => (
                  <div key={p.id} className="flex items-center gap-2">
                    <Checkbox checked={selectedPartnerIds.includes(p.id)}
                      onCheckedChange={(checked) => {
                        setSelectedPartnerIds(prev => checked ? [...prev, p.id] : prev.filter(id => id !== p.id));
                        if (checked && !form.partner_id) setForm(f => ({ ...f, partner_id: p.id }));
                      }} />
                    <span className="text-sm">{p.name}</span>
                  </div>
                ))}
              </div>
              {selectedPartnerIds.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {selectedPartnerIds.map(pid => {
                    const p = partnersList.find((x: any) => x.id === pid);
                    return p ? <Badge key={pid} variant="secondary" className="gap-1">{p.name}<X className="h-3 w-3 cursor-pointer" onClick={() => setSelectedPartnerIds(prev => prev.filter(id => id !== pid))} /></Badge> : null;
                  })}
                </div>
              )}
            </div>
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
                  <SelectContent>{stages.map(s => <SelectItem key={s.code} value={s.code}>{s.name_sr || s.name}</SelectItem>)}</SelectContent>
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
