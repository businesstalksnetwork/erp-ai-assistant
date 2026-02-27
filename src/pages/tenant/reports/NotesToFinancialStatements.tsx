import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useLegalEntities } from "@/hooks/useLegalEntities";
import { useLanguage } from "@/i18n/LanguageContext";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PrintButton } from "@/components/PrintButton";
import { ExportButton } from "@/components/ExportButton";
import { FileText, Download, Plus, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { fmtNum } from "@/lib/utils";

interface NoteSection {
  id: string;
  title: string;
  content: string;
  auto?: boolean;
}

const DEFAULT_NOTES: NoteSection[] = [
  { id: "1", title: "1. Opšte informacije / General Information", content: "", auto: false },
  { id: "2", title: "2. Osnove za sastavljanje / Basis of Preparation", content: "Finansijski izveštaji su sastavljeni u skladu sa Zakonom o računovodstvu Republike Srbije i Međunarodnim standardima finansijskog izveštavanja (MSFI/IFRS).\n\nThe financial statements have been prepared in accordance with the Accounting Law of the Republic of Serbia and International Financial Reporting Standards (IFRS).", auto: false },
  { id: "3", title: "3. Računovodstvene politike / Accounting Policies", content: "Priznavanje prihoda: Prihodi se priznaju u skladu sa IFRS 15.\nOsnovna sredstva: Amortizacija se obračunava pravolinijskim metodom.\nZalihe: Vrednovanje po metodi FIFO.\nPotraživanja: Obezvrenjenje u skladu sa IFRS 9.", auto: false },
  { id: "4", title: "4. Prihodi od prodaje / Revenue", content: "", auto: true },
  { id: "5", title: "5. Troškovi materijala / Material Costs", content: "", auto: true },
  { id: "6", title: "6. Troškovi zarada / Employee Costs", content: "", auto: true },
  { id: "7", title: "7. Amortizacija / Depreciation", content: "", auto: true },
  { id: "8", title: "8. Osnovna sredstva / Property, Plant & Equipment", content: "", auto: true },
  { id: "9", title: "9. Potraživanja / Trade Receivables", content: "", auto: true },
  { id: "10", title: "10. Obaveze / Trade Payables", content: "", auto: true },
  { id: "11", title: "11. Krediti / Borrowings", content: "", auto: true },
  { id: "12", title: "12. Povezana lica / Related Party Transactions", content: "", auto: true },
  { id: "13", title: "13. Porezi / Tax", content: "", auto: false },
  { id: "14", title: "14. Događaji posle datuma bilansa / Events After Reporting Date", content: "Nema značajnih događaja posle datuma bilansa.\nNo significant events after the reporting date.", auto: false },
];

export default function NotesToFinancialStatements() {
  const { tenantId } = useTenant();
  const { t, locale } = useLanguage();
  const { entities: legalEntities } = useLegalEntities();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(String(currentYear));
  const [selectedEntity, setSelectedEntity] = useState("all");
  const [notes, setNotes] = useState<NoteSection[]>(DEFAULT_NOTES);

  // Auto-populate data from GL
  const { data: glData, isLoading } = useQuery({
    queryKey: ["notes-fs-gl", tenantId, year, selectedEntity],
    queryFn: async () => {
      if (!tenantId) return null;
      let q = supabase
        .from("journal_lines")
        .select(`
          debit, credit,
          account:account_id(code, name, account_class),
          journal_entry:journal_entry_id(entry_date, status, tenant_id, legal_entity_id)
        `)
        .eq("journal_entry.tenant_id", tenantId)
        .eq("journal_entry.status", "posted")
        .gte("journal_entry.entry_date", `${year}-01-01`)
        .lte("journal_entry.entry_date", `${year}-12-31`);
      if (selectedEntity !== "all") {
        q = q.eq("journal_entry.legal_entity_id", selectedEntity);
      }
      const { data } = await q;
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Additional queries for auto-sections
  const { data: assetCount = 0 } = useQuery({
    queryKey: ["notes-fs-assets", tenantId, year],
    queryFn: async () => {
      const { count } = await supabase.from("assets").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId!).eq("status", "active");
      return count || 0;
    },
    enabled: !!tenantId,
  });

  const { data: loanData } = useQuery({
    queryKey: ["notes-fs-loans", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("loans").select("principal_amount, status").eq("tenant_id", tenantId!).eq("status", "active");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: icData } = useQuery({
    queryKey: ["notes-fs-ic", tenantId, year],
    queryFn: async () => {
      const { data } = await supabase.from("intercompany_transactions").select("amount, status").eq("tenant_id", tenantId!).gte("transaction_date", `${year}-01-01`).lte("transaction_date", `${year}-12-31`);
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Compute auto-content
  const autoContent = useMemo(() => {
    const result: Record<string, string> = {};
    if (!glData) return result;

    const byClass: Record<string, number> = {};
    for (const line of glData) {
      const acc = (line as any).account;
      if (!acc?.code) continue;
      const cls = acc.code.substring(0, 2);
      if (!byClass[cls]) byClass[cls] = 0;
      byClass[cls] += Number((line as any).debit || 0) - Number((line as any).credit || 0);
    }

    // Revenue (class 6x) - credit normal
    const rev60 = -(byClass["60"] || 0);
    const rev61 = -(byClass["61"] || 0);
    result["4"] = `Prihodi od prodaje proizvoda i usluga: ${fmtNum(rev60)} RSD\nOstali poslovni prihodi: ${fmtNum(rev61)} RSD\nUkupno prihodi: ${fmtNum(rev60 + rev61)} RSD`;

    // Material costs (51x)
    const mat51 = byClass["51"] || 0;
    result["5"] = `Troškovi materijala: ${fmtNum(mat51)} RSD`;

    // Employee costs (52x)
    const emp52 = byClass["52"] || 0;
    result["6"] = `Troškovi zarada, naknada i ostalih ličnih rashoda: ${fmtNum(emp52)} RSD`;

    // Depreciation (54x)
    const dep54 = byClass["54"] || 0;
    result["7"] = `Troškovi amortizacije: ${fmtNum(dep54)} RSD`;

    // Assets
    result["8"] = `Broj aktivnih osnovnih sredstava: ${assetCount}`;

    // Receivables (class 20-24)
    const recv = (byClass["20"] || 0) + (byClass["21"] || 0) + (byClass["22"] || 0) + (byClass["23"] || 0) + (byClass["24"] || 0);
    result["9"] = `Kratkoročna potraživanja (ukupno): ${fmtNum(recv)} RSD`;

    // Payables (class 43-44)
    const pay = -((byClass["43"] || 0) + (byClass["44"] || 0));
    result["10"] = `Kratkoročne obaveze (ukupno): ${fmtNum(pay)} RSD`;

    // Loans
    const totalLoans = (loanData || []).reduce((s: number, l: any) => s + Number(l.principal_amount || 0), 0);
    const activeCount = (loanData || []).length;
    result["11"] = `Aktivni krediti: ${activeCount}\nUkupan iznos glavnice: ${fmtNum(totalLoans)} RSD`;

    // IC transactions
    const icTotal = (icData || []).reduce((s: number, t: any) => s + Number(t.amount || 0), 0);
    result["12"] = icTotal > 0
      ? `Transakcije sa povezanim licima u ${year}: ${fmtNum(icTotal)} RSD`
      : `Nema značajnih transakcija sa povezanim licima u ${year}.`;

    return result;
  }, [glData, assetCount, loanData, icData, year]);

  const updateNote = (id: string, field: "title" | "content", value: string) => {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, [field]: value } : n));
  };

  const addNote = () => {
    const nextNum = notes.length + 1;
    setNotes(prev => [...prev, {
      id: String(Date.now()),
      title: `${nextNum}. Nova napomena / New Note`,
      content: "",
      auto: false,
    }]);
  };

  const removeNote = (id: string) => {
    setNotes(prev => prev.filter(n => n.id !== id));
  };

  const exportNotes = () => {
    const text = notes.map(n => {
      const content = n.auto ? (autoContent[n.id] || n.content) : n.content;
      return `${n.title}\n${"=".repeat(n.title.length)}\n${content}\n`;
    }).join("\n\n");

    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `napomene_uz_fi_${year}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const entityLabel = selectedEntity === "all"
    ? (locale === "sr" ? "Sva pravna lica" : "All legal entities")
    : legalEntities.find(e => e.id === selectedEntity)?.name || selectedEntity;

  return (
    <div className="space-y-6">
      <PageHeader
        title={locale === "sr" ? "Napomene uz finansijske izveštaje" : "Notes to Financial Statements"}
        icon={FileText}
        description={locale === "sr" ? "Generisanje napomena uz bilans stanja i bilans uspeha prema IAS 1" : "Generate disclosure notes per IAS 1 for financial statements"}
      />

      <div className="flex flex-col sm:flex-row gap-4 items-end print:hidden">
        <div>
          <Label>{locale === "sr" ? "Godina" : "Year"}</Label>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[currentYear, currentYear - 1, currentYear - 2].map(y => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>{locale === "sr" ? "Pravno lice" : "Legal Entity"}</Label>
          <Select value={selectedEntity} onValueChange={setSelectedEntity}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{locale === "sr" ? "Sva" : "All"}</SelectItem>
              {legalEntities.map(e => (
                <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportNotes}><Download className="h-4 w-4 mr-2" /> {locale === "sr" ? "Preuzmi .txt" : "Export .txt"}</Button>
          <PrintButton />
          <Button onClick={addNote}><Plus className="h-4 w-4 mr-2" /> {locale === "sr" ? "Dodaj napomenu" : "Add Note"}</Button>
        </div>
      </div>

      {/* Print header */}
      <div className="hidden print:block text-center space-y-2">
        <h1 className="text-xl font-bold">{locale === "sr" ? "NAPOMENE UZ FINANSIJSKE IZVEŠTAJE" : "NOTES TO THE FINANCIAL STATEMENTS"}</h1>
        <p className="text-sm">{locale === "sr" ? `Za godinu završenu` : `For the year ended`} 31.12.{year}</p>
        <p className="text-sm text-muted-foreground">{entityLabel}</p>
      </div>

      {isLoading ? (
        <Skeleton className="h-96" />
      ) : (
        <div className="space-y-4">
          {notes.map(note => {
            const content = note.auto ? (autoContent[note.id] || note.content) : note.content;
            return (
              <Card key={note.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <Input
                      value={note.title}
                      onChange={e => updateNote(note.id, "title", e.target.value)}
                      className="font-semibold text-base border-none p-0 h-auto shadow-none print:hidden"
                    />
                    <h3 className="hidden print:block font-bold text-base">{note.title}</h3>
                    <div className="flex items-center gap-2 print:hidden">
                      {note.auto && <Badge variant="secondary" className="text-xs">{locale === "sr" ? "Auto" : "Auto"}</Badge>}
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeNote(note.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {note.auto ? (
                    <div className="whitespace-pre-wrap text-sm text-foreground/80">{content || <span className="text-muted-foreground italic">{locale === "sr" ? "Nema podataka" : "No data"}</span>}</div>
                  ) : (
                    <>
                      <Textarea
                        value={content}
                        onChange={e => updateNote(note.id, "content", e.target.value)}
                        rows={4}
                        className="print:hidden"
                        placeholder={locale === "sr" ? "Unesite tekst napomene..." : "Enter note text..."}
                      />
                      <div className="hidden print:block whitespace-pre-wrap text-sm">{content}</div>
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
