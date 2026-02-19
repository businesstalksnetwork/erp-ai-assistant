import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Upload, Users, Package, Contact, CheckCircle2, XCircle, Loader2,
  AlertTriangle, FileArchive, ChevronDown, ChevronUp, SkipForward,
  ArrowRight, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useTenant } from "@/hooks/useTenant";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// ─── Types ───────────────────────────────────────────────────────────────────

type Screen = "upload" | "review" | "results";
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

const TARGET_TABLES = [
  "products", "partners", "contacts", "warehouses", "employees",
  "invoices", "supplier_invoices", "purchase_orders", "sales_orders",
  "journal_entries", "chart_of_accounts",
];

const CONFIDENCE_COLORS: Record<Confidence, string> = {
  exact: "bg-primary/10 text-primary border-primary/20",
  high: "bg-green-500/10 text-green-700 border-green-500/20",
  medium: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20",
  none: "bg-muted text-muted-foreground border-border",
};

const CONFIDENCE_LABELS: Record<Confidence, string> = {
  exact: "Exact match",
  high: "High confidence",
  medium: "Medium",
  none: "Unmapped",
};

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
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<Record<string, ImportResult>>({});
  const [unmappedOpen, setUnmappedOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
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
      // 1. Create a session record
      const { data: session, error: sessionErr } = await supabase
        .from("legacy_import_sessions")
        .insert({ tenant_id: tenantId, zip_filename: zipFile.name, status: "uploading" })
        .select("id")
        .single();
      if (sessionErr) throw sessionErr;
      const sid = session.id;
      setSessionId(sid);

      // 2. Upload ZIP to storage
      setUploading(true);
      const path = `${tenantId}/upload-${Date.now()}.zip`;
      setStoragePath(path);

      // Simulate progress since supabase storage doesn't expose XHR progress
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

      // Update session
      await supabase.from("legacy_import_sessions")
        .update({ zip_storage_path: path, status: "analyzing" })
        .eq("id", sid);

      // 3. Call analyze edge function
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

      // 4. Set up file list with accepted=true for exact/high confidence non-empty files
      const analyzed: FileAnalysis[] = (data.files || []).map((f: any) => ({
        ...f,
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

  // ── Phase 2: Import ───────────────────────────────────────────────────────

  const handleImport = async () => {
    if (!tenantId || !storagePath) return;

    const confirmedMapping = files
      .filter((f) => f.accepted)
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

    try {
      setImporting(true);
      const res = await fetch(`${SUPABASE_URL}/functions/v1/import-legacy-zip`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ storagePath, tenantId, confirmedMapping, sessionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");

      setResults(data.results || {});
      setImporting(false);
      setScreen("results");
      toast.success("Import complete!");
    } catch (err: any) {
      setImporting(false);
      toast.error(`Import failed: ${err.message}`);
    }
  };

  // ── Helpers ───────────────────────────────────────────────────────────────

  const toggleAccept = (filename: string) => {
    setFiles((prev) => prev.map((f) => f.filename === filename ? { ...f, accepted: !f.accepted } : f));
  };
  const setOverride = (filename: string, target: string) => {
    setFiles((prev) => prev.map((f) => f.filename === filename ? { ...f, overrideTarget: target, accepted: true } : f));
  };

  const mappedFiles = files.filter((f) => (f.suggestedTarget || f.overrideTarget) && !f.isEmpty);
  const unmappedFiles = files.filter((f) => (!f.suggestedTarget && !f.overrideTarget) || f.isEmpty);
  const acceptedCount = files.filter((f) => f.accepted).length;

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
            <strong className="text-foreground">Two-phase pipeline.</strong> Phase 1 analyzes the ZIP and shows a mapping preview — no data is written. Phase 2 imports only after you confirm. Deduplication runs on every insert.
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
                    {uploading ? `Uploading… ${uploadProgress}%` : "Analyzing CSV files…"}
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
              <div className="flex flex-wrap gap-3 text-sm">
                <span className="font-medium text-foreground">Found {files.length} CSV files</span>
                <span className="text-primary font-medium">{mappedFiles.filter((f) => f.confidence === "exact" || f.confidence === "high").length} auto-mapped</span>
                <span className="text-yellow-700/80">{mappedFiles.filter((f) => f.confidence === "medium").length} medium confidence</span>
                <span className="text-muted-foreground">{unmappedFiles.length} unmapped/empty</span>
              </div>
              <Button variant="outline" size="sm" onClick={() => { setScreen("upload"); setFiles([]); setZipFile(null); setUploadProgress(0); }}>
                <RefreshCw className="h-4 w-4 mr-1" /> Upload different ZIP
              </Button>
            </CardContent>
          </Card>

          {/* Mapped files */}
          {mappedFiles.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                  Mapped Files ({mappedFiles.length})
                </CardTitle>
                <CardDescription>Review and confirm each mapping before import</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {mappedFiles.map((f) => (
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

          {/* Unmapped / empty */}
          {unmappedFiles.length > 0 && (
            <Collapsible open={unmappedOpen} onOpenChange={setUnmappedOpen}>
              <Card>
                <CollapsibleTrigger asChild>
                  <CardHeader className="pb-3 cursor-pointer hover:bg-muted/30 transition-colors rounded-t-lg">
                    <CardTitle className="text-base flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <XCircle className="h-5 w-5 text-muted-foreground" />
                        Unmapped / Empty ({unmappedFiles.length})
                      </span>
                      {unmappedOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </CardTitle>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="p-0">
                    <div className="divide-y divide-border">
                      {unmappedFiles.map((f) => (
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

          {/* Import button */}
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">{acceptedCount} file{acceptedCount !== 1 ? "s" : ""} selected for import</p>
            <Button
              size="lg"
              onClick={handleImport}
              disabled={acceptedCount === 0 || importing}
            >
              {importing ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Importing…</>
              ) : (
                <><Upload className="h-4 w-4 mr-2" />Run Import for {acceptedCount} file{acceptedCount !== 1 ? "s" : ""}</>
              )}
            </Button>
          </div>
        </div>
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
              <CardDescription>{Object.keys(results).length} file{Object.keys(results).length !== 1 ? "s" : ""} processed</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {Object.entries(results).map(([filename, result]) => (
                <ResultRow key={filename} filename={filename} result={result} />
              ))}
            </CardContent>
          </Card>

          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => { setScreen("upload"); setFiles([]); setZipFile(null); setResults({}); setUploadProgress(0); }}>
              <Upload className="h-4 w-4 mr-2" /> Import Another ZIP
            </Button>
            <Button onClick={() => setScreen("review")}>
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

// ─── FileRow Component ────────────────────────────────────────────────────────

function FileRow({ file, onToggleAccept, onSetOverride }: {
  file: FileAnalysis;
  onToggleAccept: () => void;
  onSetOverride: (target: string) => void;
}) {
  const effectiveTarget = file.overrideTarget || file.suggestedTarget;

  return (
    <div className={`px-4 py-3 flex items-center gap-3 flex-wrap transition-colors ${file.accepted ? "bg-primary/3" : "opacity-60"}`}>
      {/* Accept/skip toggle */}
      <button
        onClick={onToggleAccept}
        className={`shrink-0 rounded-full p-1 transition-colors ${file.accepted ? "text-primary hover:bg-primary/10" : "text-muted-foreground hover:bg-muted"}`}
        title={file.accepted ? "Click to skip" : "Click to include"}
      >
        {file.accepted ? <CheckCircle2 className="h-5 w-5" /> : <SkipForward className="h-5 w-5" />}
      </button>

      {/* Filename */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{file.filename}</p>
        <p className="text-xs text-muted-foreground">
          {file.isEmpty ? "empty" : `${file.rowCount.toLocaleString()} rows`}
          {file.headers.length > 0 && ` · ${file.headers.slice(0, 4).join(", ")}${file.headers.length > 4 ? "…" : ""}`}
        </p>
      </div>

      {/* Confidence badge */}
      <Badge variant="outline" className={`text-xs shrink-0 ${CONFIDENCE_COLORS[file.confidence]}`}>
        {CONFIDENCE_LABELS[file.confidence]}
      </Badge>

      {/* Target table selector */}
      <div className="flex items-center gap-2 shrink-0">
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
        <Select
          value={effectiveTarget || ""}
          onValueChange={onSetOverride}
        >
          <SelectTrigger className="w-44 h-8 text-xs">
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
}

// ─── ResultRow Component ──────────────────────────────────────────────────────

function ResultRow({ filename, result }: { filename: string; result: ImportResult }) {
  const hasErrors = result.errors.length > 0;
  const [errOpen, setErrOpen] = useState(false);

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-3 flex-wrap text-sm py-1">
        {hasErrors ? (
          <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
        ) : (
          <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
        )}
        <span className="font-medium text-foreground flex-1 min-w-0 truncate">{filename}</span>
        <span className="text-primary font-medium">✓ {result.inserted.toLocaleString()} inserted</span>
        <span className="text-muted-foreground">{result.skipped.toLocaleString()} skipped</span>
        {hasErrors && (
          <button
            onClick={() => setErrOpen((o) => !o)}
            className="text-destructive hover:underline text-xs"
          >
            {result.errors.length} error{result.errors.length !== 1 ? "s" : ""} {errOpen ? "▲" : "▼"}
          </button>
        )}
      </div>
      {errOpen && (
        <div className="ml-7 text-xs text-destructive bg-destructive/5 rounded p-2 space-y-1">
          {result.errors.slice(0, 10).map((e, i) => <p key={i}>{e}</p>)}
          {result.errors.length > 10 && <p>…and {result.errors.length - 10} more</p>}
        </div>
      )}
    </div>
  );
}

// ─── Individual Imports (legacy fallback) ─────────────────────────────────────

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

function IndividualImports() {
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
}
