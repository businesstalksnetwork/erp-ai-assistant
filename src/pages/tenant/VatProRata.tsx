import { useState, useEffect } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/shared/PageHeader";
import { toast } from "@/hooks/use-toast";
import { Save, Percent } from "lucide-react";
import { fmtNum } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function VatProRata() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const qc = useQueryClient();
  const [year, setYear] = useState(new Date().getFullYear());

  const { data: items = [] } = useQuery({
    // CR-25: Add year to queryKey
    queryKey: ["vat-prorata", tenantId, year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vat_prorata_coefficients")
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("year", year)
        .order("year", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const current = items.find(i => i.year === year);

  // CR-26: Use local state synced from query data
  const [taxable, setTaxable] = useState(0);
  const [exempt, setExempt] = useState(0);

  useEffect(() => {
    if (current) {
      setTaxable(Number(current.taxable_revenue) || 0);
      setExempt(Number(current.exempt_revenue) || 0);
    } else {
      setTaxable(0);
      setExempt(0);
    }
  }, [current]);

  const total = taxable + exempt;
  const coefficient = total > 0 ? taxable / total : 0;
  const coeffPercent = (coefficient * 100).toFixed(2);

  const saveMutation = useMutation({
    mutationFn: async () => {
      // CR-26: Use local state values directly
      const { error } = await supabase.from("vat_prorata_coefficients").upsert({
        tenant_id: tenantId!,
        year,
        taxable_revenue: taxable,
        exempt_revenue: exempt,
        prorata_coefficient: coefficient,
      }, { onConflict: "tenant_id,year" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vat-prorata"] });
      toast({ title: t("success") });
    },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="PDV srazmereni odbitak (Pro-rata)"
        description="ZoPDV čl. 31 — Godišnji koeficijent srazmernog odbitka prethodnog poreza"
        icon={Percent}
        actions={
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            <Save className="h-4 w-4 mr-2" /> Sačuvaj
          </Button>
        }
      />

      <div className="flex gap-4 items-end">
        <div>
          <Label>Godina</Label>
          <Input type="number" className="w-24" value={year} onChange={e => setYear(+e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-sm">Unos podataka</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Oporezivi promet (sa pravom na odbitak)</Label>
              <Input type="number" value={taxable} onChange={e => setTaxable(+e.target.value)} />
            </div>
            <div>
              <Label>Promet oslobođen PDV-a (bez prava na odbitak)</Label>
              <Input type="number" value={exempt} onChange={e => setExempt(+e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Koeficijent</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <div className="text-5xl font-bold font-mono text-primary">{coeffPercent}%</div>
              <p className="text-sm text-muted-foreground mt-2">Srazmereni odbitak prethodnog PDV-a</p>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>Formula: Oporezivi promet / (Oporezivi + Oslobođeni promet)</p>
              <p>= {fmtNum(taxable)} / {fmtNum(total)} = {coeffPercent}%</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {items.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Istorija koeficijenata</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Godina</TableHead>
                  <TableHead className="text-right">Oporezivi</TableHead>
                  <TableHead className="text-right">Oslobođeni</TableHead>
                  <TableHead className="text-right">Ukupno</TableHead>
                  <TableHead className="text-right">Koeficijent</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map(item => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono">{item.year}</TableCell>
                    <TableCell className="text-right font-mono">{fmtNum(Number(item.taxable_revenue))}</TableCell>
                    <TableCell className="text-right font-mono">{fmtNum(Number(item.exempt_revenue))}</TableCell>
                    <TableCell className="text-right font-mono">{fmtNum(Number(item.total_revenue))}</TableCell>
                    <TableCell className="text-right font-mono font-bold">{(Number(item.prorata_coefficient) * 100).toFixed(2)}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
