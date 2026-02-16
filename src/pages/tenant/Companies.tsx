import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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

interface CompanyForm {
  legal_name: string; display_name: string; pib: string; maticni_broj: string;
  email: string; phone: string; website: string; address: string; city: string;
  postal_code: string; country: string; notes: string; is_internal: boolean;
}

const emptyForm: CompanyForm = {
  legal_name: "", display_name: "", pib: "", maticni_broj: "",
  email: "", phone: "", website: "", address: "", city: "",
  postal_code: "", country: "Srbija", notes: "", is_internal: false,
};

export default function Companies() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<CompanyForm>(emptyForm);
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [pibLooking, setPibLooking] = useState(false);

  const { data: companies = [], isLoading } = useQuery({
    queryKey: ["companies", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("companies")
        .select("*, company_category_assignments(category_id, company_categories(code, name, name_sr, color))")
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
    mutationFn: async (f: CompanyForm) => {
      const payload = { ...f, tenant_id: tenantId! };
      let companyId = editId;
      if (editId) {
        const { error } = await supabase.from("companies").update(payload).eq("id", editId);
        if (error) throw error;
        await supabase.from("company_category_assignments").delete().eq("company_id", editId);
      } else {
        const { data, error } = await supabase.from("companies").insert([payload]).select("id").single();
        if (error) throw error;
        companyId = data.id;
      }
      if (selectedCats.length > 0 && companyId) {
        const assignments = selectedCats.map(catId => ({ company_id: companyId!, category_id: catId, tenant_id: tenantId! }));
        await supabase.from("company_category_assignments").insert(assignments);
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["companies"] }); setOpen(false); toast.success(t("success")); },
    onError: (e: Error) => toast.error(e.message),
  });

  const lookupPib = async () => {
    if (form.pib.length !== 9) { toast.error("PIB mora imati 9 cifara"); return; }
    const { data: existing } = await supabase.from("companies").select("id, legal_name").eq("tenant_id", tenantId!).eq("pib", form.pib);
    if (existing && existing.length > 0 && (!editId || existing[0].id !== editId)) {
      toast.error(`Kompanija sa PIB ${form.pib} već postoji: ${existing[0].legal_name}`);
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
          legal_name: d.legal_name || prev.legal_name,
          maticni_broj: d.maticni_broj || prev.maticni_broj,
          address: d.address || prev.address,
          city: d.city || prev.city,
          postal_code: d.postal_code || prev.postal_code,
          country: d.country || prev.country,
        }));
        toast.success("Podaci pronađeni");
      } else {
        toast.info("PIB nije pronađen u registru");
      }
    } catch {
      toast.error("Greška pri pretrazi PIB-a");
    } finally {
      setPibLooking(false);
    }
  };

  const openAdd = () => { setEditId(null); setForm(emptyForm); setSelectedCats([]); setOpen(true); };
  const openEdit = (c: any) => {
    setEditId(c.id);
    setForm({
      legal_name: c.legal_name, display_name: c.display_name || "", pib: c.pib || "", maticni_broj: c.maticni_broj || "",
      email: c.email || "", phone: c.phone || "", website: c.website || "", address: c.address || "",
      city: c.city || "", postal_code: c.postal_code || "", country: c.country || "Srbija",
      notes: c.notes || "", is_internal: c.is_internal || false,
    });
    setSelectedCats(c.company_category_assignments?.map((a: any) => a.category_id) || []);
    setOpen(true);
  };

  const filtered = companies.filter((c: any) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return c.legal_name?.toLowerCase().includes(s) || c.pib?.includes(s) || c.city?.toLowerCase().includes(s);
  });

  const columns: ResponsiveColumn<any>[] = [
    { key: "name", label: t("name"), primary: true, render: (c) => (
      <div className="flex items-center gap-2">
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">{c.display_name || c.legal_name}</span>
      </div>
    )},
    { key: "pib", label: t("pib"), render: (c) => c.pib || "—" },
    { key: "city", label: t("city"), render: (c) => c.city || "—" },
    { key: "email", label: t("email"), hideOnMobile: true, render: (c) => c.email || "—" },
    { key: "categories", label: t("categories"), hideOnMobile: true, render: (c) => (
      <div className="flex gap-1 flex-wrap">
        {c.company_category_assignments?.map((a: any) => (
          <Badge key={a.category_id} variant="outline" style={{ borderColor: a.company_categories?.color }}>
            {a.company_categories?.name_sr || a.company_categories?.name}
          </Badge>
        ))}
      </div>
    )},
    { key: "status", label: t("status"), render: (c) => <Badge variant={c.status === "active" ? "default" : "secondary"}>{t(c.status as any)}</Badge> },
    { key: "actions", label: t("actions"), showInCard: false, render: (c) => (
      <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openEdit(c); }}>{t("edit")}</Button>
    )},
  ];

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <PageHeader
        title={t("companies")}
        description={"Company registry and CRM"}
        icon={Building2}
        actions={<Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" />{t("addCompany")}</Button>}
      />

      <MobileFilterBar
        search={<Input placeholder={t("search")} value={search} onChange={e => setSearch(e.target.value)} />}
        filters={<></>}
      />

      <ResponsiveTable
        data={filtered}
        columns={columns}
        keyExtractor={(c) => c.id}
        onRowClick={(c) => navigate(`/crm/companies/${c.id}`)}
        emptyMessage={t("noResults")}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? t("editCompany") : t("addCompany")}</DialogTitle></DialogHeader>
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
              <div className="grid gap-2"><Label>{t("legalName")} *</Label><Input value={form.legal_name} onChange={e => setForm({ ...form, legal_name: e.target.value })} /></div>
              <div className="grid gap-2"><Label>{t("displayName")}</Label><Input value={form.display_name} onChange={e => setForm({ ...form, display_name: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>{t("email")}</Label><Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
              <div className="grid gap-2"><Label>{t("phone")}</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
            </div>
            <div className="grid gap-2"><Label>{t("website")}</Label><Input value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} /></div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="grid gap-2"><Label>{t("address")}</Label><Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
              <div className="grid gap-2"><Label>{t("city")}</Label><Input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} /></div>
              <div className="grid gap-2"><Label>{t("postalCode")}</Label><Input value={form.postal_code} onChange={e => setForm({ ...form, postal_code: e.target.value })} /></div>
            </div>
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
            <div className="grid gap-2"><Label>{t("notes")}</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => mutation.mutate(form)} disabled={!form.legal_name || mutation.isPending}>
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
