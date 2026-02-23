import { useLanguage } from "@/i18n/LanguageContext";
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
import { Plus, Loader2, ArrowRight, Target } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/shared/PageHeader";
import { MobileFilterBar } from "@/components/shared/MobileFilterBar";
import { ResponsiveTable, type ResponsiveColumn } from "@/components/shared/ResponsiveTable";
import { MobileActionMenu, type ActionItem } from "@/components/shared/MobileActionMenu";

interface LeadForm {
  first_name: string; last_name: string; email: string; phone: string;
  company: string; job_title: string; source: string; status: string; notes: string;
}

const emptyForm: LeadForm = {
  first_name: "", last_name: "", email: "", phone: "",
  company: "", job_title: "", source: "website", status: "new", notes: "",
};

const STATUSES = ["new", "contacted", "qualified", "converted", "lost"] as const;
const SOURCES = ["website", "referral", "cold_call", "social_media", "advertisement", "trade_show", "other"] as const;

export default function Leads() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<LeadForm>(emptyForm);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["leads", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("leads").select("*").eq("tenant_id", tenantId!).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!tenantId,
  });

  const mutation = useMutation({
    mutationFn: async (f: LeadForm) => {
      const payload = { ...f, name: `${f.first_name} ${f.last_name}`.trim(), tenant_id: tenantId! };
      if (editId) {
        const { error } = await supabase.from("leads").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("leads").insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["leads"] }); setOpen(false); toast.success(t("success")); },
    onError: (e: Error) => toast.error(e.message),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("leads").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leads"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const convertMutation = useMutation({
    mutationFn: async (lead: any) => {
      const { data: contact, error: contactErr } = await supabase.from("contacts").insert([{
        tenant_id: tenantId!, first_name: lead.first_name || lead.name, last_name: lead.last_name || "",
        email: lead.email || null, phone: lead.phone || null, type: "prospect", company_name: lead.company || null,
      }]).select("id").single();
      if (contactErr) throw contactErr;
      const { error: oppErr } = await supabase.from("opportunities").insert([{
        tenant_id: tenantId!, title: `${lead.first_name || lead.name} ${lead.last_name || ""}`.trim(),
        lead_id: lead.id, contact_id: contact.id, value: 0, currency: "RSD", probability: 50, stage: "qualification",
        notes: lead.notes || "",
      }]);
      if (oppErr) throw oppErr;
      await supabase.from("leads").update({ status: "converted", contact_id: contact.id }).eq("id", lead.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["opportunities"] });
      toast.success(t("conversionSuccess"));
      navigate("/crm/opportunities");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openAdd = () => { setEditId(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (l: any) => {
    setEditId(l.id);
    setForm({
      first_name: l.first_name || l.name || "", last_name: l.last_name || "",
      email: l.email || "", phone: l.phone || "", company: l.company || "",
      job_title: l.job_title || "", source: l.source || "website", status: l.status, notes: l.notes || "",
    });
    setOpen(true);
  };

  const statusColor = (s: string) => {
    switch (s) {
      case "new": return "default"; case "contacted": return "secondary"; case "qualified": return "outline";
      case "converted": return "default"; case "lost": return "destructive"; default: return "secondary";
    }
  };

  const filtered = leads.filter((l: any) => {
    if (statusFilter !== "all" && l.status !== statusFilter) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    const name = `${l.first_name || l.name || ""} ${l.last_name || ""}`.toLowerCase();
    return name.includes(s) || l.email?.toLowerCase().includes(s) || l.company?.toLowerCase().includes(s);
  });

  const columns: ResponsiveColumn<any>[] = [
    { key: "name", label: t("name"), primary: true, render: (l) => <span className="font-medium">{l.first_name || l.name} {l.last_name || ""}</span> },
    { key: "company", label: t("company"), render: (l) => l.company || "—" },
    { key: "email", label: t("email"), hideOnMobile: true, render: (l) => l.email || "—" },
    { key: "phone", label: t("phone"), hideOnMobile: true, render: (l) => l.phone || "—" },
    { key: "source", label: t("leadSource"), hideOnMobile: true, render: (l) => t(l.source as any) || l.source },
    { key: "status", label: t("status"), render: (l) => <Badge variant={statusColor(l.status) as any} className="text-xs">{t(l.status as any)}</Badge> },
    { key: "actions", label: t("actions"), showInCard: false, render: (l) => {
      const actions: ActionItem[] = [
        { label: t("edit"), onClick: () => openEdit(l) },
      ];
      if (l.status !== "converted" && l.status !== "lost") {
        actions.push({ label: t("convertToOpportunity"), icon: <ArrowRight className="h-3 w-3" />, onClick: () => convertMutation.mutate(l) });
      }
      return <MobileActionMenu actions={actions} />;
    }},
  ];

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <PageHeader
        title={t("leads")}
        description={"Track and convert your sales leads"}
        icon={Target}
        actions={<Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" />{t("addLead")}</Button>}
      />

      <MobileFilterBar
        search={
          <Input placeholder={t("search")} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        }
        filters={
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allStatuses")}</SelectItem>
              {STATUSES.map(s => <SelectItem key={s} value={s}>{t(s as any) || s}</SelectItem>)}
            </SelectContent>
          </Select>
        }
      />

      <ResponsiveTable
        data={filtered}
        columns={columns}
        keyExtractor={(l) => l.id}
        emptyMessage={t("noResults")}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? t("editLead") : t("addLead")}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>{t("firstName" as any)} *</Label><Input value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} /></div>
              <div className="grid gap-2"><Label>{t("lastName" as any)}</Label><Input value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>{t("email")}</Label><Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
              <div className="grid gap-2"><Label>{t("phone")}</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>{t("company")}</Label><Input value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} /></div>
              <div className="grid gap-2"><Label>{t("jobTitle" as any)}</Label><Input value={form.job_title} onChange={e => setForm({ ...form, job_title: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{t("leadSource")}</Label>
                <Select value={form.source} onValueChange={v => setForm({ ...form, source: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{SOURCES.map(s => <SelectItem key={s} value={s}>{t(s as any) || s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>{t("status")}</Label>
                <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{t(s as any) || s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2"><Label>{t("notes")}</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => mutation.mutate(form)} disabled={!form.first_name || mutation.isPending}>
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
