import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Download, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { useStatusWorkflow } from "@/hooks/useStatusWorkflow";

const statusOptions = ["draft", "approved", "sent", "confirmed", "rejected"];

export default function PaymentOrders() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["payment-orders", tenantId, statusFilter],
    queryFn: async () => {
      let q = (supabase.from("payment_orders" as any) as any)
        .select("*, partners(name)")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false });
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      const { data } = await q.limit(200);
      return data || [];
    },
    enabled: !!tenantId,
  });

  const statusMut = useStatusWorkflow({ table: "payment_orders", queryKey: ["payment-orders", tenantId!, statusFilter] });

  const fmtNum = (n: number) => new Intl.NumberFormat("sr-RS", { minimumFractionDigits: 2 }).format(n);

  const statusColor = (s: string) => {
    if (s === "confirmed") return "default";
    if (s === "approved" || s === "sent") return "outline";
    if (s === "rejected") return "destructive";
    return "secondary";
  };

  const exportHalcom = async () => {
    try {
      toast.info("Generišem Halcom XML...");
      const { data: { session } } = await supabase.auth.getSession();
      const ids = orders.filter((o: any) => o.status === "approved").map((o: any) => o.id);
      if (ids.length === 0) { toast.error("Nema odobrenih naloga za izvoz"); return; }
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-halcom-xml`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
          body: JSON.stringify({ payment_order_ids: ids, tenant_id: tenantId }),
        }
      );
      if (!res.ok) throw new Error("Greška pri generisanju");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `halcom-export-${format(new Date(), "yyyyMMdd")}.xml`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("XML izvezen");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Nalozi za plaćanje</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportHalcom}><Download className="h-4 w-4 mr-2" />Halcom XML</Button>
          <Button onClick={() => navigate("/accounting/payment-orders/new")}><Plus className="h-4 w-4 mr-2" />Novi nalog</Button>
        </div>
      </div>

      <div className="flex gap-2">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Svi statusi</SelectItem>
            {statusOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Datum</TableHead>
            <TableHead>Partner</TableHead>
            <TableHead>Iznos</TableHead>
            <TableHead>Račun primaoca</TableHead>
            <TableHead>Šifra plaćanja</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Akcija</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {orders.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Nema naloga</TableCell></TableRow>
            ) : orders.map((o: any) => (
              <TableRow key={o.id} className="cursor-pointer" onClick={() => navigate(`/accounting/payment-orders/${o.id}`)}>
                <TableCell>{format(new Date(o.payment_date), "dd.MM.yyyy")}</TableCell>
                <TableCell>{o.partners?.name || o.recipient_name || "—"}</TableCell>
                <TableCell className="font-medium">{fmtNum(o.amount)} {o.currency}</TableCell>
                <TableCell className="font-mono text-sm">{o.recipient_account}</TableCell>
                <TableCell>{o.payment_code || "—"}</TableCell>
                <TableCell><Badge variant={statusColor(o.status)}>{o.status}</Badge></TableCell>
                <TableCell onClick={e => e.stopPropagation()}>
                  {o.status === "draft" && (
                    <Button size="sm" variant="outline" onClick={() => statusMut.mutate({ id: o.id, newStatus: "approved" })}>Odobri</Button>
                  )}
                  {o.status === "approved" && (
                    <Button size="sm" variant="outline" onClick={() => statusMut.mutate({ id: o.id, newStatus: "sent" })}>Poslato</Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}
