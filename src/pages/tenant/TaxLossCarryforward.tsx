import { useState, useEffect, useCallback } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/shared/PageHeader";
import { toast } from "@/hooks/use-toast";
import { Plus, Save, Trash2, TrendingDown } from "lucide-react";
import { fmtNum } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useDebounce } from "@/hooks/useDebounce";

export default function TaxLossCarryforward() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newYear, setNewYear] = useState(new Date().getFullYear() - 1);
  const [newAmount, setNewAmount] = useState(0);
  // CR-11: Local state for used_amount edits to prevent keystroke-per-mutation race
  const [localUsed, setLocalUsed] = useState<Record<string, number>>({});

  const { data: items = [] } = useQuery({
    queryKey: ["tax-loss-carryforward", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tax_loss_carryforward")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("loss_year", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Sync local state from DB on load
  useEffect(() => {
    const map: Record<string, number> = {};
    items.forEach(i => { map[i.id] = Number(i.used_amount) || 0; });
    setLocalUsed(map);
  }, [items]);

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("tax_loss_carryforward").insert({
        tenant_id: tenantId!,
        loss_year: newYear,
        loss_amount: newAmount,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tax-loss-carryforward"] });
      setDialogOpen(false);
      toast({ title: t("success") });
    },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, used_amount }: { id: string; used_amount: number }) => {
      const { error } = await supabase.from("tax_loss_carryforward").update({ used_amount }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tax-loss-carryforward"] });
      toast({ title: t("success") });
    },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // CR-24: Add tenant_id scope to delete
      const { error } = await supabase.from("tax_loss_carryforward").delete().eq("id", id).eq("tenant_id", tenantId!);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tax-loss-carryforward"] });
      toast({ title: t("success") });
    },
  });

  // CR-12: Validate used_amount <= loss_amount before saving
  const handleSaveUsed = useCallback((id: string, lossAmount: number) => {
    const val = localUsed[id] || 0;
    if (val > lossAmount) {
      toast({ title: "Greška", description: "Iskorišćeni iznos ne može biti veći od iznosa gubitka", variant: "destructive" });
      return;
    }
    if (val < 0) {
      toast({ title: "Greška", description: "Iskorišćeni iznos ne može biti negativan", variant: "destructive" });
      return;
    }
    updateMutation.mutate({ id, used_amount: val });
  }, [localUsed, updateMutation]);

  const currentYear = new Date().getFullYear();
  const totalRemaining = items.reduce((s, i) => s + Number(i.remaining_amount || 0), 0);
  const activeItems = items.filter(i => Number(i.expiry_year) >= currentYear && Number(i.remaining_amount) > 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Prenos poreskog gubitka"
        description="ZPDP čl. 32 — Prenos gubitka na buduće periode (5 godina)"
        icon={TrendingDown}
        actions={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" /> Dodaj gubitak</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Novi poreski gubitak</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Godina gubitka</Label>
                  <Input type="number" value={newYear} onChange={e => setNewYear(+e.target.value)} />
                </div>
                <div>
                  <Label>Iznos gubitka (RSD)</Label>
                  <Input type="number" value={newAmount} onChange={e => setNewAmount(+e.target.value)} />
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
                <TableHead>Godina gubitka</TableHead>
                <TableHead className="text-right">Iznos gubitka</TableHead>
                <TableHead className="text-right">Iskorišćeno</TableHead>
                <TableHead className="text-right">Preostalo</TableHead>
                <TableHead>Ističe</TableHead>
                <TableHead className="text-right">Status</TableHead>
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map(item => {
                const expired = Number(item.expiry_year) < currentYear;
                const remaining = Number(item.remaining_amount || 0);
                const localVal = localUsed[item.id] ?? Number(item.used_amount) ?? 0;
                const isDirty = localVal !== (Number(item.used_amount) || 0);
                return (
                  <TableRow key={item.id} className={expired ? "opacity-50" : ""}>
                    <TableCell className="font-mono">{item.loss_year}</TableCell>
                    <TableCell className="text-right font-mono">{fmtNum(Number(item.loss_amount))}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center gap-1 justify-end">
                        <Input
                          type="number"
                          className="w-28 text-right h-8"
                          value={localVal}
                          onChange={e => setLocalUsed(prev => ({ ...prev, [item.id]: Number(e.target.value) || 0 }))}
                          disabled={expired}
                        />
                        {isDirty && !expired && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => handleSaveUsed(item.id, Number(item.loss_amount))}
                            disabled={updateMutation.isPending}
                          >
                            <Save className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium">{fmtNum(remaining)}</TableCell>
                    <TableCell className="font-mono">{item.expiry_year}</TableCell>
                    <TableCell className="text-right">
                      {expired ? (
                        <span className="text-destructive text-sm">Istekao</span>
                      ) : remaining <= 0 ? (
                        <span className="text-muted-foreground text-sm">Iskorišćen</span>
                      ) : (
                        <span className="text-green-600 text-sm">Aktivan</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(item.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {items.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nema evidentiranih gubitaka</TableCell></TableRow>
              )}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={3} className="text-right font-bold">Ukupno preostalo za prenos:</TableCell>
                <TableCell className="text-right font-bold font-mono">{fmtNum(totalRemaining)}</TableCell>
                <TableCell colSpan={3} />
              </TableRow>
              <TableRow>
                <TableCell colSpan={3} className="text-right font-bold">Aktivno (neisteklo):</TableCell>
                <TableCell className="text-right font-bold font-mono">
                  {fmtNum(activeItems.reduce((s, i) => s + Number(i.remaining_amount || 0), 0))}
                </TableCell>
                <TableCell colSpan={3} />
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
