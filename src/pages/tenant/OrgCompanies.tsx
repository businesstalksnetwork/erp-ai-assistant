import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2, Building2, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useState, useMemo } from "react";

interface OrgCompany {
  id: string; tenant_id: string; legal_name: string; display_name: string | null;
  pib: string | null; maticni_broj: string | null; is_internal: boolean; status: string;
  parent_id: string | null; legal_entity_id: string | null; created_at: string;
}

interface CompanyForm {
  legal_name: string; display_name: string; pib: string; maticni_broj: string;
  is_internal: boolean; status: string; parent_id: string; legal_entity_id: string;
}

const emptyForm: CompanyForm = {
  legal_name: "", display_name: "", pib: "", maticni_broj: "",
  is_internal: true, status: "active", parent_id: "", legal_entity_id: "",
};

export default function OrgCompanies() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<CompanyForm>(emptyForm);

  const { data: companies = [], isLoading } = useQuery({
    queryKey: ["org-companies", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("companies").select("*").eq("tenant_id", tenantId!).order("legal_name");
      return (data || []) as OrgCompany[];
    },
    enabled: !!tenantId,
  });

  const { data: legalEntities = [] } = useQuery({
    queryKey: ["legal-entities-list", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("legal_entities").select("id, name, pib").eq("tenant_id", tenantId!);
      return data || [];
    },
    enabled: !!tenantId,
  });

  const mutation = useMutation({
    mutationFn: async (f: CompanyForm) => {
      const payload = {
        tenant_id: tenantId!, legal_name: f.legal_name, display_name: f.display_name || null,
        pib: f.pib || null, maticni_broj: f.maticni_broj || null, is_internal: f.is_internal,
        status: f.status, parent_id: f.parent_id || null, legal_entity_id: f.legal_entity_id || null,
      };
      if (editId) {
        const { error } = await supabase.from("companies").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("companies").insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["org-companies"] }); setOpen(false); toast.success(t("success")); },
    onError: (e: Error) => toast.error(e.message),
  });

  const tree = useMemo(() => {
    const map = new Map<string | null, OrgCompany[]>();
    for (const c of companies) { const pid = c.parent_id || null; if (!map.has(pid)) map.set(pid, []); map.get(pid)!.push(c); }
    const result: (OrgCompany & { depth: number })[] = [];
    const walk = (parentId: string | null, depth: number) => { for (const c of map.get(parentId) || []) { result.push({ ...c, depth }); walk(c.id, depth + 1); } };
    walk(null, 0);
    return result;
  }, [companies]);

  const openAdd = () => { setEditId(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (c: OrgCompany) => {
    setEditId(c.id);
    setForm({ legal_name: c.legal_name, display_name: c.display_name || "", pib: c.pib || "", maticni_broj: c.maticni_broj || "", is_internal: c.is_internal ?? true, status: c.status, parent_id: c.parent_id || "", legal_entity_id: c.legal_entity_id || "" });
    setOpen(true);
  };
  const getParentName = (id: string | null) => companies.find(c => c.id === id)?.legal_name || "—";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("orgCompanies")}</h1>
        <Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" />{t("addCompany")}</Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("name")}</TableHead>
                <TableHead>{t("pib")}</TableHead>
                <TableHead>{t("parentCompany")}</TableHead>
                <TableHead>{t("legalEntity")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead>{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
              ) : tree.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">{t("noResults")}</TableCell></TableRow>
              ) : tree.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <div className="flex items-center gap-1" style={{ paddingLeft: `${c.depth * 1.5}rem` }}>
                      {c.depth > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{c.display_name || c.legal_name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{c.pib || "—"}</TableCell>
                  <TableCell>{c.parent_id ? getParentName(c.parent_id) : "—"}</TableCell>
                  <TableCell>{legalEntities.find(e => e.id === c.legal_entity_id)?.name || "—"}</TableCell>
                  <TableCell><Badge variant={c.status === "active" ? "default" : "secondary"}>{c.status === "active" ? t("active") : t("inactive")}</Badge></TableCell>
                  <TableCell><Button size="sm" variant="ghost" onClick={() => openEdit(c)}>{t("edit")}</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{editId ? t("editCompany") : t("addCompany")}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2"><Label>{t("name")} *</Label><Input value={form.legal_name} onChange={e => setForm({ ...form, legal_name: e.target.value })} /></div>
            <div className="grid gap-2"><Label>{t("displayName")}</Label><Input value={form.display_name} onChange={e => setForm({ ...form, display_name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>{t("pib")}</Label><Input value={form.pib} onChange={e => setForm({ ...form, pib: e.target.value })} /></div>
              <div className="grid gap-2"><Label>{t("maticniBroj")}</Label><Input value={form.maticni_broj} onChange={e => setForm({ ...form, maticni_broj: e.target.value })} /></div>
            </div>
            <div className="grid gap-2">
              <Label>{t("parentCompany")}</Label>
              <Select value={form.parent_id || "__none__"} onValueChange={v => setForm({ ...form, parent_id: v === "__none__" ? "" : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— {t("none")} —</SelectItem>
                  {companies.filter(c => c.id !== editId).map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.legal_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>{t("legalEntity")}</Label>
              <Select value={form.legal_entity_id || "__none__"} onValueChange={v => setForm({ ...form, legal_entity_id: v === "__none__" ? "" : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— {t("none")} —</SelectItem>
                  {legalEntities.map(e => (
                    <SelectItem key={e.id} value={e.id}>{e.name} ({e.pib})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
