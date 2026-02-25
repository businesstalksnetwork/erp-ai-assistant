import { useState, useCallback, useMemo, useEffect } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, Search, Link2, Check, X, Eye, FileText, CheckCheck } from "lucide-react";
import { postWithRuleOrFallback } from "@/lib/postingHelper";
import { useDebounce } from "@/hooks/useDebounce";
import { useSearchParams } from "react-router-dom";

export default function BankStatements() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [matchDialogOpen, setMatchDialogOpen] = useState(false);
  const [selectedStatement, setSelectedStatement] = useState<any>(null);
  const [importForm, setImportForm] = useState({ bank_account_id: "", statement_date: new Date().toISOString().split("T")[0], statement_number: "" });
  const [csvData, setCsvData] = useState<string>("");
  const [matchingLine, setMatchingLine] = useState<any>(null);
  const [matchType, setMatchType] = useState<"invoice" | "supplier_invoice">("invoice");
  const [matchId, setMatchId] = useState("");
  const [lineFilter, setLineFilter] = useState<"all" | "unmatched" | "suggested" | "matched" | "posted">("all");

  // Pre-select bank account from URL query param
  useEffect(() => {
    const accountId = searchParams.get("account_id");
    if (accountId) {
      setImportForm(f => ({ ...f, bank_account_id: accountId }));
    }
  }, [searchParams]);

  // Fetch bank accounts
  const { data: bankAccounts = [] } = useQuery({
    queryKey: ["bank_accounts", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("bank_accounts").select("*").eq("tenant_id", tenantId!).eq("is_active", true);
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  // Fetch statements
  const { data: statements = [], isLoading } = useQuery({
    queryKey: ["bank_statements", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("bank_statements").select("*, bank_accounts(bank_name, account_number)").eq("tenant_id", tenantId!).order("statement_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  // Fetch statement lines for selected statement
  const { data: statementLines = [] } = useQuery({
    queryKey: ["bank_statement_lines", selectedStatement?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("bank_statement_lines").select("*, invoices(invoice_number), supplier_invoices(invoice_number)").eq("statement_id", selectedStatement!.id).order("line_date");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedStatement?.id,
  });

  // Fetch open invoices/supplier invoices for matching
  const { data: openInvoices = [] } = useQuery({
    queryKey: ["open_invoices_for_match", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("invoices").select("id, invoice_number, total, partner_name, status").eq("tenant_id", tenantId!).in("status", ["sent", "overdue"]);
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId && matchDialogOpen,
  });

  const { data: openSupplierInvoices = [] } = useQuery({
    queryKey: ["open_supplier_invoices_for_match", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("supplier_invoices").select("id, invoice_number, total, supplier_name, status").eq("tenant_id", tenantId!).in("status", ["received", "approved"]);
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId && matchDialogOpen,
  });

  // Parse CSV and import
  const importMutation = useMutation({
    mutationFn: async () => {
      if (!importForm.bank_account_id || !csvData.trim()) throw new Error("Missing data");

      const lines = csvData.trim().split("\n");
      const header = lines[0].split(",").map(h => h.trim().toLowerCase());

      // Expected CSV columns: date, description, amount, direction, partner_name, partner_account, payment_reference, payment_purpose
      const dateIdx = header.findIndex(h => h.includes("date") || h.includes("datum"));
      const descIdx = header.findIndex(h => h.includes("desc") || h.includes("opis"));
      const amountIdx = header.findIndex(h => h.includes("amount") || h.includes("iznos"));
      const dirIdx = header.findIndex(h => h.includes("direction") || h.includes("smer") || h.includes("type") || h.includes("tip"));
      const partnerIdx = header.findIndex(h => h.includes("partner") || h.includes("nalogodavac") || h.includes("primalac"));
      const accountIdx = header.findIndex(h => h.includes("account") || h.includes("racun"));
      const refIdx = header.findIndex(h => h.includes("reference") || h.includes("poziv"));
      const purposeIdx = header.findIndex(h => h.includes("purpose") || h.includes("svrha"));

      if (dateIdx === -1 || amountIdx === -1) throw new Error("CSV must have date and amount columns");

      // Create statement
      const bankAccount = bankAccounts.find(ba => ba.id === importForm.bank_account_id);
      const { data: stmt, error: stmtErr } = await supabase.from("bank_statements").insert({
        tenant_id: tenantId!,
        bank_account_id: importForm.bank_account_id,
        statement_date: importForm.statement_date,
        statement_number: importForm.statement_number || null,
        currency: bankAccount?.currency || "RSD",
        imported_by: user?.id,
      }).select("id").single();
      if (stmtErr) throw stmtErr;

      // Parse and insert lines
      const parsedLines = [];
      let totalIn = 0, totalOut = 0;
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(",").map(c => c.trim().replace(/^"|"$/g, ""));
        if (!cols[dateIdx] || !cols[amountIdx]) continue;
        const amount = Math.abs(parseFloat(cols[amountIdx].replace(/\s/g, "").replace(",", ".")));
        if (isNaN(amount) || amount === 0) continue;

        let direction = "credit";
        if (dirIdx !== -1) {
          const dirVal = cols[dirIdx]?.toLowerCase();
          direction = (dirVal.includes("debit") || dirVal.includes("rashod") || dirVal.includes("out") || dirVal.startsWith("-")) ? "debit" : "credit";
        } else {
          const rawAmt = parseFloat(cols[amountIdx].replace(/\s/g, "").replace(",", "."));
          direction = rawAmt < 0 ? "debit" : "credit";
        }

        if (direction === "credit") totalIn += amount;
        else totalOut += amount;

        parsedLines.push({
          tenant_id: tenantId!,
          statement_id: stmt.id,
          line_date: cols[dateIdx],
          description: descIdx !== -1 ? cols[descIdx] || null : null,
          amount,
          direction,
          partner_name: partnerIdx !== -1 ? cols[partnerIdx] || null : null,
          partner_account: accountIdx !== -1 ? cols[accountIdx] || null : null,
          payment_reference: refIdx !== -1 ? cols[refIdx] || null : null,
          payment_purpose: purposeIdx !== -1 ? cols[purposeIdx] || null : null,
        });
      }

      if (parsedLines.length === 0) throw new Error("No valid lines found in CSV");

      const { error: linesErr } = await supabase.from("bank_statement_lines").insert(parsedLines);
      if (linesErr) throw linesErr;

      // Update statement balances
      await supabase.from("bank_statements").update({ closing_balance: totalIn - totalOut }).eq("id", stmt.id);

      return { count: parsedLines.length };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["bank_statements"] });
      toast({ title: t("success"), description: `${data.count} ${t("bankStatementLinesImported")}` });
      setImportDialogOpen(false);
      setCsvData("");
    },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  // Enhanced auto-match with confidence scoring
  const autoMatchMutation = useMutation({
    mutationFn: async (statementId: string) => {
      const { data: lines } = await supabase.from("bank_statement_lines").select("*").eq("statement_id", statementId).eq("match_status", "unmatched");
      if (!lines?.length) return { matched: 0, total: 0 };

      // Load all open invoices and supplier invoices for matching
      const { data: invoices = [] } = await supabase.from("invoices").select("id, invoice_number, total, partner_name, due_date, status").eq("tenant_id", tenantId!).in("status", ["sent", "overdue"]);
      const { data: supplierInvoices = [] } = await supabase.from("supplier_invoices").select("id, invoice_number, total, supplier_name, due_date, status").eq("tenant_id", tenantId!).in("status", ["received", "approved"]);

      let matchCount = 0;
      for (const line of lines) {
        let bestMatch: { id: string; confidence: number; type: "invoice" | "supplier_invoice" } | null = null;

        const candidates = line.direction === "credit" ? invoices : supplierInvoices;
        for (const doc of candidates) {
          let confidence = 0;
          const docTotal = Number(doc.total);
          const lineAmt = Number(line.amount);

          // 1. Exact amount match: +40 points
          if (Math.abs(docTotal - lineAmt) < 0.01) confidence += 40;
          // Near amount match (within 1%): +20 points
          else if (Math.abs(docTotal - lineAmt) / Math.max(docTotal, 1) < 0.01) confidence += 20;
          else continue; // Skip if amount doesn't match at all

          // 2. Reference match: +40 points
          const ref = line.payment_reference?.trim() || "";
          const invNum = doc.invoice_number?.trim() || "";
          if (ref && invNum && (ref.includes(invNum) || invNum.includes(ref))) confidence += 40;
          else if (ref && invNum) {
            // Partial match
            const refDigits = ref.replace(/\D/g, "");
            const invDigits = invNum.replace(/\D/g, "");
            if (refDigits.length > 3 && invDigits.length > 3 && (refDigits.includes(invDigits) || invDigits.includes(refDigits))) confidence += 25;
          }

          // 3. Partner name match: +15 points
          const partnerName = line.partner_name?.toLowerCase() || "";
          const docPartner = ((doc as any).partner_name || (doc as any).supplier_name || "").toLowerCase();
          if (partnerName && docPartner && (partnerName.includes(docPartner) || docPartner.includes(partnerName))) confidence += 15;

          // 4. Date proximity: +5 points if within 7 days of due date
          if ((doc as any).due_date && line.line_date) {
            const daysDiff = Math.abs(new Date(line.line_date).getTime() - new Date((doc as any).due_date).getTime()) / 86400000;
            if (daysDiff <= 7) confidence += 5;
          }

          if (confidence >= 40 && (!bestMatch || confidence > bestMatch.confidence)) {
            bestMatch = { id: doc.id, confidence, type: line.direction === "credit" ? "invoice" : "supplier_invoice" };
          }
        }

        if (bestMatch) {
          const update: Record<string, any> = { match_status: bestMatch.confidence >= 70 ? "matched" : "suggested", match_confidence: bestMatch.confidence };
          if (bestMatch.type === "invoice") update.matched_invoice_id = bestMatch.id;
          else update.matched_supplier_invoice_id = bestMatch.id;
          await supabase.from("bank_statement_lines").update(update).eq("id", line.id);
          matchCount++;
        }
      }
      return { matched: matchCount, total: lines.length };
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["bank_statement_lines"] });
      toast({ title: t("autoMatchComplete"), description: `${result.matched}/${result.total} ${t("transactionsMatched")}` });
    },
  });

  // Manual match
  const manualMatchMutation = useMutation({
    mutationFn: async () => {
      if (!matchingLine || !matchId) throw new Error("Select a document");
      const update: any = { match_status: "manually_matched" };
      if (matchType === "invoice") update.matched_invoice_id = matchId;
      else update.matched_supplier_invoice_id = matchId;
      const { error } = await supabase.from("bank_statement_lines").update(update).eq("id", matchingLine.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bank_statement_lines"] });
      toast({ title: t("success") });
      setMatchDialogOpen(false);
    },
  });

  // Bulk confirm all suggested matches
  const bulkConfirmMutation = useMutation({
    mutationFn: async (statementId: string) => {
      const { data: lines } = await supabase.from("bank_statement_lines").select("id").eq("statement_id", statementId).eq("match_status", "suggested");
      if (!lines?.length) return 0;
      const { error } = await supabase.from("bank_statement_lines").update({ match_status: "matched" }).eq("statement_id", statementId).eq("match_status", "suggested");
      if (error) throw error;
      return lines.length;
    },
    onSuccess: (count) => {
      qc.invalidateQueries({ queryKey: ["bank_statement_lines"] });
      toast({ title: t("success"), description: `${count} ${t("transactionsMatched")}` });
    },
    onError: () => toast({ title: t("error"), variant: "destructive" }),
  });

  // Post matched lines as journal entries
  const postMatchedMutation = useMutation({
    mutationFn: async (statementId: string) => {
      const { data: lines } = await supabase.from("bank_statement_lines").select("*").eq("statement_id", statementId).in("match_status", ["matched", "manually_matched"]).is("journal_entry_id", null);
      if (!lines?.length) throw new Error(t("noMatchedLines"));

      let posted = 0;
      for (const line of lines) {
        try {
          // Use posting rules engine with fallback
          const modelCode = line.direction === "credit" ? "CUSTOMER_PAYMENT" : "VENDOR_PAYMENT";
          const fallbackLines = line.direction === "credit"
            ? [
                { accountCode: "2410", debit: line.amount, credit: 0, description: t("bankPayment"), sortOrder: 0 },
                { accountCode: "2040", debit: 0, credit: line.amount, description: t("bankPayment"), sortOrder: 1 },
              ]
            : [
                { accountCode: "4350", debit: line.amount, credit: 0, description: t("bankPayment"), sortOrder: 0 },
                { accountCode: "2410", debit: 0, credit: line.amount, description: t("bankPayment"), sortOrder: 1 },
              ];

          const jeId = await postWithRuleOrFallback({
            tenantId: tenantId!,
            userId: user?.id || null,
            entryDate: line.line_date,
            modelCode, amount: line.amount,
            description: `${t("bankPayment")}: ${line.description || line.partner_name || ""}`,
            reference: `BS-${line.payment_reference || line.id.slice(0, 8)}`,
            context: {
              bankAccountGlCode: "2410",
              partnerReceivableCode: "2040",
              partnerPayableCode: "4350",
            },
            fallbackLines,
          });

          await supabase.from("bank_statement_lines").update({ journal_entry_id: jeId }).eq("id", line.id);

          // Update invoice/supplier invoice status
          if (line.matched_invoice_id) {
            await supabase.from("invoices").update({ status: "paid" }).eq("id", line.matched_invoice_id);
          }
          if (line.matched_supplier_invoice_id) {
            await supabase.from("supplier_invoices").update({ status: "paid" }).eq("id", line.matched_supplier_invoice_id);
          }

          posted++;
        } catch (e) {
          console.error("Failed to post line", line.id, e);
        }
      }

      // Update statement status
      await supabase.from("bank_statements").update({ status: "reconciled" }).eq("id", statementId);
      return posted;
    },
    onSuccess: (count) => {
      qc.invalidateQueries({ queryKey: ["bank_statements"] });
      qc.invalidateQueries({ queryKey: ["bank_statement_lines"] });
      qc.invalidateQueries({ queryKey: ["journal-entries"] });
      toast({ title: t("success"), description: `${count} ${t("journalEntriesPosted")}` });
    },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const matchStatusBadge = (status: string, confidence?: number | null) => {
    if (status === "matched") return <Badge className="bg-primary text-primary-foreground">{t("matched")} {confidence ? `(${confidence}%)` : ""}</Badge>;
    if (status === "manually_matched") return <Badge variant="secondary">{t("manuallyMatched")}</Badge>;
    if (status === "suggested") return <Badge variant="outline" className="border-primary text-primary">Suggested {confidence ? `(${confidence}%)` : ""}</Badge>;
    if (status === "excluded") return <Badge variant="destructive">Excluded</Badge>;
    return <Badge variant="secondary">{t("unmatched")}</Badge>;
  };

  const txTypeBadge = (type: string | null) => {
    if (!type) return null;
    const colors: Record<string, string> = {
      WIRE: "bg-muted text-muted-foreground", FEE: "bg-destructive/10 text-destructive",
      SALARY: "bg-primary/10 text-primary", TAX: "bg-accent text-accent-foreground",
      CARD: "bg-secondary text-secondary-foreground", INTERNAL: "bg-muted text-muted-foreground",
    };
    return <Badge variant="outline" className={`text-[10px] ${colors[type] || ""}`}>{type}</Badge>;
  };

  const debouncedSearch = useDebounce(search, 300);

  const filtered = useMemo(() => statements.filter(s =>
    s.statement_number?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
    (s as any).bank_accounts?.bank_name?.toLowerCase().includes(debouncedSearch.toLowerCase())
  ), [statements, debouncedSearch]);

  const unmatchedCount = statementLines.filter(l => l.match_status === "unmatched").length;
  const matchedCount = statementLines.filter(l => ["matched", "manually_matched"].includes(l.match_status)).length;
  const postedCount = statementLines.filter(l => l.journal_entry_id).length;
  const suggestedCount = statementLines.filter(l => l.match_status === "suggested").length;

  const filteredLines = useMemo(() => {
    if (lineFilter === "all") return statementLines;
    if (lineFilter === "unmatched") return statementLines.filter(l => l.match_status === "unmatched");
    if (lineFilter === "suggested") return statementLines.filter(l => l.match_status === "suggested");
    if (lineFilter === "matched") return statementLines.filter(l => ["matched", "manually_matched"].includes(l.match_status));
    if (lineFilter === "posted") return statementLines.filter(l => l.journal_entry_id);
    return statementLines;
  }, [statementLines, lineFilter]);

  if (isLoading) return <p className="p-6">{t("loading")}</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("bankStatements")}</h1>
        <Button onClick={() => setImportDialogOpen(true)}><Upload className="h-4 w-4 mr-2" />{t("importStatement")}</Button>
      </div>

      {!selectedStatement ? (
        <>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder={t("search")} value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("statementNumber")}</TableHead>
                  <TableHead>{t("bankAccount")}</TableHead>
                  <TableHead>{t("statementDate")}</TableHead>
                  <TableHead>{t("closingBalance")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead>{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">{t("noResults")}</TableCell></TableRow>
                ) : filtered.map(s => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono">{s.statement_number || "—"}</TableCell>
                    <TableCell>{(s as any).bank_accounts?.bank_name} — {(s as any).bank_accounts?.account_number}</TableCell>
                    <TableCell>{s.statement_date}</TableCell>
                    <TableCell className="font-mono">{Number(s.closing_balance).toLocaleString("sr-RS", { minimumFractionDigits: 2 })} {s.currency}</TableCell>
                    <TableCell><Badge variant={s.status === "reconciled" ? "default" : "secondary"}>{s.status === "reconciled" ? t("bsReconciled") : s.status === "reconciling" ? t("bsReconciling") : t("bsImported")}</Badge></TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => setSelectedStatement(s)}><Eye className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      ) : (
        <>
          <Button variant="outline" onClick={() => setSelectedStatement(null)}>← {t("back")}</Button>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">{t("statementNumber")}: {selectedStatement.statement_number || "—"}</h2>
              <p className="text-sm text-muted-foreground">{selectedStatement.statement_date} — {(selectedStatement as any).bank_accounts?.bank_name}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => autoMatchMutation.mutate(selectedStatement.id)} disabled={autoMatchMutation.isPending}>
                <Link2 className="h-4 w-4 mr-2" />{t("autoMatch")}
              </Button>
              {suggestedCount > 0 && (
                <Button variant="outline" onClick={() => bulkConfirmMutation.mutate(selectedStatement.id)} disabled={bulkConfirmMutation.isPending}>
                  <CheckCheck className="h-4 w-4 mr-2" />Confirm {suggestedCount} suggested
                </Button>
              )}
              <Button onClick={() => postMatchedMutation.mutate(selectedStatement.id)} disabled={postMatchedMutation.isPending || matchedCount === 0}>
                <Check className="h-4 w-4 mr-2" />{t("postMatched")}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">{t("totalLines")}</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{statementLines.length}</p></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">{t("matched")}</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-primary">{matchedCount}</p></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Suggested</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-accent-foreground">{suggestedCount}</p></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">{t("unmatched")}</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-destructive">{unmatchedCount}</p></CardContent></Card>
          </div>

          <TabsList>
            <TabsTrigger value="all" onClick={() => setLineFilter("all")}>All ({statementLines.length})</TabsTrigger>
            <TabsTrigger value="unmatched" onClick={() => setLineFilter("unmatched")}>Unmatched ({unmatchedCount})</TabsTrigger>
            <TabsTrigger value="suggested" onClick={() => setLineFilter("suggested")}>Suggested ({suggestedCount})</TabsTrigger>
            <TabsTrigger value="matched" onClick={() => setLineFilter("matched")}>Matched ({matchedCount})</TabsTrigger>
            <TabsTrigger value="posted" onClick={() => setLineFilter("posted")}>Posted ({postedCount})</TabsTrigger>
          </TabsList>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("date")}</TableHead>
                  <TableHead>{t("description")}</TableHead>
                  <TableHead>{t("partnerName")}</TableHead>
                  <TableHead>{t("paymentReference")}</TableHead>
                  <TableHead className="text-right">{t("amount")}</TableHead>
                  <TableHead>{t("bsDirection")}</TableHead>
                  <TableHead>{t("bsMatchStatus")}</TableHead>
                  <TableHead>{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLines.map(l => (
                  <TableRow key={l.id}>
                    <TableCell>{l.line_date}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{l.description || "—"}</TableCell>
                    <TableCell>{l.partner_name || "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{l.payment_reference || "—"}</TableCell>
                    <TableCell className="text-right font-mono">{Number(l.amount).toLocaleString("sr-RS", { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell><Badge variant={l.direction === "credit" ? "default" : "destructive"}>{l.direction === "credit" ? "↓ " + t("inflow") : "↑ " + t("outflow")}</Badge></TableCell>
                    <TableCell>{matchStatusBadge(l.match_status, l.match_confidence)}</TableCell>
                    <TableCell>
                      {l.match_status === "unmatched" && !l.journal_entry_id && (
                        <Button variant="ghost" size="sm" onClick={() => { setMatchingLine(l); setMatchType(l.direction === "credit" ? "invoice" : "supplier_invoice"); setMatchId(""); setMatchDialogOpen(true); }}>
                          <Link2 className="h-3 w-3 mr-1" />{t("bsMatch")}
                        </Button>
                      )}
                      {l.journal_entry_id && <Badge variant="outline"><FileText className="h-3 w-3 mr-1" />{t("posted")}</Badge>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{t("importStatement")}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div><Label>{t("bankAccount")}</Label>
              <Select value={importForm.bank_account_id} onValueChange={v => setImportForm(f => ({ ...f, bank_account_id: v }))}>
                <SelectTrigger><SelectValue placeholder={t("selectBankAccount")} /></SelectTrigger>
                <SelectContent>
                  {bankAccounts.map(ba => <SelectItem key={ba.id} value={ba.id}>{ba.bank_name} — {ba.account_number}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>{t("statementDate")}</Label><Input type="date" value={importForm.statement_date} onChange={e => setImportForm(f => ({ ...f, statement_date: e.target.value }))} /></div>
              <div><Label>{t("statementNumber")}</Label><Input value={importForm.statement_number} onChange={e => setImportForm(f => ({ ...f, statement_number: e.target.value }))} /></div>
            </div>
            <div>
              <Label>{t("csvData")}</Label>
              <p className="text-xs text-muted-foreground mb-1">{t("csvFormatHint")}</p>
              <textarea
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono min-h-[150px]"
                value={csvData}
                onChange={e => setCsvData(e.target.value)}
                placeholder="datum,opis,iznos,smer,nalogodavac,racun,poziv,svrha&#10;2026-01-15,Uplata po fakturi,50000,credit,Firma DOO,265-1234,INV-2026-00001,Plaćanje"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialogOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => importMutation.mutate()} disabled={importMutation.isPending || !importForm.bank_account_id || !csvData.trim()}>{t("importCsv")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual Match Dialog */}
      <Dialog open={matchDialogOpen} onOpenChange={setMatchDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("manualMatch")}</DialogTitle></DialogHeader>
          {matchingLine && (
            <div className="space-y-4">
              <div className="p-3 rounded-md bg-muted text-sm">
                <p><strong>{t("amount")}:</strong> {Number(matchingLine.amount).toLocaleString("sr-RS", { minimumFractionDigits: 2 })}</p>
                <p><strong>{t("description")}:</strong> {matchingLine.description || "—"}</p>
                <p><strong>{t("paymentReference")}:</strong> {matchingLine.payment_reference || "—"}</p>
              </div>

              <Tabs value={matchType} onValueChange={v => { setMatchType(v as any); setMatchId(""); }}>
                <TabsList className="w-full">
                  <TabsTrigger value="invoice" className="flex-1">{t("invoices")}</TabsTrigger>
                  <TabsTrigger value="supplier_invoice" className="flex-1">{t("supplierInvoices")}</TabsTrigger>
                </TabsList>
                <TabsContent value="invoice">
                  <Select value={matchId} onValueChange={setMatchId}>
                    <SelectTrigger><SelectValue placeholder={t("bsSelectInvoice")} /></SelectTrigger>
                    <SelectContent>
                      {openInvoices.map(inv => (
                        <SelectItem key={inv.id} value={inv.id}>{inv.invoice_number} — {inv.partner_name} — {Number(inv.total).toLocaleString("sr-RS", { minimumFractionDigits: 2 })}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TabsContent>
                <TabsContent value="supplier_invoice">
                  <Select value={matchId} onValueChange={setMatchId}>
                    <SelectTrigger><SelectValue placeholder={t("bsSelectSupplierInvoice")} /></SelectTrigger>
                    <SelectContent>
                      {openSupplierInvoices.map(si => (
                        <SelectItem key={si.id} value={si.id}>{si.invoice_number} — {si.supplier_name} — {Number(si.total).toLocaleString("sr-RS", { minimumFractionDigits: 2 })}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TabsContent>
              </Tabs>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setMatchDialogOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => manualMatchMutation.mutate()} disabled={!matchId || manualMatchMutation.isPending}>{t("bsMatch")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
