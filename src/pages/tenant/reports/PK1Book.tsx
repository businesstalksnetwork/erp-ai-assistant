import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useLanguage } from "@/i18n/LanguageContext";
import { useLegalEntities } from "@/hooks/useLegalEntities";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DownloadPdfButton } from "@/components/DownloadPdfButton";
import { BookText } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";

export default function PK1Book() {
  const { tenantId } = useTenant();
  const { t } = useLanguage();
  const { entities } = useLegalEntities();
  const today = new Date();
  const [dateFrom, setDateFrom] = useState(format(startOfMonth(today), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(endOfMonth(today), "yyyy-MM-dd"));
  const [legalEntityId, setLegalEntityId] = useState<string>("all");
  const tl = (key: string) => (t as any)(key) || key;

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["pk1_book", tenantId, dateFrom, dateTo, legalEntityId],
    queryFn: async () => {
      if (!tenantId) return [];
      let q = supabase
        .from("cash_register")
        .select("*")
        .eq("tenant_id", tenantId)
        .gte("entry_date", dateFrom)
        .lte("entry_date", dateTo)
        .order("entry_date", { ascending: true })
        .order("entry_number", { ascending: true });
      if (legalEntityId !== "all") q = q.eq("legal_entity_id", legalEntityId);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const rows = useMemo(() => {
    let balance = 0;
    return entries.map((e: any, i: number) => {
      const primanja = e.direction === "in" ? Number(e.amount) : 0;
      const izdavanja = e.direction === "out" ? Number(e.amount) : 0;
      balance += primanja - izdavanja;
      return { rb: i + 1, datum: e.entry_date, opis: e.description, primanja, izdavanja, saldo: balance, entry_number: e.entry_number };
    });
  }, [entries]);

  const totalPrimanja = rows.reduce((s, r) => s + r.primanja, 0);
  const totalIzdavanja = rows.reduce((s, r) => s + r.izdavanja, 0);

  const fmtNum = (n: number) => n.toLocaleString("sr-RS", { minimumFractionDigits: 2 });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <BookText className="h-7 w-7 text-primary" />
        <h1 className="text-2xl font-bold">{tl("pk1Book")}</h1>
      </div>

      <div className="flex flex-wrap gap-4 items-end">
        <div>
          <Label>{tl("dateFrom")}</Label>
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-[170px]" />
        </div>
        <div>
          <Label>{tl("dateTo")}</Label>
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-[170px]" />
        </div>
        <div>
          <Label>{t("legalEntity")}</Label>
          <Select value={legalEntityId} onValueChange={setLegalEntityId}>
            <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("all")}</SelectItem>
              {entities.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <DownloadPdfButton type="pk1-book" params={{ tenantId, dateFrom, dateTo, legalEntityId: legalEntityId === "all" ? undefined : legalEntityId }} />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px]">Rb</TableHead>
                <TableHead>Datum</TableHead>
                <TableHead>Broj</TableHead>
                <TableHead>Opis</TableHead>
                <TableHead className="text-right">Primanja</TableHead>
                <TableHead className="text-right">Izdavanja</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8">{t("loading")}...</TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">{t("noDataToExport")}</TableCell></TableRow>
              ) : rows.map(r => (
                <TableRow key={r.rb}>
                  <TableCell className="font-mono">{r.rb}</TableCell>
                  <TableCell>{format(new Date(r.datum), "dd.MM.yyyy")}</TableCell>
                  <TableCell className="font-mono">{r.entry_number}</TableCell>
                  <TableCell>{r.opis}</TableCell>
                  <TableCell className="text-right font-mono">{r.primanja > 0 ? fmtNum(r.primanja) : ""}</TableCell>
                  <TableCell className="text-right font-mono">{r.izdavanja > 0 ? fmtNum(r.izdavanja) : ""}</TableCell>
                  <TableCell className="text-right font-mono font-semibold">{fmtNum(r.saldo)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            {rows.length > 0 && (
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={4} className="text-right font-bold">{t("total")}:</TableCell>
                  <TableCell className="text-right font-mono font-bold">{fmtNum(totalPrimanja)}</TableCell>
                  <TableCell className="text-right font-mono font-bold">{fmtNum(totalIzdavanja)}</TableCell>
                  <TableCell className="text-right font-mono font-bold">{fmtNum(totalPrimanja - totalIzdavanja)}</TableCell>
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
