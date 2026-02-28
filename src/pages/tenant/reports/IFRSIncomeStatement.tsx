import { useState, useMemo } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ExportButton } from "@/components/ExportButton";
import { PrintButton } from "@/components/PrintButton";
import { fmtNum } from "@/lib/utils";

// IAS 1 / IFRS standard line items for Statement of Profit or Loss
interface PLLine { label: string; labelSr: string; codes: string[]; sign: 1 | -1; bold?: boolean; subtotal?: boolean }

const PL_STRUCTURE: PLLine[] = [
  { label: "Revenue", labelSr: "Prihodi od prodaje", codes: ["60", "61"], sign: -1 },
  { label: "Cost of Sales", labelSr: "Nabavna vrednost prodate robe", codes: ["50", "51"], sign: 1 },
  { label: "Gross Profit", labelSr: "Bruto dobit", codes: [], sign: 1, bold: true, subtotal: true },
  { label: "Distribution Costs", labelSr: "Troškovi prodaje", codes: ["53"], sign: 1 },
  { label: "Administrative Expenses", labelSr: "Administrativni troškovi", codes: ["52", "54", "55"], sign: 1 },
  { label: "Other Operating Income", labelSr: "Ostali poslovni prihodi", codes: ["62", "63", "64", "65"], sign: -1 },
  { label: "Other Operating Expenses", labelSr: "Ostali poslovni rashodi", codes: ["57", "58"], sign: 1 },
  { label: "Operating Profit (EBIT)", labelSr: "Poslovna dobit (EBIT)", codes: [], sign: 1, bold: true, subtotal: true },
  { label: "Finance Income", labelSr: "Finansijski prihodi", codes: ["66"], sign: -1 },
  { label: "Finance Costs", labelSr: "Finansijski rashodi", codes: ["56"], sign: 1 },
  { label: "Profit Before Tax", labelSr: "Dobit pre poreza", codes: [], sign: 1, bold: true, subtotal: true },
  { label: "Income Tax Expense", labelSr: "Porez na dobit", codes: ["72", "73"], sign: 1 },
  { label: "Profit for the Period", labelSr: "Dobit perioda", codes: [], sign: 1, bold: true, subtotal: true },
];

