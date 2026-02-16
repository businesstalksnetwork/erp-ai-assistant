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
import { Plus, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

const TYPES = ["customer", "supplier", "prospect"] as const;
const SENIORITY = ["c_level", "executive", "senior_manager", "manager", "senior", "mid", "junior", "intern"] as const;
const FUNCTIONS = ["management", "sales", "marketing", "finance", "hr", "it", "operations", "legal", "procurement", "production", "other"] as const;

interface ContactForm {
  first_name: string; last_name: string; email: string; phone: string;
  type: string; seniority_level: string; function_area: string;
  company_name: string; address: string; city: string; notes: string;
  company_id: string; job_title: string;
}

const emptyForm: ContactForm = {
  first_name: "", last_name: "", email: "", phone: "",
  type: "prospect", seniority_level: "", function_area: "",
  company_name: "", address: "", city: "", notes: "",
  company_id: "", job_title: "",
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
        .select("*, contact_company_assignments(company_id, job_title, companies(id, legal_name, display_name))")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: companiesList = [] } = useQuery({
    queryKey: ["companies-list", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("companies").select("id, legal_name, display_name").eq("tenant_id", tenantId!).eq("status", "active").order("legal_name");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const mutation = useMutation({
    mutationFn: async (f: ContactForm) => {
      const { company_id, job_title, ...contactData } = f;
      const payload = {
        ...contactData,
        tenant_id: tenantId!,
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
      // Link company if selected
      if (company_id && contactId) {
        if (editId) await supabase.from("contact_company_assignments").delete().eq("contact_id", editId);
        await supabase.from("contact_company_assignments").insert([{
          contact_id: contactId, company_id, tenant_id: tenantId!, job_title: job_title || null, is_primary: true,
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
      company_id: assignment?.company_id || "", job_title: assignment?.job_title || "",
    });
    setOpen(true);
  };

  const filtered = contacts.filter((c: any) => {
    if (typeFilter !== "all" && c.type !== typeFilter) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return `${c.first_name} ${c.last_name}`.toLowerCase().includes(s) || c.email?.toLowerCase().includes(s) || c.phone?.includes(s);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("contacts")}</h1>
        <Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" />{t("addContact")}</Button>
      </div>

      <div className="flex gap-4 items-center">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder={t("search")} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allTypes")}</SelectItem>
            {TYPES.map(ty => <SelectItem key={ty} value={ty}>{t(ty as any)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("name")}</TableHead>
                <TableHead>{t("email")}</TableHead>
                <TableHead>{t("phone")}</TableHead>
                <TableHead>{t("type")}</TableHead>
                <TableHead>{t("company")}</TableHead>
                <TableHead>{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">{t("noResults")}</TableCell></TableRow>
              ) : filtered.map((c: any) => (
                <TableRow key={c.id} className="cursor-pointer" onClick={() => navigate(`/crm/contacts/${c.id}`)}>
                  <TableCell className="font-medium">{c.first_name} {c.last_name || ""}</TableCell>
                  <TableCell>{c.email || "—"}</TableCell>
                  <TableCell>{c.phone || "—"}</TableCell>
                  <TableCell><Badge variant="secondary">{t(c.type as any)}</Badge></TableCell>
                  <TableCell>
                    {c.contact_company_assignments?.map((a: any) => (
                      <Badge key={a.company_id} variant="outline" className="cursor-pointer mr-1"
                        onClick={(e) => { e.stopPropagation(); navigate(`/crm/companies/${a.company_id}`); }}>
                        {a.companies?.display_name || a.companies?.legal_name}
                      </Badge>
                    ))}
                    {(!c.contact_company_assignments || c.contact_company_assignments.length === 0) && "—"}
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openEdit(c); }}>{t("edit")}</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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
                    {companiesList.map((co: any) => <SelectItem key={co.id} value={co.id}>{co.display_name || co.legal_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2"><Label>{t("jobTitle")}</Label><Input value={form.job_title} onChange={e => setForm({ ...form, job_title: e.target.value })} /></div>
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
