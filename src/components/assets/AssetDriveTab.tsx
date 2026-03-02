import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FolderOpen, Upload, FileIcon, HardDrive } from "lucide-react";
import { toast } from "sonner";
import { useRef } from "react";

interface Props {
  assetId: string;
  assetCode: string;
  driveFolderId: string | null;
  onFolderCreated: (folderId: string) => void;
}

export function AssetDriveTab({ assetId, assetCode, driveFolderId, onFolderCreated }: Props) {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getOrCreateDrive = async (): Promise<string> => {
    const { data: existingDrive } = await supabase
      .from("drives")
      .select("id")
      .eq("tenant_id", tenantId!)
      .eq("drive_type", "shared")
      .limit(1)
      .single();
    if (existingDrive) return existingDrive.id;

    const { data: newDrive, error } = await supabase
      .from("drives")
      .insert({ tenant_id: tenantId!, name: "Shared Drive", drive_type: "shared", created_by: user?.id || null })
      .select("id")
      .single();
    if (error) throw error;
    return newDrive!.id;
  };

  const createFolder = useMutation({
    mutationFn: async () => {
      const driveId = await getOrCreateDrive();

      let { data: rootFolder } = await supabase
        .from("drive_folders")
        .select("id")
        .eq("tenant_id", tenantId!)
        .eq("drive_id", driveId)
        .eq("name", "Imovina")
        .is("parent_folder_id", null)
        .limit(1)
        .single();

      if (!rootFolder) {
        const { data: created, error } = await supabase
          .from("drive_folders")
          .insert({ tenant_id: tenantId!, drive_id: driveId, name: "Imovina", created_by: user?.id || null })
          .select("id")
          .single();
        if (error) throw error;
        rootFolder = created;
      }

      const { data: assetFolder, error: folderErr } = await supabase
        .from("drive_folders")
        .insert({ tenant_id: tenantId!, drive_id: driveId, name: assetCode, parent_folder_id: rootFolder!.id, created_by: user?.id || null })
        .select("id")
        .single();
      if (folderErr) throw folderErr;

      await supabase.from("assets").update({ drive_folder_id: assetFolder!.id } as any).eq("id", assetId);
      onFolderCreated(assetFolder!.id);
      return assetFolder!.id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["asset-drive-files"] });
      toast.success(t("assetsCrossDriveFolderCreated"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { data: files = [], isLoading } = useQuery({
    queryKey: ["asset-drive-files", driveFolderId],
    queryFn: async () => {
      if (!driveFolderId) return [];
      const { data } = await supabase
        .from("drive_files")
        .select("id, original_name, mime_type, size_bytes, created_at")
        .eq("folder_id", driveFolderId)
        .eq("is_deleted", false)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!driveFolderId,
  });

  const uploadFile = useMutation({
    mutationFn: async (file: File) => {
      if (!driveFolderId) throw new Error("No folder");

      const { data: folder } = await supabase
        .from("drive_folders")
        .select("drive_id")
        .eq("id", driveFolderId)
        .single();
      if (!folder) throw new Error("Folder not found");

      const s3Key = `${tenantId}/${driveFolderId}/${Date.now()}_${file.name}`;

      const { error } = await supabase.from("drive_files").insert({
        tenant_id: tenantId!,
        drive_id: folder.drive_id,
        folder_id: driveFolderId,
        original_name: file.name,
        mime_type: file.type || "application/octet-stream",
        size_bytes: file.size,
        s3_key: s3Key,
        uploaded_by: user?.id || "",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["asset-drive-files"] });
      toast.success(t("saved"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile.mutate(file);
    e.target.value = "";
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <HardDrive className="h-5 w-5" /> {t("assetsCrossDriveTitle")}
        </h3>
        <div className="flex gap-2">
          {!driveFolderId ? (
            <Button size="sm" onClick={() => createFolder.mutate()} disabled={createFolder.isPending}>
              <FolderOpen className="h-4 w-4 mr-1" /> {t("assetsCrossDriveCreateFolder")}
            </Button>
          ) : (
            <>
              <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
              <Button size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploadFile.isPending}>
                <Upload className="h-4 w-4 mr-1" /> {t("assetsCrossDriveUpload")}
              </Button>
            </>
          )}
        </div>
      </div>

      {!driveFolderId ? (
        <p className="text-muted-foreground text-center py-8">{t("assetsCrossDriveNoFolder")}</p>
      ) : isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      ) : files.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">{t("assetsCrossDriveEmpty")}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("name")}</TableHead>
              <TableHead>{t("type")}</TableHead>
              <TableHead>{t("assetsCrossDriveSize")}</TableHead>
              <TableHead>{t("date")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {files.map((f: any) => (
              <TableRow key={f.id}>
                <TableCell className="flex items-center gap-2">
                  <FileIcon className="h-4 w-4 text-muted-foreground" />
                  {f.original_name}
                </TableCell>
                <TableCell><Badge variant="outline">{f.mime_type?.split("/")[1] || "—"}</Badge></TableCell>
                <TableCell>{formatSize(f.size_bytes || 0)}</TableCell>
                <TableCell>{new Date(f.created_at).toLocaleDateString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