export default function IFRSIncomeStatement() {
  const { t, locale } = useLanguage();
  const { tenantId } = useTenant();
  const [dateFrom, setDateFrom] = useState(`${new Date().getFullYear()}-01-01`);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split("T")[0]);

  const { data: lines = [], isLoading } = useQuery({
    queryKey: ["ifrs-pl", tenantId, dateFrom, dateTo],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("journal_lines")
        .select(`
          debit, credit,
          account:account_id(code, name, account_class),
          journal_entry:journal_entry_id(status, entry_date, tenant_id)
        `)
        .eq("journal_entry.status", "posted")
        .eq("journal_entry.tenant_id", tenantId)
        .gte("journal_entry.entry_date", dateFrom)
        .lte("journal_entry.entry_date", dateTo);
      if (error) throw error;
      return data as any[];
    },
    enabled: !!tenantId,
  });

  const { plRows, exportData } = useMemo(() => {
    // Aggregate by 2-digit code prefix
    const byCode: Record<string, number> = {};
    for (const l of lines) {
      const code = l.account?.code;
      if (!code) continue;
      const prefix = code.substring(0, 2);
      if (!byCode[prefix]) byCode[prefix] = 0;
      byCode[prefix] += Number(l.debit || 0) - Number(l.credit || 0);
    }

    const getAmount = (codes: string[], sign: number) =>
      codes.reduce((s, c) => s + (byCode[c] || 0), 0) * sign;

    let runningTotal = 0;
    const rows: { label: string; labelSr: string; amount: number; bold?: boolean; subtotal?: boolean }[] = [];

    for (const line of PL_STRUCTURE) {
      if (line.subtotal) {
        rows.push({ label: line.label, labelSr: line.labelSr, amount: runningTotal, bold: true, subtotal: true });
      } else {
        const amt = getAmount(line.codes, line.sign);
        runningTotal += (line.sign === -1 ? -amt : -amt); // Accumulate towards profit
        // Actually recalculate: revenue positive, expenses negative from profit perspective
        const displayAmt = line.sign === -1 ? -getAmount(line.codes, 1) : getAmount(line.codes, 1);
        rows.push({ label: line.label, labelSr: line.labelSr, amount: displayAmt, bold: line.bold });
      }
    }

    // Recalculate subtotals properly
    const rev = -(byCode["60"] || 0) - (byCode["61"] || 0); // Revenue (credit normal → negate)
    const cogs = (byCode["50"] || 0) + (byCode["51"] || 0);
    const grossProfit = rev - cogs;

    const dist = byCode["53"] || 0;
    const admin = (byCode["52"] || 0) + (byCode["54"] || 0) + (byCode["55"] || 0);
    const otherInc = -((byCode["62"] || 0) + (byCode["63"] || 0) + (byCode["64"] || 0) + (byCode["65"] || 0));
    const otherExp = (byCode["57"] || 0) + (byCode["58"] || 0);
    const ebit = grossProfit - dist - admin + otherInc - otherExp;

    const finInc = -(byCode["66"] || 0);
    const finCost = byCode["56"] || 0;
    const pbt = ebit + finInc - finCost;

    const tax = (byCode["72"] || 0) + (byCode["73"] || 0);
    const netProfit = pbt - tax;

    const finalRows = [
      { label: "Revenue", labelSr: "Prihodi od prodaje", amount: rev },
      { label: "Cost of Sales", labelSr: "Nabavna vrednost prodate robe", amount: -cogs },
      { label: "Gross Profit", labelSr: "Bruto dobit", amount: grossProfit, bold: true, subtotal: true },
      { label: "Distribution Costs", labelSr: "Troškovi prodaje", amount: -dist },
      { label: "Administrative Expenses", labelSr: "Administrativni troškovi", amount: -admin },
      { label: "Other Operating Income", labelSr: "Ostali poslovni prihodi", amount: otherInc },
      { label: "Other Operating Expenses", labelSr: "Ostali poslovni rashodi", amount: -otherExp },
      { label: "Operating Profit (EBIT)", labelSr: "Poslovna dobit (EBIT)", amount: ebit, bold: true, subtotal: true },
      { label: "Finance Income", labelSr: "Finansijski prihodi", amount: finInc },
      { label: "Finance Costs", labelSr: "Finansijski rashodi", amount: -finCost },
      { label: "Profit Before Tax", labelSr: "Dobit pre poreza", amount: pbt, bold: true, subtotal: true },
      { label: "Income Tax Expense", labelSr: "Porez na dobit", amount: -tax },
      { label: "Profit for the Period", labelSr: "Dobit perioda", amount: netProfit, bold: true, subtotal: true },
    ];

    return {
      plRows: finalRows,
      exportData: finalRows.map(r => ({ item: locale === "sr" ? r.labelSr : r.label, amount: r.amount })),
    };
  }, [lines, locale]);

  const netProfit = plRows.find(r => r.label === "Profit for the Period")?.amount || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          {t("ifrsIncomeTitle")}
        </h1>
        <div className="flex gap-2 print:hidden">
          <ExportButton
            data={exportData}
            columns={[
              { key: "item", label: t("itemLabel") },
              { key: "amount", label: "RSD", formatter: (v) => Number(v).toFixed(2) },
            ]}
            filename="ifrs_income_statement"
          />
          <PrintButton />
        </div>
      </div>

      <div className="flex gap-4 print:hidden">
        <div><Label>{t("startDate")}</Label><Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} /></div>
        <div><Label>{t("endDate")}</Label><Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} /></div>
      </div>

      {isLoading ? <p>{t("loading")}</p> : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t("ifrsIas1Title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("lineItemLabel")}</TableHead>
                  <TableHead className="text-right">RSD</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plRows.map((r, i) => (
                  <TableRow key={i} className={r.subtotal ? "bg-muted/30" : ""}>
                    <TableCell className={`${r.bold ? "font-bold" : ""} ${r.subtotal ? "border-t-2 border-border" : ""}`}>
                      {locale === "sr" ? r.labelSr : r.label}
                    </TableCell>
                    <TableCell className={`text-right tabular-nums ${r.bold ? "font-bold" : ""} ${r.subtotal ? "border-t-2 border-border" : ""} ${r.amount < 0 ? "text-destructive" : ""}`}>
                      {fmtNum(r.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-6 flex items-center justify-between">
          <span className="text-xl font-bold">{t("netResult")}</span>
          <div className="flex items-center gap-3">
            <span className="text-2xl font-bold">{fmtNum(netProfit)} RSD</span>
            <Badge variant={netProfit >= 0 ? "default" : "destructive"}>{netProfit >= 0 ? t("profit") : t("loss")}</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
