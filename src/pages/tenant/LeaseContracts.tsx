import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTenant } from "@/hooks/useTenant";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, FileText, BarChart3 } from "lucide-react";
import { format } from "date-fns";

export default function LeaseContracts() {
  const { tenantId } = useTenant();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const { data: leases, isLoading } = useQuery({
    queryKey: ["lease-contracts", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lease_contracts")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const filtered = (leases || []).filter((l: any) => {
    const q = search.toLowerCase();
    return !q || l.contract_number?.toLowerCase().includes(q) || l.lessor_name?.toLowerCase().includes(q) || l.description?.toLowerCase().includes(q);
  });

  const statusVariant = (s: string) => s === "active" ? "default" as const : s === "expired" ? "destructive" as const : "secondary" as const;
  const statusLabel: Record<string, string> = { draft: "U pripremi", active: "Aktivan", expired: "Istekao", terminated: "Raskinut" };

  const fmt = (n: number | null) => n != null ? Number(n).toLocaleString("sr", { minimumFractionDigits: 2 }) : "—";

  return (
    <div className="space-y-4 p-1">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">IFRS 16 — Ugovori o lizingu</h1>
          <p className="text-muted-foreground text-sm">Right-of-use sredstva i lease liability</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/assets/leases/disclosure")}>
            <BarChart3 className="h-4 w-4 mr-2" /> Obelodanjivanja
          </Button>
          <Button onClick={() => navigate("/assets/leases/new")}>
            <Plus className="h-4 w-4 mr-2" /> Novi ugovor
          </Button>
        </div>
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
                <TableHead>Ugovor</TableHead>
                <TableHead>Zakupodavac</TableHead>
                <TableHead>Period</TableHead>
                <TableHead className="text-right">Mesečna rata</TableHead>
                <TableHead className="text-right">ROU NBV</TableHead>
                <TableHead className="text-right">Obaveza</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8">Učitavanje...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nema ugovora</TableCell></TableRow>
              ) : filtered.map((l: any) => (
                <TableRow key={l.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/assets/leases/${l.id}`)}>
                  <TableCell className="font-mono font-semibold">{l.contract_number}</TableCell>
                  <TableCell>{l.lessor_name || "—"}</TableCell>
                  <TableCell className="text-sm">{format(new Date(l.start_date), "MM/yyyy")} — {format(new Date(l.end_date), "MM/yyyy")}</TableCell>
                  <TableCell className="text-right">{fmt(l.monthly_payment)}</TableCell>
                  <TableCell className="text-right">{fmt(l.rou_net_book_value)}</TableCell>
                  <TableCell className="text-right font-semibold">{fmt(l.lease_liability_balance)}</TableCell>
                  <TableCell><Badge variant={statusVariant(l.status)}>{statusLabel[l.status] || l.status}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
