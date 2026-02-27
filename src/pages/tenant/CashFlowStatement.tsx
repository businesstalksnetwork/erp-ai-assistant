import { useState, useMemo } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/shared/PageHeader";
import { DownloadPdfButton } from "@/components/DownloadPdfButton";
import { ArrowDownUp } from "lucide-react";
import { fmtNum } from "@/lib/utils";

/**
 * Izveštaj o tokovima gotovine — Cash Flow Statement (Indirect Method)
 * Serbian standard: derives operating cash flows from net income + adjustments.
 * Account ranges follow Serbian kontni okvir.
 */

// Serbian CoA ranges for cash flow classification
const OPERATING_ADJUSTMENTS = [
  { label: "Amortizacija", codePrefix: "540", sign: 1 },
  { label: "Troškovi kamata", codePrefix: "562", sign: 1 },
  { label: "Prihodi od kamata", codePrefix: "662", sign: -1 },
  { label: "Gubici od prodaje OS", codePrefix: "570", sign: 1 },
  { label: "Dobici od prodaje OS", codePrefix: "670", sign: -1 },
];

const WORKING_CAPITAL_CHANGES = [
  { label: "Promena zaliha", codePrefix: "1", sign: -1 },
  { label: "Promena potraživanja", codePrefix: "2", sign: -1 },
  { label: "Promena obaveza iz poslovanja", codePrefix: "43", sign: 1 },
  { label: "Promena PDV obaveza/potraživanja", codePrefix: "27", sign: 1 },
];

