import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, FileText, FolderOpen } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function DocumentBrowserTab() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  const { data: categories = [] } = useQuery({
    queryKey: ["document_categories", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("document_categories").select("*").eq("tenant_id", tenantId!).order("sort_order");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["documents-browser", tenantId, categoryFilter],
    queryFn: async () => {
      let q = supabase.from("documents")
        .select("*, document_categories(code, name_sr)")
        .eq("tenant_id", tenantId!)
        .eq("status", "aktivan")
        .order("created_at", { ascending: false })
        .limit(100);
      if (categoryFilter) q = q.eq("category_id", categoryFilter);
      const { data } = await q;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const filtered = docs.filter((d: any) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return `${d.subject || ""} ${d.name || ""} ${d.protocol_number || ""}`.toLowerCase().includes(s);
  });

  const grouped = filtered.reduce((acc: Record<string, any[]>, doc: any) => {
    const cat = doc.document_categories?.name_sr || "Nekategorisano";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(doc);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder={t("dmsSearchPlaceholder")} value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={categoryFilter || "__all__"} onValueChange={v => setCategoryFilter(v === "__all__" ? "" : v)}>
          <SelectTrigger className="w-48"><SelectValue placeholder={t("dmsAllCategories")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t("dmsAllCategories")}</SelectItem>
            {categories.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.code} - {c.name_sr}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
      ) : Object.keys(grouped).length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">{t("noResults")}</CardContent></Card>
      ) : (
        Object.entries(grouped).map(([category, categoryDocs]) => (
          <Card key={category}>
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <FolderOpen className="h-4 w-4" />
                {category}
                <Badge variant="secondary" className="ml-auto">{(categoryDocs as any[]).length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-1">
                {(categoryDocs as any[]).map((doc: any) => (
                  <div
                    key={doc.id}
                    className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/documents/${doc.id}`)}
                  >
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{doc.subject || doc.name}</p>
                      <p className="text-xs text-muted-foreground">{doc.protocol_number}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">{new Date(doc.created_at).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
