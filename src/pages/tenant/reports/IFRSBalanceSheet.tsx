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

// IAS 1 Balance Sheet structure mapped to Serbian CoA classes
interface BSLine { label: string; labelSr: string; codes: string[]; sign: 1 | -1; bold?: boolean; subtotal?: boolean; section: "nca" | "ca" | "equity" | "ncl" | "cl" }

const BS_STRUCTURE: BSLine[] = [
  // Non-current assets (class 0)
  { label: "Intangible Assets", labelSr: "Nematerijalna imovina", codes: ["01", "02"], sign: 1, section: "nca" },
  { label: "Property, Plant & Equipment", labelSr: "Nekretnine, postrojenja, oprema", codes: ["02", "03", "04"], sign: 1, section: "nca" },
  { label: "Long-term Financial Assets", labelSr: "Dugoročni finansijski plasmani", codes: ["05", "06"], sign: 1, section: "nca" },
  // Current assets (class 1-2)
  { label: "Inventories", labelSr: "Zalihe", codes: ["10", "11", "12", "13", "14", "15"], sign: 1, section: "ca" },
  { label: "Trade Receivables", labelSr: "Potraživanja od kupaca", codes: ["20", "21", "22"], sign: 1, section: "ca" },
  { label: "Other Receivables", labelSr: "Ostala potraživanja", codes: ["23", "24", "27", "28", "29"], sign: 1, section: "ca" },
  { label: "Cash & Cash Equivalents", labelSr: "Gotovina i ekvivalenti", codes: ["24", "25", "26"], sign: 1, section: "ca" },
  // Equity (class 3)
  { label: "Share Capital", labelSr: "Osnovni kapital", codes: ["30"], sign: -1, section: "equity" },
  { label: "Reserves", labelSr: "Rezerve", codes: ["31", "32", "33"], sign: -1, section: "equity" },
  { label: "Retained Earnings", labelSr: "Neraspoređena dobit", codes: ["34", "35"], sign: -1, section: "equity" },
  // Non-current liabilities (class 4 long-term)
  { label: "Long-term Borrowings", labelSr: "Dugoročni krediti", codes: ["40", "41"], sign: -1, section: "ncl" },
  { label: "Provisions", labelSr: "Rezervisanja", codes: ["40"], sign: -1, section: "ncl" },
  // Current liabilities (class 4 short-term)
  { label: "Trade Payables", labelSr: "Obaveze prema dobavljačima", codes: ["43", "44"], sign: -1, section: "cl" },
  { label: "Tax Liabilities", labelSr: "Poreske obaveze", codes: ["47", "48"], sign: -1, section: "cl" },
  { label: "Other Current Liabilities", labelSr: "Ostale kratkoročne obaveze", codes: ["45", "46", "49"], sign: -1, section: "cl" },
];

