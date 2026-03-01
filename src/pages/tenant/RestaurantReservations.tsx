import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Calendar, Users, Phone, Clock, X } from "lucide-react";
import { format } from "date-fns";

export default function RestaurantReservations() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState(format(new Date(), "yyyy-MM-dd"));
  const [form, setForm] = useState({
    table_id: "", reservation_date: format(new Date(), "yyyy-MM-dd"),
    reservation_time: "19:00", party_size: "2", guest_name: "", guest_phone: "", guest_email: "", notes: "",
  });

  const { data: reservations = [] } = useQuery({
    queryKey: ["restaurant_reservations", tenantId, dateFilter],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurant_reservations")
        .select("*, restaurant_tables(table_number)")
        .eq("tenant_id", tenantId!)
        .eq("reservation_date", dateFilter)
        .order("reservation_time");
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: tables = [] } = useQuery({
    queryKey: ["restaurant_tables_active", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("restaurant_tables").select("id, table_number, capacity")
        .eq("tenant_id", tenantId!).eq("is_active", true).order("table_number");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("restaurant_reservations").insert({
        tenant_id: tenantId!,
        table_id: form.table_id || null,
        reservation_date: form.reservation_date,
        reservation_time: form.reservation_time,
        party_size: parseInt(form.party_size),
        guest_name: form.guest_name,
        guest_phone: form.guest_phone || null,
        guest_email: form.guest_email || null,
        notes: form.notes || null,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["restaurant_reservations"] });
      setDialogOpen(false);
      toast({ title: "Rezervacija kreirana" });
    },
    onError: (e: any) => toast({ title: "Greška", description: e.message, variant: "destructive" }),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("restaurant_reservations").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["restaurant_reservations"] });
      toast({ title: "Status ažuriran" });
    },
  });

  const getStatusBadge = (status: string) => {
    const map: Record<string, { label: string; className: string }> = {
      confirmed: { label: "Potvrđena", className: "bg-primary/20 text-primary border-primary/30" },
      seated: { label: "Seli", className: "bg-emerald-500/20 text-emerald-700 border-emerald-300" },
      completed: { label: "Završena", className: "bg-muted text-muted-foreground" },
      cancelled: { label: "Otkazana", className: "bg-destructive/20 text-destructive border-destructive/30" },
      no_show: { label: "Nije došao", className: "bg-warning/20 text-warning border-warning/30" },
    };
    const s = map[status] || { label: status, className: "" };
    return <Badge className={s.className}>{s.label}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Rezervacije</h1>
          <p className="text-muted-foreground">Upravljanje rezervacijama stolova</p>
        </div>
        <div className="flex items-center gap-2">
          <Input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="w-40" />
          <Button onClick={() => {
            setForm({ table_id: "", reservation_date: dateFilter, reservation_time: "19:00", party_size: "2", guest_name: "", guest_phone: "", guest_email: "", notes: "" });
            setDialogOpen(true);
          }}>
            <Plus className="h-4 w-4 mr-1" /> Nova rezervacija
          </Button>
        </div>
      </div>

      {reservations.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nema rezervacija za {dateFilter}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {reservations.map((r: any) => (
            <Card key={r.id}>
              <CardContent className="p-4 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-4">
                  <div className="text-center min-w-[60px]">
                    <div className="text-lg font-bold">{r.reservation_time?.slice(0, 5)}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.restaurant_tables ? `Sto ${r.restaurant_tables.table_number}` : "Bez stola"}
                    </div>
                  </div>
                  <div>
                    <div className="font-medium">{r.guest_name}</div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {r.party_size}</span>
                      {r.guest_phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {r.guest_phone}</span>}
                    </div>
                    {r.notes && <div className="text-xs text-muted-foreground mt-1">{r.notes}</div>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(r.status)}
                  {r.status === "confirmed" && (
                    <>
                      <Button size="sm" variant="success" onClick={() => updateStatusMutation.mutate({ id: r.id, status: "seated" })}>Seli</Button>
                      <Button size="sm" variant="outline" onClick={() => updateStatusMutation.mutate({ id: r.id, status: "no_show" })}>Nije došao</Button>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => updateStatusMutation.mutate({ id: r.id, status: "cancelled" })}>
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                  {r.status === "seated" && (
                    <Button size="sm" variant="outline" onClick={() => updateStatusMutation.mutate({ id: r.id, status: "completed" })}>Završi</Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova rezervacija</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Datum</Label>
                <Input type="date" value={form.reservation_date} onChange={e => setForm(f => ({ ...f, reservation_date: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Vreme</Label>
                <Input type="time" value={form.reservation_time} onChange={e => setForm(f => ({ ...f, reservation_time: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Ime gosta</Label>
              <Input value={form.guest_name} onChange={e => setForm(f => ({ ...f, guest_name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Broj osoba</Label>
                <Input type="number" min={1} value={form.party_size} onChange={e => setForm(f => ({ ...f, party_size: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Sto (opciono)</Label>
                <Select value={form.table_id} onValueChange={v => setForm(f => ({ ...f, table_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Izaberi" /></SelectTrigger>
                  <SelectContent>
                    {tables.map((t: any) => (
                      <SelectItem key={t.id} value={t.id}>Sto {t.table_number} ({t.capacity} os.)</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Telefon</Label>
              <Input value={form.guest_phone} onChange={e => setForm(f => ({ ...f, guest_phone: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Napomena</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.guest_name}>Sačuvaj</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
