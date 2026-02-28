import { useState } from "react";
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
import { Save, Scale } from "lucide-react";
import { fmtNum } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export default function ThinCapitalization() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const qc = useQueryClient();
  const [year, setYear] = useState(new Date().getFullYear());

  const { data: record } = useQuery({
    queryKey: ["thin-cap", tenantId, year],
    queryFn: async () => {
      const { data } = await supabase
        .from("thin_capitalization")
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("year", year)
        .maybeSingle();
      return data;
    },
    enabled: !!tenantId,
  });

  const [debt, setDebt] = useState(0);
  const [equity, setEquity] = useState(0);
  const [interest, setInterest] = useState(0);

  // Sync from DB when record loads
  const effectiveDebt = record ? Number(record.related_party_debt) : debt;
  const effectiveEquity = record ? Number(record.equity_amount) : equity;
  const effectiveInterest = record ? Number(record.interest_expense) : interest;

  const ratio = effectiveEquity > 0 ? effectiveDebt / effectiveEquity : 0;
  const maxRatio = 4.0;
  const isExceeded = ratio > maxRatio;
  const allowableDebt = effectiveEquity * maxRatio;
  const nonDeductible = isExceeded && effectiveDebt > 0
    ? effectiveInterest * ((effectiveDebt - allowableDebt) / effectiveDebt)
    : 0;

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("thin_capitalization").upsert({
        tenant_id: tenantId!,
        year,
        related_party_debt: debt || effectiveDebt,
        equity_amount: equity || effectiveEquity,
        interest_expense: interest || effectiveInterest,
        non_deductible_interest: Math.max(0, nonDeductible),
      }, { onConflict: "tenant_id,year" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["thin-cap"] });
      toast({ title: t("success") });
    },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tanka kapitalizacija"
        description="ZPDP čl. 61-63 — Ograničenje odbitka kamate na zajmove od povezanih lica (4:1)"
        icon={Scale}
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Zajam od povezanog lica</CardTitle></CardHeader>
          <CardContent>
            <Input
              type="number"
              value={record ? effectiveDebt : debt}
              onChange={e => setDebt(+e.target.value)}
              placeholder="0.00"
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Sopstveni kapital (prosek)</CardTitle></CardHeader>
          <CardContent>
            <Input
              type="number"
              value={record ? effectiveEquity : equity}
              onChange={e => setEquity(+e.target.value)}
              placeholder="0.00"
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Rashod kamate</CardTitle></CardHeader>
          <CardContent>
            <Input
              type="number"
              value={record ? effectiveInterest : interest}
              onChange={e => setInterest(+e.target.value)}
              placeholder="0.00"
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Obračun</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between">
            <span>Odnos dug / kapital:</span>
            <span className="font-mono font-bold">
              {ratio.toFixed(2)}:1
              {isExceeded ? (
                <Badge variant="destructive" className="ml-2">Prekoračen (max 4:1)</Badge>
              ) : (
                <Badge variant="secondary" className="ml-2">U okviru limita</Badge>
              )}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Dozvoljeni dug (4 × kapital):</span>
            <span className="font-mono">{fmtNum(allowableDebt)}</span>
          </div>
          <div className="flex justify-between">
            <span>Prekoračenje duga:</span>
            <span className="font-mono">{fmtNum(Math.max(0, effectiveDebt - allowableDebt))}</span>
          </div>
          <div className="flex justify-between border-t pt-2">
            <span className="font-bold text-destructive">Nepriznati rashod kamate:</span>
            <span className="font-mono font-bold text-destructive">{fmtNum(Math.max(0, nonDeductible))}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Formula: Kamata × (Zajam - 4×Kapital) / Zajam. Ovaj iznos se dodaje na poresku osnovicu u PB-1 (red 26).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
