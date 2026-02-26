import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTenant } from "@/hooks/useTenant";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Car, Fuel, Gauge } from "lucide-react";

export default function FleetVehicles() {
  const { tenantId } = useTenant();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const { data: vehicles, isLoading } = useQuery({
    queryKey: ["fleet-vehicles", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fleet_vehicles")
        .select("*, assets!inner(name, asset_code, status, acquisition_date)")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const filtered = (vehicles || []).filter((v: any) => {
    const q = search.toLowerCase();
    return !q ||
      v.registration_plate?.toLowerCase().includes(q) ||
      v.make?.toLowerCase().includes(q) ||
      v.model?.toLowerCase().includes(q) ||
      v.assets?.name?.toLowerCase().includes(q);
  });

  const engineLabel: Record<string, string> = {
    diesel: "Dizel", petrol: "Benzin", electric: "Električno", hybrid: "Hibrid", lpg: "TNG",
  };

  return (
    <div className="space-y-4 p-1">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Vozila</h1>
          <p className="text-muted-foreground text-sm">Registar vozila u voznom parku</p>
        </div>
        <Button onClick={() => navigate("/assets/fleet/vehicles/new")}>
          <Plus className="h-4 w-4 mr-2" /> Novo vozilo
        </Button>
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
                <TableHead>Registracija</TableHead>
                <TableHead>Vozilo</TableHead>
                <TableHead>Naziv (sredstvo)</TableHead>
                <TableHead>Motor</TableHead>
                <TableHead>km</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8">Učitavanje...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nema vozila</TableCell></TableRow>
              ) : filtered.map((v: any) => (
                <TableRow key={v.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/assets/fleet/vehicles/${v.id}`)}>
                  <TableCell className="font-mono font-semibold">{v.registration_plate || "—"}</TableCell>
                  <TableCell>{[v.make, v.model, v.year_of_manufacture].filter(Boolean).join(" ")}</TableCell>
                  <TableCell className="text-muted-foreground">{v.assets?.name}</TableCell>
                  <TableCell>{engineLabel[v.engine_type] || v.engine_type}</TableCell>
                  <TableCell>{v.odometer_km ? Number(v.odometer_km).toLocaleString("sr") : "—"}</TableCell>
                  <TableCell>
                    <Badge variant={v.assets?.status === "active" ? "default" : "secondary"}>
                      {v.assets?.status}
                    </Badge>
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
