import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Search, Trash2, RotateCcw, FileText, Download, XCircle } from "lucide-react";
import { format } from "date-fns";

export default function DocumentSearch() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("search");

  // Full-text search results
  const { data: searchResults = [], isLoading: isSearching } = useQuery({
    queryKey: ["search_documents", tenantId, searchQuery],
    queryFn: async () => {
      if (!tenantId || !searchQuery.trim()) return [];
      const { data, error } = await supabase.rpc("search_documents", {
        p_tenant_id: tenantId,
        p_query: searchQuery,
        p_limit: 50,
      });
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId && searchQuery.trim().length >= 2,
  });

  // Trash items
  const { data: trashItems = [], isLoading: isLoadingTrash } = useQuery({
    queryKey: ["trash_documents", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase
        .from("documents")
        .select("id, name, file_path, file_type, file_size, created_at, updated_at")
        .eq("tenant_id", tenantId)
        .eq("status", "deleted")
        .order("updated_at", { ascending: false });
      return data || [];
    },
    enabled: !!tenantId && activeTab === "trash",
  });

  const restoreMutation = useMutation({
    mutationFn: async (docId: string) => {
      const { error } = await supabase.from("documents").update({ status: "active" }).eq("id", docId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trash_documents"] });
      toast({ title: t("documentRestored" as any) || "Dokument vraćen" });
    },
    onError: (e: any) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const permanentDeleteMutation = useMutation({
    mutationFn: async (doc: any) => {
      // Delete from storage
      await supabase.storage.from("documents").remove([doc.file_path]);
      // Delete record permanently
      const { error } = await supabase.from("documents").delete().eq("id", doc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trash_documents"] });
      toast({ title: t("permanentlyDeleted" as any) || "Trajno obrisano" });
    },
    onError: (e: any) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const emptyTrashMutation = useMutation({
    mutationFn: async () => {
      for (const doc of trashItems) {
        await supabase.storage.from("documents").remove([(doc as any).file_path]);
        await supabase.from("documents").delete().eq("id", (doc as any).id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trash_documents"] });
      toast({ title: t("trashEmptied" as any) || "Korpa ispražnjena" });
    },
  });

  const handleDownload = async (doc: any) => {
    const { data } = await supabase.storage.from("documents").createSignedUrl(doc.file_path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("documentSearch" as any) || "Pretraga dokumenata"}</h1>
        <p className="text-muted-foreground text-sm">{t("fullTextSearchDesc" as any) || "Pretražite sve dokumente po sadržaju, nazivu, opisu"}</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="search" className="gap-1">
            <Search className="h-4 w-4" />
            {t("search")}
          </TabsTrigger>
          <TabsTrigger value="trash" className="gap-1">
            <Trash2 className="h-4 w-4" />
            {t("trash" as any) || "Korpa"}
            {trashItems.length > 0 && <Badge variant="secondary" className="ml-1 text-xs">{trashItems.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="search" className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder={t("searchDocuments" as any) || "Pretražite dokumente..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {isSearching && <p className="text-sm text-muted-foreground">{t("loading")}</p>}

          {searchQuery.trim().length >= 2 && !isSearching && searchResults.length === 0 && (
            <p className="text-center text-muted-foreground py-8">{t("noResults" as any) || "Nema rezultata"}</p>
          )}

          <div className="space-y-2">
            {searchResults.map((doc: any) => (
              <Card key={doc.id} className="hover:bg-accent/50 transition-colors cursor-pointer" onClick={() => handleDownload(doc)}>
                <CardContent className="p-3 flex items-center gap-3">
                  <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{doc.name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {doc.subject && <span className="truncate max-w-[200px]">{doc.subject}</span>}
                      <span>{format(new Date(doc.created_at), "dd.MM.yyyy")}</span>
                      {doc.file_type && <Badge variant="outline" className="text-xs">{doc.file_type}</Badge>}
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-xs shrink-0">
                    {(doc.rank * 100).toFixed(0)}%
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="trash" className="space-y-4">
          {trashItems.length > 0 && (
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="destructive"
                className="gap-1"
                onClick={() => emptyTrashMutation.mutate()}
                disabled={emptyTrashMutation.isPending}
              >
                <XCircle className="h-3 w-3" />
                {t("emptyTrash" as any) || "Isprazni korpu"}
              </Button>
            </div>
          )}

          {isLoadingTrash && <p className="text-sm text-muted-foreground">{t("loading")}</p>}

          {!isLoadingTrash && trashItems.length === 0 && (
            <p className="text-center text-muted-foreground py-8">{t("trashEmpty" as any) || "Korpa je prazna"}</p>
          )}

          <div className="space-y-2">
            {trashItems.map((doc: any) => (
              <Card key={doc.id}>
                <CardContent className="p-3 flex items-center gap-3">
                  <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{doc.name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{t("deletedAt" as any) || "Obrisano"}: {format(new Date(doc.updated_at), "dd.MM.yyyy HH:mm")}</span>
                      {doc.file_size && <span>• {formatFileSize(doc.file_size)}</span>}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      onClick={() => restoreMutation.mutate(doc.id)}
                    >
                      <RotateCcw className="h-3 w-3" />
                      {t("restore" as any) || "Vrati"}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="gap-1"
                      onClick={() => permanentDeleteMutation.mutate(doc)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
