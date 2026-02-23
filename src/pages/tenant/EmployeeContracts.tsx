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
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

interface ContractForm {
  employee_id: string;
  contract_type: string;
  start_date: string;
  end_date: string;
  gross_salary: number;
  net_salary: number;
  working_hours_per_week: number;
  currency: string;
  is_active: boolean;
  position_template_id: string;
}

const emptyForm: ContractForm = {
  employee_id: "",
  contract_type: "indefinite",
  start_date: new Date().toISOString().split("T")[0],
  end_date: "",
  gross_salary: 0,
  net_salary: 0,
  working_hours_per_week: 40,
  currency: "RSD",
  is_active: true,
  position_template_id: "",
};

export default function EmployeeContracts() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<ContractForm>(emptyForm);

  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ["employee-contracts", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("employee_contracts")
        .select("*, employees(full_name, position, department_id, departments(name)), position_templates(name)")
        .eq("tenant_id", tenantId!)
        .order("start_date", { ascending: false });
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["employees-list", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("employees").select("id, full_name").eq("tenant_id", tenantId!).eq("status", "active").order("full_name");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: positionTemplates = [] } = useQuery({
    queryKey: ["position-templates-list", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("position_templates").select("id, name").eq("tenant_id", tenantId!).eq("is_active", true).order("name");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const mutation = useMutation({
    mutationFn: async (f: ContractForm) => {
      const payload = {
        ...f,
        tenant_id: tenantId!,
        end_date: f.end_date || null,
        position_template_id: f.position_template_id || null,
      };
      if (editId) {
        const { error } = await supabase.from("employee_contracts").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("employee_contracts").insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employee-contracts"] });
      setOpen(false);
      toast.success(t("success"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openAdd = () => { setEditId(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (c: any) => {
    setEditId(c.id);
    setForm({
      employee_id: c.employee_id,
      contract_type: c.contract_type,
      start_date: c.start_date,
      end_date: c.end_date || "",
      gross_salary: c.gross_salary,
      net_salary: c.net_salary,
      working_hours_per_week: c.working_hours_per_week,
      currency: c.currency,
      is_active: c.is_active,
      position_template_id: c.position_template_id || "",
    });
    setOpen(true);
  };

  const contractTypeLabel = (ct: string) =>
    ({ indefinite: t("indefinite"), fixed_term: t("fixedTerm"), temporary: t("temporary"), contract: t("contractType") }[ct] || ct);

  const fmt = (n: number, cur: string) =>
    new Intl.NumberFormat("sr-RS", { style: "currency", currency: cur }).format(n);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("contracts")}</h1>
        <Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" />{t("addContract")}</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("employee")}</TableHead>
                <TableHead>{t("department")}</TableHead>
                <TableHead>{t("position")}</TableHead>
                <TableHead>{t("contractTypeLabel")}</TableHead>
                <TableHead>{t("startDate")}</TableHead>
                <TableHead>{t("endDate")}</TableHead>
                <TableHead className="text-right">{t("grossSalary")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead>{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
              ) : contracts.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">{t("noResults")}</TableCell></TableRow>
              ) : contracts.map((c: any) => (
                <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/hr/employees/${c.employee_id}`)}>
                  <TableCell className="font-medium">{c.employees?.full_name || "—"}</TableCell>
                  <TableCell>{c.employees?.departments?.name || "—"}</TableCell>
                  <TableCell>{c.position_templates?.name || c.employees?.position || "—"}</TableCell>
                  <TableCell>{contractTypeLabel(c.contract_type)}</TableCell>
                  <TableCell>{c.start_date}</TableCell>
                  <TableCell>{c.end_date || "—"}</TableCell>
                  <TableCell className="text-right">{fmt(c.gross_salary, c.currency)}</TableCell>
                  <TableCell><Badge variant={c.is_active ? "default" : "secondary"}>{c.is_active ? t("active") : t("inactive")}</Badge></TableCell>
                  <TableCell><Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openEdit(c); }}>{t("edit")}</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? t("edit") : t("addContract")}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>{t("employee")} *</Label>
              <Select value={form.employee_id} onValueChange={(v) => setForm({ ...form, employee_id: v })}>
                <SelectTrigger><SelectValue placeholder={t("employee")} /></SelectTrigger>
                <SelectContent>
                  {employees.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{t("contractTypeLabel")}</Label>
                <Select value={form.contract_type} onValueChange={(v) => setForm({ ...form, contract_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="indefinite">{t("indefinite")}</SelectItem>
                    <SelectItem value="fixed_term">{t("fixedTerm")}</SelectItem>
                    <SelectItem value="temporary">{t("temporary")}</SelectItem>
                    <SelectItem value="contract">{t("contractType")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>{t("position")}</Label>
                <Select value={form.position_template_id || "__none"} onValueChange={(v) => setForm({ ...form, position_template_id: v === "__none" ? "" : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">—</SelectItem>
                    {positionTemplates.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>{t("workingHours")}</Label><Input type="number" value={form.working_hours_per_week} onChange={(e) => setForm({ ...form, working_hours_per_week: Number(e.target.value) })} /></div>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>{t("startDate")} *</Label><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
              <div className="grid gap-2"><Label>{t("endDate")}</Label><Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>{t("grossSalary")} *</Label><Input type="number" value={form.gross_salary} onChange={(e) => setForm({ ...form, gross_salary: Number(e.target.value) })} /></div>
              <div className="grid gap-2"><Label>{t("netSalary")}</Label><Input type="number" value={form.net_salary} onChange={(e) => setForm({ ...form, net_salary: Number(e.target.value) })} /></div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              <Label>{t("active")}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => mutation.mutate(form)} disabled={!form.employee_id || !form.start_date || !form.gross_salary || mutation.isPending}>
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
