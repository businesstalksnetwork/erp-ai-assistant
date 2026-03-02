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

  const handleExport = async () => {
    if (!tenantId) return;
    setExporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("tenant-data-export");
      if (error) throw error;

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tenant-export-${tenantId}-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);

      setLastExport(new Date().toISOString());
      toast({ title: t("success"), description: "Data export completed successfully." });
    } catch (e: any) {
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
