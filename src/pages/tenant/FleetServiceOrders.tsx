import { useState } from "react";
import { useTenant } from "@/hooks/useTenant";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/components/ui/sonner";
import { Plus, Wrench, Search } from "lucide-react";
import { format } from "date-fns";

export default function FleetServiceOrders() {
  const { tenantId } = useTenant();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    vehicle_id: "", service_type: "regular", planned_date: new Date().toISOString().slice(0, 10),
    description: "", service_provider: "", labor_cost: "", parts_cost: "",
  });

  const { data: vehicles } = useQuery({
    queryKey: ["fleet-vehicles-select", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("fleet_vehicles").select("id, registration_plate, make, model").eq("tenant_id", tenantId!);
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: orders, isLoading } = useQuery({
    queryKey: ["fleet-service-orders", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fleet_service_orders")
        .select("*, fleet_vehicles!inner(registration_plate, make, model)")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const set = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }));

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId || !form.vehicle_id) throw new Error("Izaberite vozilo");
      const labor = parseFloat(form.labor_cost) || 0;
      const parts = parseFloat(form.parts_cost) || 0;
      const { error } = await supabase.from("fleet_service_orders").insert({
        tenant_id: tenantId,
        vehicle_id: form.vehicle_id,
        order_number: `SRV-${Date.now().toString().slice(-8)}`,
        service_type: form.service_type,
        status: "planned",
        planned_date: form.planned_date,
        description: form.description || null,
        service_provider: form.service_provider || null,
        labor_cost: labor,
        parts_cost: parts,
        total_cost: labor + parts,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Servisni nalog kreiran");
      qc.invalidateQueries({ queryKey: ["fleet-service-orders"] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const completeMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await supabase.from("fleet_service_orders").update({
        status: "completed", completed_date: new Date().toISOString().slice(0, 10),
      }).eq("id", orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Servis završen");
      qc.invalidateQueries({ queryKey: ["fleet-service-orders"] });
    },
  });

  const statusLabel: Record<string, string> = { planned: "Planiran", in_progress: "U toku", completed: "Završen", cancelled: "Otkazan" };
  const typeLabel: Record<string, string> = { regular: "Redovni", repair: "Popravka", inspection: "Pregled", tires: "Gume", other: "Ostalo" };
  const statusVariant = (s: string) => s === "completed" ? "default" as const : s === "cancelled" ? "destructive" as const : "secondary" as const;

  const filtered = (orders || []).filter((o: any) => {
    const q = search.toLowerCase();
    return !q || o.fleet_vehicles?.registration_plate?.toLowerCase().includes(q) || o.order_number?.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4 p-1">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Servisni nalozi</h1>
          <p className="text-muted-foreground text-sm">Redovni i vanredni servisi vozila</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> Novi nalog</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Novi servisni nalog</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Vozilo</Label>
                <Select value={form.vehicle_id} onValueChange={v => set("vehicle_id", v)}>
                  <SelectTrigger><SelectValue placeholder="Izaberite vozilo" /></SelectTrigger>
                  <SelectContent>
                    {(vehicles || []).map((v: any) => (
                      <SelectItem key={v.id} value={v.id}>{v.registration_plate} — {v.make} {v.model}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Tip servisa</Label>
                  <Select value={form.service_type} onValueChange={v => set("service_type", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="regular">Redovni</SelectItem>
                      <SelectItem value="repair">Popravka</SelectItem>
                      <SelectItem value="inspection">Pregled</SelectItem>
                      <SelectItem value="tires">Gume</SelectItem>
                      <SelectItem value="other">Ostalo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Planirani datum</Label><Input type="date" value={form.planned_date} onChange={e => set("planned_date", e.target.value)} /></div>
              </div>
              <div><Label>Servis</Label><Input value={form.service_provider} onChange={e => set("service_provider", e.target.value)} placeholder="Naziv servisa" /></div>
              <div><Label>Opis</Label><Textarea value={form.description} onChange={e => set("description", e.target.value)} rows={2} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Rad (RSD)</Label><Input type="number" value={form.labor_cost} onChange={e => set("labor_cost", e.target.value)} /></div>
                <div><Label>Delovi (RSD)</Label><Input type="number" value={form.parts_cost} onChange={e => set("parts_cost", e.target.value)} /></div>
              </div>
              <Button className="w-full" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Čuvanje..." : "Kreiraj nalog"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Pretraga..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Broj</TableHead>
                <TableHead>Vozilo</TableHead>
                <TableHead>Tip</TableHead>
                <TableHead>Datum</TableHead>
                <TableHead>Servis</TableHead>
                <TableHead className="text-right">Ukupno</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8">Učitavanje...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nema naloga</TableCell></TableRow>
              ) : filtered.map((o: any) => (
                <TableRow key={o.id}>
                  <TableCell className="font-mono">{o.order_number}</TableCell>
                  <TableCell>{o.fleet_vehicles?.registration_plate}</TableCell>
                  <TableCell>{typeLabel[o.service_type] || o.service_type}</TableCell>
                  <TableCell>{o.planned_date ? format(new Date(o.planned_date), "dd.MM.yyyy") : "—"}</TableCell>
                  <TableCell>{o.service_provider || "—"}</TableCell>
                  <TableCell className="text-right font-semibold">{Number(o.total_cost).toLocaleString("sr", { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell><Badge variant={statusVariant(o.status)}>{statusLabel[o.status] || o.status}</Badge></TableCell>
                  <TableCell>
                    {o.status === "planned" && (
                      <Button size="sm" variant="outline" onClick={() => completeMutation.mutate(o.id)}>Završi</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
