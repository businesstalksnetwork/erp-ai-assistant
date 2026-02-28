import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { useLegalEntities } from "@/hooks/useLegalEntities";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/shared/PageHeader";
import { toast } from "@/hooks/use-toast";
import { Plus, Save, Trash2, Layers, BookOpen } from "lucide-react";
import { fmtNum } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { postWithRuleOrFallback } from "@/lib/postingHelper";

const ELIM_TYPES = [
  { value: "revenue_expense", label: "Prihodi / Rashodi", debitCode: "6000", creditCode: "5000" },
  { value: "receivable_payable", label: "Potraživanja / Obaveze", debitCode: "2200", creditCode: "2040" },
  { value: "investment_equity", label: "Investicije / Kapital", debitCode: "3000", creditCode: "0400" },
  { value: "profit_inventory", label: "Nerealizovana dobit u zalihama", debitCode: "6000", creditCode: "1310" },
];

export default function IntercompanyEliminations() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const { entities: legalEntities } = useLegalEntities();
  const qc = useQueryClient();
  const [year, setYear] = useState(new Date().getFullYear());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    entity_from_id: "",
    entity_to_id: "",
    elimination_type: "revenue_expense",
    amount: 0,
    notes: "",
  });

  const { data: items = [] } = useQuery({
    queryKey: ["ic-eliminations", tenantId, year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("intercompany_eliminations")
        .select("*, entity_from:entity_from_id(name), entity_to:entity_to_id(name)")
        .eq("tenant_id", tenantId!)
        .eq("year", year)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      // CR-13: Validate entities are different
      if (form.entity_from_id && form.entity_to_id && form.entity_from_id === form.entity_to_id) {
        throw new Error("Entitet 'Od' i 'Ka' moraju biti različiti");
      }
      const { error } = await supabase.from("intercompany_eliminations").insert({
        tenant_id: tenantId!,
        year,
        entity_from_id: form.entity_from_id || null,
        entity_to_id: form.entity_to_id || null,
        elimination_type: form.elimination_type,
        amount: form.amount,
        notes: form.notes,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ic-eliminations"] });
      setDialogOpen(false);
      toast({ title: t("success") });
    },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // CR-24: Add tenant_id scope to delete
      const { error } = await supabase.from("intercompany_eliminations").delete().eq("id", id).eq("tenant_id", tenantId!);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ic-eliminations"] });
      toast({ title: t("success") });
    },
  });

  // CR-13: GL posting path for eliminations
  const postMutation = useMutation({
    mutationFn: async (item: any) => {
      if (!tenantId) throw new Error("No tenant");
      const elimType = ELIM_TYPES.find(e => e.value === item.elimination_type);
      if (!elimType) throw new Error("Unknown elimination type");

      await postWithRuleOrFallback({
        tenantId,
        userId: user?.id || null,
        entryDate: new Date().toISOString().split("T")[0],
        modelCode: "IC_ELIMINATION",
        amount: Number(item.amount),
        description: `Eliminacija: ${elimType.label} — ${year}`,
        reference: `ELIM-${item.id.substring(0, 8)}`,
        context: {},
        fallbackLines: [
          { accountCode: elimType.debitCode, debit: Number(item.amount), credit: 0, description: `Eliminacija DR — ${elimType.label}`, sortOrder: 0 },
          { accountCode: elimType.creditCode, debit: 0, credit: Number(item.amount), description: `Eliminacija CR — ${elimType.label}`, sortOrder: 1 },
        ],
      });

      const { error } = await supabase
        .from("intercompany_eliminations")
        .update({ status: "posted" })
        .eq("id", item.id)
        .eq("tenant_id", tenantId!);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ic-eliminations"] });
      toast({ title: t("success"), description: "Eliminacija proknjižena u GK" });
    },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const totalElim = items.reduce((s, i) => s + Number(i.amount), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Međukompanijske eliminacije"
        description="IFRS 10 — Eliminacija internih transakcija za konsolidovane izveštaje"
        icon={Layers}
        actions={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" /> Dodaj eliminaciju</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nova eliminacija</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Od entiteta</Label>
                  <Select value={form.entity_from_id} onValueChange={v => setForm(p => ({ ...p, entity_from_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Izaberi" /></SelectTrigger>
                    <SelectContent>
                      {legalEntities.map(le => (
                        <SelectItem key={le.id} value={le.id}>{le.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Ka entitetu</Label>
                  <Select value={form.entity_to_id} onValueChange={v => setForm(p => ({ ...p, entity_to_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Izaberi" /></SelectTrigger>
                    <SelectContent>
                      {legalEntities.map(le => (
                        <SelectItem key={le.id} value={le.id}>{le.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Tip eliminacije</Label>
                  <Select value={form.elimination_type} onValueChange={v => setForm(p => ({ ...p, elimination_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ELIM_TYPES.map(et => (
                        <SelectItem key={et.value} value={et.value}>{et.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Iznos</Label>
                  <Input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: +e.target.value }))} />
                </div>
                <div>
                  <Label>Napomene</Label>
                  <Input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
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

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Od</TableHead>
                <TableHead>Ka</TableHead>
                <TableHead>Tip</TableHead>
                <TableHead className="text-right">Iznos</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Napomene</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map(item => (
                <TableRow key={item.id}>
                  <TableCell>{(item as any).entity_from?.name || "—"}</TableCell>
                  <TableCell>{(item as any).entity_to?.name || "—"}</TableCell>
                  <TableCell>{ELIM_TYPES.find(e => e.value === item.elimination_type)?.label}</TableCell>
                  <TableCell className="text-right font-mono">{fmtNum(Number(item.amount))}</TableCell>
                  <TableCell>
                    <Badge variant={item.status === "posted" ? "default" : "secondary"}>
                      {item.status === "posted" ? "Proknjiženo" : "Nacrt"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{item.notes}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {item.status !== "posted" && (
                        <Button variant="ghost" size="icon" onClick={() => postMutation.mutate(item)} disabled={postMutation.isPending} title="Proknjiži">
                          <BookOpen className="h-4 w-4" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(item.id)} disabled={item.status === "posted"}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {items.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nema eliminacija</TableCell></TableRow>
              )}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={3} className="text-right font-bold">Ukupno eliminisano:</TableCell>
                <TableCell className="text-right font-bold font-mono">{fmtNum(totalElim)}</TableCell>
                <TableCell colSpan={3} />
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
