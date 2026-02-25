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
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Pencil, Trash2, List, Sparkles } from "lucide-react";
import { toast } from "sonner";

interface PaymentType {
  id: string;
  code: string;
  name: string;
  type: string;
  is_hourly: boolean;
  is_benefit: boolean;
  rate_multiplier: number;
  is_nontaxable: boolean;
  is_active: boolean;
}

const emptyForm = {
  code: "", name: "", type: "earning",
  is_hourly: false, is_benefit: false,
  rate_multiplier: "1.0", is_nontaxable: false, is_active: true,
};

export default function PayrollPaymentTypes() {
  const { locale } = useLanguage();
  const { tenantId } = useTenant();
  const qc = useQueryClient();
  const sr = locale === "sr";
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: types = [], isLoading } = useQuery({
    queryKey: ["payroll-payment-types", tenantId],
    queryFn: async () => {
      const { data } = await (supabase
        .from("payroll_payment_types")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("code") as any);
      return (data || []) as PaymentType[];
    },
    enabled: !!tenantId,
  });

  const seedMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("seed_payroll_payment_types" as any, { p_tenant_id: tenantId! });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["payroll-payment-types"] }); toast.success(sr ? "Vrste isplate kreirane" : "Payment types seeded"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        tenant_id: tenantId!, code: form.code, name: form.name, type: form.type,
        is_hourly: form.is_hourly, is_benefit: form.is_benefit,
        rate_multiplier: parseFloat(form.rate_multiplier),
        is_nontaxable: form.is_nontaxable, is_active: form.is_active,
      };
      if (editId) {
        const { error } = await (supabase.from("payroll_payment_types").update(payload).eq("id", editId) as any);
        if (error) throw error;
      } else {
        const { error } = await (supabase.from("payroll_payment_types").insert(payload) as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payroll-payment-types"] });
      setOpen(false); setEditId(null); setForm(emptyForm);
      toast.success(sr ? "Sačuvano" : "Saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("payroll_payment_types").delete().eq("id", id) as any);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["payroll-payment-types"] }); toast.success(sr ? "Obrisano" : "Deleted"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const openEdit = (pt: PaymentType) => {
    setEditId(pt.id);
    setForm({
      code: pt.code, name: pt.name, type: pt.type,
      is_hourly: pt.is_hourly, is_benefit: pt.is_benefit,
      rate_multiplier: String(pt.rate_multiplier),
      is_nontaxable: pt.is_nontaxable, is_active: pt.is_active,
    });
    setOpen(true);
  };

  const typeLabel = (t: string) => ({ earning: sr ? "Zarada" : "Earning", deduction: sr ? "Obustava" : "Deduction", benefit: sr ? "Naknada" : "Benefit" }[t] || t);

  return (
    <div className="space-y-6">
      <PageHeader
        title={sr ? "Vrste isplate" : "Payment Types"}
        icon={List}
        description={sr ? "Šifarnik vrsta isplata sa koeficijentima i statusom oporezivanja" : "Payment type catalog with rate multipliers and tax status"}
        actions={
          <div className="flex gap-2">
            {types.length === 0 && (
              <Button variant="outline" onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}>
                <Sparkles className="h-4 w-4 mr-2" />{sr ? "Učitaj standardne" : "Seed defaults"}
              </Button>
            )}
            <Button onClick={() => { setEditId(null); setForm(emptyForm); setOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />{sr ? "Nova vrsta" : "New Type"}
            </Button>
          </div>
        }
      />

      {isLoading ? <Skeleton className="h-80" /> : types.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          {sr ? 'Nema vrsta isplata. Kliknite "Učitaj standardne" za početnu konfiguraciju.' : 'No payment types. Click "Seed defaults" to create standard types.'}
        </CardContent></Card>
      ) : (
        <Card>
          <CardContent className="pt-6 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{sr ? "Šifra" : "Code"}</TableHead>
                  <TableHead>{sr ? "Naziv" : "Name"}</TableHead>
                  <TableHead>{sr ? "Vrsta" : "Type"}</TableHead>
                  <TableHead className="text-center">{sr ? "Časovni" : "Hourly"}</TableHead>
                  <TableHead className="text-center">{sr ? "Naknada" : "Benefit"}</TableHead>
                  <TableHead className="text-right">{sr ? "Koeficijent" : "Rate"}</TableHead>
                  <TableHead className="text-center">{sr ? "Neoporezivo" : "Nontaxable"}</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {types.map((pt) => (
                  <TableRow key={pt.id} className={!pt.is_active ? "opacity-50" : ""}>
                    <TableCell className="font-mono font-semibold">{pt.code}</TableCell>
                    <TableCell>{pt.name}</TableCell>
                    <TableCell><Badge variant="outline">{typeLabel(pt.type)}</Badge></TableCell>
                    <TableCell className="text-center">{pt.is_hourly ? "✓" : ""}</TableCell>
                    <TableCell className="text-center">{pt.is_benefit ? "✓" : ""}</TableCell>
                    <TableCell className="text-right tabular-nums">{pt.rate_multiplier}</TableCell>
                    <TableCell className="text-center">{pt.is_nontaxable ? "✓" : ""}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(pt)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => { if (confirm(sr ? "Obrisati?" : "Delete?")) deleteMutation.mutate(pt.id); }}>
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
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editId ? (sr ? "Izmeni vrstu" : "Edit Payment Type") : (sr ? "Nova vrsta" : "New Payment Type")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">{sr ? "Šifra" : "Code"}</Label><Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="100" /></div>
              <div><Label className="text-xs">{sr ? "Naziv" : "Name"}</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">{sr ? "Vrsta" : "Type"}</Label>
                <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="earning">{sr ? "Zarada" : "Earning"}</SelectItem>
                    <SelectItem value="deduction">{sr ? "Obustava" : "Deduction"}</SelectItem>
                    <SelectItem value="benefit">{sr ? "Naknada" : "Benefit"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">{sr ? "Koeficijent" : "Rate multiplier"}</Label><Input type="number" step="0.01" value={form.rate_multiplier} onChange={e => setForm({ ...form, rate_multiplier: e.target.value })} /></div>
            </div>
            <div className="flex flex-wrap gap-6 pt-2">
              <label className="flex items-center gap-2 text-sm"><Switch checked={form.is_hourly} onCheckedChange={v => setForm({ ...form, is_hourly: v })} />{sr ? "Časovni" : "Hourly"}</label>
              <label className="flex items-center gap-2 text-sm"><Switch checked={form.is_benefit} onCheckedChange={v => setForm({ ...form, is_benefit: v })} />{sr ? "Naknada" : "Benefit"}</label>
              <label className="flex items-center gap-2 text-sm"><Switch checked={form.is_nontaxable} onCheckedChange={v => setForm({ ...form, is_nontaxable: v })} />{sr ? "Neoporezivo" : "Nontaxable"}</label>
              <label className="flex items-center gap-2 text-sm"><Switch checked={form.is_active} onCheckedChange={v => setForm({ ...form, is_active: v })} />{sr ? "Aktivna" : "Active"}</label>
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
    </div>
  );
}
