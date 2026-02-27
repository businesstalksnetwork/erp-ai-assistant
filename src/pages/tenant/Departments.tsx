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
import { Plus, Loader2, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useState, useMemo } from "react";
import { useEmployeesList } from "@/hooks/useEmployeesList";

interface Dept {
  id: string; name: string; code: string; is_active: boolean;
  parent_id: string | null; company_id: string | null; manager_employee_id: string | null;
}

export default function Departments() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", code: "", is_active: true, company_id: "", parent_id: "", manager_employee_id: "" });

  const { data: departments = [], isLoading } = useQuery({
    queryKey: ["departments", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("departments").select("*").eq("tenant_id", tenantId!).order("code");
      return (data || []) as Dept[];
    },
    enabled: !!tenantId,
  });

  const { data: companies = [] } = useQuery({
    queryKey: ["org-companies", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("companies").select("id, legal_name").eq("tenant_id", tenantId!).order("legal_name");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: employees = [] } = useEmployeesList(false);

  const mutation = useMutation({
    mutationFn: async (f: typeof form) => {
      const payload = {
        name: f.name, code: f.code, is_active: f.is_active,
        company_id: f.company_id || null,
        parent_id: f.parent_id || null,
        manager_employee_id: f.manager_employee_id || null,
      };
      if (editId) {
        const { error } = await supabase.from("departments").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("departments").insert([{ ...payload, tenant_id: tenantId! }]);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["departments"] }); setOpen(false); toast.success(t("success")); },
    onError: (e: Error) => toast.error(e.message),
  });

  // Build tree
  const tree = useMemo(() => {
    const map = new Map<string | null, Dept[]>();
    for (const d of departments) {
      const pid = d.parent_id || null;
      if (!map.has(pid)) map.set(pid, []);
      map.get(pid)!.push(d);
    }
    const result: (Dept & { depth: number })[] = [];
    const walk = (parentId: string | null, depth: number) => {
      for (const d of map.get(parentId) || []) {
        result.push({ ...d, depth });
        walk(d.id, depth + 1);
      }
    };
    walk(null, 0);
    return result;
  }, [departments]);

  const openAdd = () => { setEditId(null); setForm({ name: "", code: "", is_active: true, company_id: "", parent_id: "", manager_employee_id: "" }); setOpen(true); };
  const openEdit = (d: Dept) => {
    setEditId(d.id);
    setForm({ name: d.name, code: d.code, is_active: d.is_active, company_id: d.company_id || "", parent_id: d.parent_id || "", manager_employee_id: d.manager_employee_id || "" });
    setOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("departments")}</h1>
        <Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" />{t("addDepartment")}</Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("code")}</TableHead>
                <TableHead>{t("name")}</TableHead>
                <TableHead>{t("parentDepartment" as any)}</TableHead>
                <TableHead>{t("company" as any)}</TableHead>
                <TableHead>{t("manager" as any)}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead>{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
              ) : tree.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">{t("noResults")}</TableCell></TableRow>
              ) : tree.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-mono">{d.code}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1" style={{ paddingLeft: `${d.depth * 1.5}rem` }}>
                      {d.depth > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                      {d.name}
                    </div>
                  </TableCell>
                  <TableCell>{d.parent_id ? departments.find(x => x.id === d.parent_id)?.name || "—" : "—"}</TableCell>
                  <TableCell>{d.company_id ? companies.find(c => c.id === d.company_id)?.legal_name || "—" : "—"}</TableCell>
                  <TableCell>{d.manager_employee_id ? (() => { const e = employees.find(e => e.id === d.manager_employee_id); return e ? `${e.first_name} ${e.last_name}` : "—"; })() : "—"}</TableCell>
                  <TableCell><Badge variant={d.is_active ? "default" : "secondary"}>{d.is_active ? t("active") : t("inactive")}</Badge></TableCell>
                  <TableCell><Button size="sm" variant="ghost" onClick={() => openEdit(d)}>{t("edit")}</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? t("editDepartment") : t("addDepartment")}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>{t("code")} *</Label><Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} /></div>
              <div className="grid gap-2"><Label>{t("name")} *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            </div>
            <div className="grid gap-2">
              <Label>{t("parentDepartment" as any)}</Label>
              <Select value={form.parent_id || "__none__"} onValueChange={v => setForm({ ...form, parent_id: v === "__none__" ? "" : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— {t("none" as any)} —</SelectItem>
                  {departments.filter(d => d.id !== editId).map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.code} — {d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>{t("company" as any)}</Label>
              <Select value={form.company_id || "__none__"} onValueChange={v => setForm({ ...form, company_id: v === "__none__" ? "" : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— {t("none" as any)} —</SelectItem>
                  {companies.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.legal_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>{t("manager" as any)}</Label>
              <Select value={form.manager_employee_id || "__none__"} onValueChange={v => setForm({ ...form, manager_employee_id: v === "__none__" ? "" : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— {t("none" as any)} —</SelectItem>
                  {employees.map(e => (
                    <SelectItem key={e.id} value={e.id}>{e.first_name} {e.last_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => mutation.mutate(form)} disabled={!form.name || !form.code || mutation.isPending}>
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
