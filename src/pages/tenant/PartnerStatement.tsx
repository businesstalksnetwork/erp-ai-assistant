import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useLanguage } from "@/i18n/LanguageContext";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ExportButton } from "@/components/ExportButton";
import type { CsvColumn } from "@/lib/exportCsv";

// CR4-10: Correctly compute debit/credit based on document_type and direction
function computeDebitCredit(item: any): { debit: number; credit: number } {
  const amount = Number(item.original_amount);
  const docType = (item.document_type || "").toLowerCase();
  const isCreditNote = docType.includes("credit_note") || docType.includes("creditnote") || docType === "cn";
  const isDebitNote = docType.includes("debit_note") || docType.includes("debitnote") || docType === "dn";

  if (isCreditNote) {
    // Credit notes reverse the normal direction
    return item.direction === "receivable"
      ? { debit: 0, credit: amount }
      : { debit: amount, credit: 0 };
  }
  if (isDebitNote) {
    // Debit notes follow normal direction
    return item.direction === "receivable"
      ? { debit: amount, credit: 0 }
      : { debit: 0, credit: amount };
  }
  // Standard invoices / payments
  return item.direction === "receivable"
    ? { debit: amount, credit: 0 }
    : { debit: 0, credit: amount };
}

interface StatementLine {
  date: string;
  document: string;
  debit: number;
  credit: number;
  balance: number;
}

export default function PartnerStatement() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const currentYear = new Date().getFullYear();
  const [selectedPartner, setSelectedPartner] = useState("");
  const [dateFrom, setDateFrom] = useState(`${currentYear}-01-01`);
  const [dateTo, setDateTo] = useState(`${currentYear}-12-31`);

  const { data: partners = [] } = useQuery({
    queryKey: ["partners-list", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase
        .from("partners")
        .select("id, name, type")
        .eq("tenant_id", tenantId)
        .order("name");
      return data || [];
    },
    enabled: !!tenantId,
  });

  // CR4-09: Fetch opening balance (all items before dateFrom)
  const { data: openingItems = [] } = useQuery({
    queryKey: ["partner-opening-balance", tenantId, selectedPartner, dateFrom],
    queryFn: async () => {
      if (!tenantId || !selectedPartner || !dateFrom) return [];
      const { data } = await supabase
        .from("open_items")
        .select("original_amount, direction, document_type")
        .eq("tenant_id", tenantId)
        .eq("partner_id", selectedPartner)
        .lt("document_date", dateFrom);
      return data || [];
    },
    enabled: !!tenantId && !!selectedPartner && !!dateFrom,
  });

  const openingBalance = useMemo(() => {
    let bal = 0;
    for (const item of openingItems as any[]) {
      const { debit, credit } = computeDebitCredit(item);
      bal += debit - credit;
    }
    return bal;
  }, [openingItems]);

  const { data: openItems = [], isLoading } = useQuery({
    queryKey: ["partner-statement", tenantId, selectedPartner, dateFrom, dateTo],
    queryFn: async () => {
      if (!tenantId || !selectedPartner) return [];
      const { data, error } = await supabase
        .from("open_items")
        .select("document_date, document_number, document_type, original_amount, direction, status")
        .eq("tenant_id", tenantId)
        .eq("partner_id", selectedPartner)
        .gte("document_date", dateFrom)
        .lte("document_date", dateTo)
        .order("document_date", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId && !!selectedPartner,
  });

  const statementLines = useMemo<StatementLine[]>(() => {
    let balance = openingBalance;
    return openItems.map((item: any) => {
      // CR4-10: Handle credit/debit note direction correctly
      const { debit, credit } = computeDebitCredit(item);
      balance += debit - credit;
      return {
        date: item.document_date,
        document: `${item.document_type || ""} ${item.document_number || ""}`.trim(),
        debit,
        credit,
        balance,
      };
    });
  }, [openItems, openingBalance]);

  const csvColumns: CsvColumn<StatementLine>[] = [
    { key: "date", label: t("date") },
    { key: "document", label: t("documentNumber") },
    { key: "debit", label: t("debit"), formatter: (v) => Number(v).toFixed(2) },
    { key: "credit", label: t("credit"), formatter: (v) => Number(v).toFixed(2) },
    { key: "balance", label: t("balance"), formatter: (v) => Number(v).toFixed(2) },
  ];

  const partnerName = partners.find((p: any) => p.id === selectedPartner)?.name || "";

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader title="Kartica partnera" description="Hronološki pregled svih transakcija sa partnerom" />

      <div className="flex flex-col sm:flex-row gap-4 items-end flex-wrap">
        <div className="min-w-[240px]">
          <Label>{t("selectPartner")}</Label>
          <Select value={selectedPartner} onValueChange={setSelectedPartner}>
            <SelectTrigger><SelectValue placeholder={t("selectPartner")} /></SelectTrigger>
            <SelectContent>
              {partners.map((p: any) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Od</Label>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40" />
        </div>
        <div>
          <Label>Do</Label>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40" />
        </div>
        {statementLines.length > 0 && (
          <ExportButton data={statementLines} columns={csvColumns} filename={`kartica_${partnerName}`} />
        )}
      </div>

      {!selectedPartner && (
        <Card><CardContent className="p-8 text-center text-muted-foreground">Izaberite partnera za prikaz kartice</CardContent></Card>
      )}

      {selectedPartner && statementLines.length === 0 && !isLoading && (
        <Card><CardContent className="p-8 text-center text-muted-foreground">Nema transakcija za izabrani period</CardContent></Card>
      )}

      {statementLines.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("date")}</TableHead>
                  <TableHead>{t("documentNumber")}</TableHead>
                  <TableHead className="text-right">{t("debit")}</TableHead>
                  <TableHead className="text-right">{t("credit")}</TableHead>
                  <TableHead className="text-right">{t("balance")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* CR4-09: Opening balance row */}
                {openingBalance !== 0 && (
                  <TableRow className="bg-muted/30">
                    <TableCell className="font-medium italic">{dateFrom}</TableCell>
                    <TableCell className="font-medium italic">Početno stanje</TableCell>
                    <TableCell className="text-right tabular-nums">{openingBalance > 0 ? openingBalance.toLocaleString("sr-RS", { minimumFractionDigits: 2 }) : ""}</TableCell>
                    <TableCell className="text-right tabular-nums">{openingBalance < 0 ? Math.abs(openingBalance).toLocaleString("sr-RS", { minimumFractionDigits: 2 }) : ""}</TableCell>
                    <TableCell className={`text-right tabular-nums font-semibold ${openingBalance < 0 ? "text-destructive" : ""}`}>
                      {openingBalance.toLocaleString("sr-RS", { minimumFractionDigits: 2 })}
                    </TableCell>
                  </TableRow>
                )}
                {statementLines.map((line, i) => (
                  <TableRow key={i}>
                    <TableCell>{new Date(line.date).toLocaleDateString("sr-Latn-RS")}</TableCell>
                    <TableCell>{line.document}</TableCell>
                    <TableCell className="text-right tabular-nums">{line.debit ? line.debit.toLocaleString("sr-RS", { minimumFractionDigits: 2 }) : ""}</TableCell>
                    <TableCell className="text-right tabular-nums">{line.credit ? line.credit.toLocaleString("sr-RS", { minimumFractionDigits: 2 }) : ""}</TableCell>
                    <TableCell className={`text-right tabular-nums font-semibold ${line.balance < 0 ? "text-destructive" : ""}`}>
                      {line.balance.toLocaleString("sr-RS", { minimumFractionDigits: 2 })}
                    </TableCell>
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
