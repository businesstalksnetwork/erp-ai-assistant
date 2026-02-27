import { useMemo } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BookOpen } from "lucide-react";
import { fmtNum } from "@/lib/utils";

interface PostingLine {
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  description: string;
}

interface GlPostingPreviewProps {
  lines: Array<{
    description: string;
    line_total: number;
    tax_amount: number;
    total_with_tax: number;
    item_type?: string;
  }>;
  partnerName: string;
  invoiceType: string;
  currency: string;
  subtotal: number;
  totalTax: number;
  grandTotal: number;
}

/**
 * Shows estimated GL posting lines that will be created when invoice is posted.
 * Uses standard Serbian posting logic:
 * - DR 2040 (Kupci) for receivable
 * - CR 6xxx (Prihodi) for revenue  
 * - CR 4700 (PDV) for output VAT
 */
export default function GlPostingPreview({
  lines, partnerName, invoiceType, currency, subtotal, totalTax, grandTotal,
}: GlPostingPreviewProps) {
  const { t } = useLanguage();

  const postingLines = useMemo<PostingLine[]>(() => {
    if (grandTotal <= 0) return [];

    const result: PostingLine[] = [];

    // For credit notes, reverse debit/credit
    const drSide = invoiceType === "credit_note" ? 0 : grandTotal;
    const crSide = invoiceType === "credit_note" ? grandTotal : 0;

    // DR/CR: Receivable (Kupci - 2040)
    result.push({
      accountCode: "2040",
      accountName: "Kupci u zemlji",
      debit: drSide,
      credit: crSide,
      description: `${partnerName || t("partner")}`,
    });

    // CR: Revenue lines - group by item_type
    const revenueByType: Record<string, number> = {};
    lines.forEach(l => {
      if (l.line_total <= 0) return;
      const type = l.item_type || "service";
      revenueByType[type] = (revenueByType[type] || 0) + l.line_total;
    });

    const isCredit = invoiceType === "credit_note";
    const isDebit = invoiceType === "debit_note";

    const revenueAccounts: Record<string, { code: string; name: string }> = {
      goods: { code: "6120", name: "Prihodi od prodaje robe" },
      service: { code: "6500", name: "Prihodi od usluga" },
      product: { code: "6100", name: "Prihodi od prodaje proizvoda" },
    };

    Object.entries(revenueByType).forEach(([type, amount]) => {
      const acc = revenueAccounts[type] || revenueAccounts.service;
      result.push({
        accountCode: acc.code,
        accountName: acc.name,
        debit: isCredit ? amount : 0,
        credit: isCredit ? 0 : amount,
        description: l10nItemType(type),
      });
    });

    // CR: Output VAT (PDV)
    if (totalTax > 0) {
      result.push({
        accountCode: "4700",
        accountName: "Obaveze za PDV",
        debit: isCredit ? totalTax : 0,
        credit: isCredit ? 0 : totalTax,
        description: "PDV",
      });
    }

    // For advance invoices, different posting
    if (invoiceType === "advance") {
      result[0] = { ...result[0], accountCode: "2040", accountName: "Kupci - avansi" };
    }

    return result;
  }, [lines, partnerName, invoiceType, grandTotal, subtotal, totalTax]);

  if (postingLines.length === 0) return null;

  const totalDebit = postingLines.reduce((s, l) => s + l.debit, 0);
  const totalCredit = postingLines.reduce((s, l) => s + l.credit, 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">{t("glPostingPreview")}</CardTitle>
          <Badge variant={isBalanced ? "default" : "destructive"} className="ml-auto">
            {isBalanced ? t("balanced") : t("unbalanced")}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">{t("glPostingPreviewDesc")}</p>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">{t("accountCode")}</TableHead>
              <TableHead>{t("accountName")}</TableHead>
              <TableHead>{t("description")}</TableHead>
              <TableHead className="text-right w-[120px]">{t("debit")}</TableHead>
              <TableHead className="text-right w-[120px]">{t("credit")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {postingLines.map((l, i) => (
              <TableRow key={i}>
                <TableCell className="font-mono text-sm">{l.accountCode}</TableCell>
                <TableCell className="text-sm">{l.accountName}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{l.description}</TableCell>
                <TableCell className="text-right font-mono text-sm">{l.debit > 0 ? fmtNum(l.debit) : ""}</TableCell>
                <TableCell className="text-right font-mono text-sm">{l.credit > 0 ? fmtNum(l.credit) : ""}</TableCell>
              </TableRow>
            ))}
            <TableRow className="font-semibold bg-muted/50">
              <TableCell colSpan={3} className="text-right">{t("total")}</TableCell>
              <TableCell className="text-right font-mono">{fmtNum(totalDebit)} {currency}</TableCell>
              <TableCell className="text-right font-mono">{fmtNum(totalCredit)} {currency}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function l10nItemType(type: string): string {
  switch (type) {
    case "goods": return "Roba";
    case "service": return "Usluga";
    case "product": return "Proizvod";
    default: return type;
  }
}
