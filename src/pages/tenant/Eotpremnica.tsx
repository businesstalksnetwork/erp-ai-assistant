import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useLanguage } from "@/i18n/LanguageContext";
import { useLegalEntities } from "@/hooks/useLegalEntities";
import { useAuth } from "@/hooks/useAuth";
import { useStatusWorkflow } from "@/hooks/useStatusWorkflow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Truck, CheckCircle, ArrowRight, X, Send } from "lucide-react";
import { format } from "date-fns";
import type { Database } from "@/integrations/supabase/types";

type DispatchNote = Database["public"]["Tables"]["dispatch_notes"]["Row"];

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  confirmed: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  in_transit: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  delivered: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

const nextStatus: Record<string, string> = {
  draft: "confirmed",
  confirmed: "in_transit",
  in_transit: "delivered",
};

export default function Eotpremnica() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { entities: legalEntities } = useLegalEntities();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);

  const [form, setForm] = useState({
    document_number: "",
    sender_name: "",
    sender_pib: "",
    sender_address: "",
    sender_city: "",
    receiver_name: "",
    receiver_pib: "",
    receiver_address: "",
    receiver_city: "",
    legal_entity_id: "",
    notes: "",
    vehicle_plate: "",
    driver_name: "",
    transport_reason: "",
  });

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ["dispatch_notes", tenantId, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("dispatch_notes")
        .select("*, legal_entities(name)")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false });
      if (statusFilter !== "all") query = query.eq("status", statusFilter);
      const { data, error } = await query;
      if (error) throw error;
      return data as (DispatchNote & { legal_entities: { name: string } | null })[];
    },
    enabled: !!tenantId,
  });

  const statusMutation = useStatusWorkflow({ table: "dispatch_notes", queryKey: ["dispatch_notes"] });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("dispatch_notes").insert({
        tenant_id: tenantId!,
        document_number: form.document_number || `OTP-${Date.now()}`,
        sender_name: form.sender_name || null,
        sender_pib: form.sender_pib || null,
        sender_address: form.sender_address || null,
        sender_city: form.sender_city || null,
        receiver_name: form.receiver_name || null,
        receiver_pib: form.receiver_pib || null,
        receiver_address: form.receiver_address || null,
        receiver_city: form.receiver_city || null,
        legal_entity_id: form.legal_entity_id || null,
        notes: form.notes || null,
        vehicle_plate: form.vehicle_plate || null,
        driver_name: form.driver_name || null,
        transport_reason: form.transport_reason || null,
        created_by: user?.id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dispatch_notes"] });
      toast({ title: t("success") });
      setCreateOpen(false);
      setForm({ document_number: "", sender_name: "", sender_pib: "", sender_address: "", sender_city: "", receiver_name: "", receiver_pib: "", receiver_address: "", receiver_city: "", legal_entity_id: "", notes: "", vehicle_plate: "", driver_name: "", transport_reason: "" });
    },
    onError: (err: any) => toast({ title: t("error"), description: err.message, variant: "destructive" }),
  });

  const filtered = useMemo(() => {
    if (!search) return notes;
    const s = search.toLowerCase();
    return notes.filter((n) =>
      n.document_number.toLowerCase().includes(s) ||
      (n.sender_name || "").toLowerCase().includes(s) ||
      (n.receiver_name || "").toLowerCase().includes(s)
    );
  }, [notes, search]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("dispatchNotes")}</h1>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />{t("add")}
        </Button>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder={t("search")} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allStatuses")}</SelectItem>
            <SelectItem value="draft">{t("draft")}</SelectItem>
            <SelectItem value="confirmed">{t("confirmed")}</SelectItem>
            <SelectItem value="in_transit">{t("inTransit")}</SelectItem>
            <SelectItem value="delivered">{t("delivered")}</SelectItem>
            <SelectItem value="cancelled">{t("cancelled")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? <p>{t("loading")}</p> : filtered.length === 0 ? <p className="text-muted-foreground">{t("noResults")}</p> : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("documentNumber")}</TableHead>
              <TableHead>{t("date")}</TableHead>
              <TableHead>{t("senderName")}</TableHead>
              <TableHead>{t("receiverName")}</TableHead>
              {legalEntities.length > 1 && <TableHead>{t("legalEntity")}</TableHead>}
              <TableHead>{t("status")}</TableHead>
              <TableHead>eOtp</TableHead>
              <TableHead>{t("actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((n) => (
              <TableRow key={n.id} className="cursor-pointer" onClick={() => navigate(`/inventory/dispatch-notes/${n.id}`)}>
                <TableCell className="font-medium">{n.document_number}</TableCell>
                <TableCell>{format(new Date(n.document_date), "dd.MM.yyyy")}</TableCell>
                <TableCell>{n.sender_name || "—"}</TableCell>
                <TableCell>{n.receiver_name || "—"}</TableCell>
                {legalEntities.length > 1 && <TableCell>{n.legal_entities?.name || "—"}</TableCell>}
                <TableCell><Badge className={statusColors[n.status] || ""}>{t(n.status as any)}</Badge></TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">{n.eotpremnica_status || "—"}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    {n.status === "confirmed" && (!n.eotpremnica_status || n.eotpremnica_status === "not_submitted") && (
                      <Button size="sm" variant="outline" onClick={async () => {
                        try {
                          const { error } = await supabase.functions.invoke("eotpremnica-submit", {
                            body: { dispatch_note_id: n.id, tenant_id: tenantId },
                          });
                          if (error) throw error;
                          queryClient.invalidateQueries({ queryKey: ["dispatch_notes"] });
                          toast({ title: t("success") });
                        } catch (err: any) {
                          toast({ title: t("error"), description: err.message, variant: "destructive" });
                        }
                      }}>
                        <Send className="h-3 w-3 mr-1" />{t("submitApi")}
                      </Button>
                    )}
                    {nextStatus[n.status] && (
                      <Button size="sm" variant="outline" onClick={() => statusMutation.mutate({ id: n.id, newStatus: nextStatus[n.status] })}>
                        {n.status === "draft" && <CheckCircle className="h-3 w-3 mr-1" />}
                        {n.status === "confirmed" && <Truck className="h-3 w-3 mr-1" />}
                        {n.status === "in_transit" && <ArrowRight className="h-3 w-3 mr-1" />}
                        {t(nextStatus[n.status] === "confirmed" ? "confirmed" : nextStatus[n.status] === "in_transit" ? "inTransit" : "delivered" as any)}
                      </Button>
                    )}
                    {n.status !== "delivered" && n.status !== "cancelled" && (
                      <Button size="sm" variant="ghost" onClick={() => statusMutation.mutate({ id: n.id, newStatus: "cancelled" })}>
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{t("dispatchNotes")} — {t("add")}</DialogTitle></DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
            <div><Label>{t("documentNumber")}</Label><Input value={form.document_number} onChange={(e) => setForm(f => ({ ...f, document_number: e.target.value }))} placeholder="OTP-001" /></div>
            {legalEntities.length > 1 && (
              <div><Label>{t("legalEntity")}</Label>
                <Select value={form.legal_entity_id} onValueChange={(v) => setForm(f => ({ ...f, legal_entity_id: v }))}>
                  <SelectTrigger><SelectValue placeholder={t("selectLegalEntity")} /></SelectTrigger>
                  <SelectContent>{legalEntities.map(e => <SelectItem key={e.id} value={e.id}>{e.name} ({e.pib})</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div><Label>{t("transportReason")}</Label><Input value={form.transport_reason} onChange={(e) => setForm(f => ({ ...f, transport_reason: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{t("senderName")}</Label><Input value={form.sender_name} onChange={(e) => setForm(f => ({ ...f, sender_name: e.target.value }))} /></div>
              <div><Label>{t("senderName")} PIB</Label><Input value={form.sender_pib} onChange={(e) => setForm(f => ({ ...f, sender_pib: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{t("address")} ({t("senderName")})</Label><Input value={form.sender_address} onChange={(e) => setForm(f => ({ ...f, sender_address: e.target.value }))} /></div>
              <div><Label>{t("senderCity")}</Label><Input value={form.sender_city} onChange={(e) => setForm(f => ({ ...f, sender_city: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{t("receiverName")}</Label><Input value={form.receiver_name} onChange={(e) => setForm(f => ({ ...f, receiver_name: e.target.value }))} /></div>
              <div><Label>{t("receiverName")} PIB</Label><Input value={form.receiver_pib} onChange={(e) => setForm(f => ({ ...f, receiver_pib: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{t("address")} ({t("receiverName")})</Label><Input value={form.receiver_address} onChange={(e) => setForm(f => ({ ...f, receiver_address: e.target.value }))} /></div>
              <div><Label>{t("receiverCity")}</Label><Input value={form.receiver_city} onChange={(e) => setForm(f => ({ ...f, receiver_city: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{t("vehiclePlate")}</Label><Input value={form.vehicle_plate} onChange={(e) => setForm(f => ({ ...f, vehicle_plate: e.target.value }))} /></div>
              <div><Label>{t("driverName")}</Label><Input value={form.driver_name} onChange={(e) => setForm(f => ({ ...f, driver_name: e.target.value }))} /></div>
            </div>
            <div><Label>{t("notes")}</Label><Textarea value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
