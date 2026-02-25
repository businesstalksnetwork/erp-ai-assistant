import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, ArrowDownLeft, ArrowUpRight, Wallet } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

export default function CashRegister() {
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [filterMonth, setFilterMonth] = useState(format(new Date(), "yyyy-MM"));
  const [form, setForm] = useState({
    direction: "in" as "in" | "out",
    amount: "",
    description: "",
    document_ref: "",
  });

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["cash-register", tenantId, filterMonth],
    queryFn: async () => {
      if (!tenantId) return [];
      const start = `${filterMonth}-01`;
      const endDate = new Date(Number(filterMonth.split("-")[0]), Number(filterMonth.split("-")[1]), 0);
      const end = format(endDate, "yyyy-MM-dd");
      const { data, error } = await supabase
        .from("cash_register")
        .select("*")
        .eq("tenant_id", tenantId)
        .gte("entry_date", start)
        .lte("entry_date", end)
        .order("entry_date")
        .order("entry_number");
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { totalIn, totalOut } = useMemo(() => {
    let totalIn = 0, totalOut = 0;
    for (const e of entries) {
      if (e.direction === "in") totalIn += Number(e.amount);
      else totalOut += Number(e.amount);
    }
    return { totalIn, totalOut };
  }, [entries]);

  const createMut = useMutation({
    mutationFn: async () => {
      const entryNumber = `BL-${Date.now().toString(36).toUpperCase()}`;
      const { error } = await supabase.from("cash_register").insert({
        tenant_id: tenantId!,
        entry_number: entryNumber,
        entry_date: format(new Date(), "yyyy-MM-dd"),
        direction: form.direction,
        amount: Number(form.amount),
        description: form.description,
        document_ref: form.document_ref || null,
        created_by: user?.id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Stavka blagajne kreirana");
      qc.invalidateQueries({ queryKey: ["cash-register"] });
      setOpen(false);
      setForm({ direction: "in", amount: "", description: "", document_ref: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Blagajna"
        description="Blagajnički dnevnik — evidencija gotovinskih uplata i isplata"
      />

      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <Label>Mesec</Label>
          <Input type="month" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className="w-48" />
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Nova stavka
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Primanja</p>
            <p className="text-lg font-bold text-green-600">{totalIn.toLocaleString("sr-RS")} RSD</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Izdavanja</p>
            <p className="text-lg font-bold text-red-600">{totalOut.toLocaleString("sr-RS")} RSD</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Saldo</p>
            <p className="text-lg font-bold">{(totalIn - totalOut).toLocaleString("sr-RS")} RSD</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Wallet className="h-4 w-4" /> Blagajnički dnevnik
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-60" />
          ) : entries.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nema stavki za izabrani mesec.</p>
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Broj</TableHead>
                  <TableHead>Datum</TableHead>
                  <TableHead>Smer</TableHead>
                  <TableHead>Opis</TableHead>
                  <TableHead>Dokument</TableHead>
                  <TableHead className="text-right">Primanje</TableHead>
                  <TableHead className="text-right">Izdavanje</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((e: any) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-mono text-xs">{e.entry_number}</TableCell>
                    <TableCell>{e.entry_date}</TableCell>
                    <TableCell>
                      {e.direction === "in" ? (
                        <Badge variant="default" className="gap-1"><ArrowDownLeft className="h-3 w-3" /> Uplata</Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1"><ArrowUpRight className="h-3 w-3" /> Isplata</Badge>
                      )}
                    </TableCell>
                    <TableCell>{e.description}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{e.document_ref || "—"}</TableCell>
                    <TableCell className="text-right text-green-600">
                      {e.direction === "in" ? Number(e.amount).toLocaleString("sr-RS") : ""}
                    </TableCell>
                    <TableCell className="text-right text-red-600">
                      {e.direction === "out" ? Number(e.amount).toLocaleString("sr-RS") : ""}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={5} className="font-semibold">UKUPNO</TableCell>
                  <TableCell className="text-right font-semibold text-green-600">{totalIn.toLocaleString("sr-RS")}</TableCell>
                  <TableCell className="text-right font-semibold text-red-600">{totalOut.toLocaleString("sr-RS")}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova blagajnička stavka</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Smer</Label>
              <Select value={form.direction} onValueChange={(v: "in" | "out") => setForm({ ...form, direction: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="in">Uplata (primanje)</SelectItem>
                  <SelectItem value="out">Isplata (izdavanje)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Iznos (RSD)</Label>
              <Input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </div>
            <div>
              <Label>Opis</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="npr. Nabavka kancelarijskog materijala" />
            </div>
            <div>
              <Label>Broj dokumenta (opciono)</Label>
              <Input value={form.document_ref} onChange={(e) => setForm({ ...form, document_ref: e.target.value })} placeholder="npr. RN-001/26" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Otkaži</Button>
            <Button onClick={() => createMut.mutate()} disabled={!form.description || !form.amount || createMut.isPending}>
              {createMut.isPending ? "Čuvanje..." : "Sačuvaj"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
