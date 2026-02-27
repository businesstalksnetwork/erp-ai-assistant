import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, FolderOpen, Archive, BarChart3 } from "lucide-react";

export default function DocumentReportsTab() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();

  const { data: stats, isLoading } = useQuery({
    queryKey: ["document-stats", tenantId],
    queryFn: async () => {
      const [totalRes, activeRes, archivedRes, catRes] = await Promise.all([
        supabase.from("documents").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId!),
        supabase.from("documents").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId!).eq("status", "aktivan"),
        supabase.from("documents").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId!).eq("status", "arhiviran"),
        supabase.from("document_categories").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId!),
      ]);
      return {
        total: totalRes.count || 0,
        active: activeRes.count || 0,
        archived: archivedRes.count || 0,
        categories: catRes.count || 0,
      };
    },
    enabled: !!tenantId,
  });

  const { data: byCategory = [] } = useQuery({
    queryKey: ["document-by-category", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("documents")
        .select("category_id, document_categories(name_sr, code)")
        .eq("tenant_id", tenantId!);
      const counts: Record<string, { name: string; count: number }> = {};
      (data || []).forEach((d: any) => {
        const name = d.document_categories?.name_sr || "Nekategorisano";
        if (!counts[name]) counts[name] = { name, count: 0 };
        counts[name].count++;
      });
      return Object.values(counts).sort((a, b) => b.count - a.count);
    },
    enabled: !!tenantId,
  });

  if (isLoading) {
    return <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <FileText className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{stats?.total || 0}</p>
                <p className="text-sm text-muted-foreground">{t("documents")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <BarChart3 className="h-8 w-8 text-primary/80" />
              <div>
                <p className="text-2xl font-bold">{stats?.active || 0}</p>
                <p className="text-sm text-muted-foreground">Aktivni</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Archive className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{stats?.archived || 0}</p>
                <p className="text-sm text-muted-foreground">Arhivirani</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <FolderOpen className="h-8 w-8 text-primary/60" />
              <div>
                <p className="text-2xl font-bold">{stats?.categories || 0}</p>
                <p className="text-sm text-muted-foreground">Kategorije</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t("documents")} po kategoriji</CardTitle>
        </CardHeader>
        <CardContent>
          {byCategory.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">{t("noResults")}</p>
          ) : (
            <div className="space-y-3">
              {byCategory.map((cat) => (
                <div key={cat.name} className="flex items-center justify-between">
                  <span className="text-sm">{cat.name}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-32 h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.min(100, (cat.count / (stats?.total || 1)) * 100)}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium w-8 text-right">{cat.count}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
