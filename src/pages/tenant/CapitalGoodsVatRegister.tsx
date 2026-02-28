import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/shared/PageHeader";
import { toast } from "@/hooks/use-toast";
import { Plus, Save, Building2 } from "lucide-react";
import { fmtNum } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function CapitalGoodsVatRegister() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    description: "",
    acquisition_date: new Date().toISOString().split("T")[0],
    initial_vat_amount: 0,
    adjustment_period_years: 5,
    year: new Date().getFullYear(),
    original_prorata: 1.0,
    current_prorata: 1.0,
  });

  const { data: items = [] } = useQuery({
    queryKey: ["capital-goods-vat", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("capital_goods_vat_register")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("acquisition_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const annualFraction = 1 / form.adjustment_period_years;
      const adjustment = form.initial_vat_amount * annualFraction * (form.current_prorata - form.original_prorata);
      const { error } = await supabase.from("capital_goods_vat_register").insert({
        tenant_id: tenantId!,
        ...form,
        annual_adjustment: adjustment,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["capital-goods-vat"] });
      setDialogOpen(false);
      toast({ title: t("success") });
    },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Evidencija ispravki PDV-a za kapitalna dobra"
        description="ZoPDV čl. 32 — Ispravka odbitka prethodnog poreza za opremu i objekte (5/10 godina)"
        icon={Building2}
        actions={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" /> Dodaj stavku</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nova stavka kapitalnog dobra</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Opis</Label>
                  <Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
                </div>
                <div>
                  <Label>Datum nabavke</Label>
                  <Input type="date" value={form.acquisition_date} onChange={e => setForm(p => ({ ...p, acquisition_date: e.target.value }))} />
                </div>
                <div>
                  <Label>Inicijalni PDV</Label>
                  <Input type="number" value={form.initial_vat_amount} onChange={e => setForm(p => ({ ...p, initial_vat_amount: +e.target.value }))} />
                </div>
                <div>
                  <Label>Period ispravke</Label>
                  <Select value={String(form.adjustment_period_years)} onValueChange={v => setForm(p => ({ ...p, adjustment_period_years: +v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5 godina (oprema)</SelectItem>
                      <SelectItem value="10">10 godina (objekti)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Originalni pro-rata</Label>
                    <Input type="number" step="0.01" value={form.original_prorata} onChange={e => setForm(p => ({ ...p, original_prorata: +e.target.value }))} />
                  </div>
                  <div>
                    <Label>Tekući pro-rata</Label>
                    <Input type="number" step="0.01" value={form.current_prorata} onChange={e => setForm(p => ({ ...p, current_prorata: +e.target.value }))} />
                  </div>
                </div>
                <Button onClick={() => addMutation.mutate()} disabled={addMutation.isPending}>
                  <Save className="h-4 w-4 mr-2" /> Sačuvaj
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Opis</TableHead>
                <TableHead>Datum nabavke</TableHead>
                <TableHead className="text-right">PDV</TableHead>
                <TableHead>Period</TableHead>
                <TableHead className="text-right">Orig. %</TableHead>
                <TableHead className="text-right">Tekući %</TableHead>
                <TableHead className="text-right">Godišnja ispravka</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map(item => (
                <TableRow key={item.id}>
                  <TableCell>{item.description}</TableCell>
                  <TableCell className="font-mono">{item.acquisition_date}</TableCell>
                  <TableCell className="text-right font-mono">{fmtNum(Number(item.initial_vat_amount))}</TableCell>
                  <TableCell>{item.adjustment_period_years} god.</TableCell>
                  <TableCell className="text-right font-mono">{(Number(item.original_prorata) * 100).toFixed(1)}%</TableCell>
                  <TableCell className="text-right font-mono">{(Number(item.current_prorata) * 100).toFixed(1)}%</TableCell>
                  <TableCell className="text-right font-mono font-medium">{fmtNum(Number(item.annual_adjustment))}</TableCell>
                </TableRow>
              ))}
              {items.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nema stavki</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
