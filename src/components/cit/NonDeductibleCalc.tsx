import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import { useMemo, useEffect } from "react";

interface Props {
  fiscalYear: string;
  selectedEntity: string;
  totalRevenue: number;
  onNonDeductibleChange: (amount: number) => void;
}

export function NonDeductibleCalc({ fiscalYear, selectedEntity, totalRevenue, onNonDeductibleChange }: Props) {
  const { tenantId } = useTenant();

  const { data: expenseData = [] } = useQuery({
    queryKey: ["non-deductible-expenses", tenantId, fiscalYear, selectedEntity],
    queryFn: async () => {
      if (!tenantId || !fiscalYear) return [];
      let query = supabase
        .from("journal_lines")
        .select("debit, credit, account:account_id(code), journal_entry:journal_entry_id(entry_date, status, tenant_id, legal_entity_id)")
        .eq("journal_entry.tenant_id", tenantId)
        .eq("journal_entry.status", "posted")
        .gte("journal_entry.entry_date", `${fiscalYear}-01-01`)
        .lte("journal_entry.entry_date", `${fiscalYear}-12-31`);
      if (selectedEntity) query = query.eq("journal_entry.legal_entity_id", selectedEntity);
      const { data } = await query;
      return data || [];
    },
    enabled: !!tenantId && !!fiscalYear,
  });

  const calc = useMemo(() => {
    let representation = 0;
    let advertising = 0;
    for (const line of expenseData) {
      const code = (line as any).account?.code;
      if (!code) continue;
      const amount = Number((line as any).debit || 0) - Number((line as any).credit || 0);
      if (code.startsWith("552")) representation += amount;
      else if (code.startsWith("553")) advertising += amount;
    }

    const repLimit = totalRevenue * 0.005;
    const advLimit = totalRevenue * 0.1;
    const repExcess = Math.max(0, representation - repLimit);
    const advExcess = Math.max(0, advertising - advLimit);
    const totalNonDeductible = Math.round(repExcess + advExcess);

    return { representation: Math.round(representation), advertising: Math.round(advertising), repLimit: Math.round(repLimit), advLimit: Math.round(advLimit), repExcess: Math.round(repExcess), advExcess: Math.round(advExcess), totalNonDeductible };
  }, [expenseData, totalRevenue]);

  useEffect(() => {
    onNonDeductibleChange(calc.totalNonDeductible);
  }, [calc.totalNonDeductible, onNonDeductibleChange]);

  if (calc.representation === 0 && calc.advertising === 0) return null;

  return (
    <Card className="border-accent/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2 text-accent-foreground">
          <AlertTriangle className="h-4 w-4" /> Nepriznati rashodi — automatski obračun
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {calc.representation > 0 && (
          <div className="grid grid-cols-4 gap-2">
            <span className="text-muted-foreground">Reprezentacija (552):</span>
            <span className="text-right tabular-nums">{calc.representation.toLocaleString("sr-RS")}</span>
            <span className="text-right tabular-nums text-muted-foreground">limit {calc.repLimit.toLocaleString("sr-RS")} (0,5%)</span>
            <span className={`text-right tabular-nums font-semibold ${calc.repExcess > 0 ? "text-destructive" : ""}`}>
              {calc.repExcess > 0 ? `+${calc.repExcess.toLocaleString("sr-RS")}` : "U limitu"}
            </span>
          </div>
        )}
        {calc.advertising > 0 && (
          <div className="grid grid-cols-4 gap-2">
            <span className="text-muted-foreground">Reklama/propaganda (553):</span>
            <span className="text-right tabular-nums">{calc.advertising.toLocaleString("sr-RS")}</span>
            <span className="text-right tabular-nums text-muted-foreground">limit {calc.advLimit.toLocaleString("sr-RS")} (10%)</span>
            <span className={`text-right tabular-nums font-semibold ${calc.advExcess > 0 ? "text-destructive" : ""}`}>
              {calc.advExcess > 0 ? `+${calc.advExcess.toLocaleString("sr-RS")}` : "U limitu"}
            </span>
          </div>
        )}
        {calc.totalNonDeductible > 0 && (
          <div className="pt-2 border-t border-border/40 font-semibold flex justify-between">
            <span>Ukupno nepriznati rashodi:</span>
            <span className="text-destructive">{calc.totalNonDeductible.toLocaleString("sr-RS")} RSD</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
