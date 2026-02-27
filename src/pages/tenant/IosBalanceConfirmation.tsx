import { useState, useMemo, Suspense, lazy } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useLanguage } from "@/i18n/LanguageContext";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { FileCheck } from "lucide-react";
import { DownloadPdfButton } from "@/components/DownloadPdfButton";
import { fmtNum } from "@/lib/utils";
import { format } from "date-fns";

const IosConfirmations = lazy(() => import("@/pages/tenant/IosConfirmations"));

export default function IosBalanceConfirmation() {
  const { tenantId } = useTenant();
  const { locale } = useLanguage();
  const sr = locale === "sr";
  const [cutoffDate, setCutoffDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [tab, setTab] = useState("report");

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
        map.set(pid, { name: partner?.name || "Nepoznat", pib: partner?.pib || "", receivable: 0, payable: 0, items: 0 });
      }
      const entry = map.get(pid)!;
      entry.items++;
      const remaining = Number(item.remaining_amount || item.original_amount || 0);
      if (item.direction === "receivable") entry.receivable += remaining;
      else entry.payable += remaining;
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
        title={sr ? "IOS — Izvod otvorenih stavki" : "IOS — Statement of Open Items"}
        description={sr ? "Potvrda salda sa partnerima" : "Balance confirmations with partners"}
        actions={
          tenantId && tab === "report" ? (
            <DownloadPdfButton type="ios_report" params={{ tenant_id: tenantId, cutoff_date: cutoffDate }} />
          ) : undefined
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="report">{sr ? "Izveštaj" : "Report"}</TabsTrigger>
          <TabsTrigger value="confirmations">{sr ? "Potvrde salda" : "Confirmations"}</TabsTrigger>
        </TabsList>

        <TabsContent value="report" className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div>
              <Label>{sr ? "Datum preseka" : "Cutoff Date"}</Label>
              <Input type="date" value={cutoffDate} onChange={(e) => setCutoffDate(e.target.value)} className="w-48" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card><CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground">{sr ? "Ukupna potraživanja" : "Total Receivables"}</p>
              <p className="text-lg font-bold text-primary">{fmtNum(totalReceivable)} RSD</p>
            </CardContent></Card>
            <Card><CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground">{sr ? "Ukupne obaveze" : "Total Payables"}</p>
              <p className="text-lg font-bold text-destructive">{fmtNum(totalPayable)} RSD</p>
            </CardContent></Card>
            <Card><CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground">{sr ? "Neto saldo" : "Net Balance"}</p>
              <p className="text-lg font-bold">{fmtNum(totalReceivable - totalPayable)} RSD</p>
            </CardContent></Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileCheck className="h-4 w-4" /> {sr ? "Saldo po partnerima" : "Balance by Partner"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : partnerSummary.length === 0 ? (
                <p className="text-muted-foreground text-sm">{sr ? "Nema otvorenih stavki za izabrani datum." : "No open items for selected date."}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{sr ? "Partner" : "Partner"}</TableHead>
                      <TableHead>PIB</TableHead>
                      <TableHead className="text-right">{sr ? "Potraživanja" : "Receivables"}</TableHead>
                      <TableHead className="text-right">{sr ? "Obaveze" : "Payables"}</TableHead>
                      <TableHead className="text-right">{sr ? "Neto" : "Net"}</TableHead>
                      <TableHead className="text-center">{sr ? "Stavke" : "Items"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {partnerSummary.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell className="font-mono text-xs">{p.pib || "—"}</TableCell>
                        <TableCell className="text-right text-primary">{fmtNum(p.receivable)}</TableCell>
                        <TableCell className="text-right text-destructive">{fmtNum(p.payable)}</TableCell>
                        <TableCell className={`text-right font-semibold ${p.net >= 0 ? "text-primary" : "text-destructive"}`}>
                          {fmtNum(p.net)}
                        </TableCell>
                        <TableCell className="text-center">{p.items}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="confirmations">
          <Suspense fallback={<Skeleton className="h-96 w-full" />}>
            <IosConfirmations />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
