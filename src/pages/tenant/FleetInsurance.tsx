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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/components/ui/sonner";
import { Plus, Shield } from "lucide-react";
import { format, differenceInDays } from "date-fns";

export default function FleetInsurance() {
  const { tenantId } = useTenant();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    vehicle_id: "", insurance_type: "mandatory", policy_number: "",
    insurer: "", start_date: "", end_date: "", premium_amount: "",
  });

  const { data: vehicles } = useQuery({
    queryKey: ["fleet-vehicles-select", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("fleet_vehicles").select("id, registration_plate, make, model").eq("tenant_id", tenantId!);
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: policies, isLoading } = useQuery({
    queryKey: ["fleet-insurance", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fleet_insurance")
        .select("*, fleet_vehicles!inner(registration_plate, make, model)")
        .eq("tenant_id", tenantId!)
        .order("end_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const set = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }));
  const typeLabel: Record<string, string> = { mandatory: "Obavezno", casco: "Kasko", combined: "Kombinovano" };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId || !form.vehicle_id) throw new Error("Izaberite vozilo");
      const { error } = await supabase.from("fleet_insurance").insert({
        tenant_id: tenantId,
        vehicle_id: form.vehicle_id,
        insurance_type: form.insurance_type,
        policy_number: form.policy_number || null,
        insurer: form.insurer || null,
        start_date: form.start_date,
        end_date: form.end_date,
        premium_amount: form.premium_amount ? parseFloat(form.premium_amount) : 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Polisa dodana");
      qc.invalidateQueries({ queryKey: ["fleet-insurance"] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const expiryBadge = (d: string) => {
    const days = differenceInDays(new Date(d), new Date());
    if (days < 0) return <Badge variant="destructive">Istekla</Badge>;
    if (days <= 30) return <Badge variant="destructive">Ističe za {days}d</Badge>;
    return <Badge variant="default">Aktivna</Badge>;
  };

  return (
    <div className="space-y-4 p-1">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Osiguranja</h1>
          <p className="text-muted-foreground text-sm">Polise obaveznog i kasko osiguranja</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" /> Nova polisa</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Nova polisa osiguranja</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Vozilo</Label>
                <Select value={form.vehicle_id} onValueChange={v => set("vehicle_id", v)}>
                  <SelectTrigger><SelectValue placeholder="Izaberite" /></SelectTrigger>
                  <SelectContent>
                    {(vehicles || []).map((v: any) => (
                      <SelectItem key={v.id} value={v.id}>{v.registration_plate} — {v.make} {v.model}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Tip</Label>
                  <Select value={form.insurance_type} onValueChange={v => set("insurance_type", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mandatory">Obavezno</SelectItem>
                      <SelectItem value="casco">Kasko</SelectItem>
                      <SelectItem value="combined">Kombinovano</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Osiguravač</Label><Input value={form.insurer} onChange={e => set("insurer", e.target.value)} /></div>
              </div>
              <div><Label>Broj polise</Label><Input value={form.policy_number} onChange={e => set("policy_number", e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Od</Label><Input type="date" value={form.start_date} onChange={e => set("start_date", e.target.value)} /></div>
                <div><Label>Do</Label><Input type="date" value={form.end_date} onChange={e => set("end_date", e.target.value)} /></div>
              </div>
              <div><Label>Premija (RSD)</Label><Input type="number" value={form.premium_amount} onChange={e => set("premium_amount", e.target.value)} /></div>
              <Button className="w-full" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>Sačuvaj</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vozilo</TableHead>
                <TableHead>Tip</TableHead>
                <TableHead>Polisa</TableHead>
                <TableHead>Osiguravač</TableHead>
                <TableHead>Od</TableHead>
                <TableHead>Do</TableHead>
                <TableHead className="text-right">Premija</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8">Učitavanje...</TableCell></TableRow>
              ) : (policies || []).length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nema polisa</TableCell></TableRow>
              ) : (policies || []).map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono">{p.fleet_vehicles?.registration_plate}</TableCell>
                  <TableCell>{typeLabel[p.insurance_type] || p.insurance_type}</TableCell>
                  <TableCell>{p.policy_number || "—"}</TableCell>
                  <TableCell>{p.insurer || "—"}</TableCell>
                  <TableCell>{format(new Date(p.start_date), "dd.MM.yyyy")}</TableCell>
                  <TableCell>{format(new Date(p.end_date), "dd.MM.yyyy")}</TableCell>
                  <TableCell className="text-right font-semibold">{Number(p.premium_amount).toLocaleString("sr", { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell>{expiryBadge(p.end_date)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
