import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { addDays, isAfter, isBefore } from "date-fns";
import { fmtNumCompact } from "@/lib/utils";

interface Props {
  tenantId: string;
}

export function CashflowForecastWidget({ tenantId }: Props) {
  const today = new Date();
  const day30 = addDays(today, 30);
  const day60 = addDays(today, 60);
  const day90 = addDays(today, 90);

  // Open (unpaid) sales invoices — expected inflows
  const { data: inflows } = useQuery({
    queryKey: ["cashflow-inflows", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("invoices")
        .select("total, due_date")
        .eq("tenant_id", tenantId)
        .in("status", ["draft", "sent"])
        .not("due_date", "is", null);
      return data || [];
    },
    enabled: !!tenantId,
    staleTime: 1000 * 60 * 5,
  });

  // Open supplier invoices — expected outflows
  const { data: outflows } = useQuery({
    queryKey: ["cashflow-outflows", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("supplier_invoices")
        .select("total, due_date")
        .eq("tenant_id", tenantId)
        .in("status", ["received", "approved"])
        .not("due_date", "is", null);
      return data || [];
    },
    enabled: !!tenantId,
    staleTime: 1000 * 60 * 5,
  });

  const bucket = (items: any[], from: Date, to: Date) =>
    (items || [])
      .filter((i) => {
        const d = new Date(i.due_date);
        return !isBefore(d, from) && isBefore(d, to);
      })
      .reduce((s, i) => s + Number(i.total), 0);

  const periods = [
    { label: "0–30 dana", inflow: bucket(inflows || [], today, day30), outflow: bucket(outflows || [], today, day30) },
    { label: "31–60 dana", inflow: bucket(inflows || [], day30, day60), outflow: bucket(outflows || [], day30, day60) },
    { label: "61–90 dana", inflow: bucket(inflows || [], day60, day90), outflow: bucket(outflows || [], day60, day90) },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Prognoza novčanih tokova</CardTitle>
        <p className="text-xs text-muted-foreground">Na osnovu otvorenih faktura i obaveza prema dobavljačima</p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-3">
          {periods.map((p) => {
            const net = p.inflow - p.outflow;
            const NetIcon = net > 0 ? TrendingUp : net < 0 ? TrendingDown : Minus;
            const netColor = net > 0 ? "text-green-600" : net < 0 ? "text-destructive" : "text-muted-foreground";
            return (
              <div key={p.label} className="bg-muted/40 rounded-lg p-3 space-y-2">
                <p className="text-xs font-medium text-muted-foreground">{p.label}</p>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[hsl(142,76%,36%)]">↑ Prihodi</span>
                    <span className="font-medium tabular-nums text-[hsl(142,76%,36%)]">{fmtNumCompact(p.inflow)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-destructive">↓ Rashodi</span>
                    <span className="font-medium tabular-nums text-destructive">{fmtNumCompact(p.outflow)}</span>
                  </div>
                  <div className="border-t pt-1 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1">
                      <NetIcon className={`h-3 w-3 ${netColor}`} />
                      <span className={netColor}>Neto</span>
                    </div>
                    <span className={`font-semibold tabular-nums ${netColor}`}>{fmtNumCompact(net)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          * RSD. Prikazani iznosi su projektovani na osnovu rokova plaćanja otvorenih stavki.
        </p>
      </CardContent>
    </Card>
  );
}
