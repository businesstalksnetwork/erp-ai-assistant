import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { Search, FolderOpen, FileText, Download, Eye, Grid, List } from "lucide-react";

export default function DocumentBrowser() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"tree" | "grid">("tree");
  const [expandedYear, setExpandedYear] = useState<number | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const { data: docs = [] } = useQuery({
    queryKey: ["documents_browser", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase.from("documents")
        .select("*, document_categories(code, name_sr)")
        .eq("tenant_id", tenantId).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!tenantId,
  });

  const filtered = docs.filter((d: any) => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return `${d.protocol_number || ""} ${d.subject || ""} ${d.name || ""} ${d.file_path || ""}`.toLowerCase().includes(s);
  });

  // Group by year -> category
  const grouped = filtered.reduce((acc: any, d: any) => {
    const year = new Date(d.created_at).getFullYear();
    const catCode = d.document_categories?.code || "misc";
    const catName = d.document_categories?.name_sr || "Ostalo";
    if (!acc[year]) acc[year] = {};
    if (!acc[year][catCode]) acc[year][catCode] = { name: catName, docs: [] };
    acc[year][catCode].docs.push(d);
    return acc;
  }, {});

  const years = Object.keys(grouped).sort((a, b) => Number(b) - Number(a));

  const handlePreview = async (doc: any) => {
    const { data } = await supabase.storage.from("tenant-documents").createSignedUrl(doc.file_path, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const handleDownload = async (doc: any) => {
    const { data } = await supabase.storage.from("tenant-documents").download(doc.file_path);
    if (data) {
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url; a.download = doc.name; a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("dmsBrowser")}</h1>
          <p className="text-muted-foreground text-sm">{t("dmsBrowserDesc")}</p>
        </div>
        <div className="flex gap-1">
          <Button variant={viewMode === "tree" ? "default" : "outline"} size="sm" onClick={() => setViewMode("tree")}><List className="h-4 w-4" /></Button>
          <Button variant={viewMode === "grid" ? "default" : "outline"} size="sm" onClick={() => setViewMode("grid")}><Grid className="h-4 w-4" /></Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder={t("dmsSearchPlaceholder")} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
      </div>

      {viewMode === "tree" ? (
        <div className="space-y-2">
          {years.map(year => (
            <div key={year}>
              <Button variant="ghost" className="w-full justify-start gap-2 font-bold" onClick={() => setExpandedYear(expandedYear === Number(year) ? null : Number(year))}>
                <FolderOpen className="h-4 w-4 text-primary" />
                {year} ({Object.values(grouped[year] as Record<string, { docs: any[] }>).reduce((sum, c) => sum + c.docs.length, 0)})
              </Button>
              {expandedYear === Number(year) && (
                <div className="ml-6 space-y-1">
                  {Object.entries(grouped[year] as Record<string, { name: string; docs: any[] }>).map(([code, cat]) => (
                    <div key={code}>
                      <Button variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={() => setExpandedCategory(expandedCategory === `${year}-${code}` ? null : `${year}-${code}`)}>
                        <FolderOpen className="h-3 w-3 text-muted-foreground" />
                        {code} - {cat.name} ({cat.docs.length})
                      </Button>
                      {expandedCategory === `${year}-${code}` && (
                        <div className="ml-6 space-y-1">
                          {cat.docs.map((doc: any) => (
                            <div key={doc.id} className="flex items-center gap-2 py-1 px-2 rounded hover:bg-muted/50 cursor-pointer" onClick={() => navigate(`/documents/${doc.id}`)}>
                              <FileText className="h-3 w-3 text-muted-foreground" />
                              <span className="font-mono text-sm">{doc.protocol_number}</span>
                              <span className="text-sm truncate flex-1">{doc.subject || doc.name}</span>
                              <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handlePreview(doc)}><Eye className="h-3 w-3" /></Button>
                                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleDownload(doc)}><Download className="h-3 w-3" /></Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {years.map(year => (
            <div key={year}>
              <h2 className="text-lg font-bold mb-3">{year}</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {Object.values(grouped[year] as Record<string, { name: string; docs: any[] }>).flatMap(cat =>
                  cat.docs.map((doc: any) => (
                    <Card key={doc.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/documents/${doc.id}`)}>
                      <CardContent className="pt-4 space-y-2">
                        <div className="flex items-center gap-2">
                          <FileText className="h-5 w-5 text-primary" />
                          <span className="font-mono text-xs">{doc.protocol_number}</span>
                        </div>
                        <p className="text-sm truncate">{doc.subject || doc.name}</p>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">{doc.document_categories?.code || "misc"}</Badge>
                          <Badge variant={doc.status === "aktivan" ? "default" : "secondary"} className="text-xs">{doc.status}</Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {filtered.length === 0 && <p className="text-center text-muted-foreground py-8">{t("noResults")}</p>}
    </div>
  );
}
