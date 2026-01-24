import { useState, useRef, useCallback } from 'react';
import { useSelectedCompany } from '@/lib/company-context';
import { useDocuments, Document, DocumentFolder } from '@/hooks/useDocuments';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  FolderOpen, 
  Plus, 
  Search, 
  Upload, 
  Download, 
  Trash2, 
  FileText, 
  FileSpreadsheet,
  FileImage,
  File,
  MoreVertical,
  Pencil,
  Loader2,
  Eye,
} from 'lucide-react';
import { format } from 'date-fns';
import { sr } from 'date-fns/locale';

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(fileType: string | null) {
  if (!fileType) return File;
  if (fileType.includes('pdf')) return FileText;
  if (fileType.includes('spreadsheet') || fileType.includes('excel') || fileType.includes('csv')) return FileSpreadsheet;
  if (fileType.includes('image')) return FileImage;
  return File;
}

function canPreview(fileType: string | null): boolean {
  if (!fileType) return false;
  return fileType === 'application/pdf' || fileType.startsWith('image/');
}

export default function Documents() {
  const { selectedCompany } = useSelectedCompany();
  const companyId = selectedCompany?.id || null;
  
  const {
    folders,
    documents,
    isLoading,
    createFolder,
    updateFolder,
    deleteFolder,
    uploadDocument,
    deleteDocument,
    moveDocument,
    getDownloadUrl,
    searchDocuments,
  } = useDocuments(companyId);

  const [activeTab, setActiveTab] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [editingFolder, setEditingFolder] = useState<DocumentFolder | null>(null);
  const [deleteFolderConfirm, setDeleteFolderConfirm] = useState<DocumentFolder | null>(null);
  const [deleteDocConfirm, setDeleteDocConfirm] = useState<Document | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadFolderId, setUploadFolderId] = useState<string>('all');
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter documents based on active tab and search
  const filteredDocuments = useCallback(() => {
    let docs = documents;
    
    // Filter by folder
    if (activeTab !== 'all') {
      docs = docs.filter(d => d.folder_id === activeTab);
    }
    
    // Apply search
    return searchDocuments(searchQuery, docs);
  }, [documents, activeTab, searchQuery, searchDocuments]);

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || !companyId) return;
    
    setIsUploading(true);
    const folderId = uploadFolderId === 'all' ? null : uploadFolderId;
    
    try {
      for (const file of Array.from(files)) {
        if (file.size > 20 * 1024 * 1024) {
          throw new Error(`Fajl "${file.name}" je prevelik (max 20MB)`);
        }
        await uploadDocument.mutateAsync({ file, folderId });
      }
      setUploadDialogOpen(false);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileUpload(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDownload = async (doc: Document) => {
    const url = await getDownloadUrl(doc.file_path);
    if (url) {
      window.open(url, '_blank');
    }
  };

  const handlePreview = async (doc: Document) => {
    setPreviewDoc(doc);
    setIsLoadingPreview(true);
    setPreviewUrl(null);
    
    const url = await getDownloadUrl(doc.file_path);
    setPreviewUrl(url);
    setIsLoadingPreview(false);
  };

  const handleCreateFolder = async () => {
    if (!folderName.trim()) return;
    await createFolder.mutateAsync(folderName.trim());
    setFolderName('');
    setFolderDialogOpen(false);
  };

  const handleUpdateFolder = async () => {
    if (!editingFolder || !folderName.trim()) return;
    await updateFolder.mutateAsync({ id: editingFolder.id, name: folderName.trim() });
    setFolderName('');
    setEditingFolder(null);
  };

  const handleDeleteFolder = async () => {
    if (!deleteFolderConfirm) return;
    await deleteFolder.mutateAsync(deleteFolderConfirm.id);
    if (activeTab === deleteFolderConfirm.id) {
      setActiveTab('all');
    }
    setDeleteFolderConfirm(null);
  };

  const handleDeleteDocument = async () => {
    if (!deleteDocConfirm) return;
    await deleteDocument.mutateAsync(deleteDocConfirm);
    setDeleteDocConfirm(null);
  };

  const handleMoveDocument = async (docId: string, newFolderId: string | null) => {
    await moveDocument.mutateAsync({ docId, newFolderId });
  };

  const openEditFolder = (folder: DocumentFolder) => {
    setEditingFolder(folder);
    setFolderName(folder.name);
  };

  const openUploadDialog = () => {
    setUploadFolderId(activeTab);
    setUploadDialogOpen(true);
  };

  if (!selectedCompany) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            Izaberite kompaniju da biste videli dokumentaciju.
          </CardContent>
        </Card>
      </div>
    );
  }

  const displayedDocs = filteredDocuments();

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <FolderOpen className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold">Dokumentacija</h1>
      </div>

      {/* Search + Actions Row */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pretraži dokumente..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button variant="outline" onClick={() => setFolderDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Novi folder
        </Button>
        <Button onClick={openUploadDialog}>
          <Upload className="h-4 w-4 mr-2" />
          Upload
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="h-auto flex-wrap">
              <TabsTrigger value="all">Sva dokumentacija</TabsTrigger>
              {folders.map((folder) => (
                <div key={folder.id} className="flex items-center">
                  <TabsTrigger value={folder.id} className="pr-1">
                    {folder.name}
                  </TabsTrigger>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                        <MoreVertical className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEditFolder(folder)}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Izmeni
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className="text-destructive"
                        onClick={() => setDeleteFolderConfirm(folder)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Obriši
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </TabsList>

            <TabsContent value={activeTab} className="mt-4">
              {/* Documents Table */}
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : displayedDocs.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  {searchQuery 
                    ? 'Nema rezultata pretrage.' 
                    : 'Nema dokumenata u ovom folderu.'}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ime fajla</TableHead>
                      <TableHead>Folder</TableHead>
                      <TableHead>Veličina</TableHead>
                      <TableHead>Datum</TableHead>
                      <TableHead className="w-[120px]">Akcije</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayedDocs.map((doc) => {
                      const FileIcon = getFileIcon(doc.file_type);
                      const folder = folders.find(f => f.id === doc.folder_id);
                      
                      return (
                        <TableRow key={doc.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <FileIcon className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{doc.name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {folder?.name || '-'}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatFileSize(doc.file_size)}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {format(new Date(doc.created_at), 'dd.MM.yyyy', { locale: sr })}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {canPreview(doc.file_type) && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handlePreview(doc)}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDownload(doc)}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuLabel>Premesti u</DropdownMenuLabel>
                                  <DropdownMenuItem 
                                    onClick={() => handleMoveDocument(doc.id, null)}
                                    disabled={doc.folder_id === null}
                                  >
                                    Bez foldera {doc.folder_id === null && '✓'}
                                  </DropdownMenuItem>
                                  {folders.map(f => (
                                    <DropdownMenuItem 
                                      key={f.id}
                                      onClick={() => handleMoveDocument(doc.id, f.id)}
                                      disabled={f.id === doc.folder_id}
                                    >
                                      {f.name} {f.id === doc.folder_id && '✓'}
                                    </DropdownMenuItem>
                                  ))}
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem 
                                    className="text-destructive"
                                    onClick={() => setDeleteDocConfirm(doc)}
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Obriši
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </Tabs>
        </CardHeader>
      </Card>

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload dokumenata</DialogTitle>
          </DialogHeader>
          
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
              isDragging 
                ? 'border-primary bg-primary/5' 
                : 'border-muted-foreground/25 hover:border-muted-foreground/50'
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => handleFileUpload(e.target.files)}
            />
            {isUploading ? (
              <div className="flex items-center justify-center gap-2">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span>Upload u toku...</span>
              </div>
            ) : (
              <>
                <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                <p className="text-muted-foreground mb-2">
                  Prevuci fajlove ovde ili klikni za izbor
                </p>
                <p className="text-sm text-muted-foreground">
                  PDF, Word, Excel, slike (max 20MB)
                </p>
              </>
            )}
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Folder:</label>
            <Select value={uploadFolderId} onValueChange={setUploadFolderId}>
              <SelectTrigger>
                <SelectValue placeholder="Izaberi folder" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Bez foldera</SelectItem>
                {folders.map(f => (
                  <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>
              Zatvori
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewDoc} onOpenChange={() => { setPreviewDoc(null); setPreviewUrl(null); }}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              {previewDoc?.name}
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 min-h-0 overflow-auto">
            {isLoadingPreview ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : previewUrl ? (
              previewDoc?.file_type === 'application/pdf' ? (
                <iframe 
                  src={previewUrl} 
                  className="w-full h-[70vh]" 
                  title={previewDoc?.name}
                />
              ) : previewDoc?.file_type?.startsWith('image/') ? (
                <img 
                  src={previewUrl} 
                  alt={previewDoc?.name} 
                  className="max-w-full max-h-[70vh] object-contain mx-auto"
                />
              ) : (
                <div className="text-center py-12">
                  <File className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                  <p>Preview nije dostupan za ovaj tip fajla.</p>
                </div>
              )
            ) : null}
          </div>
          
          {previewDoc && (
            <div className="flex items-center justify-between pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                Veličina: {formatFileSize(previewDoc.file_size)} | 
                Datum: {format(new Date(previewDoc.created_at), 'dd.MM.yyyy', { locale: sr })}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => handleDownload(previewDoc)}>
                  <Download className="h-4 w-4 mr-2" />
                  Preuzmi
                </Button>
                <Button variant="outline" onClick={() => { setPreviewDoc(null); setPreviewUrl(null); }}>
                  Zatvori
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create/Edit Folder Dialog */}
      <Dialog 
        open={folderDialogOpen || !!editingFolder} 
        onOpenChange={(open) => {
          if (!open) {
            setFolderDialogOpen(false);
            setEditingFolder(null);
            setFolderName('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingFolder ? 'Izmeni folder' : 'Novi folder'}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Naziv foldera"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  editingFolder ? handleUpdateFolder() : handleCreateFolder();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setFolderDialogOpen(false);
                setEditingFolder(null);
                setFolderName('');
              }}
            >
              Otkaži
            </Button>
            <Button 
              onClick={editingFolder ? handleUpdateFolder : handleCreateFolder}
              disabled={!folderName.trim()}
            >
              {editingFolder ? 'Sačuvaj' : 'Kreiraj'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Folder Confirm */}
      <AlertDialog open={!!deleteFolderConfirm} onOpenChange={() => setDeleteFolderConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Obriši folder?</AlertDialogTitle>
            <AlertDialogDescription>
              Brisanjem foldera "{deleteFolderConfirm?.name}" obrisaćete i sve dokumente u njemu. 
              Ova akcija se ne može poništiti.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Otkaži</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteFolder} className="bg-destructive text-destructive-foreground">
              Obriši
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Document Confirm */}
      <AlertDialog open={!!deleteDocConfirm} onOpenChange={() => setDeleteDocConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Obriši dokument?</AlertDialogTitle>
            <AlertDialogDescription>
              Da li ste sigurni da želite da obrišete "{deleteDocConfirm?.name}"?
              Ova akcija se ne može poništiti.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Otkaži</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteDocument} className="bg-destructive text-destructive-foreground">
              Obriši
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
