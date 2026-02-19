import { useState, useCallback, useRef, memo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import {
  Upload, Users, Package, Contact, CheckCircle2, XCircle, Loader2,
  AlertTriangle, FileArchive, ChevronDown, ChevronUp, SkipForward,
  ArrowRight, RefreshCw, Search, Info,
} from "lucide-react";
import { toast } from "sonner";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useTenant } from "@/hooks/useTenant";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// ─── Types ────────────────────────────────────────────────────────────────────

type Screen = "upload" | "review" | "importing" | "results";
type Confidence = "exact" | "high" | "medium" | "none";

interface FileAnalysis {
  filename: string;
  fullPath: string;
  rowCount: number;
  headers: string[];
  sampleRows: string[][];
  suggestedTarget: string | null;
  confidence: Confidence;
  dedupField: string;
  humanLabel: string;
  isEmpty: boolean;
  parseError?: string;
  // UI state
  accepted: boolean;
  overrideTarget?: string;
}

interface ImportResult {
  inserted: number;
  skipped: number;
  errors: string[];
}

interface ProgressEntry {
  filename: string;
  targetTable: string;
  status: "pending" | "running" | "done" | "error";
  result?: ImportResult;
  error?: string;
}

const TARGET_TABLES = [
  "products", "partners", "contacts", "warehouses", "employees",
  "invoices", "supplier_invoices", "purchase_orders", "sales_orders",
  "journal_entries", "chart_of_accounts", "bank_statements",
  "goods_receipts", "retail_prices", "locations", "cost_centers",
  "departments", "payroll_runs", "employee_contracts", "tax_rates",
  "fixed_assets", "inventory_movements", "leads",
];

const CONFIDENCE_COLORS: Record<Confidence, string> = {
  exact: "bg-primary/10 text-primary border-primary/20",
  high: "bg-green-500/10 text-green-700 border-green-500/20",
  medium: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20",
  none: "bg-muted text-muted-foreground border-border",
};

const CONFIDENCE_LABELS: Record<Confidence, string> = {
  exact: "Exact",
  high: "High",
  medium: "Medium",
  none: "Unmapped",
};

// ─── FileRow — defined BEFORE default export to avoid React ref warnings ───────

