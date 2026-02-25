import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Pencil, Trash2, Layers, Sparkles } from "lucide-react";
import { toast } from "sonner";

interface Category {
  id: string;
  code: string;
  name: string;
  ovp_code: string;
  ola_code: string;
  ben_code: string;
  tax_rate: number;
  pio_employee_rate: number;
  pio_employer_rate: number;
  health_employee_rate: number;
  health_employer_rate: number;
  unemployment_employee_rate: number;
  ben_coefficient: number;
  subsidy_tax_pct: number;
  subsidy_pio_employee_pct: number;
  subsidy_pio_employer_pct: number;
  is_active: boolean;
}

const emptyForm = {
  code: "", name: "", ovp_code: "101", ola_code: "00", ben_code: "0",
  tax_rate: "10", pio_employee_rate: "14", pio_employer_rate: "10",
  health_employee_rate: "5.15", health_employer_rate: "5.15", unemployment_employee_rate: "0.75",
  ben_coefficient: "1.0", subsidy_tax_pct: "0", subsidy_pio_employee_pct: "0", subsidy_pio_employer_pct: "0",
  is_active: true,
};

export default function PayrollCategories() {
  const { locale } = useLanguage();
  const { tenantId } = useTenant();
  const qc = useQueryClient();
  const sr = locale === "sr";
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["payroll-categories", tenantId],
    queryFn: async () => {
      const { data } = await (supabase
        .from("payroll_income_categories")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("code") as any);
      return (data || []) as Category[];
    },
    enabled: !!tenantId,
  });

  const seedMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("seed_payroll_income_categories" as any, { p_tenant_id: tenantId! });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["payroll-categories"] }); toast.success(sr ? "Kategorije kreirane" : "Categories seeded"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        tenant_id: tenantId!,
        code: form.code, name: form.name,
        ovp_code: form.ovp_code, ola_code: form.ola_code, ben_code: form.ben_code,
        tax_rate: parseFloat(form.tax_rate) / 100,
        pio_employee_rate: parseFloat(form.pio_employee_rate) / 100,
        pio_employer_rate: parseFloat(form.pio_employer_rate) / 100,
        health_employee_rate: parseFloat(form.health_employee_rate) / 100,
        health_employer_rate: parseFloat(form.health_employer_rate) / 100,
        unemployment_employee_rate: parseFloat(form.unemployment_employee_rate) / 100,
        ben_coefficient: parseFloat(form.ben_coefficient),
        subsidy_tax_pct: parseFloat(form.subsidy_tax_pct),
        subsidy_pio_employee_pct: parseFloat(form.subsidy_pio_employee_pct),
        subsidy_pio_employer_pct: parseFloat(form.subsidy_pio_employer_pct),
        is_active: form.is_active,
      };
      if (editId) {
        const { error } = await (supabase.from("payroll_income_categories").update(payload).eq("id", editId) as any);
        if (error) throw error;
      } else {
        const { error } = await (supabase.from("payroll_income_categories").insert(payload) as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payroll-categories"] });
      setOpen(false); setEditId(null); setForm(emptyForm);
      toast.success(sr ? "Sačuvano" : "Saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("payroll_income_categories").delete().eq("id", id) as any);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["payroll-categories"] }); toast.success(sr ? "Obrisano" : "Deleted"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const openEdit = (c: Category) => {
    setEditId(c.id);
    setForm({
      code: c.code, name: c.name, ovp_code: c.ovp_code, ola_code: c.ola_code, ben_code: c.ben_code,
      tax_rate: String((c.tax_rate * 100).toFixed(2)),
      pio_employee_rate: String((c.pio_employee_rate * 100).toFixed(2)),
      pio_employer_rate: String((c.pio_employer_rate * 100).toFixed(2)),
      health_employee_rate: String((c.health_employee_rate * 100).toFixed(2)),
      health_employer_rate: String((c.health_employer_rate * 100).toFixed(2)),
      unemployment_employee_rate: String((c.unemployment_employee_rate * 100).toFixed(2)),
      ben_coefficient: String(c.ben_coefficient),
      subsidy_tax_pct: String(c.subsidy_tax_pct),
      subsidy_pio_employee_pct: String(c.subsidy_pio_employee_pct),
      subsidy_pio_employer_pct: String(c.subsidy_pio_employer_pct),
      is_active: c.is_active,
    });
    setOpen(true);
  };

  const fmtPct = (v: number) => `${(v * 100).toFixed(2)}%`;

  return (
    <div className="space-y-6">
      <PageHeader
        title={sr ? "Kategorije prihoda za obračun" : "Payroll Income Categories"}
        icon={Layers}
        description={sr ? "OVP/OLA/BEN šifarnik sa stopama poreza i doprinosa po kategoriji zaposlenog" : "OVP/OLA/BEN catalog with per-category tax and contribution rates"}
        actions={
          <div className="flex gap-2">
            {categories.length === 0 && (
              <Button variant="outline" onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}>
                <Sparkles className="h-4 w-4 mr-2" />{sr ? "Učitaj standardne" : "Seed defaults"}
              </Button>
            )}
            <Button onClick={() => { setEditId(null); setForm(emptyForm); setOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />{sr ? "Nova kategorija" : "New Category"}
            </Button>
          </div>
        }
      />

      {isLoading ? <Skeleton className="h-80" /> : categories.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          {sr ? "Nema kategorija. Kliknite \"Učitaj standardne\" za početnu konfiguraciju." : "No categories. Click \"Seed defaults\" to create standard Serbian categories."}
        </CardContent></Card>
      ) : (
        <Card>
          <CardContent className="pt-6 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{sr ? "Šifra" : "Code"}</TableHead>
                  <TableHead>{sr ? "Naziv" : "Name"}</TableHead>
                  <TableHead>OVP</TableHead>
                  <TableHead>OLA</TableHead>
                  <TableHead>BEN</TableHead>
                  <TableHead className="text-right">{sr ? "Porez" : "Tax"}</TableHead>
                  <TableHead className="text-right">PIO-R</TableHead>
                  <TableHead className="text-right">PIO-P</TableHead>
                  <TableHead className="text-right">Zdrav-R</TableHead>
                  <TableHead className="text-right">Zdrav-P</TableHead>
                  <TableHead className="text-right">Nezap</TableHead>
                  <TableHead className="text-right">{sr ? "Benef. koef." : "Ben. coeff."}</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((c) => (
                  <TableRow key={c.id} className={!c.is_active ? "opacity-50" : ""}>
                    <TableCell className="font-mono font-semibold">{c.code}</TableCell>
                    <TableCell>{c.name}</TableCell>
                    <TableCell><Badge variant="outline">{c.ovp_code}</Badge></TableCell>
                    <TableCell><Badge variant="outline">{c.ola_code}</Badge></TableCell>
                    <TableCell><Badge variant="outline">{c.ben_code}</Badge></TableCell>
                    <TableCell className="text-right tabular-nums">{fmtPct(c.tax_rate)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtPct(c.pio_employee_rate)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtPct(c.pio_employer_rate)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtPct(c.health_employee_rate)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtPct(c.health_employer_rate)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtPct(c.unemployment_employee_rate)}</TableCell>
                    <TableCell className="text-right tabular-nums">{c.ben_coefficient}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(c)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(c.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={open} onOpenChange={(o) => { if (!o) { setOpen(false); setEditId(null); } }}>
        <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? (sr ? "Izmeni kategoriju" : "Edit Category") : (sr ? "Nova kategorija" : "New Category")}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div><Label className="text-xs">{sr ? "Šifra" : "Code"}</Label><Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="K01" /></div>
            <div className="col-span-2"><Label className="text-xs">{sr ? "Naziv" : "Name"}</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label className="text-xs">OVP</Label><Input value={form.ovp_code} onChange={e => setForm({ ...form, ovp_code: e.target.value })} /></div>
            <div><Label className="text-xs">OLA</Label><Input value={form.ola_code} onChange={e => setForm({ ...form, ola_code: e.target.value })} /></div>
            <div><Label className="text-xs">BEN</Label><Input value={form.ben_code} onChange={e => setForm({ ...form, ben_code: e.target.value })} /></div>
            <div><Label className="text-xs">{sr ? "Porez %" : "Tax %"}</Label><Input type="number" step="0.01" value={form.tax_rate} onChange={e => setForm({ ...form, tax_rate: e.target.value })} /></div>
            <div><Label className="text-xs">PIO-R %</Label><Input type="number" step="0.01" value={form.pio_employee_rate} onChange={e => setForm({ ...form, pio_employee_rate: e.target.value })} /></div>
            <div><Label className="text-xs">PIO-P %</Label><Input type="number" step="0.01" value={form.pio_employer_rate} onChange={e => setForm({ ...form, pio_employer_rate: e.target.value })} /></div>
            <div><Label className="text-xs">Zdrav-R %</Label><Input type="number" step="0.01" value={form.health_employee_rate} onChange={e => setForm({ ...form, health_employee_rate: e.target.value })} /></div>
            <div><Label className="text-xs">Zdrav-P %</Label><Input type="number" step="0.01" value={form.health_employer_rate} onChange={e => setForm({ ...form, health_employer_rate: e.target.value })} /></div>
            <div><Label className="text-xs">{sr ? "Nezap %" : "Unemp %"}</Label><Input type="number" step="0.01" value={form.unemployment_employee_rate} onChange={e => setForm({ ...form, unemployment_employee_rate: e.target.value })} /></div>
            <div><Label className="text-xs">{sr ? "Benef. koeficijent" : "Ben. coefficient"}</Label><Input type="number" step="0.001" value={form.ben_coefficient} onChange={e => setForm({ ...form, ben_coefficient: e.target.value })} /></div>
            <div><Label className="text-xs">{sr ? "Subv. porez %" : "Subsidy Tax %"}</Label><Input type="number" value={form.subsidy_tax_pct} onChange={e => setForm({ ...form, subsidy_tax_pct: e.target.value })} /></div>
            <div><Label className="text-xs">{sr ? "Subv. PIO-R %" : "Subsidy PIO-R %"}</Label><Input type="number" value={form.subsidy_pio_employee_pct} onChange={e => setForm({ ...form, subsidy_pio_employee_pct: e.target.value })} /></div>
            <div><Label className="text-xs">{sr ? "Subv. PIO-P %" : "Subsidy PIO-P %"}</Label><Input type="number" value={form.subsidy_pio_employer_pct} onChange={e => setForm({ ...form, subsidy_pio_employer_pct: e.target.value })} /></div>
            <div className="flex items-center gap-2 pt-5">
              <Switch checked={form.is_active} onCheckedChange={v => setForm({ ...form, is_active: v })} />
              <Label className="text-xs">{sr ? "Aktivna" : "Active"}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); setEditId(null); }}>{sr ? "Otkaži" : "Cancel"}</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.code || !form.name}>
              {sr ? "Sačuvaj" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{sr ? "Potvrda" : "Confirmation"}</AlertDialogTitle>
            <AlertDialogDescription>{sr ? "Da li ste sigurni da želite da obrišete ovu stavku?" : "Are you sure you want to delete this item?"}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{sr ? "Otkaži" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteId) deleteMutation.mutate(deleteId); setDeleteId(null); }}>{sr ? "Obriši" : "Delete"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
