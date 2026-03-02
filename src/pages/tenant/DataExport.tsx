import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Download, Shield, Database, Clock } from "lucide-react";

export default function DataExport() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { toast } = useToast();
  const [exporting, setExporting] = useState(false);
  const [lastExport, setLastExport] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  const handleExport = async () => {
    if (!tenantId) return;
    setExporting(true);
    setProgress("Starting export...");

    try {
      // Paginated export: loop until no next_cursor remains
      let allData: Record<string, any[]> = {};
      let cursor: string | undefined;
      let page = 0;

      do {
        page++;
        setProgress(`Fetching page ${page}...`);

        const body: Record<string, any> = {};
        if (cursor) {
          body.cursor = JSON.parse(atob(cursor));
        }

        const { data, error } = await supabase.functions.invoke("tenant-data-export", { body });
        if (error) throw error;

        // Merge table data
        const tables = data.tables || {};
        for (const [table, rows] of Object.entries(tables)) {
          if (!allData[table]) allData[table] = [];
          allData[table].push(...(rows as any[]));
        }

        cursor = data.truncated ? data.next_cursor : undefined;
      } while (cursor);

      // Build final export payload
      const exportPayload = {
        export_version: "1.1",
        exported_at: new Date().toISOString(),
        tenant_id: tenantId,
        tables: allData,
        row_counts: Object.fromEntries(Object.entries(allData).map(([k, v]) => [k, v.length])),
        total_pages: page,
      };

      const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tenant-export-${tenantId}-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);

      setLastExport(new Date().toISOString());
      setProgress(null);
      toast({ title: t("success"), description: `Data export completed (${page} page${page > 1 ? "s" : ""}).` });
    } catch (e: any) {
      setProgress(null);
      toast({ title: t("error"), description: e.message, variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{"Data Export"}</h1>
        <p className="text-sm text-muted-foreground">
          ISO 22301 — Export all tenant data for business continuity and portability.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Database className="h-4 w-4 text-primary" />
              {"Export Format"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="secondary">JSON</Badge>
            <p className="text-xs text-muted-foreground mt-1">Complete structured export</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              {"Compliance"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge>ISO 22301</Badge>
            <p className="text-xs text-muted-foreground mt-1">Business continuity standard</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              {"Last Export"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-medium">
              {lastExport ? new Date(lastExport).toLocaleString() : "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{"Export All Data"}</CardTitle>
          <CardDescription>
            Downloads partners, invoices, products, journal entries, employees, contacts, and more as a single JSON file.
            {progress && <span className="ml-2 text-primary font-medium">{progress}</span>}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleExport} disabled={exporting} size="lg">
            <Download className="h-4 w-4 mr-2" />
            {exporting ? "Exporting..." : "Download Export"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
