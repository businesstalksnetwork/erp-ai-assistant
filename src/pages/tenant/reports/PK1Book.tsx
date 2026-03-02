import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useLanguage } from "@/i18n/LanguageContext";
import { useLegalEntities } from "@/hooks/useLegalEntities";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TableRow, TableCell } from "@/components/ui/table";
import { DownloadPdfButton } from "@/components/DownloadPdfButton";
import { BookText } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { PageHeader } from "@/components/shared/PageHeader";
import { MobileFilterBar } from "@/components/shared/MobileFilterBar";
import { ResponsiveTable, type ResponsiveColumn } from "@/components/shared/ResponsiveTable";

interface PK1Row {
  rb: number;
  datum: string;
  entry_number: string;
  opis: string;
  primanja: number;
  izdavanja: number;
  saldo: number;
}

export default function PK1Book() {
  const { tenantId } = useTenant();
  const { t } = useLanguage();
  const { entities } = useLegalEntities();
  const today = new Date();
  const [dateFrom, setDateFrom] = useState(format(startOfMonth(today), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(endOfMonth(today), "yyyy-MM-dd"));
  const [legalEntityId, setLegalEntityId] = useState<string>("all");
  const tl = (key: string) => t(key) || key;

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

  const columns: ResponsiveColumn<PK1Row>[] = [
    { key: "rb", label: "Rb", render: (r) => <span className="font-mono">{r.rb}</span>, sortable: true, sortValue: (r) => r.rb },
    { key: "datum", label: "Datum", render: (r) => format(new Date(r.datum), "dd.MM.yyyy"), sortable: true, sortValue: (r) => r.datum },
    { key: "entry_number", label: "Broj", render: (r) => <span className="font-mono">{r.entry_number}</span> },
    { key: "opis", label: "Opis", primary: true, render: (r) => r.opis },
    { key: "primanja", label: "Primanja", align: "right", sortable: true, sortValue: (r) => r.primanja, render: (r) => <span className="font-mono">{r.primanja > 0 ? fmtNum(r.primanja) : ""}</span> },
    { key: "izdavanja", label: "Izdavanja", align: "right", sortable: true, sortValue: (r) => r.izdavanja, render: (r) => <span className="font-mono">{r.izdavanja > 0 ? fmtNum(r.izdavanja) : ""}</span> },
    { key: "saldo", label: "Saldo", align: "right", render: (r) => <span className="font-mono font-semibold">{fmtNum(r.saldo)}</span> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={tl("pk1Book")} icon={BookText} actions={
        <DownloadPdfButton type="pk1-book" params={{ tenantId, dateFrom, dateTo, legalEntityId: legalEntityId === "all" ? undefined : legalEntityId }} />
      } />

      <MobileFilterBar
        filters={
          <>
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
          </>
        }
      />

      <ResponsiveTable
        data={rows}
        columns={columns}
        keyExtractor={(r) => String(r.rb)}
        emptyMessage={t("noDataToExport")}
        enableExport
        exportFilename="pk1_book"
        renderFooter={rows.length > 0 ? () => (
          <TableRow>
            <TableCell colSpan={4} className="text-right font-bold">{t("total")}:</TableCell>
            <TableCell className="text-right font-mono font-bold">{fmtNum(totalPrimanja)}</TableCell>
            <TableCell className="text-right font-mono font-bold">{fmtNum(totalIzdavanja)}</TableCell>
            <TableCell className="text-right font-mono font-bold">{fmtNum(totalPrimanja - totalIzdavanja)}</TableCell>
          </TableRow>
        ) : undefined}
      />
    </div>
  );
}
