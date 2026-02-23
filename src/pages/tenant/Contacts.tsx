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
import { Plus, Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/shared/PageHeader";
import { MobileFilterBar } from "@/components/shared/MobileFilterBar";
import { ResponsiveTable, type ResponsiveColumn } from "@/components/shared/ResponsiveTable";

const TYPES = ["customer", "supplier", "prospect"] as const;
const SENIORITY = ["c_level", "executive", "senior_manager", "manager", "senior", "mid", "junior", "intern"] as const;
const FUNCTIONS = ["management", "sales", "marketing", "finance", "hr", "it", "operations", "legal", "procurement", "production", "other"] as const;
const CONTACT_ROLES = ["decision_maker", "influencer", "champion", "end_user", "billing", "technical", "primary"] as const;

const ROLE_LABELS: Record<string, string> = {
  decision_maker: "decisionMaker",
  influencer: "influencer",
  champion: "champion",
  end_user: "endUser",
  billing: "billing",
  technical: "technical",
  primary: "primaryContact",
};

interface ContactForm {
  first_name: string; last_name: string; email: string; phone: string;
  type: string; seniority_level: string; function_area: string;
  company_name: string; address: string; city: string; notes: string;
  company_id: string; job_title: string; contact_role: string;
}

const emptyForm: ContactForm = {
  first_name: "", last_name: "", email: "", phone: "",
  type: "prospect", seniority_level: "", function_area: "",
  company_name: "", address: "", city: "", notes: "",
  company_id: "", job_title: "", contact_role: "",
};

export default function Contacts() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<ContactForm>(emptyForm);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ["contacts", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("contacts")
        .select("*, contact_company_assignments(company_id, partner_id, job_title, partners(id, name, display_name))")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: companiesList = [] } = useQuery({
    queryKey: ["partners-list", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("partners").select("id, name, display_name").eq("tenant_id", tenantId!).eq("is_active", true).order("name");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const mutation = useMutation({
    mutationFn: async (f: ContactForm) => {
      const { company_id, job_title, contact_role, ...contactData } = f;
      const payload = {
        ...contactData, tenant_id: tenantId!,
        seniority_level: contactData.seniority_level || null,
        function_area: contactData.function_area || null,
      };
      let contactId = editId;
      if (editId) {
        const { error } = await supabase.from("contacts").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("contacts").insert([payload]).select("id").single();
        if (error) throw error;
        contactId = data.id;
      }
      if (company_id && contactId) {
        if (editId) await supabase.from("contact_company_assignments").delete().eq("contact_id", editId);
        await supabase.from("contact_company_assignments").insert([{
          contact_id: contactId, company_id, partner_id: company_id, tenant_id: tenantId!, job_title: job_title || null, is_primary: true, role: contact_role || null,
        }]);
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["contacts"] }); setOpen(false); toast.success(t("success")); },
    onError: (e: Error) => toast.error(e.message),
  });

  const openAdd = () => { setEditId(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (c: any) => {
    const assignment = c.contact_company_assignments?.[0];
    setEditId(c.id);
    setForm({
      first_name: c.first_name, last_name: c.last_name || "", email: c.email || "", phone: c.phone || "",
      type: c.type || "prospect", seniority_level: c.seniority_level || "", function_area: c.function_area || "",
      company_name: c.company_name || "", address: c.address || "", city: c.city || "", notes: c.notes || "",
      company_id: assignment?.partner_id || assignment?.company_id || "", job_title: assignment?.job_title || "",
      contact_role: assignment?.role || "",
    });
    setOpen(true);
  };

  const filtered = contacts.filter((c: any) => {
    if (typeFilter !== "all" && c.type !== typeFilter) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return `${c.first_name} ${c.last_name}`.toLowerCase().includes(s) || c.email?.toLowerCase().includes(s) || c.phone?.includes(s);
  });

  const columns: ResponsiveColumn<any>[] = [
    { key: "name", label: t("name"), primary: true, render: (c) => <span className="font-medium">{c.first_name} {c.last_name || ""}</span> },
    { key: "email", label: t("email"), render: (c) => c.email || "—" },
    { key: "phone", label: t("phone"), hideOnMobile: true, render: (c) => c.phone || "—" },
    { key: "type", label: t("type"), render: (c) => <Badge variant="secondary">{t(c.type as any)}</Badge> },
    { key: "company", label: t("company"), hideOnMobile: true, render: (c) => (
      <>
        {c.contact_company_assignments?.map((a: any) => (
          <Badge key={a.partner_id || a.company_id} variant="outline" className="cursor-pointer mr-1"
            onClick={(e) => { e.stopPropagation(); navigate(`/crm/companies/${a.partner_id || a.company_id}`); }}>
            {a.partners?.display_name || a.partners?.name || "—"}
          </Badge>
        ))}
        {(!c.contact_company_assignments || c.contact_company_assignments.length === 0) && "—"}
      </>
    )},
    { key: "actions", label: t("actions"), showInCard: false, render: (c) => (
      <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openEdit(c); }}>{t("edit")}</Button>
    )},
  ];

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <PageHeader
        title={t("contacts")}
        description={"Your contacts directory"}
        icon={Users}
        actions={<Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" />{t("addContact")}</Button>}
      />

      <MobileFilterBar
        search={<Input placeholder={t("search")} value={search} onChange={e => setSearch(e.target.value)} />}
        filters={
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allTypes")}</SelectItem>
              {TYPES.map(ty => <SelectItem key={ty} value={ty}>{t(ty as any)}</SelectItem>)}
            </SelectContent>
          </Select>
        }
      />

      <ResponsiveTable
        data={filtered}
        columns={columns}
        keyExtractor={(c) => c.id}
        onRowClick={(c) => navigate(`/crm/contacts/${c.id}`)}
        emptyMessage={t("noResults")}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? t("editContact") : t("addContact")}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>{t("firstName")} *</Label><Input value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} /></div>
              <div className="grid gap-2"><Label>{t("lastName")}</Label><Input value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>{t("email")}</Label><Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
              <div className="grid gap-2"><Label>{t("phone")}</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{t("company")}</Label>
                <Select value={form.company_id || "__none"} onValueChange={v => setForm({ ...form, company_id: v === "__none" ? "" : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">—</SelectItem>
                     {companiesList.map((co: any) => <SelectItem key={co.id} value={co.id}>{co.display_name || co.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2"><Label>{t("jobTitle")}</Label><Input value={form.job_title} onChange={e => setForm({ ...form, job_title: e.target.value })} /></div>
              <div className="grid gap-2">
                <Label>{t("contactRole")}</Label>
                <Select value={form.contact_role || "__none"} onValueChange={v => setForm({ ...form, contact_role: v === "__none" ? "" : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">{t("noRole")}</SelectItem>
                    {CONTACT_ROLES.map(r => <SelectItem key={r} value={r}>{t(ROLE_LABELS[r] as any)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label>{t("type")}</Label>
                <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TYPES.map(ty => <SelectItem key={ty} value={ty}>{t(ty as any)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>{t("seniorityLevel")}</Label>
                <Select value={form.seniority_level || "__none"} onValueChange={v => setForm({ ...form, seniority_level: v === "__none" ? "" : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">—</SelectItem>
                    {SENIORITY.map(s => <SelectItem key={s} value={s}>{t(s as any) || s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>{t("functionArea")}</Label>
                <Select value={form.function_area || "__none"} onValueChange={v => setForm({ ...form, function_area: v === "__none" ? "" : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">—</SelectItem>
                    {FUNCTIONS.map(f => <SelectItem key={f} value={f}>{t(f as any) || f}</SelectItem>)}
                  </SelectContent>
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
