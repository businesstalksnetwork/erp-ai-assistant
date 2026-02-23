import { useLanguage } from "@/i18n/LanguageContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, Download, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useRef } from "react";

interface Props {
  opportunityId: string;
  tenantId: string;
  onActivity: (type: string, description: string, metadata?: any) => void;
}

export function OpportunityDocumentsTab({ opportunityId, tenantId, onActivity }: Props) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["opportunity-documents", opportunityId],
    queryFn: async () => {
      const { data } = await supabase
        .from("opportunity_documents" as any)
        .select("*, profiles(full_name)")
        .eq("opportunity_id", opportunityId)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const filePath = `opportunities/${opportunityId}/${Date.now()}_${file.name}`;
      const { error: uploadErr } = await supabase.storage
        .from("tenant-documents")
        .upload(filePath, file);
      if (uploadErr) throw uploadErr;

      const { error } = await supabase.from("opportunity_documents" as any).insert([{
        tenant_id: tenantId,
        opportunity_id: opportunityId,
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
        mime_type: file.type,
        uploaded_by: user?.id,
      }]);
      if (error) throw error;
      onActivity("document_uploaded", `Uploaded: ${file.name}`, { file_name: file.name });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["opportunity-documents", opportunityId] });
      toast.success(t("success"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (doc: any) => {
      await supabase.storage.from("tenant-documents").remove([doc.file_path]);
      const { error } = await supabase.from("opportunity_documents" as any).delete().eq("id", doc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["opportunity-documents", opportunityId] });
      toast.success(t("success"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleDownload = async (doc: any) => {
    const { data } = await supabase.storage.from("tenant-documents").download(doc.file_path);
    if (data) {
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.file_name;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const fmtSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">{t("documents")} ({docs.length})</CardTitle>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) uploadMutation.mutate(file);
              e.target.value = "";
            }}
          />
          <Button size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploadMutation.isPending}>
            {uploadMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
            {t("uploadDocument")}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : docs.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">{t("noResults")}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("name")}</TableHead>
                <TableHead>{t("size")}</TableHead>
                <TableHead>{t("uploadedBy")}</TableHead>
                <TableHead>{t("date")}</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {docs.map((d: any) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.file_name}</TableCell>
                  <TableCell>{fmtSize(d.file_size || 0)}</TableCell>
                  <TableCell>{(d as any).profiles?.full_name || "—"}</TableCell>
                  <TableCell>{new Date(d.created_at).toLocaleDateString("sr-RS")}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="icon" onClick={() => handleDownload(d)}>
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(d)} disabled={deleteMutation.isPending}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
