import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Loader2, Search, Building2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/shared/PageHeader";
import { MobileFilterBar } from "@/components/shared/MobileFilterBar";
import { ResponsiveTable, type ResponsiveColumn } from "@/components/shared/ResponsiveTable";

interface PartnerForm {
  name: string; display_name: string; pib: string; maticni_broj: string;
  email: string; phone: string; website: string; address: string; city: string;
  postal_code: string; country: string; notes: string; type: string;
  contact_person: string; credit_limit: number; payment_terms_days: number;
  default_currency: string;
}

const emptyForm: PartnerForm = {
  name: "", display_name: "", pib: "", maticni_broj: "",
  email: "", phone: "", website: "", address: "", city: "",
  postal_code: "", country: "RS", notes: "", type: "customer",
  contact_person: "", credit_limit: 0, payment_terms_days: 30,
  default_currency: "RSD",
};

export default function Companies() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<PartnerForm>(emptyForm);
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [pibLooking, setPibLooking] = useState(false);

  const { data: partners = [], isLoading } = useQuery({
    queryKey: ["partners-crm", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("partners")
        .select("*, partner_category_assignments(category_id, company_categories(code, name, name_sr, color))")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["company-categories", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("company_categories").select("*").eq("tenant_id", tenantId!).order("sort_order");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const mutation = useMutation({
    mutationFn: async (f: PartnerForm) => {
      const payload = {
        tenant_id: tenantId!,
        name: f.name,
        display_name: f.display_name || null,
        pib: f.pib || null,
        maticni_broj: f.maticni_broj || null,
        email: f.email || null,
        phone: f.phone || null,
        website: f.website || null,
        address: f.address || null,
        city: f.city || null,
        postal_code: f.postal_code || null,
        country: f.country || "RS",
        notes: f.notes || null,
        type: f.type,
        contact_person: f.contact_person || null,
        credit_limit: f.credit_limit || 0,
        payment_terms_days: f.payment_terms_days || 30,
        default_currency: f.default_currency || "RSD",
        status: "active",
      };
      let partnerId = editId;
      if (editId) {
        const { error } = await supabase.from("partners").update(payload).eq("id", editId);
        if (error) throw error;
        await supabase.from("partner_category_assignments").delete().eq("partner_id", editId);
      } else {
        const { data, error } = await supabase.from("partners").insert([payload]).select("id").single();
        if (error) throw error;
        partnerId = data.id;
      }
      if (selectedCats.length > 0 && partnerId) {
        const assignments = selectedCats.map(catId => ({ partner_id: partnerId!, category_id: catId, tenant_id: tenantId! }));
        await supabase.from("partner_category_assignments").insert(assignments);
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["partners-crm"] }); setOpen(false); toast.success(t("success")); },
    onError: (e: Error) => toast.error(e.message),
  });

  const lookupPib = async () => {
    if (form.pib.length !== 9) { toast.error(t("pibMustBe9Digits")); return; }
    const { data: existing } = await supabase.from("partners").select("id, name").eq("tenant_id", tenantId!).eq("pib", form.pib);
    if (existing && existing.length > 0 && (!editId || existing[0].id !== editId)) {
      toast.error(`Partner sa PIB ${form.pib} već postoji: ${existing[0].name}`);
      return;
    }
    setPibLooking(true);
    try {
      const res = await supabase.functions.invoke("company-lookup", { body: { pib: form.pib } });
      if (res.error) throw res.error;
      const d = res.data;
      if (d?.found) {
        setForm(prev => ({
          ...prev,
          name: d.legal_name || prev.name,
          maticni_broj: d.maticni_broj || prev.maticni_broj,
          address: d.address || prev.address,
          city: d.city || prev.city,
          postal_code: d.postal_code || prev.postal_code,
          country: d.country || prev.country,
        }));
        toast.success(t("pibDataFound"));
      } else {
        toast.info(t("pibNotFound"));
      }
    } catch {
      toast.error(t("pibLookupError"));
    } finally {
      setPibLooking(false);
    }
  };

  const openAdd = () => { setEditId(null); setForm(emptyForm); setSelectedCats([]); setOpen(true); };
  const openEdit = (p: any) => {
    setEditId(p.id);
    setForm({
      name: p.name, display_name: p.display_name || "", pib: p.pib || "", maticni_broj: p.maticni_broj || "",
      email: p.email || "", phone: p.phone || "", website: p.website || "", address: p.address || "",
      city: p.city || "", postal_code: p.postal_code || "", country: p.country || "RS",
      notes: p.notes || "", type: p.type || "customer",
      contact_person: p.contact_person || "", credit_limit: p.credit_limit || 0,
      payment_terms_days: p.payment_terms_days || 30, default_currency: p.default_currency || "RSD",
    });
    setSelectedCats(p.partner_category_assignments?.map((a: any) => a.category_id) || []);
    setOpen(true);
  };

  const typeLabel = (type: string) => {
    const map: Record<string, string> = { customer: t("customer"), supplier: t("supplier"), both: t("both") };
    return map[type] || type;
  };

  const filtered = partners.filter((p: any) => {
    if (typeFilter !== "all" && p.type !== typeFilter) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return p.name?.toLowerCase().includes(s) || p.display_name?.toLowerCase().includes(s) || p.pib?.includes(s) || p.city?.toLowerCase().includes(s);
  });

  const columns: ResponsiveColumn<any>[] = [
    { key: "name", label: t("name"), primary: true, render: (p) => (
      <div className="flex items-center gap-2">
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">{p.display_name || p.name}</span>
      </div>
    )},
    { key: "pib", label: t("pib"), render: (p) => p.pib || "—" },
    { key: "city", label: t("city"), render: (p) => p.city || "—" },
    { key: "type", label: t("type"), render: (p) => <Badge variant="outline">{typeLabel(p.type)}</Badge> },
    { key: "categories", label: t("categories"), hideOnMobile: true, render: (p) => (
      <div className="flex gap-1 flex-wrap">
        {p.partner_category_assignments?.map((a: any) => (
          <Badge key={a.category_id} variant="outline" style={{ borderColor: a.company_categories?.color }}>
            {a.company_categories?.name_sr || a.company_categories?.name}
          </Badge>
        ))}
      </div>
    )},
    { key: "status", label: t("status"), render: (p) => (
      <Badge variant={p.is_active ? "default" : "secondary"}>
        {p.is_active ? t("active") : t("inactive")}
      </Badge>
    )},
    { key: "actions", label: t("actions"), showInCard: false, render: (p) => (
      <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openEdit(p); }}>{t("edit")}</Button>
    )},
  ];

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <PageHeader
        title={t("partners")}
        description={t("companies") + " — " + t("customer") + " / " + t("supplier")}
        icon={Building2}
        actions={<Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" />{t("addPartner")}</Button>}
      />

      <MobileFilterBar
        search={<Input placeholder={t("search")} value={search} onChange={e => setSearch(e.target.value)} />}
        filters={
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allTypes")}</SelectItem>
              <SelectItem value="customer">{t("customer")}</SelectItem>
              <SelectItem value="supplier">{t("supplier")}</SelectItem>
              <SelectItem value="both">{t("both")}</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      <ResponsiveTable
        data={filtered}
        columns={columns}
        keyExtractor={(p) => p.id}
        onRowClick={(p) => navigate(`/crm/companies/${p.id}`)}
        emptyMessage={t("noResults")}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? t("editPartner") : t("addPartner")}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="grid gap-2 sm:col-span-2">
                <Label>{t("pib")}</Label>
                <div className="flex gap-2">
                  <Input value={form.pib} onChange={e => setForm({ ...form, pib: e.target.value.replace(/\D/g, "").slice(0, 9) })} placeholder="9 cifara" />
                  <Button variant="outline" onClick={lookupPib} disabled={pibLooking || form.pib.length !== 9}>
                    {pibLooking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="grid gap-2">
                <Label>{t("maticniBroj")}</Label>
                <Input value={form.maticni_broj} onChange={e => setForm({ ...form, maticni_broj: e.target.value.replace(/\D/g, "").slice(0, 8) })} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>{t("name")} *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
              <div className="grid gap-2"><Label>{t("displayName")}</Label><Input value={form.display_name} onChange={e => setForm({ ...form, display_name: e.target.value })} /></div>
            </div>
            <div className="grid gap-2">
              <Label>{t("type")}</Label>
              <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="customer">{t("customer")}</SelectItem>
                  <SelectItem value="supplier">{t("supplier")}</SelectItem>
                  <SelectItem value="both">{t("both")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="grid gap-2"><Label>{t("email")}</Label><Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
              <div className="grid gap-2"><Label>{t("phone")}</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
              <div className="grid gap-2"><Label>{t("contactPerson")}</Label><Input value={form.contact_person} onChange={e => setForm({ ...form, contact_person: e.target.value })} /></div>
            </div>
            <div className="grid gap-2"><Label>{t("website")}</Label><Input value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} /></div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="grid gap-2"><Label>{t("address")}</Label><Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
              <div className="grid gap-2"><Label>{t("city")}</Label><Input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} /></div>
              <div className="grid gap-2"><Label>{t("postalCode")}</Label><Input value={form.postal_code} onChange={e => setForm({ ...form, postal_code: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="grid gap-2"><Label>{t("creditLimit")}</Label><Input type="number" value={form.credit_limit} onChange={e => setForm({ ...form, credit_limit: +e.target.value })} /></div>
              <div className="grid gap-2"><Label>{t("paymentTermsDays")}</Label><Input type="number" value={form.payment_terms_days} onChange={e => setForm({ ...form, payment_terms_days: +e.target.value })} /></div>
              <div className="grid gap-2">
                <Label>{t("defaultCurrency")}</Label>
                <Select value={form.default_currency} onValueChange={v => setForm({ ...form, default_currency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RSD">RSD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {categories.length > 0 && (
              <div className="grid gap-2">
                <Label>{t("categories")}</Label>
                <div className="flex flex-wrap gap-3">
                  {categories.map((cat: any) => (
                    <label key={cat.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={selectedCats.includes(cat.id)}
                        onCheckedChange={(checked) => {
                          setSelectedCats(prev => checked ? [...prev, cat.id] : prev.filter(id => id !== cat.id));
                        }}
                      />
                      <span style={{ color: cat.color }}>{cat.name_sr || cat.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            <div className="grid gap-2"><Label>{t("notes")}</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => mutation.mutate(form)} disabled={!form.name || mutation.isPending}>
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
