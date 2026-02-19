import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, Users, Package, Contact, CheckCircle2, XCircle, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

type ImportResult = {
  inserted: number;
  skipped: number;
  errors: string[];
};

type ImportStatus = "idle" | "uploading" | "importing" | "done" | "error";

interface ImportTask {
  key: "products" | "partners" | "contacts";
  label: string;
  description: string;
  icon: React.ElementType;
  csvFilename: string;
  functionName: string;
  expectedCount: number;
}

const IMPORT_TASKS: ImportTask[] = [
  {
    key: "products",
    label: "Products / Articles",
    description: "3,729 products from dbo.A_UnosPodataka.csv",
    icon: Package,
    csvFilename: "dbo.A_UnosPodataka.csv",
    functionName: "import-legacy-products",
    expectedCount: 3729,
  },
  {
    key: "partners",
    label: "Partners / Customers",
    description: "9,785 partners from dbo.A_UnosPodataka_Partner.csv",
    icon: Users,
    csvFilename: "dbo.A_UnosPodataka_Partner.csv",
    functionName: "import-legacy-partners",
    expectedCount: 9785,
  },
  {
    key: "contacts",
    label: "Contact Persons",
    description: "293 contacts from dbo.A_aPodaci.csv",
    icon: Contact,
    csvFilename: "dbo.A_aPodaci.csv",
    functionName: "import-legacy-contacts",
    expectedCount: 293,
  },
];

export default function LegacyImport() {
  const [statuses, setStatuses] = useState<Record<string, ImportStatus>>({});
  const [results, setResults] = useState<Record<string, ImportResult>>({});
  const [files, setFiles] = useState<Record<string, File>>({});

  const setStatus = (key: string, status: ImportStatus) =>
    setStatuses((prev) => ({ ...prev, [key]: status }));

  const setResult = (key: string, result: ImportResult) =>
    setResults((prev) => ({ ...prev, [key]: result }));

  const handleFileSelect = (key: string, file: File) => {
    setFiles((prev) => ({ ...prev, [key]: file }));
    setStatus(key, "idle");
  };

  const runImport = async (task: ImportTask) => {
    const file = files[task.key];
    if (!file) {
      toast.error("Please select the CSV file first");
      return;
    }

    try {
      // Step 1: Upload CSV to storage
      setStatus(task.key, "uploading");
      const { error: uploadError } = await supabase.storage
        .from("legacy-imports")
        .upload(task.csvFilename, file, { upsert: true });

      if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

      // Step 2: Invoke edge function
      setStatus(task.key, "importing");
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/${task.functionName}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
        }
      );

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

  const runAll = async () => {
    for (const task of IMPORT_TASKS) {
      if (files[task.key]) {
        await runImport(task);
      }
    }
  };

  const allFilesSelected = IMPORT_TASKS.every((t) => files[t.key]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Legacy Data Import"
        icon={Upload}
        description="One-time import of legacy SQL Server data into the Uniprom tenant"
      />

      <Card className="border-warning/30 bg-warning/5">
        <CardContent className="flex items-start gap-3 py-4">
          <AlertTriangle className="h-5 w-5 text-warning mt-0.5 shrink-0" />
          <div className="text-sm text-muted-foreground">
            <strong className="text-foreground">One-time migration tool.</strong> Each import
            deduplicates by PIB / SKU / email to prevent double inserts. Upload the original CSV
            files exported from SQL Server, then run each import. This targets tenant{" "}
            <code className="bg-muted px-1 rounded text-xs">7774c25d…</code> (Uniprom).
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {IMPORT_TASKS.map((task) => {
          const status = statuses[task.key] || "idle";
          const result = results[task.key];
          const file = files[task.key];
          const Icon = task.icon;

          return (
            <Card key={task.key}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Icon className="h-5 w-5 text-primary" />
                    <div>
                      <CardTitle className="text-base">{task.label}</CardTitle>
                      <CardDescription>{task.description}</CardDescription>
                    </div>
                  </div>
                  <StatusBadge status={status} />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept=".csv"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleFileSelect(task.key, f);
                      }}
                    />
                    <Button variant="outline" size="sm" asChild>
                      <span>
                        <Upload className="h-4 w-4 mr-2" />
                        {file ? file.name : `Select ${task.csvFilename}`}
                      </span>
                    </Button>
                  </label>

                  <Button
                    size="sm"
                    onClick={() => runImport(task)}
                    disabled={!file || status === "uploading" || status === "importing"}
                  >
                    {status === "uploading" || status === "importing" ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : null}
                    {status === "uploading"
                      ? "Uploading…"
                      : status === "importing"
                      ? "Importing…"
                      : "Run Import"}
                  </Button>
                </div>

                {result && (
                  <div className="flex items-center gap-4 text-sm rounded-md bg-muted px-3 py-2">
                    <span className="text-primary font-medium">✓ {result.inserted} inserted</span>
                    <span className="text-muted-foreground">{result.skipped} skipped</span>
                    {result.errors.length > 0 && (
                      <span className="text-destructive">{result.errors.length} errors</span>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex justify-end">
        <Button
          size="lg"
          onClick={runAll}
          disabled={
            !allFilesSelected ||
            Object.values(statuses).some(
              (s) => s === "uploading" || s === "importing"
            )
          }
        >
          <Upload className="h-4 w-4 mr-2" />
          Run All Imports
        </Button>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: ImportStatus }) {
  if (status === "idle") return null;
  if (status === "uploading")
    return <Badge variant="secondary"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Uploading</Badge>;
  if (status === "importing")
    return <Badge variant="secondary"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Importing</Badge>;
  if (status === "done")
    return <Badge className="bg-primary"><CheckCircle2 className="h-3 w-3 mr-1" />Done</Badge>;
  if (status === "error")
    return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Error</Badge>;
  return null;
}
