import { useState, useCallback } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/shared/PageHeader";
import { Upload, FileText, AlertTriangle, CheckCircle, Clock, XCircle, FileUp } from "lucide-react";

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle; color: string; labelSr: string; labelEn: string }> = {
  PENDING: { icon: Clock, color: "text-yellow-500", labelSr: "Na čekanju", labelEn: "Pending" },
  PROCESSING: { icon: Clock, color: "text-blue-500", labelSr: "Obrada", labelEn: "Processing" },
  PARSED: { icon: CheckCircle, color: "text-primary", labelSr: "Obrađen", labelEn: "Parsed" },
  MATCHED: { icon: CheckCircle, color: "text-primary", labelSr: "Upareno", labelEn: "Matched" },
  ERROR: { icon: XCircle, color: "text-destructive", labelSr: "Greška", labelEn: "Error" },
  QUARANTINE: { icon: AlertTriangle, color: "text-destructive", labelSr: "Karantin", labelEn: "Quarantine" },
};

export default function BankDocumentImport() {
  const { t, locale } = useLanguage();
  const { tenantId } = useTenant();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState("all");
  const [selectedAccountId, setSelectedAccountId] = useState<string>("all");
  const [isDragOver, setIsDragOver] = useState(false);

  const isSr = locale === "sr";

  const { data: imports = [], isLoading } = useQuery({
    queryKey: ["document_imports", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("document_imports")
        .select("*, bank_accounts(bank_name, account_number)")
        .eq("tenant_id", tenantId!)
        .order("imported_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const { data: bankAccounts = [] } = useQuery({
    queryKey: ["bank_accounts", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("bank_accounts").select("id, bank_name, account_number, iban").eq("tenant_id", tenantId!).eq("is_active", true);
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const { data: csvProfiles = [] } = useQuery({
    queryKey: ["csv_import_profiles", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("csv_import_profiles").select("*, banks(name)").order("profile_name");
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const detectFormat = (filename: string): string => {
    const ext = filename.split(".").pop()?.toLowerCase();
    if (ext === "xml") return "NBS_XML";
    if (ext === "csv") return "CSV";
    if (ext === "pdf") return "PDF";
    return "CSV";
  };

  const hashFile = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
  };

  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      const results = [];
      for (const file of files) {
        const sha256 = await hashFile(file);
        const format = detectFormat(file.name);

        const { data: existing } = await supabase.from("document_imports")
          .select("id").eq("tenant_id", tenantId!).eq("sha256_hash", sha256).maybeSingle();
        if (existing) {
          toast({ title: isSr ? "Duplikat" : "Duplicate", description: file.name, variant: "destructive" });
          continue;
        }

        const { data: importRecord, error } = await supabase.from("document_imports").insert({
          tenant_id: tenantId!,
          original_filename: file.name,
          file_format: format,
          file_size_bytes: file.size,
          sha256_hash: sha256,
          status: "PENDING",
          source_type: "MANUAL_UPLOAD",
          bank_account_id: selectedAccountId !== "all" ? selectedAccountId : null,
        }).select("id").single();
        if (error) throw error;

        if (format === "NBS_XML" || format === "CAMT053" || format === "MT940") {
          try {
            const text = await file.text();
            const { data: parseResult, error: parseError } = await supabase.functions.invoke("parse-bank-xml", {
              body: { xml: text, importId: importRecord.id, tenantId: tenantId! },
            });
            if (parseError) throw parseError;
            results.push({ file: file.name, status: "parsed", transactions: parseResult?.transactions_count || 0 });
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            await supabase.from("document_imports").update({ status: "ERROR", error_message: msg }).eq("id", importRecord.id);
            results.push({ file: file.name, status: "error" });
          }
        } else {
          results.push({ file: file.name, status: "pending" });
        }
      }
      return results;
    },
    onSuccess: (results) => {
      qc.invalidateQueries({ queryKey: ["document_imports"] });
      const parsed = results.filter(r => r.status === "parsed").length;
      const pending = results.filter(r => r.status === "pending").length;
      toast({
        title: isSr ? "Uvoz završen" : "Import complete",
        description: `${parsed} ${isSr ? "obrađeno" : "parsed"}, ${pending} ${isSr ? "na čekanju" : "pending"}`,
      });
    },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter(f =>
      f.name.endsWith(".xml") || f.name.endsWith(".csv") || f.name.endsWith(".pdf")
    );
    if (files.length > 0) uploadMutation.mutate(files);
  }, [uploadMutation]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length > 0) uploadMutation.mutate(files);
    e.target.value = "";
  };

  const filtered = imports.filter(i => {
    if (tab === "quarantine") return i.status === "QUARANTINE" || i.status === "ERROR";
    if (tab === "parsed") return i.status === "PARSED" || i.status === "MATCHED";
    return true;
  });

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-40" /><Skeleton className="h-64" /></div>;

  const errorCount = imports.filter(i => i.status === "ERROR" || i.status === "QUARANTINE").length;

  return (
    <div className="space-y-6">
      <PageHeader title={isSr ? "Uvoz bankovnih dokumenata" : "Bank Document Import"} />

      <div
        onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${isDragOver ? "border-primary bg-primary/5" : "border-muted-foreground/30"}`}
      >
        <FileUp className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
        <p className="text-sm font-medium">{isSr ? "Prevucite XML, CSV ili PDF fajlove ovde" : "Drop XML, CSV, or PDF files here"}</p>
        <p className="text-xs text-muted-foreground mt-1">{isSr ? "ili kliknite da izaberete" : "or click to select"}</p>
        <div className="flex items-center justify-center gap-4 mt-4">
          <div>
            <Label>{isSr ? "Račun" : "Account"}</Label>
            <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{isSr ? "Auto-detekcija" : "Auto-detect"}</SelectItem>
                {bankAccounts.map(ba => <SelectItem key={ba.id} value={ba.id}>{ba.bank_name} — {ba.account_number}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="pt-5">
            <label>
              <input type="file" multiple accept=".xml,.csv,.pdf" className="hidden" onChange={handleFileInput} />
              <Button variant="outline" asChild><span><Upload className="h-4 w-4 mr-2" />{isSr ? "Izaberite fajlove" : "Select files"}</span></Button>
            </label>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold">{imports.length}</p><p className="text-xs text-muted-foreground">{isSr ? "Ukupno" : "Total"}</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold text-primary">{imports.filter(i => i.status === "PARSED" || i.status === "MATCHED").length}</p><p className="text-xs text-muted-foreground">{isSr ? "Obrađeno" : "Parsed"}</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold text-accent-foreground">{imports.filter(i => i.status === "PENDING").length}</p><p className="text-xs text-muted-foreground">{isSr ? "Na čekanju" : "Pending"}</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold text-destructive">{errorCount}</p><p className="text-xs text-muted-foreground">{isSr ? "Greške" : "Errors"}</p></CardContent></Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="all">{isSr ? "Svi" : "All"} ({imports.length})</TabsTrigger>
          <TabsTrigger value="parsed">{isSr ? "Obrađeni" : "Parsed"}</TabsTrigger>
          <TabsTrigger value="quarantine">{isSr ? "Karantin" : "Quarantine"} ({errorCount})</TabsTrigger>
        </TabsList>
        <TabsContent value={tab}>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{isSr ? "Fajl" : "File"}</TableHead>
                  <TableHead>{isSr ? "Format" : "Format"}</TableHead>
                  <TableHead>{isSr ? "Račun" : "Account"}</TableHead>
                  <TableHead>{isSr ? "Transakcije" : "Transactions"}</TableHead>
                  <TableHead>{isSr ? "Status" : "Status"}</TableHead>
                  <TableHead>{isSr ? "Datum" : "Date"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">{t("noResults")}</TableCell></TableRow>
                ) : filtered.map(imp => {
                  const st = STATUS_CONFIG[imp.status] || STATUS_CONFIG.PENDING;
                  const StIcon = st.icon;
                  return (
                    <TableRow key={imp.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm truncate max-w-[200px]">{imp.original_filename}</span>
                        </div>
                      </TableCell>
                      <TableCell><Badge variant="outline">{imp.file_format}</Badge></TableCell>
                      <TableCell className="text-sm">{(imp as any).bank_accounts?.bank_name || "—"}</TableCell>
                      <TableCell className="font-mono">{imp.transactions_count || 0}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <StIcon className={`h-3.5 w-3.5 ${st.color}`} />
                          <span className="text-xs">{isSr ? st.labelSr : st.labelEn}</span>
                        </div>
                        {imp.error_message && <p className="text-xs text-destructive mt-1 truncate max-w-[200px]">{imp.error_message}</p>}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(imp.imported_at).toLocaleDateString("sr-RS")}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {csvProfiles.length > 0 && (
        <div className="text-xs text-muted-foreground">
          {isSr ? "Dostupni CSV profili" : "Available CSV profiles"}: {csvProfiles.map(p => p.profile_name).join(", ")}
        </div>
      )}
    </div>
  );
}
