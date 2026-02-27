import { useLanguage } from "@/i18n/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BookOpen } from "lucide-react";
import { fmtNum } from "@/lib/utils";

export interface PreviewLine {
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  description?: string;
}

interface PostingPreviewPanelProps {
  lines: PreviewLine[];
  currency?: string;
  title?: string;
}

/**
 * Generic GL posting preview panel. Shows debit/credit lines with balance check.
 * Used across all document types: invoices, supplier invoices, cash register, deferrals, etc.
 */
export default function PostingPreviewPanel({ lines, currency = "RSD", title }: PostingPreviewPanelProps) {
  const { t } = useLanguage();

  if (lines.length === 0) return null;

  const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
  const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">{title || t("glPostingPreview")}</CardTitle>
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
            {lines.map((l, i) => (
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

/** Helper to build supplier invoice approval posting preview lines */
export function buildSupplierInvoicePreviewLines(inv: { amount: number; tax_amount: number; total: number; invoice_number: string }): PreviewLine[] {
  const lines: PreviewLine[] = [
    { accountCode: "7000", accountName: "Nabavna vrednost robe", debit: inv.amount, credit: 0, description: `COGS - ${inv.invoice_number}` },
  ];
  if (inv.tax_amount > 0) {
    lines.push({ accountCode: "2700", accountName: "PDV u primljenim fakturama", debit: inv.tax_amount, credit: 0, description: `Ulazni PDV - ${inv.invoice_number}` });
  }
  lines.push({ accountCode: "4350", accountName: "Dobavljači u zemlji", debit: 0, credit: inv.total, description: `Obaveza - ${inv.invoice_number}` });
  return lines;
}

/** Helper to build supplier invoice payment posting preview lines */
export function buildSupplierPaymentPreviewLines(inv: { total: number; invoice_number: string }): PreviewLine[] {
  return [
    { accountCode: "4350", accountName: "Dobavljači u zemlji", debit: inv.total, credit: 0, description: `Zatvaranje obaveze - ${inv.invoice_number}` },
    { accountCode: "2410", accountName: "Tekući račun", debit: 0, credit: inv.total, description: `Isplata - ${inv.invoice_number}` },
  ];
}

/** Helper to build cash register posting preview lines */
export function buildCashPreviewLines(direction: "in" | "out", amount: number, description: string): PreviewLine[] {
  if (direction === "in") {
    return [
      { accountCode: "1000", accountName: "Blagajna", debit: amount, credit: 0, description },
      { accountCode: "6990", accountName: "Ostali prihodi", debit: 0, credit: amount, description },
    ];
  }
  return [
    { accountCode: "5790", accountName: "Ostali rashodi", debit: amount, credit: 0, description },
    { accountCode: "1000", accountName: "Blagajna", debit: 0, credit: amount, description },
  ];
}

/** Helper to build deferral recognition posting preview lines */
export function buildDeferralPreviewLines(type: "revenue" | "expense", amount: number): PreviewLine[] {
  if (type === "revenue") {
    return [
      { accountCode: "4600", accountName: "Razgraničeni prihodi", debit: amount, credit: 0, description: "Razgraničenje prihoda" },
      { accountCode: "6010", accountName: "Prihodi od prodaje", debit: 0, credit: amount, description: "Priznati prihod" },
    ];
  }
  return [
    { accountCode: "5400", accountName: "Troškovi amortizacije", debit: amount, credit: 0, description: "Priznati rashod" },
    { accountCode: "1500", accountName: "AVR - unapred plaćeni troškovi", debit: 0, credit: amount, description: "Razgraničenje rashoda" },
  ];
}
