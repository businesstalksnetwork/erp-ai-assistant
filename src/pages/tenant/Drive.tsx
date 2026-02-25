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
import {
  FolderOpen, File, Upload, FolderPlus, Download, Eye, Trash2, ChevronRight,
  ChevronDown, MoreVertical, HardDrive, FileUp, Home, Search, Grid, List,
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
  original_name: string;
  mime_type: string;
  size_bytes: number;
  status: string;
  uploaded_by: string;
  created_at: string;
  tags: string[] | null;
  description: string | null;
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

  const [activeDriveId, setActiveDriveId] = useState<string | null>(null);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [searchTerm, setSearchTerm] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});

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

  // Auto-select first drive
  useEffect(() => {
    if (drives.length > 0 && !activeDriveId) {
      setActiveDriveId(drives[0].id);
    }
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

  // ─── Create Drive (auto on first load) ───
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

      // Create default folders
      const defaultFolders = [
        { name: "Računovodstvo", color: "#1F4E79" },
        { name: "HR", color: "#2E7D32" },
        { name: "Projekti", color: "#E65100" },
        { name: "Opšte", color: "#5C6BC0" },
        { name: "Menadžment", color: "#880E4F" },
      ];
      for (const f of defaultFolders) {
        await supabase.from("drive_folders").insert({
          drive_id: data.id,
          tenant_id: tenantId!,
          name: f.name,
          color: f.color,
          is_system: true,
          created_by: user?.id,
        });
      }
      return data.id;
    },
    onSuccess: (driveId) => {
      qc.invalidateQueries({ queryKey: ["drives"] });
      setActiveDriveId(driveId);
      toast({ title: isSr ? "Drive kreiran" : "Drive created" });
    },
  });

  // Auto-create drive if none exists
  useEffect(() => {
    if (!drivesLoading && drives.length === 0 && tenantId && user) {
      createDriveMutation.mutate();
    }
  }, [drivesLoading, drives.length, tenantId, user]);

  // ─── Create Folder ───
  const createFolderMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("drive_folders").insert({
        drive_id: activeDriveId!,
        tenant_id: tenantId!,
        parent_folder_id: currentFolderId,
        name: newFolderName,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["drive_folders"] });
      setNewFolderOpen(false);
      setNewFolderName("");
    },
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
        // 1. Get presigned URL
        const { data: initData, error: initErr } = await supabase.functions.invoke("drive-presign", {
          body: {
            action: "upload_init",
            tenantId,
            fileName: file.name,
            mimeType: file.type,
            sizeBytes: file.size,
            folderId: currentFolderId,
            driveId: activeDriveId,
          },
        });
        if (initErr) throw initErr;
        const { presignedUrl, fileId } = initData;

        // 2. Upload directly to S3
        setUploadProgress(prev => ({ ...prev, [tempId]: 30 }));
        const uploadRes = await fetch(presignedUrl, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type },
        });
        if (!uploadRes.ok) throw new Error("Upload failed");

        setUploadProgress(prev => ({ ...prev, [tempId]: 80 }));

        // 3. Confirm
        await supabase.functions.invoke("drive-presign", {
          body: { action: "upload_confirm", tenantId, fileId },
        });

        setUploadProgress(prev => ({ ...prev, [tempId]: 100 }));
        setTimeout(() => setUploadProgress(prev => {
          const next = { ...prev };
          delete next[tempId];
          return next;
        }), 1000);
      } catch (e: any) {
        toast({ title: isSr ? "Greška pri uploadu" : "Upload error", description: e.message, variant: "destructive" });
        setUploadProgress(prev => {
          const next = { ...prev };
          delete next[tempId];
          return next;
        });
      }
    }

    qc.invalidateQueries({ queryKey: ["drive_files"] });
  }, [activeDriveId, currentFolderId, tenantId, toast, isSr, qc]);

  // ─── Download / Preview ───
  const handleDownload = async (fileId: string) => {
    const { data, error } = await supabase.functions.invoke("drive-presign", {
      body: { action: "download", tenantId, fileId },
    });
    if (error || !data?.presignedUrl) {
      toast({ title: t("error"), variant: "destructive" });
      return;
    }
    window.open(data.presignedUrl, "_blank");
  };

  const handlePreview = async (fileId: string) => {
    const { data, error } = await supabase.functions.invoke("drive-presign", {
      body: { action: "preview", tenantId, fileId },
    });
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

  // ─── Drag & Drop ───
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) uploadFiles(droppedFiles);
  }, [uploadFiles]);

  // ─── Breadcrumb Path ───
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
          <span className="truncate">{folder.name}</span>
        </div>
        {isExpanded && children.map(child => renderFolderTree(child, level + 1))}
      </div>
    );
  };

  // ─── Filtered files ───
  const filteredFiles = files.filter(f =>
    !searchTerm || f.original_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const breadcrumb = buildBreadcrumb();
  const activeDrive = drives.find(d => d.id === activeDriveId);

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
              {/* Drive selector */}
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

              {/* Folder tree */}
              {rootFolders.map(f => renderFolderTree(f, 0))}

              {rootFolders.length === 0 && (
                <p className="text-xs text-muted-foreground px-2 py-4 text-center">
                  {isSr ? "Nema fascikli" : "No folders"}
                </p>
              )}
            </div>
          </ScrollArea>

          {/* Storage quota */}
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
            {/* Breadcrumb */}
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
                <Input
                  className="h-8 w-48 pl-7 text-sm"
                  placeholder={isSr ? "Pretraži..." : "Search..."}
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setNewFolderOpen(true)} disabled={!activeDriveId}>
                <FolderPlus className="h-4 w-4" />
              </Button>
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
              /* No folder selected – show subfolder cards */
              <div className="p-6">
                {rootFolders.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {rootFolders.map(f => {
                      const childCount = getChildren(f.id).length;
                      const fileCount = 0; // We don't query counts for root view
                      return (
                        <div
                          key={f.id}
                          className="border rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow hover:border-primary/30"
                          onClick={() => {
                            setCurrentFolderId(f.id);
                            setExpandedFolders(prev => new Set([...prev, f.id]));
                          }}
                        >
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
                {/* Subfolders in current folder */}
                {getChildren(currentFolderId).length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-medium text-muted-foreground mb-2 uppercase">{isSr ? "Fascikle" : "Folders"}</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {getChildren(currentFolderId).map(sf => (
                        <div
                          key={sf.id}
                          className="flex items-center gap-2 p-2 rounded-md border cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => {
                            setCurrentFolderId(sf.id);
                            setExpandedFolders(prev => new Set([...prev, sf.id]));
                          }}
                        >
                          <FolderOpen className="h-5 w-5" style={{ color: sf.color || undefined }} />
                          <span className="text-sm truncate">{sf.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Files */}
                {filesLoading ? (
                  <div className="space-y-2">{Array.from({length:3}).map((_,i)=><Skeleton key={i} className="h-10" />)}</div>
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
                          <p className="text-xs text-muted-foreground">{formatBytes(f.size_bytes)} · {new Date(f.created_at).toLocaleDateString("sr-RS")}</p>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handlePreview(f.id)}>
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDownload(f.id)}>
                            <Download className="h-3.5 w-3.5" />
                          </Button>
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
                      <div
                        key={f.id}
                        className="border rounded-lg p-3 cursor-pointer hover:shadow-md transition-shadow group"
                        onClick={() => handlePreview(f.id)}
                      >
                        <div className="text-3xl text-center mb-2">{getFileIcon(f.mime_type)}</div>
                        <p className="text-xs font-medium truncate text-center">{f.original_name}</p>
                        <p className="text-[10px] text-muted-foreground text-center">{formatBytes(f.size_bytes)}</p>
                        <div className="flex justify-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={e => { e.stopPropagation(); handleDownload(f.id); }}>
                            <Download className="h-3 w-3" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={e => { e.stopPropagation(); deleteMutation.mutate(f.id); }}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          {/* Drag overlay */}
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
            <Button onClick={() => createFolderMutation.mutate()} disabled={!newFolderName.trim()}>
              {isSr ? "Kreiraj" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
