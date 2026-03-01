import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Download, Trash2, ExternalLink } from "lucide-react";
import { AttachDocumentButton } from "./AttachDocumentButton";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface TransactionDocumentsTabProps {
  entityType: string;
  entityId: string;
  title?: string;
}

export function TransactionDocumentsTab({ entityType, entityId, title }: TransactionDocumentsTabProps) {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ["entity-documents", entityType, entityId],
    queryFn: async () => {
      if (!tenantId || !entityId) return [];
      const { data, error } = await supabase
        .from("documents")
        .select("id, name, file_path, file_size, file_type, created_at, uploaded_by, status")
        .eq("tenant_id", tenantId)
        .eq("entity_type", entityType)
        .eq("entity_id", entityId)
        .neq("status", "deleted")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId && !!entityId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (docId: string) => {
      const { error } = await supabase
        .from("documents")
        .update({ status: "deleted" })
        .eq("id", docId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entity-documents", entityType, entityId] });
      toast({ title: t("documentDeleted" as any) || "Dokument obrisan" });
    },
    onError: (e: any) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const handleDownload = async (doc: any) => {
    const { data } = await supabase.storage.from("documents").createSignedUrl(doc.file_path, 300);
    if (data?.signedUrl) {
      window.open(data.signedUrl, "_blank");
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            {title || t("attachedDocuments" as any) || "Priloženi dokumenti"}
            {documents.length > 0 && (
              <Badge variant="secondary" className="ml-1">{documents.length}</Badge>
            )}
          </CardTitle>
          <AttachDocumentButton entityType={entityType} entityId={entityId} />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading && <p className="text-sm text-muted-foreground">{t("loading")}</p>}
        {!isLoading && documents.length === 0 && (
          <p className="text-sm text-muted-foreground py-4 text-center">
            {t("noDocuments" as any) || "Nema priloženih dokumenata"}
          </p>
        )}
        <div className="space-y-2">
          {documents.map((doc: any) => (
            <div key={doc.id} className="flex items-center gap-3 p-2 rounded-md border hover:bg-accent/50 transition-colors">
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{doc.name}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{format(new Date(doc.created_at), "dd.MM.yyyy HH:mm")}</span>
                  {doc.file_size && <span>• {formatFileSize(doc.file_size)}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button size="icon-sm" variant="ghost" onClick={() => handleDownload(doc)}>
                  <Download className="h-3 w-3" />
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => deleteMutation.mutate(doc.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
