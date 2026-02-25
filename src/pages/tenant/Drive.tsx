import { useState, useCallback, useRef, useEffect } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/shared/PageHeader";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  FolderOpen, File, Upload, FolderPlus, Download, Eye, Trash2, ChevronRight,
  ChevronDown, MoreVertical, HardDrive, FileUp, Home, Search, Grid, List,
  Share2, History, RotateCcw, X,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";

// Types
interface DriveRecord {
  id: string;
  name: string;
  drive_type: string;
  default_permission: string;
  quota_bytes: number | null;
  used_bytes: number;
  icon: string | null;
  is_active: boolean;
}

interface FolderRecord {
  id: string;
  drive_id: string;
  parent_folder_id: string | null;
  name: string;
  full_path: string | null;
  depth: number;
  is_system: boolean;
  color: string | null;
}

interface FileRecord {
  id: string;
  folder_id: string;
  drive_id?: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  status: string;
  uploaded_by: string;
  created_at: string;
  tags: string[] | null;
  description: string | null;
  version?: number;
}

interface PermissionRecord {
  id: string;
  resource_type: string;
  resource_id: string;
  subject_type: string;
  subject_id: string;
  permission_level: string;
  propagate_to_children: boolean;
  granted_by: string | null;
}

interface VersionRecord {
  id: string;
  file_id: string;
  version_number: number;
  s3_key: string;
  size_bytes: number;
  mime_type: string;
  uploaded_by: string;
  created_at: string;
  note: string | null;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function getFileIcon(mime: string) {
  if (mime.startsWith("image/")) return "🖼️";
  if (mime.startsWith("video/")) return "🎬";
  if (mime.startsWith("audio/")) return "🎵";
  if (mime === "application/pdf") return "📄";
  if (mime.includes("spreadsheet") || mime.includes("excel")) return "📊";
  if (mime.includes("word") || mime.includes("document")) return "📝";
  if (mime.includes("zip") || mime.includes("archive")) return "📦";
  return "📎";
}

export default function Drive() {
  const { t, locale } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const isSr = locale === "sr";
  const fileInputRef = useRef<HTMLInputElement>(null);
  const versionFileInputRef = useRef<HTMLInputElement>(null);

  const [activeDriveId, setActiveDriveId] = useState<string | null>(null);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [searchTerm, setSearchTerm] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});

  // Share dialog state
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareTarget, setShareTarget] = useState<{ type: "FOLDER" | "FILE"; id: string; name: string } | null>(null);
  const [newPermEmployee, setNewPermEmployee] = useState("");
  const [newPermLevel, setNewPermLevel] = useState("READ");
  const [newPermPropagate, setNewPermPropagate] = useState(false);

  // Version history state
  const [versionDialogOpen, setVersionDialogOpen] = useState(false);
  const [versionFile, setVersionFile] = useState<FileRecord | null>(null);

  // ─── Queries ───
  const { data: drives = [], isLoading: drivesLoading } = useQuery({
    queryKey: ["drives", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("drives")
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as DriveRecord[];
    },
    enabled: !!tenantId,
  });

  useEffect(() => {
    if (drives.length > 0 && !activeDriveId) setActiveDriveId(drives[0].id);
  }, [drives, activeDriveId]);

  const { data: folders = [] } = useQuery({
    queryKey: ["drive_folders", activeDriveId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("drive_folders")
        .select("*")
        .eq("drive_id", activeDriveId!)
        .eq("tenant_id", tenantId!)
        .order("name");
      if (error) throw error;
      return data as FolderRecord[];
    },
    enabled: !!activeDriveId && !!tenantId,
  });

  const { data: files = [], isLoading: filesLoading } = useQuery({
    queryKey: ["drive_files", currentFolderId],
    queryFn: async () => {
      if (!currentFolderId) return [];
      const { data, error } = await supabase
        .from("drive_files")
        .select("*")
        .eq("folder_id", currentFolderId)
        .eq("tenant_id", tenantId!)
        .eq("is_deleted", false)
        .neq("status", "DELETED")
        .order("original_name");
      if (error) throw error;
      return data as FileRecord[];
    },
    enabled: !!currentFolderId && !!tenantId,
  });

  // Employees query for share dialog
  const { data: employees = [] } = useQuery({
    queryKey: ["employees_for_share", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, full_name, position")
        .eq("tenant_id", tenantId!)
        .eq("status", "active")
        .order("full_name");
      if (error) throw error;
      return data as { id: string; full_name: string; position: string | null }[];
    },
    enabled: !!tenantId && shareDialogOpen,
  });

  // Permissions for share target
  const { data: permissions = [], refetch: refetchPerms } = useQuery({
    queryKey: ["drive_permissions", shareTarget?.id],
    queryFn: async () => {
      if (!shareTarget) return [];
      const { data, error } = await supabase
        .from("drive_permissions")
        .select("*")
        .eq("resource_id", shareTarget.id)
        .eq("tenant_id", tenantId!);
      if (error) throw error;
      return data as PermissionRecord[];
    },
    enabled: !!shareTarget && !!tenantId && shareDialogOpen,
  });

  // File versions
  const { data: versions = [], refetch: refetchVersions } = useQuery({
    queryKey: ["drive_file_versions", versionFile?.id],
    queryFn: async () => {
      if (!versionFile) return [];
      const { data, error } = await supabase
        .from("drive_file_versions")
        .select("*")
        .eq("file_id", versionFile.id)
        .eq("tenant_id", tenantId!)
        .order("version_number", { ascending: false });
      if (error) throw error;
      return data as VersionRecord[];
    },
    enabled: !!versionFile && !!tenantId && versionDialogOpen,
  });

  // ─── Create Drive ───
  const createDriveMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from("drives").insert({
        tenant_id: tenantId!,
        name: "Company Drive",
        drive_type: "COMPANY",
        default_permission: "READ",
        created_by: user?.id,
      }).select("id").single();
      if (error) throw error;

      const topFolders: { name: string; color: string; children?: { name: string }[] }[] = [
        { name: "Računovodstvo", color: "#1F4E79", children: [
          { name: "Fakture" }, { name: "Izvodi" }, { name: "Izveštaji" },
        ]},
        { name: "HR", color: "#2E7D32", children: [
          { name: "Ugovori" }, { name: "Plate" }, { name: "Dokumenta zaposlenih" },
        ]},
        { name: "Prodaja", color: "#E65100", children: [
          { name: "Ponude" }, { name: "Narudžbine" }, { name: "Otpremnice" },
        ]},
        { name: "Nabavka", color: "#6A1B9A", children: [
          { name: "Nabavke" }, { name: "Prijemnice" },
        ]},
        { name: "Projekti", color: "#00838F" },
        { name: "Opšte", color: "#5C6BC0" },
        { name: "Menadžment", color: "#880E4F" },
        { name: "DMS Dokumenti", color: "#37474F" },
      ];

      for (const f of topFolders) {
        const { data: parentData } = await supabase.from("drive_folders").insert({
          drive_id: data.id, tenant_id: tenantId!, name: f.name, color: f.color, is_system: true, created_by: user?.id,
        }).select("id").single();
        if (parentData && f.children) {
          for (const child of f.children) {
            await supabase.from("drive_folders").insert({
              drive_id: data.id, tenant_id: tenantId!, parent_folder_id: parentData.id, name: child.name, is_system: true, created_by: user?.id,
            });
          }
        }
      }
      return data.id;
    },
    onSuccess: (driveId) => {
      qc.invalidateQueries({ queryKey: ["drives"] });
      setActiveDriveId(driveId);
      toast({ title: isSr ? "Drive kreiran" : "Drive created" });
    },
  });

  useEffect(() => {
    if (!drivesLoading && drives.length === 0 && tenantId && user) createDriveMutation.mutate();
  }, [drivesLoading, drives.length, tenantId, user]);

  // ─── Create Folder ───
  const createFolderMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("drive_folders").insert({
        drive_id: activeDriveId!, tenant_id: tenantId!, parent_folder_id: currentFolderId, name: newFolderName, created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["drive_folders"] }); setNewFolderOpen(false); setNewFolderName(""); },
  });

  // ─── Upload Files ───
  const uploadFiles = useCallback(async (fileList: File[]) => {
    if (!activeDriveId || !currentFolderId || !tenantId) {
      toast({ title: isSr ? "Izaberite fasciklu" : "Select a folder first", variant: "destructive" });
      return;
    }
    for (const file of fileList) {
      const tempId = crypto.randomUUID();
      setUploadProgress(prev => ({ ...prev, [tempId]: 0 }));
      try {
        const { data: initData, error: initErr } = await supabase.functions.invoke("drive-presign", {
          body: { action: "upload_init", tenantId, fileName: file.name, mimeType: file.type, sizeBytes: file.size, folderId: currentFolderId, driveId: activeDriveId },
        });
        if (initErr) throw initErr;
        const { presignedUrl, fileId } = initData;
        setUploadProgress(prev => ({ ...prev, [tempId]: 30 }));
        const uploadRes = await fetch(presignedUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
        if (!uploadRes.ok) throw new Error("Upload failed");
        setUploadProgress(prev => ({ ...prev, [tempId]: 80 }));
        await supabase.functions.invoke("drive-presign", { body: { action: "upload_confirm", tenantId, fileId } });
        setUploadProgress(prev => ({ ...prev, [tempId]: 100 }));
        setTimeout(() => setUploadProgress(prev => { const next = { ...prev }; delete next[tempId]; return next; }), 1000);
      } catch (e: any) {
        toast({ title: isSr ? "Greška pri uploadu" : "Upload error", description: e.message, variant: "destructive" });
        setUploadProgress(prev => { const next = { ...prev }; delete next[tempId]; return next; });
      }
    }
    qc.invalidateQueries({ queryKey: ["drive_files"] });
  }, [activeDriveId, currentFolderId, tenantId, toast, isSr, qc]);

  // ─── Download / Preview ───
  const handleDownload = async (fileId: string) => {
    const { data, error } = await supabase.functions.invoke("drive-presign", { body: { action: "download", tenantId, fileId } });
    if (error || !data?.presignedUrl) { toast({ title: t("error"), variant: "destructive" }); return; }
    window.open(data.presignedUrl, "_blank");
  };

  const handlePreview = async (fileId: string) => {
    const { data, error } = await supabase.functions.invoke("drive-presign", { body: { action: "preview", tenantId, fileId } });
    if (error || !data?.presignedUrl) return;
    window.open(data.presignedUrl, "_blank");
  };

  // ─── Delete ───
  const deleteMutation = useMutation({
    mutationFn: async (fileId: string) => {
      const { error } = await supabase.from("drive_files")
        .update({ is_deleted: true, deleted_at: new Date().toISOString(), deleted_by: user?.id, status: "DELETED" })
        .eq("id", fileId).eq("tenant_id", tenantId!);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["drive_files"] }),
  });

  // ─── Share: Add permission ───
  const addPermissionMutation = useMutation({
    mutationFn: async () => {
      if (!shareTarget || !newPermEmployee) throw new Error("Missing data");
      const { error } = await supabase.from("drive_permissions").insert({
        tenant_id: tenantId!,
        resource_type: shareTarget.type,
        resource_id: shareTarget.id,
        subject_type: "USER",
        subject_id: newPermEmployee,
        permission_level: newPermLevel,
        propagate_to_children: newPermPropagate,
        granted_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      refetchPerms();
      setNewPermEmployee("");
      toast({ title: isSr ? "Pristup dodeljen" : "Access granted" });
    },
  });

  // ─── Share: Remove permission ───
  const removePermissionMutation = useMutation({
    mutationFn: async (permId: string) => {
      const { error } = await supabase.from("drive_permissions").delete().eq("id", permId).eq("tenant_id", tenantId!);
      if (error) throw error;
    },
    onSuccess: () => { refetchPerms(); toast({ title: isSr ? "Pristup uklonjen" : "Access removed" }); },
  });

  // ─── Version: Upload new version ───
  const handleUploadNewVersion = useCallback(async (file: File) => {
    if (!versionFile || !tenantId) return;
    try {
      const { data, error } = await supabase.functions.invoke("drive-presign", {
        body: {
          action: "upload_new_version",
          tenantId,
          fileId: versionFile.id,
          fileName: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
          driveId: versionFile.drive_id,
          folderId: versionFile.folder_id,
        },
      });
      if (error) throw error;

      const uploadRes = await fetch(data.presignedUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      if (!uploadRes.ok) throw new Error("Upload failed");

      toast({ title: isSr ? "Nova verzija otpremljena" : "New version uploaded" });
      refetchVersions();
      qc.invalidateQueries({ queryKey: ["drive_files"] });
    } catch (e: any) {
      toast({ title: t("error"), description: e.message, variant: "destructive" });
    }
  }, [versionFile, tenantId, toast, isSr, qc, t, refetchVersions]);

  // ─── Version: Restore ───
  const restoreVersionMutation = useMutation({
    mutationFn: async (versionId: string) => {
      if (!versionFile) throw new Error("No file");
      const { data, error } = await supabase.functions.invoke("drive-presign", {
        body: { action: "restore_version", tenantId, fileId: versionFile.id, versionId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: isSr ? "Verzija vraćena" : "Version restored" });
      refetchVersions();
      qc.invalidateQueries({ queryKey: ["drive_files"] });
    },
  });

  // ─── Version: Download ───
  const handleDownloadVersion = async (versionId: string) => {
    const { data, error } = await supabase.functions.invoke("drive-presign", {
      body: { action: "download_version", tenantId, versionId },
    });
    if (error || !data?.presignedUrl) { toast({ title: t("error"), variant: "destructive" }); return; }
    window.open(data.presignedUrl, "_blank");
  };

  // ─── Drag & Drop ───
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragOver(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) uploadFiles(droppedFiles);
  }, [uploadFiles]);

  // ─── Breadcrumb ───
  const buildBreadcrumb = (): FolderRecord[] => {
    if (!currentFolderId) return [];
    const path: FolderRecord[] = [];
    let current = folders.find(f => f.id === currentFolderId);
    while (current) {
      path.unshift(current);
      current = current.parent_folder_id ? folders.find(f => f.id === current!.parent_folder_id) : undefined;
    }
    return path;
  };

  // ─── Folder Tree ───
  const rootFolders = folders.filter(f => !f.parent_folder_id);
  const getChildren = (parentId: string) => folders.filter(f => f.parent_folder_id === parentId);

  const toggleExpand = (folderId: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId); else next.add(folderId);
      return next;
    });
  };

  const openShareDialog = (type: "FOLDER" | "FILE", id: string, name: string) => {
    setShareTarget({ type, id, name });
    setShareDialogOpen(true);
    setNewPermEmployee("");
    setNewPermLevel("READ");
    setNewPermPropagate(false);
  };

  const openVersionHistory = (file: FileRecord) => {
    setVersionFile(file);
    setVersionDialogOpen(true);
  };

  const renderFolderTree = (folder: FolderRecord, level: number) => {
    const children = getChildren(folder.id);
    const isExpanded = expandedFolders.has(folder.id);
    const isActive = folder.id === currentFolderId;

    return (
      <div key={folder.id}>
        <div
          className={`flex items-center gap-1 py-1.5 px-2 rounded-md cursor-pointer text-sm transition-colors hover:bg-muted ${isActive ? "bg-primary/10 text-primary font-medium" : ""}`}
          style={{ paddingLeft: `${level * 16 + 8}px` }}
          onClick={() => {
            setCurrentFolderId(folder.id);
            if (children.length > 0) toggleExpand(folder.id);
          }}
        >
          {children.length > 0 ? (
            isExpanded ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />
          ) : <span className="w-3.5" />}
          <FolderOpen className="h-4 w-4 shrink-0" style={{ color: folder.color || undefined }} />
          <span className="truncate flex-1">{folder.name}</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
              <button className="opacity-0 group-hover:opacity-100 hover:opacity-100 focus:opacity-100 h-5 w-5 flex items-center justify-center rounded hover:bg-muted-foreground/10">
                <MoreVertical className="h-3 w-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
              <DropdownMenuItem onClick={() => openShareDialog("FOLDER", folder.id, folder.name)}>
                <Share2 className="h-4 w-4 mr-2" />{t("shareFile")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {isExpanded && children.map(child => renderFolderTree(child, level + 1))}
      </div>
    );
  };

  const filteredFiles = files.filter(f => !searchTerm || f.original_name.toLowerCase().includes(searchTerm.toLowerCase()));
  const breadcrumb = buildBreadcrumb();
  const activeDrive = drives.find(d => d.id === activeDriveId);
  const employeeNameMap = new Map(employees.map(e => [e.id, e.full_name]));

  if (drivesLoading) return <div className="space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-[500px]" /></div>;

  return (
    <div className="space-y-4">
      <PageHeader title="ERP Drive" />

      <div className="flex h-[calc(100vh-180px)] rounded-lg border overflow-hidden bg-background">
        {/* ─── Left: Sidebar ─── */}
        <div className="w-64 border-r flex flex-col shrink-0">
          <div className="p-3 border-b">
            <Button size="sm" className="w-full" onClick={() => fileInputRef.current?.click()} disabled={!currentFolderId}>
              <Upload className="h-4 w-4 mr-2" />{isSr ? "Otpremi" : "Upload"}
            </Button>
            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={e => {
              const fl = e.target.files ? Array.from(e.target.files) : [];
              if (fl.length) uploadFiles(fl);
              e.target.value = "";
            }} />
          </div>

          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {drives.map(d => (
                <div
                  key={d.id}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer text-sm transition-colors ${d.id === activeDriveId ? "bg-muted font-medium" : "hover:bg-muted/50"}`}
                  onClick={() => { setActiveDriveId(d.id); setCurrentFolderId(null); }}
                >
                  <HardDrive className="h-4 w-4 text-primary" />
                  <span className="truncate">{d.name}</span>
                </div>
              ))}
              <Separator className="my-2" />
              {rootFolders.map(f => renderFolderTree(f, 0))}
              {rootFolders.length === 0 && (
                <p className="text-xs text-muted-foreground px-2 py-4 text-center">{isSr ? "Nema fascikli" : "No folders"}</p>
              )}
            </div>
          </ScrollArea>

          {activeDrive && activeDrive.quota_bytes && (
            <div className="p-3 border-t text-xs text-muted-foreground">
              <Progress value={(activeDrive.used_bytes / activeDrive.quota_bytes) * 100} className="h-1.5 mb-1" />
              {formatBytes(activeDrive.used_bytes)} / {formatBytes(activeDrive.quota_bytes)}
            </div>
          )}
        </div>

        {/* ─── Right: Content ─── */}
        <div
          className={`flex-1 flex flex-col ${isDragOver ? "bg-primary/5" : ""}`}
          onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
        >
          {/* Toolbar */}
          <div className="flex items-center gap-2 p-3 border-b">
            <div className="flex items-center gap-1 text-sm flex-1 min-w-0">
              <button className="text-muted-foreground hover:text-foreground" onClick={() => setCurrentFolderId(null)}>
                <Home className="h-4 w-4" />
              </button>
              {breadcrumb.map((bc, i) => (
                <span key={bc.id} className="flex items-center gap-1">
                  <ChevronRight className="h-3 w-3 text-muted-foreground" />
                  <button
                    className={`hover:text-foreground truncate max-w-[120px] ${i === breadcrumb.length - 1 ? "font-medium text-foreground" : "text-muted-foreground"}`}
                    onClick={() => setCurrentFolderId(bc.id)}
                  >
                    {bc.name}
                  </button>
                </span>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <div className="relative">
                <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
                <Input className="h-8 w-48 pl-7 text-sm" placeholder={isSr ? "Pretraži..." : "Search..."} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setNewFolderOpen(true)} disabled={!activeDriveId}><FolderPlus className="h-4 w-4" /></Button>
              <Button variant={viewMode === "list" ? "default" : "ghost"} size="icon" className="h-8 w-8" onClick={() => setViewMode("list")}><List className="h-4 w-4" /></Button>
              <Button variant={viewMode === "grid" ? "default" : "ghost"} size="icon" className="h-8 w-8" onClick={() => setViewMode("grid")}><Grid className="h-4 w-4" /></Button>
            </div>
          </div>

          {/* Upload progress */}
          {Object.keys(uploadProgress).length > 0 && (
            <div className="px-3 py-2 border-b space-y-1">
              {Object.entries(uploadProgress).map(([id, pct]) => (
                <div key={id} className="flex items-center gap-2">
                  <FileUp className="h-3.5 w-3.5 text-primary animate-pulse" />
                  <Progress value={pct} className="h-1.5 flex-1" />
                  <span className="text-xs text-muted-foreground">{pct}%</span>
                </div>
              ))}
            </div>
          )}

          {/* Content area */}
          <ScrollArea className="flex-1">
            {!currentFolderId ? (
              <div className="p-6">
                {rootFolders.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {rootFolders.map(f => {
                      const childCount = getChildren(f.id).length;
                      return (
                        <div key={f.id} className="border rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow hover:border-primary/30"
                          onClick={() => { setCurrentFolderId(f.id); setExpandedFolders(prev => new Set([...prev, f.id])); }}>
                          <FolderOpen className="h-8 w-8 mb-2" style={{ color: f.color || "hsl(var(--primary))" }} />
                          <p className="font-medium text-sm">{f.name}</p>
                          {childCount > 0 && <p className="text-xs text-muted-foreground">{childCount} {isSr ? "podfascikli" : "subfolders"}</p>}
                          {f.is_system && <Badge variant="outline" className="mt-1 text-[10px]">System</Badge>}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground py-16">
                    <HardDrive className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>{isSr ? "Izaberite fasciklu iz stabla" : "Select a folder from the tree"}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-3">
                {getChildren(currentFolderId).length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-medium text-muted-foreground mb-2 uppercase">{isSr ? "Fascikle" : "Folders"}</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {getChildren(currentFolderId).map(sf => (
                        <div key={sf.id} className="flex items-center gap-2 p-2 rounded-md border cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => { setCurrentFolderId(sf.id); setExpandedFolders(prev => new Set([...prev, sf.id])); }}>
                          <FolderOpen className="h-5 w-5" style={{ color: sf.color || undefined }} />
                          <span className="text-sm truncate">{sf.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {filesLoading ? (
                  <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
                ) : filteredFiles.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <FileUp className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p>{isSr ? "Nema fajlova. Prevucite fajl ovde ili kliknite Otpremi." : "No files. Drag & drop or click Upload."}</p>
                  </div>
                ) : viewMode === "list" ? (
                  <div className="space-y-0.5">
                    {filteredFiles.map(f => (
                      <div key={f.id} className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted/50 group">
                        <span className="text-lg">{getFileIcon(f.mime_type)}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{f.original_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatBytes(f.size_bytes)} · {new Date(f.created_at).toLocaleDateString("sr-RS")}
                            {f.version && f.version > 1 && <span className="ml-1 text-primary">v{f.version}</span>}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handlePreview(f.id)}><Eye className="h-3.5 w-3.5" /></Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDownload(f.id)}><Download className="h-3.5 w-3.5" /></Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon" variant="ghost" className="h-7 w-7"><MoreVertical className="h-3.5 w-3.5" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handlePreview(f.id)}>
                                <Eye className="h-4 w-4 mr-2" />{isSr ? "Pregled" : "Preview"}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDownload(f.id)}>
                                <Download className="h-4 w-4 mr-2" />{isSr ? "Preuzmi" : "Download"}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openShareDialog("FILE", f.id, f.original_name)}>
                                <Share2 className="h-4 w-4 mr-2" />{t("shareFile")}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openVersionHistory(f)}>
                                <History className="h-4 w-4 mr-2" />{t("fileVersionHistory")}
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive" onClick={() => deleteMutation.mutate(f.id)}>
                                <Trash2 className="h-4 w-4 mr-2" />{isSr ? "Obriši" : "Delete"}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {filteredFiles.map(f => (
                      <div key={f.id} className="border rounded-lg p-3 cursor-pointer hover:shadow-md transition-shadow group" onClick={() => handlePreview(f.id)}>
                        <div className="text-3xl text-center mb-2">{getFileIcon(f.mime_type)}</div>
                        <p className="text-xs font-medium truncate text-center">{f.original_name}</p>
                        <p className="text-[10px] text-muted-foreground text-center">{formatBytes(f.size_bytes)}</p>
                        <div className="flex justify-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={e => { e.stopPropagation(); handleDownload(f.id); }}><Download className="h-3 w-3" /></Button>
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={e => { e.stopPropagation(); openShareDialog("FILE", f.id, f.original_name); }}><Share2 className="h-3 w-3" /></Button>
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={e => { e.stopPropagation(); openVersionHistory(f); }}><History className="h-3 w-3" /></Button>
                          <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={e => { e.stopPropagation(); deleteMutation.mutate(f.id); }}><Trash2 className="h-3 w-3" /></Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          {isDragOver && currentFolderId && (
            <div className="absolute inset-0 bg-primary/10 border-2 border-dashed border-primary rounded-lg flex items-center justify-center pointer-events-none z-10">
              <div className="text-center">
                <FileUp className="h-12 w-12 mx-auto mb-2 text-primary" />
                <p className="font-medium text-primary">{isSr ? "Pustite fajlove ovde" : "Drop files here"}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* New Folder Dialog */}
      <Dialog open={newFolderOpen} onOpenChange={setNewFolderOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{isSr ? "Nova fascikla" : "New Folder"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{isSr ? "Naziv" : "Name"}</Label>
              <Input value={newFolderName} onChange={e => setNewFolderName(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => createFolderMutation.mutate()} disabled={!newFolderName.trim()}>{isSr ? "Kreiraj" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Share Dialog */}
      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5" />
              {t("shareFile")}: {shareTarget?.name}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Current permissions */}
            {permissions.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs uppercase text-muted-foreground">{isSr ? "Trenutni pristup" : "Current Access"}</Label>
                {permissions.map(p => (
                  <div key={p.id} className="flex items-center justify-between py-1.5 px-2 rounded-md bg-muted/50">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{employeeNameMap.get(p.subject_id) || p.subject_id.slice(0, 8)}</span>
                      <Badge variant={p.permission_level === "ADMIN" ? "default" : p.permission_level === "WRITE" ? "secondary" : "outline"} className="text-[10px]">
                        {p.permission_level}
                      </Badge>
                    </div>
                    <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => removePermissionMutation.mutate(p.id)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                <Separator />
              </div>
            )}

            {/* Add new permission */}
            <div className="space-y-3">
              <div>
                <Label>{t("shareWith")}</Label>
                <Select value={newPermEmployee} onValueChange={setNewPermEmployee}>
                  <SelectTrigger><SelectValue placeholder={isSr ? "Izaberite zaposlenog..." : "Select employee..."} /></SelectTrigger>
                  <SelectContent>
                    {employees.map(emp => (
                      <SelectItem key={emp.id} value={emp.id}>{emp.full_name}{emp.position ? ` (${emp.position})` : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>{t("permissionLevel")}</Label>
                <RadioGroup value={newPermLevel} onValueChange={setNewPermLevel} className="flex gap-4 mt-1">
                  <div className="flex items-center gap-1.5">
                    <RadioGroupItem value="READ" id="perm-read" />
                    <Label htmlFor="perm-read" className="font-normal">{t("readAccess")}</Label>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <RadioGroupItem value="WRITE" id="perm-write" />
                    <Label htmlFor="perm-write" className="font-normal">{t("writeAccess")}</Label>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <RadioGroupItem value="ADMIN" id="perm-admin" />
                    <Label htmlFor="perm-admin" className="font-normal">{t("adminAccess")}</Label>
                  </div>
                </RadioGroup>
              </div>

              {shareTarget?.type === "FOLDER" && (
                <div className="flex items-center gap-2">
                  <Checkbox id="propagate" checked={newPermPropagate} onCheckedChange={(v) => setNewPermPropagate(!!v)} />
                  <Label htmlFor="propagate" className="font-normal text-sm">{t("applyToSubfolders")}</Label>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => addPermissionMutation.mutate()} disabled={!newPermEmployee}>
              {isSr ? "Dodeli pristup" : "Grant Access"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Version History Dialog */}
      <Dialog open={versionDialogOpen} onOpenChange={setVersionDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              {t("fileVersionHistory")}
            </DialogTitle>
          </DialogHeader>

          {versionFile && (
            <div className="space-y-4">
              {/* Current version */}
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{versionFile.original_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("currentVersion")}: v{versionFile.version || 1} · {formatBytes(versionFile.size_bytes)}
                    </p>
                  </div>
                  <Badge>{isSr ? "Trenutna" : "Current"}</Badge>
                </div>
              </div>

              {/* Upload new version */}
              <Button variant="outline" className="w-full" onClick={() => versionFileInputRef.current?.click()}>
                <Upload className="h-4 w-4 mr-2" />{t("uploadNewVersion")}
              </Button>
              <input ref={versionFileInputRef} type="file" className="hidden" onChange={e => {
                const f = e.target.files?.[0];
                if (f) handleUploadNewVersion(f);
                e.target.value = "";
              }} />

              <Separator />

              {/* Previous versions */}
              {versions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">{t("noVersions")}</p>
              ) : (
                <ScrollArea className="max-h-[300px]">
                  <div className="space-y-2">
                    {versions.map(v => (
                      <div key={v.id} className="flex items-center justify-between py-2 px-3 rounded-md border">
                        <div>
                          <p className="text-sm font-medium">v{v.version_number}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(v.created_at).toLocaleString("sr-RS")} · {formatBytes(v.size_bytes)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="ghost" onClick={() => handleDownloadVersion(v.id)}>
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => restoreVersionMutation.mutate(v.id)}>
                            <RotateCcw className="h-3.5 w-3.5 mr-1" />{t("restoreVersion")}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