export default function CashFlowStatement() {
  const { t, locale } = useLanguage();
  const { tenantId } = useTenant();
  const currentYear = new Date().getFullYear();
  const [dateFrom, setDateFrom] = useState(`${currentYear}-01-01`);
  const [dateTo, setDateTo] = useState(`${currentYear}-12-31`);

  // Get all posted journal lines for the period
  const { data: lines = [], isLoading } = useQuery({
    queryKey: ["cash-flow-lines", tenantId, dateFrom, dateTo],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase
        .from("journal_lines")
        .select(`debit, credit, account:chart_of_accounts!inner(code, account_type), journal_entry:journal_entries!inner(status, entry_date, tenant_id)`)
        .eq("journal_entry.status", "posted")
        .eq("journal_entry.tenant_id", tenantId)
        .gte("journal_entry.entry_date", dateFrom)
        .lte("journal_entry.entry_date", dateTo);
      return (data || []) as any[];
    },
    enabled: !!tenantId,
  });

  // Get opening balances (before dateFrom) for balance sheet accounts
  const { data: openingLines = [] } = useQuery({
    queryKey: ["cash-flow-opening", tenantId, dateFrom],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase
        .from("journal_lines")
        .select(`debit, credit, account:chart_of_accounts!inner(code, account_type), journal_entry:journal_entries!inner(status, entry_date, tenant_id)`)
        .eq("journal_entry.status", "posted")
        .eq("journal_entry.tenant_id", tenantId)
        .lt("journal_entry.entry_date", dateFrom);
      return (data || []) as any[];
    },
    enabled: !!tenantId,
  });

  const cashFlow = useMemo(() => {
    // Aggregate balances by account code prefix
    const periodBalances = new Map<string, number>();
    const openingBalances = new Map<string, number>();

    for (const l of lines) {
      const code = l.account?.code || "";
      const prefix3 = code.substring(0, 3);
      const prefix2 = code.substring(0, 2);
      const prefix1 = code.substring(0, 1);
      for (const p of [prefix3, prefix2, prefix1, code]) {
        periodBalances.set(p, (periodBalances.get(p) || 0) + Number(l.debit) - Number(l.credit));
      }
    }

    for (const l of openingLines) {
      const code = l.account?.code || "";
      const prefix3 = code.substring(0, 3);
      const prefix2 = code.substring(0, 2);
      const prefix1 = code.substring(0, 1);
      for (const p of [prefix3, prefix2, prefix1, code]) {
        openingBalances.set(p, (openingBalances.get(p) || 0) + Number(l.debit) - Number(l.credit));
      }
    }

    const getChange = (prefix: string) => (periodBalances.get(prefix) || 0);
    const getBalanceChange = (prefix: string) => {
      // Change = closing balance - opening balance for balance sheet items
      const closingMovement = periodBalances.get(prefix) || 0;
      return closingMovement;
    };

    // Net income (revenue - expenses from P&L)
    const totalRevenue = lines
      .filter((l: any) => l.account?.account_type === "revenue")
      .reduce((s: number, l: any) => s + Number(l.credit) - Number(l.debit), 0);
    const totalExpenses = lines
      .filter((l: any) => l.account?.account_type === "expense")
      .reduce((s: number, l: any) => s + Number(l.debit) - Number(l.credit), 0);
    const netIncome = totalRevenue - totalExpenses;

    // Operating adjustments
    const adjustments = OPERATING_ADJUSTMENTS.map(a => ({
      label: a.label,
      amount: Math.abs(getChange(a.codePrefix)) * a.sign,
    }));
    const totalAdjustments = adjustments.reduce((s, a) => s + a.amount, 0);

    // Working capital changes
    const wcChanges = WORKING_CAPITAL_CHANGES.map(wc => ({
      label: wc.label,
      amount: getBalanceChange(wc.codePrefix) * wc.sign * -1,
    }));
    const totalWcChanges = wcChanges.reduce((s, w) => s + w.amount, 0);
    const operatingCashFlow = netIncome + totalAdjustments + totalWcChanges;

    // Investing: fixed assets (class 0)
    const investingItems = [
      { label: "Nabavka osnovnih sredstava", amount: -Math.abs(getChange("02")) },
      { label: "Nabavka nematerijalnih ulaganja", amount: -Math.abs(getChange("01")) },
      { label: "Prodaja osnovnih sredstava", amount: Math.abs(getChange("670")) },
    ];
    const investingCashFlow = investingItems.reduce((s, i) => s + i.amount, 0);

    // Financing: loans (class 4 long-term), equity changes
    const financingItems = [
      { label: "Primljeni krediti", amount: getBalanceChange("41") * -1 },
      { label: "Otplata kredita", amount: getBalanceChange("41") },
      { label: "Isplata dividendi", amount: -Math.abs(getChange("340")) },
    ];
    const financingCashFlow = financingItems.reduce((s, i) => s + i.amount, 0);

    // Cash position
    const cashChange = operatingCashFlow + investingCashFlow + financingCashFlow;
    const openingCash = openingBalances.get("24") || 0; // Account 24x = cash/bank
    const closingCash = openingCash + (periodBalances.get("24") || 0);

    return {
      netIncome, adjustments, totalAdjustments,
      wcChanges, totalWcChanges, operatingCashFlow,
      investingItems, investingCashFlow,
      financingItems, financingCashFlow,
      cashChange, openingCash, closingCash,
    };
  }, [lines, openingLines]);

  const renderSection = (title: string, items: { label: string; amount: number }[], total: number, totalLabel: string) => (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableBody>
            {items.filter(i => Math.abs(i.amount) > 0.01).map((item, idx) => (
              <TableRow key={idx}>
                <TableCell>{item.label}</TableCell>
                <TableCell className={`text-right tabular-nums ${item.amount >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {fmtNum(item.amount)}
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-muted/50 font-semibold">
              <TableCell>{totalLabel}</TableCell>
              <TableCell className={`text-right tabular-nums ${total >= 0 ? "text-green-600" : "text-red-600"}`}>
                {fmtNum(total)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={locale === "sr" ? "Izveštaj o tokovima gotovine" : "Cash Flow Statement"}
        icon={ArrowDownUp}
        description={locale === "sr" ? "Indirektni metod — prema srpskim standardima" : "Indirect method"}
        actions={
          tenantId ? (
            <DownloadPdfButton
              type="cash_flow_statement"
              params={{ tenant_id: tenantId, date_from: dateFrom, date_to: dateTo }}
            />
          ) : undefined
        }
      />

      <div className="flex gap-4">
        <div>
          <Label>{t("startDate")}</Label>
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        </div>
        <div>
          <Label>{t("endDate")}</Label>
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>
      </div>

      {isLoading ? (
        <p className="text-center text-muted-foreground py-8">{t("loading")}</p>
      ) : (
        <div className="space-y-4">
          {/* A. Operating Activities */}
          <Card>
            <CardHeader><CardTitle className="text-base">{locale === "sr" ? "A. Poslovne aktivnosti" : "A. Operating Activities"}</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">{locale === "sr" ? "Neto rezultat" : "Net Income"}</TableCell>
                    <TableCell className={`text-right tabular-nums font-semibold ${cashFlow.netIncome >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {fmtNum(cashFlow.netIncome)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {renderSection(
            locale === "sr" ? "Korekcije" : "Adjustments",
            cashFlow.adjustments,
            cashFlow.totalAdjustments,
            locale === "sr" ? "Ukupne korekcije" : "Total Adjustments"
          )}

          {renderSection(
            locale === "sr" ? "Promene obrtnog kapitala" : "Working Capital Changes",
            cashFlow.wcChanges,
            cashFlow.totalWcChanges,
            locale === "sr" ? "Ukupne promene" : "Total WC Changes"
          )}

          <Card className="border-primary/30">
            <CardContent className="p-4 flex justify-between items-center">
              <span className="font-semibold">{locale === "sr" ? "Neto gotovina iz poslovnih aktivnosti" : "Net Cash from Operations"}</span>
              <span className={`text-xl font-bold ${cashFlow.operatingCashFlow >= 0 ? "text-green-600" : "text-red-600"}`}>
                {fmtNum(cashFlow.operatingCashFlow)} RSD
              </span>
            </CardContent>
          </Card>

          {/* B. Investing */}
          {renderSection(
            locale === "sr" ? "B. Investicione aktivnosti" : "B. Investing Activities",
            cashFlow.investingItems,
            cashFlow.investingCashFlow,
            locale === "sr" ? "Neto gotovina iz investicija" : "Net Cash from Investing"
          )}

          {/* C. Financing */}
          {renderSection(
            locale === "sr" ? "C. Finansijske aktivnosti" : "C. Financing Activities",
            cashFlow.financingItems,
            cashFlow.financingCashFlow,
            locale === "sr" ? "Neto gotovina iz finansiranja" : "Net Cash from Financing"
          )}

          {/* Summary */}
          <Card className="border-2 border-primary/50">
            <CardContent className="p-4 space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{locale === "sr" ? "Početno stanje gotovine" : "Opening Cash"}</span>
                <span className="tabular-nums">{fmtNum(cashFlow.openingCash)} RSD</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{locale === "sr" ? "Neto promena" : "Net Change"}</span>
                <span className={`tabular-nums font-medium ${cashFlow.cashChange >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {cashFlow.cashChange >= 0 ? "+" : ""}{fmtNum(cashFlow.cashChange)} RSD
                </span>
              </div>
              <div className="flex justify-between border-t pt-3">
                <span className="font-bold text-lg">{locale === "sr" ? "Završno stanje gotovine" : "Closing Cash"}</span>
                <span className="font-bold text-lg tabular-nums">{fmtNum(cashFlow.closingCash)} RSD</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
