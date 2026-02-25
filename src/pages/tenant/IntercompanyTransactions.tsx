import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { useLegalEntities } from "@/hooks/useLegalEntities";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, ArrowRightLeft, Trash2 } from "lucide-react";
import { format } from "date-fns";

export default function IntercompanyTransactions() {
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const { entities: legalEntities } = useLegalEntities();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    from_legal_entity_id: "",
    to_legal_entity_id: "",
    amount: "",
    description: "",
    reference: "",
    notes: "",
  });

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["intercompany-transactions", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("intercompany_transactions")
        .select("*, from_entity:from_legal_entity_id(name), to_entity:to_legal_entity_id(name)")
        .eq("tenant_id", tenantId)
        .order("transaction_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const createMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("intercompany_transactions").insert({
        tenant_id: tenantId!,
        from_legal_entity_id: form.from_legal_entity_id,
        to_legal_entity_id: form.to_legal_entity_id,
        amount: Number(form.amount),
        description: form.description,
        reference: form.reference || null,
        notes: form.notes || null,
        created_by: user?.id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Intercompany transakcija kreirana");
      qc.invalidateQueries({ queryKey: ["intercompany-transactions"] });
      setOpen(false);
      setForm({ from_legal_entity_id: "", to_legal_entity_id: "", amount: "", description: "", reference: "", notes: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("intercompany_transactions").delete().eq("id", id).eq("status", "draft");
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Obrisano");
      qc.invalidateQueries({ queryKey: ["intercompany-transactions"] });
    },
  });

  const statusColors: Record<string, "default" | "secondary" | "destructive"> = {
    draft: "secondary",
    posted: "default",
    eliminated: "destructive",
  };

  const totalAmount = transactions.reduce((s: number, t: any) => s + Number(t.amount || 0), 0);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader
        title="Intercompany transakcije"
        description="Međukompanijske transakcije između pravnih lica unutar grupe"
      />

      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">Ukupno: <span className="font-semibold">{totalAmount.toLocaleString("sr-RS")} RSD</span></p>
        <Button onClick={() => setOpen(true)} disabled={legalEntities.length < 2}>
          <Plus className="h-4 w-4 mr-2" /> Nova transakcija
        </Button>
      </div>

      {legalEntities.length < 2 && (
        <Card>
          <CardContent className="p-4 text-center text-muted-foreground">
            Potrebna su najmanje 2 pravna lica za intercompany transakcije. Dodajte ih u Podešavanjima.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><ArrowRightLeft className="h-4 w-4" /> Transakcije</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Učitavanje...</p>
          ) : transactions.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nema transakcija.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Datum</TableHead>
                  <TableHead>Od</TableHead>
                  <TableHead>Ka</TableHead>
                  <TableHead>Opis</TableHead>
                  <TableHead className="text-right">Iznos</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Akcije</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((t: any) => (
                  <TableRow key={t.id}>
                    <TableCell>{t.transaction_date}</TableCell>
                    <TableCell className="font-medium">{(t.from_entity as any)?.name || "—"}</TableCell>
                    <TableCell className="font-medium">{(t.to_entity as any)?.name || "—"}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{t.description}</TableCell>
                    <TableCell className="text-right font-semibold">{Number(t.amount).toLocaleString("sr-RS")}</TableCell>
                    <TableCell><Badge variant={statusColors[t.status] || "secondary"}>{t.status}</Badge></TableCell>
                    <TableCell className="text-right">
                      {t.status === "draft" && (
                        <Button size="icon" variant="ghost" onClick={() => deleteMut.mutate(t.id)} className="text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova intercompany transakcija</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Od pravnog lica</Label>
                <Select value={form.from_legal_entity_id} onValueChange={(v) => setForm({ ...form, from_legal_entity_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Izaberite" /></SelectTrigger>
                  <SelectContent>
                    {legalEntities.map((le: any) => (
                      <SelectItem key={le.id} value={le.id}>{le.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Ka pravnom licu</Label>
                <Select value={form.to_legal_entity_id} onValueChange={(v) => setForm({ ...form, to_legal_entity_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Izaberite" /></SelectTrigger>
                  <SelectContent>
                    {legalEntities.filter((le: any) => le.id !== form.from_legal_entity_id).map((le: any) => (
                      <SelectItem key={le.id} value={le.id}>{le.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Iznos (RSD)</Label>
              <Input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </div>
            <div>
              <Label>Opis</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="npr. Administrativne usluge za januar" />
            </div>
            <div>
              <Label>Referenca (opciono)</Label>
              <Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Otkaži</Button>
            <Button onClick={() => createMut.mutate()} disabled={!form.from_legal_entity_id || !form.to_legal_entity_id || !form.amount || !form.description || createMut.isPending}>
              {createMut.isPending ? "Čuvanje..." : "Sačuvaj"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
