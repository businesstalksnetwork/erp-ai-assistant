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
  osnovna_tabela: number;
  satnica_tip: string;
  payment_category: string;
  compensation_pct: number;
  surcharge_pct: number;
  gl_debit: string;
  gl_credit: string;
  reduces_regular: boolean;
  includes_hot_meal: boolean;
  is_advance: boolean;
  is_storno: boolean;
}

const emptyForm = {
  code: "", name: "", type: "zarada",
  is_hourly: false, is_benefit: false,
  rate_multiplier: "1.0", is_nontaxable: false, is_active: true,
  osnovna_tabela: "1", satnica_tip: "K", payment_category: "Z",
  compensation_pct: "0", surcharge_pct: "0",
  gl_debit: "5200", gl_credit: "4500",
  reduces_regular: false, includes_hot_meal: true,
  is_advance: false, is_storno: false,
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
        osnovna_tabela: parseInt(form.osnovna_tabela),
        satnica_tip: form.satnica_tip, payment_category: form.payment_category,
        compensation_pct: parseFloat(form.compensation_pct),
        surcharge_pct: parseFloat(form.surcharge_pct),
        gl_debit: form.gl_debit, gl_credit: form.gl_credit,
        reduces_regular: form.reduces_regular, includes_hot_meal: form.includes_hot_meal,
        is_advance: form.is_advance, is_storno: form.is_storno,
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
      osnovna_tabela: String(pt.osnovna_tabela || 1),
      satnica_tip: pt.satnica_tip || "K",
      payment_category: pt.payment_category || "Z",
      compensation_pct: String(pt.compensation_pct || 0),
      surcharge_pct: String(pt.surcharge_pct || 0),
      gl_debit: pt.gl_debit || "5200",
      gl_credit: pt.gl_credit || "4500",
      reduces_regular: pt.reduces_regular ?? false,
      includes_hot_meal: pt.includes_hot_meal ?? true,
      is_advance: pt.is_advance ?? false,
      is_storno: pt.is_storno ?? false,
    });
    setOpen(true);
  };

  const categoryLabel = (t: string) => ({
    Z: sr ? "Zarada" : "Earning", B: sr ? "Bolovanje" : "Sick leave",
    N: sr ? "Naknada" : "Compensation", A: sr ? "Akontacija" : "Advance",
    S: sr ? "Storno" : "Reversal"
  }[t] || t);

  const categoryColor = (t: string) => ({
    Z: "default", B: "secondary", N: "outline", A: "destructive", S: "destructive"
  }[t] || "outline") as any;

  return (
    <div className="space-y-6">
      <PageHeader
        title={sr ? "Vrste isplate" : "Payment Types"}
        icon={List}
        description={sr ? "Šifarnik vrsta isplata sa koeficijentima, GL kontima i statusom oporezivanja" : "Payment type catalog with rate multipliers, GL accounts, and tax status"}
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
                  <TableHead>{sr ? "Kat." : "Cat."}</TableHead>
                  <TableHead className="text-center">{sr ? "Tab." : "Tab."}</TableHead>
                  <TableHead className="text-right">{sr ? "%Nakn." : "%Comp."}</TableHead>
                  <TableHead className="text-right">{sr ? "%Dod." : "%Surch."}</TableHead>
                  <TableHead>{sr ? "Duguje" : "Debit"}</TableHead>
                  <TableHead>{sr ? "Potražuje" : "Credit"}</TableHead>
                  <TableHead className="text-center">{sr ? "Neopor." : "Nontax"}</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {types.map((pt) => (
                  <TableRow key={pt.id} className={!pt.is_active ? "opacity-50" : ""}>
                    <TableCell className="font-mono font-semibold">{pt.code}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{pt.name}</TableCell>
                    <TableCell><Badge variant={categoryColor(pt.payment_category)}>{categoryLabel(pt.payment_category)}</Badge></TableCell>
                    <TableCell className="text-center">{pt.osnovna_tabela}</TableCell>
                    <TableCell className="text-right tabular-nums">{pt.compensation_pct > 0 ? `${pt.compensation_pct}%` : ""}</TableCell>
                    <TableCell className="text-right tabular-nums">{pt.surcharge_pct > 0 ? `${pt.surcharge_pct}%` : ""}</TableCell>
                    <TableCell className="font-mono text-xs">{pt.gl_debit}</TableCell>
                    <TableCell className="font-mono text-xs">{pt.gl_credit}</TableCell>
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
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? (sr ? "Izmeni vrstu" : "Edit Payment Type") : (sr ? "Nova vrsta" : "New Payment Type")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-3 gap-3">
              <div><Label className="text-xs">{sr ? "Šifra" : "Code"}</Label><Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="100" /></div>
              <div className="col-span-2"><Label className="text-xs">{sr ? "Naziv" : "Name"}</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">{sr ? "Kategorija" : "Category"}</Label>
                <Select value={form.payment_category} onValueChange={v => setForm({ ...form, payment_category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Z">{sr ? "Zarada" : "Earning"}</SelectItem>
                    <SelectItem value="B">{sr ? "Bolovanje" : "Sick leave"}</SelectItem>
                    <SelectItem value="N">{sr ? "Naknada" : "Compensation"}</SelectItem>
                    <SelectItem value="A">{sr ? "Akontacija" : "Advance"}</SelectItem>
                    <SelectItem value="S">{sr ? "Storno" : "Reversal"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">{sr ? "Osnovna tabela" : "Base table"}</Label>
                <Select value={form.osnovna_tabela} onValueChange={v => setForm({ ...form, osnovna_tabela: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 - {sr ? "Poslodavac" : "Employer"}</SelectItem>
                    <SelectItem value="2">2 - {sr ? "RFZO" : "Health fund"}</SelectItem>
                    <SelectItem value="3">3 - {sr ? "Porodiljsko" : "Maternity"}</SelectItem>
                    <SelectItem value="4">4 - {sr ? "Invalidnost" : "Disability"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">{sr ? "Satnica" : "Rate type"}</Label>
                <Select value={form.satnica_tip} onValueChange={v => setForm({ ...form, satnica_tip: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="K">{sr ? "Časovni" : "Hourly"}</SelectItem>
                    <SelectItem value="N">{sr ? "Mesečni" : "Monthly"}</SelectItem>
                    <SelectItem value="P">{sr ? "Prosečni" : "Average"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-3">
              <div><Label className="text-xs">{sr ? "% Naknade" : "% Compensation"}</Label><Input type="number" step="1" value={form.compensation_pct} onChange={e => setForm({ ...form, compensation_pct: e.target.value })} /></div>
              <div><Label className="text-xs">{sr ? "% Dodatak" : "% Surcharge"}</Label><Input type="number" step="1" value={form.surcharge_pct} onChange={e => setForm({ ...form, surcharge_pct: e.target.value })} /></div>
              <div><Label className="text-xs">{sr ? "Konto Dug." : "GL Debit"}</Label><Input value={form.gl_debit} onChange={e => setForm({ ...form, gl_debit: e.target.value })} /></div>
              <div><Label className="text-xs">{sr ? "Konto Pot." : "GL Credit"}</Label><Input value={form.gl_credit} onChange={e => setForm({ ...form, gl_credit: e.target.value })} /></div>
            </div>
            <div className="flex flex-wrap gap-4 pt-2">
              <label className="flex items-center gap-2 text-sm"><Switch checked={form.is_nontaxable} onCheckedChange={v => setForm({ ...form, is_nontaxable: v })} />{sr ? "Neoporezivo" : "Nontaxable"}</label>
              <label className="flex items-center gap-2 text-sm"><Switch checked={form.reduces_regular} onCheckedChange={v => setForm({ ...form, reduces_regular: v })} />{sr ? "Umanjuje red. rad" : "Reduces regular"}</label>
              <label className="flex items-center gap-2 text-sm"><Switch checked={form.includes_hot_meal} onCheckedChange={v => setForm({ ...form, includes_hot_meal: v })} />{sr ? "Topli obrok" : "Hot meal"}</label>
              <label className="flex items-center gap-2 text-sm"><Switch checked={form.is_benefit} onCheckedChange={v => setForm({ ...form, is_benefit: v })} />{sr ? "Naknada" : "Benefit"}</label>
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
