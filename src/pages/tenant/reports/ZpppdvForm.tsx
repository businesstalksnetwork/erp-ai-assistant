import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useLanguage } from "@/i18n/LanguageContext";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Download, FileText, AlertTriangle, CheckCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function ZpppdvForm() {
  const { tenantId } = useTenant();
  const { t } = useLanguage();
  const { toast } = useToast();

  const { data: periods = [], isLoading } = useQuery({
    queryKey: ["pdv-periods-refund", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase
        .from("pdv_periods")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("start_date", { ascending: false });
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Filter periods where input_vat > output_vat (refund eligible)
  const refundEligible = periods.filter((p: any) => p.input_vat > p.output_vat);
  const fmtNum = (n: number) => n.toLocaleString("sr-RS", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const generateXml = (period: any) => {
    const refundAmount = period.input_vat - period.output_vat;
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ZPPPDV xmlns="http://pid.purs.gov.rs/zpppdv">
  <Zaglavlje>
    <PeriodOd>${period.start_date}</PeriodOd>
    <PeriodDo>${period.end_date}</PeriodDo>
    <NazivPerioda>${escXml(period.period_name)}</NazivPerioda>
  </Zaglavlje>
  <Podaci>
    <IzlazniPDV>${period.output_vat.toFixed(2)}</IzlazniPDV>
    <UlazniPDV>${period.input_vat.toFixed(2)}</UlazniPDV>
    <PoreskaObaveza>${period.vat_liability.toFixed(2)}</PoreskaObaveza>
    <IznosPovracaja>${refundAmount.toFixed(2)}</IznosPovracaja>
    <StatusPerioda>${period.status}</StatusPerioda>
  </Podaci>
  <Zahtev>
    <VrstaZahteva>povracaj</VrstaZahteva>
    <TrazeniIznos>${refundAmount.toFixed(2)}</TrazeniIznos>
    <Napomena>Zahtev za povraćaj PDV-a za period ${escXml(period.period_name)}</Napomena>
  </Zahtev>
</ZPPPDV>`;

    const blob = new Blob([xml], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ZPPPDV_${period.period_name.replace(/\s+/g, "_")}.xml`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "ZPPPDV XML generisan" });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="ZPPPDV — Zahtev za povraćaj PDV-a"
        description="Generisanje zahteva za povraćaj PDV-a kada je ulazni PDV veći od izlaznog"
        icon={FileText}
      />

      {/* Summary card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Ukupno perioda</div>
            <div className="text-2xl font-bold">{periods.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> Pravo na povraćaj
            </div>
            <div className="text-2xl font-bold text-primary">{refundEligible.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Ukupan iznos povraćaja</div>
            <div className="text-2xl font-bold">
              {fmtNum(refundEligible.reduce((s: number, p: any) => s + (p.input_vat - p.output_vat), 0))} RSD
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">PDV periodi sa pravom na povraćaj</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-40" /> : refundEligible.length === 0 ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm py-8 justify-center">
              <CheckCircle className="h-4 w-4" />
              <span>Nema perioda sa pretplatom PDV-a. Povraćaj nije potreban.</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead>
                    <TableHead className="text-right">Izlazni PDV</TableHead>
                    <TableHead className="text-right">Ulazni PDV</TableHead>
                    <TableHead className="text-right">Iznos povraćaja</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Akcije</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {refundEligible.map((p: any) => {
                    const refund = p.input_vat - p.output_vat;
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.period_name}</TableCell>
                        <TableCell className="text-right">{fmtNum(p.output_vat)}</TableCell>
                        <TableCell className="text-right">{fmtNum(p.input_vat)}</TableCell>
                        <TableCell className="text-right font-semibold text-primary">{fmtNum(refund)}</TableCell>
                        <TableCell><Badge variant={p.status === "submitted" ? "default" : "secondary"}>{p.status}</Badge></TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" onClick={() => generateXml(p)}>
                            <Download className="h-3 w-3 mr-1" /> ZPPPDV XML
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* All periods for reference */}
      <Card>
        <CardHeader><CardTitle className="text-base">Svi PDV periodi</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-40" /> : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead>
                    <TableHead className="text-right">Izlazni PDV</TableHead>
                    <TableHead className="text-right">Ulazni PDV</TableHead>
                    <TableHead className="text-right">Obaveza / Pretplata</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {periods.map((p: any) => {
                    const diff = p.output_vat - p.input_vat;
                    const isRefund = diff < 0;
                    return (
                      <TableRow key={p.id}>
                        <TableCell>{p.period_name}</TableCell>
                        <TableCell className="text-right">{fmtNum(p.output_vat)}</TableCell>
                        <TableCell className="text-right">{fmtNum(p.input_vat)}</TableCell>
                        <TableCell className={`text-right font-medium ${isRefund ? "text-primary" : ""}`}>
                          {isRefund ? `−${fmtNum(Math.abs(diff))}` : fmtNum(diff)}
                        </TableCell>
                        <TableCell><Badge variant={p.status === "submitted" ? "default" : "secondary"}>{p.status}</Badge></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function escXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
