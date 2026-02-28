import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTenant } from "@/hooks/useTenant";
import { useLanguage } from "@/i18n/LanguageContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";
import { ArrowLeft, Save } from "lucide-react";

export default function FleetVehicleForm() {
  const { id } = useParams();
  const isEdit = !!id;
  const { tenantId } = useTenant();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [form, setForm] = useState({
    registration_plate: "", vin: "", make: "", model: "",
    year_of_manufacture: "", engine_type: "diesel", engine_capacity_cc: "",
    engine_power_kw: "", color: "", seat_count: "5", vehicle_class: "passenger",
    odometer_km: "0", notes: "", asset_name: "",
  });

  useQuery({
    queryKey: ["fleet-vehicle", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fleet_vehicles")
        .select("*, assets!inner(name)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      setForm({
        registration_plate: data.registration_plate || "",
        vin: data.vin || "",
        make: data.make || "",
        model: data.model || "",
        year_of_manufacture: data.year_of_manufacture?.toString() || "",
        engine_type: data.engine_type || "diesel",
        engine_capacity_cc: data.engine_capacity_cc?.toString() || "",
        engine_power_kw: data.engine_power_kw?.toString() || "",
        color: data.color || "",
        seat_count: data.seat_count?.toString() || "5",
        vehicle_class: data.vehicle_class || "passenger",
        odometer_km: data.odometer_km?.toString() || "0",
        notes: data.notes || "",
        asset_name: (data as any).assets?.name || "",
      });
      return data;
    },
    enabled: isEdit,
  });

  const set = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }));

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error("No tenant");
      if (isEdit) {
        const { error } = await supabase.from("fleet_vehicles").update({
          registration_plate: form.registration_plate || null,
          vin: form.vin || null, make: form.make || null, model: form.model || null,
          year_of_manufacture: form.year_of_manufacture ? parseInt(form.year_of_manufacture) : null,
          engine_type: form.engine_type,
          engine_capacity_cc: form.engine_capacity_cc ? parseInt(form.engine_capacity_cc) : null,
          engine_power_kw: form.engine_power_kw ? parseFloat(form.engine_power_kw) : null,
          color: form.color || null, seat_count: parseInt(form.seat_count) || 5,
          vehicle_class: form.vehicle_class, odometer_km: parseFloat(form.odometer_km) || 0,
          notes: form.notes || null,
        }).eq("id", id!);
        if (error) throw error;
      } else {
        const assetCode = `VOZ-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;
        const { data: asset, error: ae } = await supabase.from("assets").insert({
          tenant_id: tenantId,
          name: form.asset_name || `${form.make} ${form.model} ${form.registration_plate}`.trim(),
          asset_code: assetCode, asset_type: "vehicle", status: "active",
        }).select("id").single();
        if (ae) throw ae;
        const { error } = await supabase.from("fleet_vehicles").insert({
          tenant_id: tenantId, asset_id: asset.id,
          registration_plate: form.registration_plate || null,
          vin: form.vin || null, make: form.make || null, model: form.model || null,
          year_of_manufacture: form.year_of_manufacture ? parseInt(form.year_of_manufacture) : null,
          engine_type: form.engine_type,
          engine_capacity_cc: form.engine_capacity_cc ? parseInt(form.engine_capacity_cc) : null,
          engine_power_kw: form.engine_power_kw ? parseFloat(form.engine_power_kw) : null,
          color: form.color || null, seat_count: parseInt(form.seat_count) || 5,
          vehicle_class: form.vehicle_class, odometer_km: parseFloat(form.odometer_km) || 0,
          notes: form.notes || null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(isEdit ? t("fleetVehicleUpdated") : t("fleetVehicleAdded"));
      qc.invalidateQueries({ queryKey: ["fleet-vehicles"] });
      navigate("/assets/fleet/vehicles");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4 p-1">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5" /></Button>
        <h1 className="text-2xl font-bold">{isEdit ? t("editVehicle") : t("newVehicle")}</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>{t("basicData")}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {!isEdit && (
              <div><Label>{t("assetNameLabel")}</Label><Input value={form.asset_name} onChange={e => set("asset_name", e.target.value)} placeholder="npr. Fiat Doblo BG-123-AB" /></div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div><Label>{t("registrationPlate")}</Label><Input value={form.registration_plate} onChange={e => set("registration_plate", e.target.value)} placeholder="BG-123-AB" /></div>
              <div><Label>VIN</Label><Input value={form.vin} onChange={e => set("vin", e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div><Label>{t("vehicleMake")}</Label><Input value={form.make} onChange={e => set("make", e.target.value)} placeholder="Fiat" /></div>
              <div><Label>{t("vehicleModel")}</Label><Input value={form.model} onChange={e => set("model", e.target.value)} placeholder="Doblo" /></div>
              <div><Label>{t("vehicleYear")}</Label><Input type="number" value={form.year_of_manufacture} onChange={e => set("year_of_manufacture", e.target.value)} /></div>
            </div>
            <div><Label>{t("vehicleColor")}</Label><Input value={form.color} onChange={e => set("color", e.target.value)} /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t("technicalData")}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t("engineType")}</Label>
                <Select value={form.engine_type} onValueChange={v => set("engine_type", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="diesel">Dizel</SelectItem>
                    <SelectItem value="petrol">Benzin</SelectItem>
                    <SelectItem value="electric">EV</SelectItem>
                    <SelectItem value="hybrid">Hibrid</SelectItem>
                    <SelectItem value="lpg">TNG</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("vehicleClass")}</Label>
                <Select value={form.vehicle_class} onValueChange={v => set("vehicle_class", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="passenger">{t("passenger" as any) || "Passenger"}</SelectItem>
                    <SelectItem value="cargo">{t("cargo" as any) || "Cargo"}</SelectItem>
                    <SelectItem value="special">{t("special" as any) || "Special"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div><Label>{t("engineCapacity")}</Label><Input type="number" value={form.engine_capacity_cc} onChange={e => set("engine_capacity_cc", e.target.value)} /></div>
              <div><Label>{t("enginePower")}</Label><Input type="number" value={form.engine_power_kw} onChange={e => set("engine_power_kw", e.target.value)} /></div>
              <div><Label>{t("seatCount")}</Label><Input type="number" value={form.seat_count} onChange={e => set("seat_count", e.target.value)} /></div>
            </div>
            <div><Label>{t("odometer")}</Label><Input type="number" value={form.odometer_km} onChange={e => set("odometer_km", e.target.value)} /></div>
            <div><Label>{t("notes")}</Label><Textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={3} /></div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => navigate(-1)}>{t("cancel")}</Button>
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          <Save className="h-4 w-4 mr-2" /> {saveMutation.isPending ? t("saving") : t("save")}
        </Button>
      </div>
    </div>
  );
}
