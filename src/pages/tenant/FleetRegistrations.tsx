import { useState } from "react";
import { useTenant } from "@/hooks/useTenant";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/components/ui/sonner";
import { Plus } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { PageHeader } from "@/components/shared/PageHeader";
import { ResponsiveTable, type ResponsiveColumn } from "@/components/shared/ResponsiveTable";

export default function FleetRegistrations() {
  const { tenantId } = useTenant();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    vehicle_id: "", registration_date: "", expiry_date: "",
    registration_number: "", inspection_date: "", inspection_expiry: "", cost: "",
  });

  const { data: vehicles } = useQuery({
    queryKey: ["fleet-vehicles-select", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("fleet_vehicles").select("id, registration_plate, make, model").eq("tenant_id", tenantId!);
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: regs = [], isLoading } = useQuery({
    queryKey: ["fleet-registrations", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fleet_registrations")
        .select("*, fleet_vehicles!inner(registration_plate, make, model)")
        .eq("tenant_id", tenantId!)
        .order("expiry_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const set = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }));

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId || !form.vehicle_id) throw new Error("Izaberite vozilo");
      const { error } = await supabase.from("fleet_registrations").insert({
        tenant_id: tenantId, vehicle_id: form.vehicle_id,
        registration_date: form.registration_date, expiry_date: form.expiry_date,
        registration_number: form.registration_number || null,
        inspection_date: form.inspection_date || null, inspection_expiry: form.inspection_expiry || null,
        cost: form.cost ? parseFloat(form.cost) : 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Registracija dodana");
      qc.invalidateQueries({ queryKey: ["fleet-registrations"] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const expiryBadge = (d: string) => {
    const days = differenceInDays(new Date(d), new Date());
    if (days < 0) return <Badge variant="destructive">Istekla</Badge>;
    if (days <= 30) return <Badge variant="destructive">Ističe za {days}d</Badge>;
    if (days <= 60) return <Badge variant="secondary">Uskoro ({days}d)</Badge>;
    return <Badge variant="default">Aktivna</Badge>;
  };

  const columns: ResponsiveColumn<any>[] = [
    { key: "vehicle", label: "Vozilo", primary: true, sortable: true, sortValue: (r) => r.fleet_vehicles?.registration_plate || "", render: (r) => <span className="font-mono">{r.fleet_vehicles?.registration_plate}</span> },
    { key: "reg", label: "Reg. broj", hideOnMobile: true, render: (r) => r.registration_number || "—" },
    { key: "from", label: "Od", sortable: true, sortValue: (r) => r.registration_date, render: (r) => format(new Date(r.registration_date), "dd.MM.yyyy") },
    { key: "to", label: "Do", sortable: true, sortValue: (r) => r.expiry_date, render: (r) => format(new Date(r.expiry_date), "dd.MM.yyyy") },
    { key: "insp", label: "Tehnički do", hideOnMobile: true, render: (r) => r.inspection_expiry ? format(new Date(r.inspection_expiry), "dd.MM.yyyy") : "—" },
    { key: "cost", label: "Trošak", align: "right" as const, sortable: true, sortValue: (r) => Number(r.cost), render: (r) => Number(r.cost).toLocaleString("sr", { minimumFractionDigits: 2 }) },
    { key: "status", label: "Status", render: (r) => expiryBadge(r.expiry_date) },
  ];

  if (isLoading) {
    return <div className="flex justify-center py-8"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  }

  return (
    <div className="space-y-4 p-1">
      <PageHeader
        title="Registracije vozila"
        description="Pregled registracija i tehničkih pregleda"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" /> Nova registracija</Button></DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Nova registracija</DialogTitle></DialogHeader>
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
                  <div><Label>Datum registracije</Label><Input type="date" value={form.registration_date} onChange={e => set("registration_date", e.target.value)} /></div>
                  <div><Label>Važi do</Label><Input type="date" value={form.expiry_date} onChange={e => set("expiry_date", e.target.value)} /></div>
                </div>
                <div><Label>Registarski broj</Label><Input value={form.registration_number} onChange={e => set("registration_number", e.target.value)} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Tehnički pregled</Label><Input type="date" value={form.inspection_date} onChange={e => set("inspection_date", e.target.value)} /></div>
                  <div><Label>Važi do</Label><Input type="date" value={form.inspection_expiry} onChange={e => set("inspection_expiry", e.target.value)} /></div>
                </div>
                <div><Label>Trošak (RSD)</Label><Input type="number" value={form.cost} onChange={e => set("cost", e.target.value)} /></div>
                <Button className="w-full" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>Sačuvaj</Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      <ResponsiveTable
        data={regs}
        columns={columns}
        keyExtractor={(r) => r.id}
        emptyMessage="Nema registracija"
        enableExport
        exportFilename="fleet-registrations"
      />
    </div>
  );
}
