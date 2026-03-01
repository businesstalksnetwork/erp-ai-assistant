import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Users, UtensilsCrossed, Clock, Edit, Trash2 } from "lucide-react";

interface RestaurantTable {
  id: string;
  table_number: number;
  capacity: number;
  zone: string;
  status: string;
  shape: string;
  is_active: boolean;
}

export default function RestaurantTables() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<RestaurantTable | null>(null);
  const [form, setForm] = useState({ table_number: "", capacity: "4", zone: "main", shape: "square" });

  const { data: tables = [], isLoading } = useQuery({
    queryKey: ["restaurant_tables", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurant_tables")
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("is_active", true)
        .order("table_number");
      if (error) throw error;
      return data as RestaurantTable[];
    },
    enabled: !!tenantId,
  });

  const { data: activeOrders = [] } = useQuery({
    queryKey: ["restaurant_orders_active", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("restaurant_orders")
        .select("id, table_id, status, total_amount")
        .eq("tenant_id", tenantId!)
        .eq("status", "open");
      return data || [];
    },
    enabled: !!tenantId,
    refetchInterval: 15000,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        tenant_id: tenantId!,
        table_number: parseInt(form.table_number),
        capacity: parseInt(form.capacity),
        zone: form.zone,
        shape: form.shape,
      };
      if (editingTable) {
        const { error } = await supabase.from("restaurant_tables").update(payload).eq("id", editingTable.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("restaurant_tables").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["restaurant_tables"] });
      setDialogOpen(false);
      setEditingTable(null);
      toast({ title: editingTable ? "Sto ažuriran" : "Sto dodat" });
    },
    onError: (e: any) => toast({ title: "Greška", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("restaurant_tables").update({ is_active: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["restaurant_tables"] });
      toast({ title: "Sto uklonjen" });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("restaurant_tables").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["restaurant_tables"] }),
  });

  const openCreate = () => {
    setEditingTable(null);
    setForm({ table_number: "", capacity: "4", zone: "main", shape: "square" });
    setDialogOpen(true);
  };

  const openEdit = (table: RestaurantTable) => {
    setEditingTable(table);
    setForm({
      table_number: String(table.table_number),
      capacity: String(table.capacity),
      zone: table.zone,
      shape: table.shape,
    });
    setDialogOpen(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "free": return "bg-emerald-500/20 text-emerald-700 border-emerald-300";
      case "occupied": return "bg-destructive/20 text-destructive border-destructive/30";
      case "reserved": return "bg-warning/20 text-warning border-warning/30";
      default: return "";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "free": return "Slobodan";
      case "occupied": return "Zauzet";
      case "reserved": return "Rezervisan";
      default: return status;
    }
  };

  const zones = [...new Set(tables.map(t => t.zone))];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("restaurantTables" as any) || "Stolovi"}</h1>
          <p className="text-muted-foreground">Upravljanje rasporedom stolova u restoranu</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> Dodaj sto</Button>
      </div>

      {zones.length === 0 && !isLoading && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <UtensilsCrossed className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nema stolova. Dodajte prvi sto za početak.</p>
          </CardContent>
        </Card>
      )}

      {zones.map(zone => (
        <div key={zone}>
          <h2 className="text-lg font-semibold mb-3 capitalize">{zone === "main" ? "Glavna sala" : zone === "terrace" ? "Terasa" : zone === "vip" ? "VIP" : zone}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {tables.filter(t => t.zone === zone).map(table => {
              const order = activeOrders.find(o => o.table_id === table.id);
              return (
                <Card
                  key={table.id}
                  className={`cursor-pointer transition-all hover:scale-105 ${table.status === "occupied" ? "ring-2 ring-destructive/50" : ""}`}
                  onClick={() => {
                    if (table.status === "free") updateStatusMutation.mutate({ id: table.id, status: "occupied" });
                    else if (table.status === "occupied") updateStatusMutation.mutate({ id: table.id, status: "free" });
                  }}
                >
                  <CardContent className="p-4 text-center space-y-2">
                    <div className="text-2xl font-bold">{table.table_number}</div>
                    <Badge className={getStatusColor(table.status)}>{getStatusLabel(table.status)}</Badge>
                    <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                      <Users className="h-3 w-3" /> {table.capacity}
                    </div>
                    {order && (
                      <div className="text-xs font-medium text-primary">
                        {Number(order.total_amount).toFixed(0)} RSD
                      </div>
                    )}
                    <div className="flex justify-center gap-1 pt-1">
                      <Button size="icon-sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openEdit(table); }}>
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button size="icon-sm" variant="ghost" className="text-destructive" onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(table.id); }}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ))}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTable ? "Izmeni sto" : "Novi sto"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Broj stola</Label>
              <Input type="number" value={form.table_number} onChange={e => setForm(f => ({ ...f, table_number: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Kapacitet (osobe)</Label>
              <Input type="number" value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Zona</Label>
              <Select value={form.zone} onValueChange={v => setForm(f => ({ ...f, zone: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="main">Glavna sala</SelectItem>
                  <SelectItem value="terrace">Terasa</SelectItem>
                  <SelectItem value="vip">VIP</SelectItem>
                  <SelectItem value="bar">Bar</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Oblik</Label>
              <Select value={form.shape} onValueChange={v => setForm(f => ({ ...f, shape: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="square">Kvadratni</SelectItem>
                  <SelectItem value="round">Okrugli</SelectItem>
                  <SelectItem value="rectangle">Pravougaoni</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.table_number}>
              {editingTable ? "Sačuvaj" : "Dodaj"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
