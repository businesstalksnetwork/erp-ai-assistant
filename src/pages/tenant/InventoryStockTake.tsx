import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { postWithRuleOrFallback } from "@/lib/postingHelper";
import { ClipboardList, Plus, BookOpen, Check } from "lucide-react";

export default function InventoryStockTake() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);

  const [form, setForm] = useState({
    stock_take_date: new Date().toISOString().split("T")[0],
    location_id: "",
    warehouse_id: "",
    commission_members: "",
    notes: "",
  });

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

  const { data: stockTakes = [], isLoading } = useQuery({
    queryKey: ["inventory-stock-takes", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("inventory_stock_takes" as any)
        .select("*, locations(name), warehouses(name)")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false });
      return (data || []) as any[];
    },
    enabled: !!tenantId,
  });

  const { data: items = [] } = useQuery({
    queryKey: ["stock-take-items", selectedId],
    queryFn: async () => {
      const { data } = await supabase
        .from("inventory_stock_take_items" as any)
        .select("*, products(name, sku)")
        .eq("stock_take_id", selectedId!);
      return (data || []) as any[];
    },
    enabled: !!selectedId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const members = form.commission_members.split(",").map((m) => m.trim()).filter(Boolean);
      const { data, error } = await supabase.from("inventory_stock_takes" as any).insert([{
        tenant_id: tenantId!,
        stock_take_date: form.stock_take_date,
        location_id: form.location_id || null,
        warehouse_id: form.warehouse_id || null,
        commission_members: members,
        notes: form.notes,
        created_by: user?.id,
        status: "draft",
      }] as any).select().single();
      if (error) throw error;

      // Auto-populate items from current stock
      const stockQuery = supabase.from("inventory_stock" as any).select("product_id, quantity, unit_cost").eq("tenant_id", tenantId!);
      if (form.warehouse_id) (stockQuery as any).eq("warehouse_id", form.warehouse_id);
      const { data: stockData } = await stockQuery;

      if (stockData && stockData.length > 0) {
        const itemsToInsert = (stockData as any[]).map((s) => ({
          stock_take_id: (data as any).id,
          product_id: s.product_id,
          expected_qty: Number(s.quantity),
          counted_qty: Number(s.quantity), // default to expected, user adjusts
          unit_cost: Number(s.unit_cost || 0),
        }));
        await supabase.from("inventory_stock_take_items" as any).insert(itemsToInsert as any);
      }
      return (data as any).id;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["inventory-stock-takes"] });
      setCreateOpen(false);
      setSelectedId(id);
      toast({ title: "Popisna lista kreirana" });
    },
    onError: (e: Error) => toast({ title: "Greška", description: e.message, variant: "destructive" }),
  });

  const updateItemMutation = useMutation({
    mutationFn: async ({ id, counted_qty }: { id: string; counted_qty: number }) => {
      const { error } = await supabase.from("inventory_stock_take_items" as any).update({ counted_qty } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["stock-take-items"] }),
  });

  const handleApprove = async (st: any) => {
    if (!tenantId || !user) return;
    setPosting(true);
    try {
      const { data: stItems } = await supabase
        .from("inventory_stock_take_items" as any)
        .select("*")
        .eq("stock_take_id", st.id);

      const differences = (stItems as any[] || []).filter((i) => Number(i.difference_qty) !== 0);

      let journalId: string | null = null;
      if (differences.length > 0) {
        const surplusTotal = differences.filter((d) => d.difference_qty > 0).reduce((s, d) => s + Math.abs(Number(d.difference_value)), 0);
        const shortageTotal = differences.filter((d) => d.difference_qty < 0).reduce((s, d) => s + Math.abs(Number(d.difference_value)), 0);

        if (shortageTotal > 0) {
          journalId = await postWithRuleOrFallback({
            tenantId,
            userId: user.id,
            modelCode: "STOCK_TAKE_SHORTAGE",
            amount: shortageTotal,
            entryDate: st.stock_take_date,
            description: `Manjak na popisu - ${st.stock_take_date}`,
            reference: `ST-SHORT-${st.id.slice(0, 8)}`,
            context: {},
            fallbackLines: [
              { accountCode: "5850", debit: shortageTotal, credit: 0, description: "Manjak robe na popisu", sortOrder: 1 },
              { accountCode: "1320", debit: 0, credit: shortageTotal, description: "Smanjenje zaliha - manjak", sortOrder: 2 },
            ],
          });
        }
        if (surplusTotal > 0) {
          const surplusJournalId = await postWithRuleOrFallback({
            tenantId,
            userId: user.id,
            modelCode: "STOCK_TAKE_SURPLUS",
            amount: surplusTotal,
            entryDate: st.stock_take_date,
            description: `Višak na popisu - ${st.stock_take_date}`,
            reference: `ST-SURP-${st.id.slice(0, 8)}`,
            context: {},
            fallbackLines: [
              { accountCode: "1320", debit: surplusTotal, credit: 0, description: "Povećanje zaliha - višak", sortOrder: 1 },
              { accountCode: "6700", debit: 0, credit: surplusTotal, description: "Višak robe na popisu", sortOrder: 2 },
            ],
          });
          if (!journalId) journalId = surplusJournalId;
        }
      }

      await supabase.from("inventory_stock_takes" as any).update({
        status: "approved",
        approved_by: user.id,
        approved_at: new Date().toISOString(),
        journal_entry_id: journalId,
      } as any).eq("id", st.id);

      qc.invalidateQueries({ queryKey: ["inventory-stock-takes"] });
      toast({ title: "Popis odobren i proknjižen" });
    } catch (e: any) {
      toast({ title: "Greška", description: e.message, variant: "destructive" });
    } finally {
      setPosting(false);
    }
  };

  const selectedSt = stockTakes.find((s) => s.id === selectedId);
  const statusLabels: Record<string, string> = { draft: "Nacrt", in_progress: "U toku", completed: "Završen", approved: "Odobren" };
  const statusVariant = (s: string) => s === "approved" ? "default" as const : "outline" as const;

  const totalDiffValue = items.reduce((s, i) => s + Math.abs(Number(i.difference_value || 0)), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Popisna lista robe"
        description="Inventurni popis sa komisijskim protokolom"
        icon={ClipboardList}
        actions={
          <div className="flex gap-2 print:hidden">
            <PrintButton />
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />Novi popis
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
                  <TableHead>Magacin</TableHead>
                  <TableHead>Komisija</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">{t("loading")}</TableCell></TableRow>
                ) : stockTakes.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nema popisa</TableCell></TableRow>
                ) : stockTakes.map((st: any) => (
                  <TableRow key={st.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedId(st.id)}>
                    <TableCell>{st.stock_take_date}</TableCell>
                    <TableCell>{st.locations?.name || "—"}</TableCell>
                    <TableCell>{st.warehouses?.name || "—"}</TableCell>
                    <TableCell className="text-sm">{(st.commission_members || []).join(", ") || "—"}</TableCell>
                    <TableCell><Badge variant={statusVariant(st.status)}>{statusLabels[st.status] || st.status}</Badge></TableCell>
                    <TableCell>
                      {st.status === "draft" && (
                        <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleApprove(st); }} disabled={posting}>
                          <Check className="h-3 w-3 mr-1" />Odobri
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
            <span className="text-lg font-semibold">Popis: {selectedSt?.stock_take_date}</span>
            <Badge variant={statusVariant(selectedSt?.status)}>{statusLabels[selectedSt?.status] || selectedSt?.status}</Badge>
            {selectedSt?.commission_members?.length > 0 && (
              <span className="text-sm text-muted-foreground">Komisija: {selectedSt.commission_members.join(", ")}</span>
            )}
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Proizvod</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">Očekivano</TableHead>
                    <TableHead className="text-right">Prebrojano</TableHead>
                    <TableHead className="text-right">Razlika</TableHead>
                    <TableHead className="text-right">Jed. cena</TableHead>
                    <TableHead className="text-right">Vrednost razlike</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item: any) => (
                    <TableRow key={item.id} className={Number(item.difference_qty) !== 0 ? "bg-destructive/5" : ""}>
                      <TableCell className="font-medium">{item.products?.name}</TableCell>
                      <TableCell className="text-sm font-mono">{item.products?.sku || "—"}</TableCell>
                      <TableCell className="text-right font-mono">{Number(item.expected_qty)}</TableCell>
                      <TableCell className="text-right">
                        {selectedSt?.status === "draft" ? (
                          <Input
                            type="number"
                            className="w-24 ml-auto text-right"
                            defaultValue={Number(item.counted_qty)}
                            onBlur={(e) => {
                              const val = Number(e.target.value);
                              if (val !== Number(item.counted_qty)) {
                                updateItemMutation.mutate({ id: item.id, counted_qty: val });
                              }
                            }}
                          />
                        ) : (
                          <span className="font-mono">{Number(item.counted_qty)}</span>
                        )}
                      </TableCell>
                      <TableCell className={`text-right font-mono font-semibold ${Number(item.difference_qty) < 0 ? "text-destructive" : Number(item.difference_qty) > 0 ? "text-green-600" : ""}`}>
                        {Number(item.difference_qty) > 0 ? "+" : ""}{Number(item.difference_qty)}
                      </TableCell>
                      <TableCell className="text-right font-mono">{fmtNum(Number(item.unit_cost))}</TableCell>
                      <TableCell className={`text-right font-mono ${Number(item.difference_value) < 0 ? "text-destructive" : Number(item.difference_value) > 0 ? "text-green-600" : ""}`}>
                        {fmtNum(Number(item.difference_value || 0))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                {items.length > 0 && (
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={6} className="font-bold">Ukupna vrednost razlika:</TableCell>
                      <TableCell className="text-right font-bold font-mono">{fmtNum(totalDiffValue)}</TableCell>
                    </TableRow>
                  </TableFooter>
                )}
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novi popis robe</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Datum popisa</Label>
              <Input type="date" value={form.stock_take_date} onChange={(e) => setForm((f) => ({ ...f, stock_take_date: e.target.value }))} />
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
              <Label>Članovi komisije (razdvojeni zarezom)</Label>
              <Input value={form.commission_members} onChange={(e) => setForm((f) => ({ ...f, commission_members: e.target.value }))} placeholder="Ime Prezime, Ime Prezime" />
            </div>
            <div>
              <Label>Napomena</Label>
              <Input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Otkaži</Button>
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>Kreiraj popis</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
