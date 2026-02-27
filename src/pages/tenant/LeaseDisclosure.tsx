import { useState, useMemo } from "react";
import { useTenant } from "@/hooks/useTenant";
import { useLanguage } from "@/i18n/LanguageContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ExportButton } from "@/components/ExportButton";
import { PrintButton } from "@/components/PrintButton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fmtNum } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export default function LeaseDisclosure() {
  const { tenantId } = useTenant();
  const { t, locale } = useLanguage();
  const navigate = useNavigate();
  const sr = locale === "sr";
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split("T")[0]);

  const { data: leases = [] } = useQuery({
    queryKey: ["lease-contracts-disclosure", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lease_contracts")
        .select("*")
        .eq("tenant_id", tenantId!)
        .in("status", ["active", "expired"]);
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: schedules = [] } = useQuery({
    queryKey: ["lease-schedules-all", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lease_payment_schedule")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("payment_date");
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: modifications = [] } = useQuery({
    queryKey: ["lease-modifications-all", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lease_modifications")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("modification_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const fmt = (n: number | null) => n != null ? fmtNum(Number(n)) : "—";

  // Summary KPIs
  const summary = useMemo(() => {
    const active = leases.filter((l: any) => l.status === "active");
    const shortTerm = active.filter((l: any) => l.short_term_exempt);
    const lowValue = active.filter((l: any) => l.low_value_exempt);
    const standard = active.filter((l: any) => !l.short_term_exempt && !l.low_value_exempt);

    return {
      totalContracts: active.length,
      totalLiability: standard.reduce((s: number, l: any) => s + Number(l.lease_liability_balance || 0), 0),
      totalRouNbv: standard.reduce((s: number, l: any) => s + Number(l.rou_net_book_value || 0), 0),
      shortTermCount: shortTerm.length,
      lowValueCount: lowValue.length,
      totalInterest: schedules
        .filter((s: any) => s.status === "posted")
        .reduce((sum: number, s: any) => sum + Number(s.interest_amount || 0), 0),
      totalDepreciation: schedules
        .filter((s: any) => s.status === "posted")
        .reduce((sum: number, s: any) => sum + Number(s.rou_depreciation || 0), 0),
    };
  }, [leases, schedules]);

  // Maturity analysis
  const maturity = useMemo(() => {
    const now = new Date(asOfDate);
    const buckets = { within1y: 0, y1to2: 0, y2to3: 0, y3to5: 0, over5y: 0 };

    for (const s of schedules) {
      if ((s as any).status === "posted") continue;
      const pDate = new Date((s as any).payment_date);
      const diffMs = pDate.getTime() - now.getTime();
      const diffYears = diffMs / (365.25 * 24 * 60 * 60 * 1000);
      const amt = Number((s as any).payment_amount || 0);

      if (diffYears <= 1) buckets.within1y += amt;
      else if (diffYears <= 2) buckets.y1to2 += amt;
      else if (diffYears <= 3) buckets.y2to3 += amt;
      else if (diffYears <= 5) buckets.y3to5 += amt;
      else buckets.over5y += amt;
    }

    return buckets;
  }, [schedules, asOfDate]);

  const maturityTotal = Object.values(maturity).reduce((a, b) => a + b, 0);

  const maturityRows = [
    { label: sr ? "Do 1 godine" : "Within 1 year", amount: maturity.within1y },
    { label: sr ? "1-2 godine" : "1-2 years", amount: maturity.y1to2 },
    { label: sr ? "2-3 godine" : "2-3 years", amount: maturity.y2to3 },
    { label: sr ? "3-5 godina" : "3-5 years", amount: maturity.y3to5 },
    { label: sr ? "Preko 5 godina" : "Over 5 years", amount: maturity.over5y },
  ];

  const exportData = maturityRows.map(r => ({ bucket: r.label, amount: r.amount }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/assets/leases")}><ArrowLeft className="h-5 w-5" /></Button>
        <h1 className="text-2xl font-bold">{sr ? "IFRS 16 — Obelodanjivanja" : "IFRS 16 — Disclosures"}</h1>
        <div className="ml-auto flex gap-2 print:hidden">
          <ExportButton data={exportData} columns={[
            { key: "bucket", label: sr ? "Period" : "Maturity Bucket" },
            { key: "amount", label: "RSD", formatter: (v) => Number(v).toFixed(2) },
          ]} filename="ifrs16_disclosure" />
          <PrintButton />
        </div>
      </div>

      <div className="flex gap-4 print:hidden">
        <div><Label>{sr ? "Na dan" : "As of"}</Label><Input type="date" value={asOfDate} onChange={e => setAsOfDate(e.target.value)} /></div>
      </div>

      {/* Summary KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          { label: sr ? "Aktivni ugovori" : "Active Leases", value: String(summary.totalContracts) },
          { label: sr ? "Ukupna obaveza" : "Total Liability", value: `${fmt(summary.totalLiability)} RSD` },
          { label: sr ? "ROU NBV ukupno" : "Total ROU NBV", value: `${fmt(summary.totalRouNbv)} RSD` },
          { label: sr ? "Kratkoročni izuzeci" : "Short-term Exemptions", value: String(summary.shortTermCount) },
        ].map(kpi => (
          <Card key={kpi.label}>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{kpi.label}</CardTitle></CardHeader>
            <CardContent><div className="text-xl font-bold">{kpi.value}</div></CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="maturity">
        <TabsList className="print:hidden">
          <TabsTrigger value="maturity">{sr ? "Analiza dospeća" : "Maturity Analysis"}</TabsTrigger>
          <TabsTrigger value="pl-impact">{sr ? "Uticaj na BU" : "P&L Impact"}</TabsTrigger>
          <TabsTrigger value="reconciliation">{sr ? "Rekonciljacija" : "Reconciliation"}</TabsTrigger>
          <TabsTrigger value="modifications">{sr ? "Modifikacije" : "Modifications"}</TabsTrigger>
        </TabsList>

        <TabsContent value="maturity">
          <Card>
            <CardHeader><CardTitle>{sr ? "Analiza dospeća nediskontovanih plaćanja" : "Maturity Analysis of Undiscounted Payments"}</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{sr ? "Period" : "Maturity Bucket"}</TableHead>
                    <TableHead className="text-right">RSD</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {maturityRows.map(r => (
                    <TableRow key={r.label}>
                      <TableCell>{r.label}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(r.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell className="font-bold">{sr ? "Ukupno" : "Total"}</TableCell>
                    <TableCell className="text-right font-bold tabular-nums">{fmt(maturityTotal)}</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pl-impact">
          <Card>
            <CardHeader><CardTitle>{sr ? "Uticaj na bilans uspeha" : "Profit or Loss Impact"}</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">{sr ? "Trošak amortizacije ROU" : "ROU Depreciation Expense"}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(summary.totalDepreciation)} RSD</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">{sr ? "Trošak kamate" : "Interest Expense"}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(summary.totalInterest)} RSD</TableCell>
                  </TableRow>
                  <TableRow className="bg-muted/30">
                    <TableCell className="font-bold">{sr ? "Ukupan uticaj" : "Total P&L Impact"}</TableCell>
                    <TableCell className="text-right font-bold tabular-nums">{fmt(summary.totalDepreciation + summary.totalInterest)} RSD</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          {summary.shortTermCount > 0 && (
            <Card className="mt-4">
              <CardContent className="p-4">
                <Badge variant="secondary">{sr ? "Kratkoročni lizinzi" : "Short-term Leases"}</Badge>
                <p className="text-sm text-muted-foreground mt-2">
                  {sr
                    ? `${summary.shortTermCount} ugovor(a) tretiran(o) kao kratkoročni — rashod se priznaje pravolinijski.`
                    : `${summary.shortTermCount} lease(s) treated as short-term — expense recognized on straight-line basis.`}
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="reconciliation">
          <Card>
            <CardHeader><CardTitle>{sr ? "Rekonciljacija obaveza po lizingu" : "Lease Liability Reconciliation"}</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{sr ? "Ugovor" : "Contract"}</TableHead>
                    <TableHead className="text-right">{sr ? "Početna obaveza" : "Initial Liability"}</TableHead>
                    <TableHead className="text-right">{sr ? "Plaćeno (glavnica)" : "Paid (Principal)"}</TableHead>
                    <TableHead className="text-right">{sr ? "Kamata" : "Interest"}</TableHead>
                    <TableHead className="text-right">{sr ? "Trenutna obaveza" : "Current Balance"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leases.filter((l: any) => l.status === "active" && !l.short_term_exempt).map((l: any) => {
                    const leaseSchedules = schedules.filter((s: any) => s.lease_id === l.id && s.status === "posted");
                    const paidPrincipal = leaseSchedules.reduce((s: number, p: any) => s + Number(p.principal_amount || 0), 0);
                    const paidInterest = leaseSchedules.reduce((s: number, p: any) => s + Number(p.interest_amount || 0), 0);
                    return (
                      <TableRow key={l.id}>
                        <TableCell className="font-mono">{l.contract_number}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmt(l.initial_liability)}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmt(paidPrincipal)}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmt(paidInterest)}</TableCell>
                        <TableCell className="text-right tabular-nums font-semibold">{fmt(l.lease_liability_balance)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell className="font-bold">{sr ? "Ukupno" : "Total"}</TableCell>
                    <TableCell className="text-right font-bold tabular-nums">
                      {fmt(leases.filter((l: any) => l.status === "active" && !l.short_term_exempt).reduce((s: number, l: any) => s + Number(l.initial_liability || 0), 0))}
                    </TableCell>
                    <TableCell colSpan={2}></TableCell>
                    <TableCell className="text-right font-bold tabular-nums">{fmt(summary.totalLiability)}</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="modifications">
          <Card>
            <CardHeader><CardTitle>{sr ? "Modifikacije ugovora" : "Lease Modifications"}</CardTitle></CardHeader>
            <CardContent className="p-0">
              {modifications.length === 0 ? (
                <p className="p-6 text-center text-muted-foreground">{sr ? "Nema evidentiranih modifikacija" : "No modifications recorded"}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{sr ? "Datum" : "Date"}</TableHead>
                      <TableHead>{sr ? "Tip" : "Type"}</TableHead>
                      <TableHead className="text-right">{sr ? "Nova rata" : "New Payment"}</TableHead>
                      <TableHead className="text-right">{sr ? "Dobitak/gubitak" : "Gain/Loss"}</TableHead>
                      <TableHead>{sr ? "Napomene" : "Notes"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {modifications.map((m: any) => (
                      <TableRow key={m.id}>
                        <TableCell>{m.modification_date}</TableCell>
                        <TableCell><Badge variant="outline">{m.modification_type}</Badge></TableCell>
                        <TableCell className="text-right tabular-nums">{fmt(m.new_monthly_payment)}</TableCell>
                        <TableCell className={`text-right tabular-nums ${Number(m.gain_loss_on_modification) < 0 ? "text-destructive" : ""}`}>
                          {fmt(m.gain_loss_on_modification)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{m.notes || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
