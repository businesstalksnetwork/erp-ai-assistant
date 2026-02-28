import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Archive, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ResponsiveTable, type ResponsiveColumn } from "@/components/shared/ResponsiveTable";

export default function ReportSnapshots() {
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: snapshots = [], isLoading } = useQuery({
    queryKey: ["report-snapshots", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("report_snapshots").select("*").eq("tenant_id", tenantId!)
        .order("frozen_at", { ascending: false });
      return data || [];
    },
    enabled: !!tenantId,
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("report_snapshots").delete().eq("id", id).eq("tenant_id", tenantId!);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["report-snapshots"] }); toast({ title: t("snapshotDeleted") }); },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const typeLabel: Record<string, string> = {
    balance_sheet: "Bilans stanja",
    income_statement: "Bilans uspeha",
    trial_balance: "Bruto bilans",
    statisticki_aneks: "Statistički aneks",
  };

  const columns: ResponsiveColumn<any>[] = [
    { key: "name", label: t("name"), primary: true, sortable: true, sortValue: (s) => s.report_title || "", render: (s) => <span className="font-medium">{s.report_title}</span> },
    { key: "type", label: t("type"), sortable: true, sortValue: (s) => typeLabel[s.report_type] || s.report_type, render: (s) => <Badge variant="outline">{typeLabel[s.report_type] || s.report_type}</Badge> },
    { key: "period", label: t("period"), hideOnMobile: true, render: (s) => `${s.period_from} — ${s.period_to}` },
    { key: "date", label: t("date"), sortable: true, sortValue: (s) => s.frozen_at, render: (s) => new Date(s.frozen_at).toLocaleDateString("sr-Latn") },
    { key: "note", label: t("note"), hideOnMobile: true, render: (s) => <span className="text-muted-foreground">{s.notes || "—"}</span> },
    { key: "actions", label: "", render: (s) => (
      <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); deleteMut.mutate(s.id); }} disabled={deleteMut.isPending}>
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    )},
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("reportArchive")} icon={Archive} description={t("reportArchiveDesc")} />

      {isLoading ? <Skeleton className="h-64 w-full" /> : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <ResponsiveTable
              data={snapshots}
              columns={columns}
              keyExtractor={(s) => s.id}
              emptyMessage={t("noResults")}
              enableExport
              exportFilename="report-snapshots"
              enableColumnToggle
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
