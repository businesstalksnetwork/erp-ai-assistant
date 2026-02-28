import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/PageHeader";
import { PrintButton } from "@/components/PrintButton";
import { useToast } from "@/hooks/use-toast";
import { fmtNum } from "@/lib/utils";
import { createCodeBasedJournalEntry } from "@/lib/journalUtils";
import { Trash2, Plus, BookOpen } from "lucide-react";

export default function InventoryWriteOff() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [posting, setPosting] = useState(false);

  const [form, setForm] = useState({
    write_off_date: new Date().toISOString().split("T")[0],
    location_id: "",
    warehouse_id: "",
    reason: "",
    commission_members: "",
    commission_protocol_number: "",
    notes: "",
  });

  const [itemForm, setItemForm] = useState({ product_id: "", quantity: 0, unit_cost: 0, reason: "" });

  const { data: locations = [] } = useQuery({
    queryKey: ["locations", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("locations").select("id, name").eq("tenant_id", tenantId!).eq("is_active", true).order("name");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: warehouses = [] } = useQuery({
    queryKey: ["warehouses", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("warehouses").select("id, name").eq("tenant_id", tenantId!).eq("is_active", true).order("name");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products-active", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("id, name, sku").eq("tenant_id", tenantId!).eq("is_active", true).order("name");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: writeOffs = [], isLoading } = useQuery({
    queryKey: ["inventory-write-offs", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("inventory_write_offs")
        .select("*, locations(name), warehouses(name)")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false });
      return (data || []) as any[];
    },
    enabled: !!tenantId,
  });

  const { data: items = [] } = useQuery({
    queryKey: ["write-off-items", selectedId],
    queryFn: async () => {
      const { data } = await supabase
        .from("inventory_write_off_items")
        .select("*, products(name, sku)")
        .eq("write_off_id", selectedId!);
      return (data || []) as any[];
    },
    enabled: !!selectedId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const members = form.commission_members.split(",").map((m) => m.trim()).filter(Boolean);
      const { data, error } = await supabase.from("inventory_write_offs").insert([{
        tenant_id: tenantId!,
        write_off_date: form.write_off_date,
        location_id: form.location_id || null,
        warehouse_id: form.warehouse_id || null,
        reason: form.reason,
        commission_members: members,
        commission_protocol_number: form.commission_protocol_number,
        notes: form.notes,
        created_by: user?.id,
        status: "draft",
      }]).select().single();
      if (error) throw error;
      return (data as any).id;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["inventory-write-offs"] });
      setCreateOpen(false);
      setSelectedId(id);
      toast({ title: "Otpis kreiran" });
    },
    onError: (e: Error) => toast({ title: "Greška", description: e.message, variant: "destructive" }),
  });

  const addItemMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("inventory_write_off_items").insert([{
        write_off_id: selectedId,
        tenant_id: tenantId!,
        product_id: itemForm.product_id,
        quantity: itemForm.quantity,
        unit_cost: itemForm.unit_cost,
        reason: itemForm.reason,
      }]);
      if (error) throw error;

      // Update total
      const { data: allItems } = await supabase.from("inventory_write_off_items").select("total_cost").eq("write_off_id", selectedId!);
      const total = (allItems || []).reduce((s: number, i: any) => s + Number(i.total_cost), 0);
      await supabase.from("inventory_write_offs").update({ total_value: total }).eq("id", selectedId!);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["write-off-items"] });
      qc.invalidateQueries({ queryKey: ["inventory-write-offs"] });
      setAddItemOpen(false);
      setItemForm({ product_id: "", quantity: 0, unit_cost: 0, reason: "" });
      toast({ title: "Stavka dodata" });
    },
    onError: (e: Error) => toast({ title: "Greška", description: e.message, variant: "destructive" }),
  });

  const handlePost = async (wo: any) => {
    if (!tenantId || !user) return;
    setPosting(true);
    try {
      const total = Number(wo.total_value);
      if (total <= 0) throw new Error("Nema stavki za knjiženje");

      const journalId = await createCodeBasedJournalEntry({
        tenantId,
        userId: user.id,
        entryDate: wo.write_off_date,
        description: `Otpis robe - ${wo.reason || "bez razloga"}`,
        reference: `WO-${wo.id.slice(0, 8)}`,
        lines: [
          { accountCode: "5850", debit: total, credit: 0, description: "Rashod po osnovu rashodovanja robe", sortOrder: 1 },
          { accountCode: "1320", debit: 0, credit: total, description: "Smanjenje zaliha robe u magacinu", sortOrder: 2 },
        ],
      });

      await supabase.from("inventory_write_offs").update({
        status: "posted",
        journal_entry_id: journalId,
        approved_by: user.id,
      }).eq("id", wo.id);

      qc.invalidateQueries({ queryKey: ["inventory-write-offs"] });
      toast({ title: "Otpis proknjižen (5850 DR / 1320 CR)" });
    } catch (e: any) {
      toast({ title: "Greška", description: e.message, variant: "destructive" });
    } finally {
      setPosting(false);
    }
  };

  const selectedWo = writeOffs.find((w) => w.id === selectedId);
  const statusLabels: Record<string, string> = { draft: "Nacrt", approved: "Odobren", posted: "Proknjižen" };
  const statusVariant = (s: string) => s === "posted" ? "default" as const : "outline" as const;
  const totalItems = items.reduce((s, i) => s + Number(i.total_cost || 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Otpisi robe"
        description="Rashodovanje robe sa komisijskim protokolom i GL knjiženje (5850/1320)"
        icon={Trash2}
        actions={
          <div className="flex gap-2 print:hidden">
            <PrintButton />
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />Novi otpis
            </Button>
          </div>
        }
      />

      {!selectedId ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Datum</TableHead>
                  <TableHead>Lokacija</TableHead>
                  <TableHead>Razlog</TableHead>
                  <TableHead>Protokol br.</TableHead>
                  <TableHead className="text-right">Vrednost (RSD)</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">{t("loading")}</TableCell></TableRow>
                ) : writeOffs.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nema otpisa</TableCell></TableRow>
                ) : writeOffs.map((wo: any) => (
                  <TableRow key={wo.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedId(wo.id)}>
                    <TableCell>{wo.write_off_date}</TableCell>
                    <TableCell>{wo.locations?.name || "—"}</TableCell>
                    <TableCell>{wo.reason || "—"}</TableCell>
                    <TableCell className="font-mono text-sm">{wo.commission_protocol_number || "—"}</TableCell>
                    <TableCell className="text-right font-mono font-semibold">{fmtNum(Number(wo.total_value))}</TableCell>
                    <TableCell><Badge variant={statusVariant(wo.status)}>{statusLabels[wo.status] || wo.status}</Badge></TableCell>
                    <TableCell>
                      {wo.status === "draft" && (
                        <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handlePost(wo); }} disabled={posting}>
                          <BookOpen className="h-3 w-3 mr-1" />Proknjiži
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex items-center gap-3 print:hidden">
            <Button variant="outline" onClick={() => setSelectedId(null)}>← Nazad</Button>
            <span className="text-lg font-semibold">Otpis: {selectedWo?.write_off_date}</span>
            <Badge variant={statusVariant(selectedWo?.status)}>{statusLabels[selectedWo?.status] || selectedWo?.status}</Badge>
            {selectedWo?.status === "draft" && (
              <Button size="sm" onClick={() => setAddItemOpen(true)}>
                <Plus className="h-3 w-3 mr-1" />Dodaj stavku
              </Button>
            )}
          </div>
          {selectedWo?.commission_members?.length > 0 && (
            <div className="text-sm text-muted-foreground">Komisija: {selectedWo.commission_members.join(", ")}</div>
          )}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Proizvod</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">Količina</TableHead>
                    <TableHead className="text-right">Jed. cena</TableHead>
                    <TableHead className="text-right">Ukupno (RSD)</TableHead>
                    <TableHead>Razlog</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nema stavki</TableCell></TableRow>
                  ) : items.map((item: any) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.products?.name}</TableCell>
                      <TableCell className="font-mono text-sm">{item.products?.sku || "—"}</TableCell>
                      <TableCell className="text-right font-mono">{Number(item.quantity)}</TableCell>
                      <TableCell className="text-right font-mono">{fmtNum(Number(item.unit_cost))}</TableCell>
                      <TableCell className="text-right font-mono font-semibold">{fmtNum(Number(item.total_cost))}</TableCell>
                      <TableCell className="text-sm">{item.reason || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                {items.length > 0 && (
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={4} className="font-bold">Ukupno:</TableCell>
                      <TableCell className="text-right font-bold font-mono">{fmtNum(totalItems)}</TableCell>
                      <TableCell />
                    </TableRow>
                  </TableFooter>
                )}
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      {/* Create write-off dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novi otpis robe</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Datum otpisa</Label>
                <Input type="date" value={form.write_off_date} onChange={(e) => setForm((f) => ({ ...f, write_off_date: e.target.value }))} />
              </div>
              <div>
                <Label>Br. protokola komisije</Label>
                <Input value={form.commission_protocol_number} onChange={(e) => setForm((f) => ({ ...f, commission_protocol_number: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Lokacija</Label>
                <Select value={form.location_id} onValueChange={(v) => setForm((f) => ({ ...f, location_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Izaberite" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Sve</SelectItem>
                    {locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Magacin</Label>
                <Select value={form.warehouse_id} onValueChange={(v) => setForm((f) => ({ ...f, warehouse_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Izaberite" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Svi</SelectItem>
                    {warehouses.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Razlog otpisa</Label>
              <Input value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} />
            </div>
            <div>
              <Label>Članovi komisije (razdvojeni zarezom)</Label>
              <Input value={form.commission_members} onChange={(e) => setForm((f) => ({ ...f, commission_members: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Otkaži</Button>
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>Kreiraj otpis</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add item dialog */}
      <Dialog open={addItemOpen} onOpenChange={setAddItemOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Dodaj stavku za otpis</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Proizvod</Label>
              <Select value={itemForm.product_id} onValueChange={(v) => setItemForm((f) => ({ ...f, product_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Izaberite proizvod" /></SelectTrigger>
                <SelectContent>
                  {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} ({p.sku})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Količina</Label>
                <Input type="number" value={itemForm.quantity} onChange={(e) => setItemForm((f) => ({ ...f, quantity: Number(e.target.value) }))} />
              </div>
              <div>
                <Label>Jedinična cena</Label>
                <Input type="number" value={itemForm.unit_cost} onChange={(e) => setItemForm((f) => ({ ...f, unit_cost: Number(e.target.value) }))} />
              </div>
            </div>
            <div className="p-3 bg-muted rounded-md text-center">
              <span className="text-sm text-muted-foreground">Ukupno: </span>
              <span className="text-lg font-bold font-mono">{fmtNum(itemForm.quantity * itemForm.unit_cost)} RSD</span>
            </div>
            <div>
              <Label>Razlog</Label>
              <Input value={itemForm.reason} onChange={(e) => setItemForm((f) => ({ ...f, reason: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddItemOpen(false)}>Otkaži</Button>
            <Button onClick={() => addItemMutation.mutate()} disabled={!itemForm.product_id || itemForm.quantity <= 0 || addItemMutation.isPending}>Dodaj</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