const FileRow = memo(function FileRow({ file, onToggleAccept, onSetOverride }: {
  file: FileAnalysis;
  onToggleAccept: () => void;
  onSetOverride: (target: string) => void;
}) {
  const effectiveTarget = file.overrideTarget || file.suggestedTarget;

  return (
    <div className={`px-4 py-3 flex items-center gap-3 flex-wrap transition-colors ${file.accepted ? "bg-primary/5" : "opacity-60"}`}>
      {/* Accept/skip toggle */}
      <button
        onClick={onToggleAccept}
        className={`shrink-0 rounded-full p-1 transition-colors ${file.accepted ? "text-primary hover:bg-primary/10" : "text-muted-foreground hover:bg-muted"}`}
        title={file.accepted ? "Click to skip" : "Click to include"}
      >
        {file.accepted ? <CheckCircle2 className="h-5 w-5" /> : <SkipForward className="h-5 w-5" />}
      </button>

      {/* Filename + meta */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{file.filename}</p>
        <p className="text-xs text-muted-foreground">
          {file.isEmpty ? "empty" : `${file.rowCount.toLocaleString()} rows`}
          {file.headers.length > 0 && ` · ${file.headers.slice(0, 4).join(", ")}${file.headers.length > 4 ? "…" : ""}`}
        </p>
      </div>

      {/* Confidence badge + tooltip */}
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className={`text-xs shrink-0 cursor-help gap-1 ${CONFIDENCE_COLORS[file.confidence]}`}>
              {CONFIDENCE_LABELS[file.confidence]}
              <Info className="h-3 w-3 opacity-60" />
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs text-xs">{file.humanLabel || "No mapping reason available"}</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Target table selector */}
      <div className="flex items-center gap-2 shrink-0">
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
        <Select value={effectiveTarget || ""} onValueChange={onSetOverride}>
          <SelectTrigger className="w-48 h-8 text-xs">
            <SelectValue placeholder="Select target table…" />
          </SelectTrigger>
          <SelectContent>
            {TARGET_TABLES.map((t) => (
              <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
});

// ─── ResultRow — defined BEFORE default export ─────────────────────────────────

const ResultRow = memo(function ResultRow({ entry }: { entry: ProgressEntry }) {
  const [errOpen, setErrOpen] = useState(false);
  const result = entry.result;
  const hasErrors = (result?.errors?.length ?? 0) > 0;

  return (
    <div className="space-y-1 py-2">
      <div className="flex items-center gap-3 flex-wrap text-sm">
        {entry.status === "running" && <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />}
        {entry.status === "done" && !hasErrors && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
        {(entry.status === "done" && hasErrors) && <AlertTriangle className="h-4 w-4 text-warning shrink-0" />}
        {entry.status === "error" && <XCircle className="h-4 w-4 text-destructive shrink-0" />}
        {entry.status === "pending" && <div className="h-4 w-4 rounded-full border-2 border-border shrink-0" />}

        <span className="font-medium text-foreground flex-1 min-w-0 truncate">{entry.filename}</span>
        <span className="text-xs text-muted-foreground">→ {entry.targetTable}</span>

        {entry.status === "running" && <span className="text-xs text-muted-foreground italic">importing…</span>}
        {entry.status === "pending" && <span className="text-xs text-muted-foreground italic">waiting…</span>}
        {result && (
          <>
            <span className="text-primary font-medium text-xs">✓ {result.inserted.toLocaleString()} inserted</span>
            <span className="text-muted-foreground text-xs">{result.skipped.toLocaleString()} skipped</span>
          </>
        )}
        {entry.status === "error" && <span className="text-destructive text-xs">{entry.error}</span>}
        {hasErrors && (
          <button onClick={() => setErrOpen((o) => !o)} className="text-destructive hover:underline text-xs">
            {result!.errors.length} error{result!.errors.length !== 1 ? "s" : ""} {errOpen ? "▲" : "▼"}
          </button>
        )}
      </div>
      {errOpen && result && (
        <div className="ml-7 text-xs text-destructive bg-destructive/5 rounded p-2 space-y-1">
          {result.errors.slice(0, 10).map((e, i) => <p key={i}>{e}</p>)}
          {result.errors.length > 10 && <p>…and {result.errors.length - 10} more</p>}
        </div>
      )}
    </div>
  );
});

// ─── IndividualImports ─────────────────────────────────────────────────────────

type IndividualStatus = "idle" | "uploading" | "importing" | "done" | "error";

interface ImportTask {
  key: "products" | "partners" | "contacts";
  label: string;
  description: string;
  icon: React.ElementType;
  csvFilename: string;
  functionName: string;
}

const IMPORT_TASKS: ImportTask[] = [
  { key: "products", label: "Products / Articles", description: "dbo.A_UnosPodataka.csv", icon: Package, csvFilename: "dbo.A_UnosPodataka.csv", functionName: "import-legacy-products" },
  { key: "partners", label: "Partners / Customers", description: "dbo.A_UnosPodataka_Partner.csv", icon: Users, csvFilename: "dbo.A_UnosPodataka_Partner.csv", functionName: "import-legacy-partners" },
  { key: "contacts", label: "Contact Persons", description: "dbo.A_aPodaci.csv", icon: Contact, csvFilename: "dbo.A_aPodaci.csv", functionName: "import-legacy-contacts" },
];

const IndividualImports = memo(function IndividualImports() {
  const [statuses, setStatuses] = useState<Record<string, IndividualStatus>>({});
  const [results, setResults] = useState<Record<string, { inserted: number; skipped: number; errors: string[] }>>({});
  const [files, setFiles] = useState<Record<string, File>>({});

  const setStatus = (key: string, s: IndividualStatus) => setStatuses((p) => ({ ...p, [key]: s }));
  const setResult = (key: string, r: any) => setResults((p) => ({ ...p, [key]: r }));

  const runImport = async (task: ImportTask) => {
    const file = files[task.key];
    if (!file) { toast.error("Please select the CSV file first"); return; }
    try {
      setStatus(task.key, "uploading");
      const { error: uploadError } = await supabase.storage.from("legacy-imports").upload(task.csvFilename, file, { upsert: true });
      if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);
      setStatus(task.key, "importing");
      const res = await fetch(`${SUPABASE_URL}/functions/v1/${task.functionName}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");
      setResult(task.key, data);
      setStatus(task.key, "done");
      toast.success(`${task.label}: ${data.inserted} inserted, ${data.skipped} skipped`);
    } catch (err: any) {
      setStatus(task.key, "error");
      toast.error(`${task.label} import failed: ${err.message}`);
    }
  };

  return (
    <div className="mt-3 space-y-3">
      {IMPORT_TASKS.map((task) => {
        const status = statuses[task.key] || "idle";
        const result = results[task.key];
        const file = files[task.key];
        const Icon = task.icon;
        return (
          <Card key={task.key} className="bg-muted/30">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-3">
                <Icon className="h-5 w-5 text-primary shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium">{task.label}</p>
                  <p className="text-xs text-muted-foreground">{task.description}</p>
                </div>
                {status === "done" && <Badge className="bg-primary text-xs"><CheckCircle2 className="h-3 w-3 mr-1" />Done</Badge>}
                {status === "error" && <Badge variant="destructive" className="text-xs"><XCircle className="h-3 w-3 mr-1" />Error</Badge>}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <label className="cursor-pointer">
                  <input type="file" accept=".csv" className="hidden" onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setFiles((p) => ({ ...p, [task.key]: f }));
                  }} />
                  <Button variant="outline" size="sm" asChild>
                    <span><Upload className="h-3 w-3 mr-1" />{file ? file.name : `Select ${task.csvFilename}`}</span>
                  </Button>
                </label>
                <Button size="sm" onClick={() => runImport(task)} disabled={!file || status === "uploading" || status === "importing"}>
                  {(status === "uploading" || status === "importing") && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                  {status === "uploading" ? "Uploading…" : status === "importing" ? "Importing…" : "Run Import"}
                </Button>
              </div>
              {result && (
                <div className="flex gap-4 text-xs bg-background rounded px-3 py-2">
                  <span className="text-primary font-medium">✓ {result.inserted} inserted</span>
                  <span className="text-muted-foreground">{result.skipped} skipped</span>
                  {result.errors.length > 0 && <span className="text-destructive">{result.errors.length} errors</span>}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
});

// ─── Main Component ───────────────────────────────────────────────────────────

export default function LegacyImport() {
  const { tenantId } = useTenant();
  const [screen, setScreen] = useState<Screen>("upload");
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [files, setFiles] = useState<FileAnalysis[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [storagePath, setStoragePath] = useState<string | null>(null);
  const [progressEntries, setProgressEntries] = useState<ProgressEntry[]>([]);
  const [importDoneCount, setImportDoneCount] = useState(0);
  const [unmappedOpen, setUnmappedOpen] = useState(false);
  const [emptyOpen, setEmptyOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── File drop/select ──────────────────────────────────────────────────────

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f && f.name.endsWith(".zip")) setZipFile(f);
    else toast.error("Please drop a .zip file");
  }, []);

  // ── Phase 1: Upload + Analyze ─────────────────────────────────────────────

  const handleAnalyze = async () => {
    if (!zipFile) return;
    if (!tenantId) { toast.error("No tenant selected"); return; }

    try {
      const { data: session, error: sessionErr } = await supabase
        .from("legacy_import_sessions")
        .insert({ tenant_id: tenantId, zip_filename: zipFile.name, status: "uploading" })
        .select("id")
        .single();
      if (sessionErr) throw sessionErr;
      const sid = session.id;
      setSessionId(sid);

      setUploading(true);
      const path = `${tenantId}/upload-${Date.now()}.zip`;
      setStoragePath(path);

      const progressInterval = setInterval(() => {
        setUploadProgress((p) => Math.min(p + 5, 85));
      }, 300);

      const { error: uploadErr } = await supabase.storage
        .from("legacy-imports")
        .upload(path, zipFile, { upsert: true });
      clearInterval(progressInterval);
      setUploadProgress(100);
      if (uploadErr) throw uploadErr;
      setUploading(false);

      await supabase.from("legacy_import_sessions")
        .update({ zip_storage_path: path, status: "analyzing" })
        .eq("id", sid);

      setAnalyzing(true);
      const res = await fetch(`${SUPABASE_URL}/functions/v1/analyze-legacy-zip`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ storagePath: path, sessionId: sid }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analysis failed");

      const analyzed: FileAnalysis[] = (data.files || []).map((f: any) => ({
        ...f,
        humanLabel: f.humanLabel || "",
        // Auto-accept exact/high confidence non-empty files; never accept empty files
        accepted: (f.confidence === "exact" || f.confidence === "high") && !f.isEmpty,
      }));

      setFiles(analyzed);
      setAnalyzing(false);
      setScreen("review");
      toast.success(`Analyzed ${data.totalCsvFiles} CSV files`);
    } catch (err: any) {
      setUploading(false);
      setAnalyzing(false);
      toast.error(`Analysis failed: ${err.message}`);
    }
  };

  // ── Phase 2: Progressive file-by-file import ──────────────────────────────

  const handleImport = async () => {
    if (!tenantId || !storagePath) return;

    const confirmedMapping = files
      .filter((f) => f.accepted && !f.isEmpty)
      .map((f) => ({
        filename: f.filename,
        fullPath: f.fullPath,
        targetTable: f.overrideTarget || f.suggestedTarget,
      }))
      .filter((m) => m.targetTable);

    if (confirmedMapping.length === 0) {
      toast.error("No files selected for import");
      return;
    }

    // Set up progress tracker
    const entries: ProgressEntry[] = confirmedMapping.map((m) => ({
      filename: m.filename,
      targetTable: m.targetTable!,
      status: "pending",
    }));
    setProgressEntries(entries);
    setImportDoneCount(0);
    setScreen("importing");

    // Process one at a time
    for (let i = 0; i < confirmedMapping.length; i++) {
      const mapping = confirmedMapping[i];

      setProgressEntries((prev) =>
        prev.map((e, idx) => idx === i ? { ...e, status: "running" } : e)
      );

      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/import-legacy-zip`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            storagePath,
            tenantId,
            confirmedMapping: [mapping],
            sessionId,
          }),
        });
        const data = await res.json();

        if (!res.ok) {
          setProgressEntries((prev) =>
            prev.map((e, idx) => idx === i ? { ...e, status: "error", error: data.error || "Import failed" } : e)
          );
        } else {
          const result: ImportResult = data.results?.[mapping.filename] || { inserted: 0, skipped: 0, errors: [] };
          setProgressEntries((prev) =>
            prev.map((e, idx) => idx === i ? { ...e, status: "done", result } : e)
          );
        }
      } catch (err: any) {
        setProgressEntries((prev) =>
          prev.map((e, idx) => idx === i ? { ...e, status: "error", error: err.message } : e)
        );
      }

      setImportDoneCount(i + 1);
    }

    setScreen("results");
    toast.success("Import complete!");
  };

  // ── Helpers ───────────────────────────────────────────────────────────────

  const toggleAccept = useCallback((filename: string) => {
    setFiles((prev) => prev.map((f) => f.filename === filename ? { ...f, accepted: !f.accepted } : f));
  }, []);

  const setOverride = useCallback((filename: string, target: string) => {
    setFiles((prev) => prev.map((f) => f.filename === filename ? { ...f, overrideTarget: target, accepted: true } : f));
  }, []);

  // Categorize files
  const emptyFiles = files.filter((f) => f.isEmpty);
  const nonEmptyFiles = files.filter((f) => !f.isEmpty);
  const mappedFiles = nonEmptyFiles.filter((f) => f.suggestedTarget || f.overrideTarget);
  const unmappedFiles = nonEmptyFiles.filter((f) => !f.suggestedTarget && !f.overrideTarget);
  const acceptedCount = files.filter((f) => f.accepted && !f.isEmpty).length;

  const autoMappedCount = mappedFiles.filter((f) => f.confidence === "exact" || f.confidence === "high").length;
  const mediumCount = mappedFiles.filter((f) => f.confidence === "medium").length;

  // Search filter for mapped files
  const q = searchQuery.toLowerCase();
  const filteredMapped = mappedFiles.filter((f) =>
    !q || f.filename.toLowerCase().includes(q) || (f.suggestedTarget || "").includes(q)
  );
  const filteredUnmapped = unmappedFiles.filter((f) =>
    !q || f.filename.toLowerCase().includes(q)
  );

  const resetAll = () => {
    setScreen("upload");
    setFiles([]);
    setZipFile(null);
    setUploadProgress(0);
    setProgressEntries([]);
    setImportDoneCount(0);
    setSearchQuery("");
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <PageHeader
        title="Legacy Data Import"
        icon={FileArchive}
        description="Upload a ZIP archive with CSV exports — the system maps each file to a system table for your review before importing"
      />

      <Card className="border-warning/30 bg-warning/5">
        <CardContent className="flex items-start gap-3 py-4">
          <AlertTriangle className="h-5 w-5 text-warning mt-0.5 shrink-0" />
          <div className="text-sm text-muted-foreground">
            <strong className="text-foreground">Two-phase pipeline.</strong> Phase 1 analyzes the ZIP and shows a mapping preview — no data is written. Phase 2 imports one file at a time with live progress. Deduplication runs on every insert.
          </div>
        </CardContent>
      </Card>

      {/* ── SCREEN 1: Upload ── */}
      {screen === "upload" && (
        <Card>
          <CardHeader>
            <CardTitle>Upload ZIP Archive</CardTitle>
            <CardDescription>Drop your legacy export ZIP — up to 500 MB, containing any number of CSV files</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors cursor-pointer
                ${dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30"}
                ${zipFile ? "border-primary/50 bg-primary/5" : ""}`}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".zip"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setZipFile(f);
                }}
              />
              <FileArchive className={`h-12 w-12 mx-auto mb-3 ${zipFile ? "text-primary" : "text-muted-foreground"}`} />
              {zipFile ? (
                <div>
                  <p className="font-medium text-foreground">{zipFile.name}</p>
                  <p className="text-sm text-muted-foreground mt-1">{(zipFile.size / 1024 / 1024).toFixed(1)} MB</p>
                </div>
              ) : (
                <div>
                  <p className="font-medium text-muted-foreground">Drop your .zip file here or click to select</p>
                  <p className="text-sm text-muted-foreground mt-1">Supports up to 500 MB</p>
                </div>
              )}
            </div>

            {(uploading || analyzing) && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {uploading ? `Uploading… ${uploadProgress}%` : "Analyzing CSV files — inspecting headers and matching patterns…"}
                  </span>
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                </div>
                {uploading && <Progress value={uploadProgress} className="h-2" />}
              </div>
            )}

            <Button
              size="lg"
              className="w-full"
              onClick={handleAnalyze}
              disabled={!zipFile || uploading || analyzing}
            >
              {uploading || analyzing ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{uploading ? "Uploading…" : "Analyzing…"}</>
              ) : (
                <><ArrowRight className="h-4 w-4 mr-2" />Analyze ZIP</>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── SCREEN 2: Mapping Review ── */}
      {screen === "review" && (
        <div className="space-y-4">
          {/* Summary bar */}
          <Card>
            <CardContent className="py-4 flex flex-wrap gap-4 items-center justify-between">
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm items-center">
                <span className="font-medium text-foreground">{files.length} CSV files found</span>
                <span className="text-primary font-medium">{autoMappedCount} auto-mapped</span>
                <span className="text-yellow-700/80">{mediumCount} medium confidence</span>
                <span className="text-muted-foreground">{unmappedFiles.length} unmapped</span>
                <span className="text-muted-foreground">{emptyFiles.length} empty (auto-skipped)</span>
              </div>
              <Button variant="outline" size="sm" onClick={resetAll}>
                <RefreshCw className="h-4 w-4 mr-1" /> Upload different ZIP
              </Button>
            </CardContent>
          </Card>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search files by name or target table…"
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Mapped files */}
          {filteredMapped.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                  Mapped Files ({filteredMapped.length}{q ? ` of ${mappedFiles.length}` : ""})
                </CardTitle>
                <CardDescription>Hover the confidence badge to see why each file was mapped. Toggle ✓/→ to include/skip.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {filteredMapped.map((f) => (
                    <FileRow
                      key={f.filename}
                      file={f}
                      onToggleAccept={() => toggleAccept(f.filename)}
                      onSetOverride={(t) => setOverride(f.filename, t)}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Unmapped files */}
          {filteredUnmapped.length > 0 && (
            <Collapsible open={unmappedOpen} onOpenChange={setUnmappedOpen}>
              <Card>
                <CollapsibleTrigger className="w-full text-left">
                  <CardHeader className="pb-3 cursor-pointer hover:bg-muted/30 transition-colors rounded-t-lg">
                    <CardTitle className="text-base flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-warning" />
                        Unmapped ({filteredUnmapped.length}) — needs manual assignment
                      </span>
                      {unmappedOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </CardTitle>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="p-0">
                    <div className="divide-y divide-border">
                      {filteredUnmapped.map((f) => (
                        <FileRow
                          key={f.filename}
                          file={f}
                          onToggleAccept={() => toggleAccept(f.filename)}
                          onSetOverride={(t) => setOverride(f.filename, t)}
                        />
                      ))}
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          )}

          {/* Empty files — always auto-skipped, just show a count */}
          {emptyFiles.length > 0 && !q && (
            <Collapsible open={emptyOpen} onOpenChange={setEmptyOpen}>
              <CollapsibleTrigger className="w-full">
                <div className="flex items-center justify-between text-sm text-muted-foreground px-1 py-1 hover:text-foreground transition-colors cursor-pointer">
                  <span className="flex items-center gap-2">
                    <XCircle className="h-4 w-4" />
                    {emptyFiles.length} empty files — automatically skipped
                  </span>
                  {emptyOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-1 text-xs text-muted-foreground bg-muted/30 rounded-lg p-3 space-y-0.5 max-h-48 overflow-y-auto">
                  {emptyFiles.map((f) => (
                    <p key={f.filename} className="font-mono">{f.filename}</p>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Import button */}
          <div className="flex justify-between items-center pt-2">
            <p className="text-sm text-muted-foreground">
              {acceptedCount} file{acceptedCount !== 1 ? "s" : ""} selected for import
            </p>
            <Button
              size="lg"
              onClick={handleImport}
              disabled={acceptedCount === 0}
            >
              <Upload className="h-4 w-4 mr-2" />
              Run Import for {acceptedCount} file{acceptedCount !== 1 ? "s" : ""}
            </Button>
          </div>
        </div>
      )}

      {/* ── SCREEN: Importing (live progress) ── */}
      {screen === "importing" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              Importing… ({importDoneCount} of {progressEntries.length})
            </CardTitle>
            <CardDescription>Files are imported one at a time — even if one fails, others continue</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            <Progress value={(importDoneCount / progressEntries.length) * 100} className="h-2 mb-4" />
            <div className="divide-y divide-border">
              {progressEntries.map((entry, i) => (
                <ResultRow key={i} entry={entry} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── SCREEN 3: Results ── */}
      {screen === "results" && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-6 w-6 text-primary" />
                Import Complete
              </CardTitle>
              <CardDescription>
                {progressEntries.filter((e) => e.status === "done").length} succeeded ·{" "}
                {progressEntries.filter((e) => e.status === "error").length} failed ·{" "}
                {progressEntries.reduce((sum, e) => sum + (e.result?.inserted ?? 0), 0).toLocaleString()} total rows inserted
              </CardDescription>
            </CardHeader>
            <CardContent className="divide-y divide-border">
              {progressEntries.map((entry, i) => (
                <ResultRow key={i} entry={entry} />
              ))}
            </CardContent>
          </Card>

          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={resetAll}>
              <Upload className="h-4 w-4 mr-2" /> Import Another ZIP
            </Button>
            <Button variant="outline" onClick={() => setScreen("review")}>
              Back to Mapping
            </Button>
          </div>
        </div>
      )}

      {/* ── Advanced / individual imports ── */}
      <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between text-muted-foreground" size="sm">
            Advanced: Individual CSV imports
            {advancedOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <IndividualImports />
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
