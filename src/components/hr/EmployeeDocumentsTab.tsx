import { useLanguage } from "@/i18n/LanguageContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, Download, Trash2, Loader2, FileText } from "lucide-react";
import { toast } from "sonner";
import { useRef } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

interface Props {
  employeeId: string;
  tenantId: string;
}

export function EmployeeDocumentsTab({ employeeId, tenantId }: Props) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["employee-documents", employeeId, tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("documents")
        .select("*")
        .eq("entity_type", "employee")
        .eq("entity_id", employeeId)
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const filePath = `${tenantId}/employees/${employeeId}/${Date.now()}_${file.name}`;
      const { error: uploadErr } = await supabase.storage
        .from("tenant-documents")
        .upload(filePath, file);
      if (uploadErr) throw uploadErr;

      const { error } = await supabase.from("documents").insert([{
        tenant_id: tenantId,
        entity_type: "employee",
        entity_id: employeeId,
        name: file.name,
        file_path: filePath,
        file_size: file.size,
        file_type: file.type,
        uploaded_by: user?.id,
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employee-documents", employeeId] });
      toast.success(t("success"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (doc: any) => {
      await supabase.storage.from("tenant-documents").remove([doc.file_path]);
      const { error } = await supabase.from("documents").delete().eq("id", doc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employee-documents", employeeId] });
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
      a.download = doc.name;
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
      <CardHeader className="flex flex-row items-center justify-between gap-2">
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
            <span className="hidden sm:inline">{t("uploadDocument")}</span>
            <span className="sm:hidden">{t("upload")}</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : docs.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">{t("noResults")}</p>
        ) : isMobile ? (
          <div className="space-y-3">
            {docs.map((d: any) => (
              <div key={d.id} className="flex items-start gap-3 p-3 rounded-lg border">
                <FileText className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{d.name}</p>
                  <p className="text-xs text-muted-foreground">{fmtSize(d.file_size || 0)} · {new Date(d.created_at).toLocaleDateString("sr-RS")}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDownload(d)}>
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deleteMutation.mutate(d)} disabled={deleteMutation.isPending}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("name")}</TableHead>
                <TableHead>{t("size")}</TableHead>
                <TableHead>{t("date")}</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {docs.map((d: any) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.name}</TableCell>
                  <TableCell>{fmtSize(d.file_size || 0)}</TableCell>
                  <TableCell className="whitespace-nowrap">{new Date(d.created_at).toLocaleDateString("sr-RS")}</TableCell>
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
