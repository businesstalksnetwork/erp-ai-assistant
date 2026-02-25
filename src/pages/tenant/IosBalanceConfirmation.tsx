import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, FileCheck } from "lucide-react";
import { format } from "date-fns";

export default function IosBalanceConfirmation() {
  const { tenantId } = useTenant();
  const [cutoffDate, setCutoffDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const { data: openItems = [], isLoading } = useQuery({
    queryKey: ["ios-open-items", tenantId, cutoffDate],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("open_items")
        .select("id, partner_id, document_id, original_amount, remaining_amount, direction, due_date, created_at, partners(name, pib)")
        .eq("tenant_id", tenantId)
        .eq("status", "open")
        .lte("created_at", cutoffDate + "T23:59:59")
        .order("partner_id");
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const partnerSummary = useMemo(() => {
    const map = new Map<string, { name: string; pib: string; receivable: number; payable: number; items: number }>();
    for (const item of openItems) {
      const pid = item.partner_id || "unknown";
      const partner = item.partners as any;
      if (!map.has(pid)) {
        map.set(pid, {
          name: partner?.name || "Nepoznat",
          pib: partner?.pib || "",
          receivable: 0,
          payable: 0,
          items: 0,
        });
      }
      const entry = map.get(pid)!;
      entry.items++;
      const remaining = Number(item.remaining_amount || item.original_amount || 0);
      if (item.direction === "receivable") {
        entry.receivable += remaining;
      } else {
        entry.payable += remaining;
      }
    }
    return Array.from(map.entries())
      .map(([id, v]) => ({ id, ...v, net: v.receivable - v.payable }))
      .sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
  }, [openItems]);

  const totalReceivable = partnerSummary.reduce((s, p) => s + p.receivable, 0);
  const totalPayable = partnerSummary.reduce((s, p) => s + p.payable, 0);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader
        title="IOS — Izvod otvorenih stavki"
        description="Potvrda salda sa partnerima (Izvod Otvorenih Stavki)"
      />

      <div className="flex flex-col sm:flex-row gap-4 items-end">
        <div>
          <Label>Datum preseka</Label>
          <Input type="date" value={cutoffDate} onChange={(e) => setCutoffDate(e.target.value)} className="w-48" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Ukupna potraživanja</p>
            <p className="text-lg font-bold text-green-600">{totalReceivable.toLocaleString("sr-RS")} RSD</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Ukupne obaveze</p>
            <p className="text-lg font-bold text-red-600">{totalPayable.toLocaleString("sr-RS")} RSD</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Neto saldo</p>
            <p className="text-lg font-bold">{(totalReceivable - totalPayable).toLocaleString("sr-RS")} RSD</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileCheck className="h-4 w-4" /> Saldo po partnerima
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Učitavanje...</p>
          ) : partnerSummary.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nema otvorenih stavki za izabrani datum.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Partner</TableHead>
                  <TableHead>PIB</TableHead>
                  <TableHead className="text-right">Potraživanja</TableHead>
                  <TableHead className="text-right">Obaveze</TableHead>
                  <TableHead className="text-right">Neto</TableHead>
                  <TableHead className="text-center">Stavke</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {partnerSummary.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="font-mono text-xs">{p.pib || "—"}</TableCell>
                    <TableCell className="text-right text-green-600">{p.receivable.toLocaleString("sr-RS")}</TableCell>
                    <TableCell className="text-right text-red-600">{p.payable.toLocaleString("sr-RS")}</TableCell>
                    <TableCell className={`text-right font-semibold ${p.net >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {p.net.toLocaleString("sr-RS")}
                    </TableCell>
                    <TableCell className="text-center">{p.items}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
