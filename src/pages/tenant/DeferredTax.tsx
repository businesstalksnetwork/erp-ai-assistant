import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/shared/PageHeader";
import { toast } from "@/hooks/use-toast";
import { Plus, Save, Trash2, Clock } from "lucide-react";
import { fmtNum } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function DeferredTax() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const qc = useQueryClient();
  const [year, setYear] = useState(new Date().getFullYear());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    item_type: "asset" as "asset" | "liability",
    description: "",
    accounting_base: 0,
    tax_base: 0,
    tax_rate: 0.15,
  });

  const { data: items = [] } = useQuery({
    queryKey: ["deferred-tax", tenantId, year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deferred_tax_items")
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("year", year)
        .order("item_type", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const diff = form.accounting_base - form.tax_base;
      const { error } = await supabase.from("deferred_tax_items").insert({
        tenant_id: tenantId!,
        year,
        ...form,
        deferred_tax_amount: Math.abs(diff * form.tax_rate),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deferred-tax"] });
      setDialogOpen(false);
      toast({ title: t("success") });
    },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("deferred_tax_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deferred-tax"] });
      toast({ title: t("success") });
    },
  });

  const dtaTotal = items.filter(i => i.item_type === "asset").reduce((s, i) => s + Number(i.deferred_tax_amount), 0);
  const dtlTotal = items.filter(i => i.item_type === "liability").reduce((s, i) => s + Number(i.deferred_tax_amount), 0);
  const net = dtaTotal - dtlTotal;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Odloženi porez (IAS 12)"
        description="Obračun odloženih poreskih sredstava i obaveza na osnovu privremenih razlika"
        icon={Clock}
        actions={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" /> Dodaj stavku</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nova stavka odloženog poreza</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Tip</Label>
                  <Select value={form.item_type} onValueChange={v => setForm(p => ({ ...p, item_type: v as any }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="asset">Odloženo poresko sredstvo (DTA)</SelectItem>
                      <SelectItem value="liability">Odložena poreska obaveza (DTL)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Opis</Label>
                  <Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Računovodstvena osnova</Label>
                    <Input type="number" value={form.accounting_base} onChange={e => setForm(p => ({ ...p, accounting_base: +e.target.value }))} />
                  </div>
                  <div>
                    <Label>Poreska osnova</Label>
                    <Input type="number" value={form.tax_base} onChange={e => setForm(p => ({ ...p, tax_base: +e.target.value }))} />
                  </div>
                </div>
                <div>
                  <Label>Poreska stopa</Label>
                  <Input type="number" step="0.01" value={form.tax_rate} onChange={e => setForm(p => ({ ...p, tax_rate: +e.target.value }))} />
                </div>
                <Button onClick={() => addMutation.mutate()} disabled={addMutation.isPending}>
                  <Save className="h-4 w-4 mr-2" /> Sačuvaj
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="flex gap-4 items-end">
        <div>
          <Label>Godina</Label>
          <Input type="number" className="w-24" value={year} onChange={e => setYear(+e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-green-600">DTA (Sredstva)</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold font-mono">{fmtNum(dtaTotal)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-destructive">DTL (Obaveze)</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold font-mono">{fmtNum(dtlTotal)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Neto pozicija</CardTitle></CardHeader>
          <CardContent><div className={`text-2xl font-bold font-mono ${net >= 0 ? "text-green-600" : "text-destructive"}`}>{fmtNum(net)}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tip</TableHead>
                <TableHead>Opis</TableHead>
                <TableHead className="text-right">Rač. osnova</TableHead>
                <TableHead className="text-right">Por. osnova</TableHead>
                <TableHead className="text-right">Privr. razlika</TableHead>
                <TableHead className="text-right">Stopa</TableHead>
                <TableHead className="text-right">Odloženi porez</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map(item => (
                <TableRow key={item.id}>
                  <TableCell>{item.item_type === "asset" ? "DTA" : "DTL"}</TableCell>
                  <TableCell>{item.description}</TableCell>
                  <TableCell className="text-right font-mono">{fmtNum(Number(item.accounting_base))}</TableCell>
                  <TableCell className="text-right font-mono">{fmtNum(Number(item.tax_base))}</TableCell>
                  <TableCell className="text-right font-mono">{fmtNum(Number(item.temporary_difference))}</TableCell>
                  <TableCell className="text-right font-mono">{(Number(item.tax_rate) * 100).toFixed(0)}%</TableCell>
                  <TableCell className="text-right font-mono font-medium">{fmtNum(Number(item.deferred_tax_amount))}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(item.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {items.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nema stavki</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