export default function IFRSBalanceSheet() {
  const { t, locale } = useLanguage();
  const { tenantId } = useTenant();
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split("T")[0]);

  const { data: lines = [], isLoading } = useQuery({
    queryKey: ["ifrs-bs", tenantId, asOfDate],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("journal_lines")
        .select(`
          debit, credit,
          account:account_id(code, name, account_class, account_type),
          journal_entry:journal_entry_id(status, entry_date, tenant_id)
        `)
        .eq("journal_entry.status", "posted")
        .eq("journal_entry.tenant_id", tenantId)
        .lte("journal_entry.entry_date", asOfDate);
      if (error) throw error;
      return data as any[];
    },
    enabled: !!tenantId,
  });

  const { sections, totalAssets, totalEquityAndLiabilities } = useMemo(() => {
    const byCode: Record<string, number> = {};
    for (const l of lines) {
      const code = l.account?.code;
      if (!code) continue;
      const prefix = code.substring(0, 2);
      if (!byCode[prefix]) byCode[prefix] = 0;
      byCode[prefix] += Number(l.debit || 0) - Number(l.credit || 0);
    }

    const sectionGroups: Record<string, { title: string; titleSr: string; items: { label: string; labelSr: string; amount: number }[]; total: number }> = {
      nca: { title: "Non-Current Assets", titleSr: "Stalna imovina", items: [], total: 0 },
      ca: { title: "Current Assets", titleSr: "Obrtna imovina", items: [], total: 0 },
      equity: { title: "Equity", titleSr: "Kapital", items: [], total: 0 },
      ncl: { title: "Non-Current Liabilities", titleSr: "Dugoročne obaveze", items: [], total: 0 },
      cl: { title: "Current Liabilities", titleSr: "Kratkoročne obaveze", items: [], total: 0 },
    };

    for (const line of BS_STRUCTURE) {
      const raw = line.codes.reduce((s, c) => s + (byCode[c] || 0), 0);
      const amount = raw * line.sign;
      if (Math.abs(amount) > 0.01) {
        sectionGroups[line.section].items.push({ label: line.label, labelSr: line.labelSr, amount });
        sectionGroups[line.section].total += amount;
      }
    }

    const ta = sectionGroups.nca.total + sectionGroups.ca.total;
    const tel = sectionGroups.equity.total + sectionGroups.ncl.total + sectionGroups.cl.total;

    return { sections: sectionGroups, totalAssets: ta, totalEquityAndLiabilities: tel };
  }, [lines]);

  const isBalanced = Math.abs(totalAssets - totalEquityAndLiabilities) < 1;

  const renderSection = (key: string) => {
    const sec = sections[key];
    if (!sec) return null;
    return (
      <Card key={key}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold uppercase tracking-wide">
            {locale === "sr" ? sec.titleSr : sec.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableBody>
              {sec.items.map((item, i) => (
                <TableRow key={i}>
                  <TableCell className="pl-6">{locale === "sr" ? item.labelSr : item.label}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtNum(item.amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="font-bold pl-6">{t("total")}</TableCell>
                <TableCell className="text-right font-bold tabular-nums">{fmtNum(sec.total)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>
    );
  };

  const exportData = Object.values(sections).flatMap(s =>
    [...s.items.map(i => ({ section: locale === "sr" ? s.titleSr : s.title, item: locale === "sr" ? i.labelSr : i.label, amount: i.amount })),
    { section: locale === "sr" ? s.titleSr : s.title, item: "TOTAL", amount: s.total }]
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          {locale === "sr" ? "Bilans stanja (IFRS)" : "Statement of Financial Position (IFRS)"}
        </h1>
        <div className="flex gap-2 print:hidden">
          <ExportButton
            data={exportData}
            columns={[
              { key: "section", label: locale === "sr" ? "Sekcija" : "Section" },
              { key: "item", label: locale === "sr" ? "Stavka" : "Item" },
              { key: "amount", label: "RSD", formatter: (v) => Number(v).toFixed(2) },
            ]}
            filename="ifrs_balance_sheet"
          />
          <PrintButton />
        </div>
      </div>

      <div className="flex gap-4 print:hidden">
        <div><Label>{t("asOfDate")}</Label><Input type="date" value={asOfDate} onChange={e => setAsOfDate(e.target.value)} /></div>
      </div>

      {isLoading ? <p>{t("loading")}</p> : (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">{locale === "sr" ? "AKTIVA" : "ASSETS"}</h2>
          {renderSection("nca")}
          {renderSection("ca")}
          <Card>
            <CardContent className="p-4 flex justify-between items-center">
              <span className="font-bold text-lg">{locale === "sr" ? "UKUPNA AKTIVA" : "TOTAL ASSETS"}</span>
              <span className="font-bold text-lg tabular-nums">{fmtNum(totalAssets)} RSD</span>
            </CardContent>
          </Card>

          <h2 className="text-lg font-semibold">{locale === "sr" ? "PASIVA" : "EQUITY & LIABILITIES"}</h2>
          {renderSection("equity")}
          {renderSection("ncl")}
          {renderSection("cl")}
          <Card>
            <CardContent className="p-4 flex justify-between items-center">
              <span className="font-bold text-lg">{locale === "sr" ? "UKUPNA PASIVA" : "TOTAL EQUITY & LIABILITIES"}</span>
              <span className="font-bold text-lg tabular-nums">{fmtNum(totalEquityAndLiabilities)} RSD</span>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 flex items-center justify-between">
              <span className="font-bold">{locale === "sr" ? "Aktiva = Pasiva" : "Assets = Equity + Liabilities"}</span>
              <Badge variant={isBalanced ? "default" : "destructive"}>{isBalanced ? t("balanced") : t("unbalanced")}</Badge>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
