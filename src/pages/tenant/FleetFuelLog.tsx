import { useState } from "react";
import { useTenant } from "@/hooks/useTenant";
import { useLanguage } from "@/i18n/LanguageContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/components/ui/sonner";
import { Plus, Search } from "lucide-react";
import { format } from "date-fns";

export default function FleetFuelLog() {
  const { tenantId } = useTenant();
  const { t } = useLanguage();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    vehicle_id: "", log_date: new Date().toISOString().slice(0, 10),
    fuel_type: "diesel", quantity_liters: "", price_per_liter: "",
    total_cost: "", odometer_km: "", station_name: "", receipt_number: "",
  });

  const { data: vehicles } = useQuery({
    queryKey: ["fleet-vehicles-select", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("fleet_vehicles").select("id, registration_plate, make, model").eq("tenant_id", tenantId!);
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: logs, isLoading } = useQuery({
    queryKey: ["fleet-fuel-logs", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("fleet_fuel_logs")
        .select("*, fleet_vehicles!inner(registration_plate, make, model)")
        .eq("tenant_id", tenantId!).order("log_date", { ascending: false }).limit(200);
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const set = (k: string, v: string) => {
    const next = { ...form, [k]: v };
    if ((k === "quantity_liters" || k === "price_per_liter") && next.quantity_liters && next.price_per_liter) {
      next.total_cost = (parseFloat(next.quantity_liters) * parseFloat(next.price_per_liter)).toFixed(2);
    }
    setForm(next);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId || !form.vehicle_id) throw new Error(t("selectVehicle"));
      const { error } = await supabase.from("fleet_fuel_logs").insert({
        tenant_id: tenantId, vehicle_id: form.vehicle_id, log_date: form.log_date,
        fuel_type: form.fuel_type, quantity_liters: parseFloat(form.quantity_liters),
        price_per_liter: form.price_per_liter ? parseFloat(form.price_per_liter) : null,
        total_cost: parseFloat(form.total_cost),
        odometer_km: form.odometer_km ? parseFloat(form.odometer_km) : null,
        station_name: form.station_name || null, receipt_number: form.receipt_number || null,
      });
      if (error) throw error;
      if (form.odometer_km) {
        await supabase.from("fleet_vehicles").update({ odometer_km: parseFloat(form.odometer_km) }).eq("id", form.vehicle_id);
      }
    },
    onSuccess: () => {
      toast.success(t("fuelRecorded"));
      qc.invalidateQueries({ queryKey: ["fleet-fuel-logs"] });
      setOpen(false);
      setForm({ vehicle_id: "", log_date: new Date().toISOString().slice(0, 10), fuel_type: "diesel", quantity_liters: "", price_per_liter: "", total_cost: "", odometer_km: "", station_name: "", receipt_number: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = (logs || []).filter((l: any) => {
    const q = search.toLowerCase();
    return !q || l.fleet_vehicles?.registration_plate?.toLowerCase().includes(q) || l.station_name?.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4 p-1">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("fuelLog")}</h1>
          <p className="text-muted-foreground text-sm">{t("fuelLogDesc")}</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> {t("fleetNewEntry")}</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{t("fuelLogTitle")}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>{t("vehicle")}</Label>
                <Select value={form.vehicle_id} onValueChange={v => set("vehicle_id", v)}>
                  <SelectTrigger><SelectValue placeholder={t("selectVehicle")} /></SelectTrigger>
                  <SelectContent>
                    {(vehicles || []).map((v: any) => (
                      <SelectItem key={v.id} value={v.id}>{v.registration_plate} — {v.make} {v.model}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>{t("date")}</Label><Input type="date" value={form.log_date} onChange={e => set("log_date", e.target.value)} /></div>
                <div>
                  <Label>{t("fuelType")}</Label>
                  <Select value={form.fuel_type} onValueChange={v => set("fuel_type", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="diesel">Dizel</SelectItem>
                      <SelectItem value="petrol">Benzin</SelectItem>
                      <SelectItem value="lpg">TNG</SelectItem>
                      <SelectItem value="electric">EV</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div><Label>{t("liters")}</Label><Input type="number" step="0.01" value={form.quantity_liters} onChange={e => set("quantity_liters", e.target.value)} /></div>
                <div><Label>{t("pricePerLiter")}</Label><Input type="number" step="0.01" value={form.price_per_liter} onChange={e => set("price_per_liter", e.target.value)} /></div>
                <div><Label>{t("totalRsd")}</Label><Input type="number" step="0.01" value={form.total_cost} onChange={e => set("total_cost", e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>{t("odometer")}</Label><Input type="number" value={form.odometer_km} onChange={e => set("odometer_km", e.target.value)} /></div>
                <div><Label>{t("station")}</Label><Input value={form.station_name} onChange={e => set("station_name", e.target.value)} /></div>
              </div>
              <div><Label>{t("receiptNumberLabel")}</Label><Input value={form.receipt_number} onChange={e => set("receipt_number", e.target.value)} /></div>
              <Button className="w-full" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? t("saving") : t("save")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder={t("search")} className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("date")}</TableHead>
                <TableHead>{t("vehicle")}</TableHead>
                <TableHead>{t("fuelType")}</TableHead>
                <TableHead className="text-right">{t("liters")}</TableHead>
                <TableHead className="text-right">{t("pricePerLiter")}</TableHead>
                <TableHead className="text-right">{t("total")}</TableHead>
                <TableHead className="text-right">km</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8">{t("loading")}</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">{t("noEntries")}</TableCell></TableRow>
              ) : filtered.map((l: any) => (
                <TableRow key={l.id}>
                  <TableCell>{format(new Date(l.log_date), "dd.MM.yyyy")}</TableCell>
                  <TableCell className="font-mono">{l.fleet_vehicles?.registration_plate}</TableCell>
                  <TableCell>{l.fuel_type}</TableCell>
                  <TableCell className="text-right">{Number(l.quantity_liters).toFixed(2)}</TableCell>
                  <TableCell className="text-right">{l.price_per_liter ? Number(l.price_per_liter).toFixed(2) : "—"}</TableCell>
                  <TableCell className="text-right font-semibold">{Number(l.total_cost).toLocaleString("sr", { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell className="text-right">{l.odometer_km ? Number(l.odometer_km).toLocaleString("sr") : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
