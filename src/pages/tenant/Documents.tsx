import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Download, Trash2, Search } from "lucide-react";

const ENTITY_TYPES = ["invoice", "partner", "employee", "product", "production_order", "other"];

export default function Documents() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [filterEntity, setFilterEntity] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [form, setForm] = useState({ name: "", entity_type: "", entity_id: "", tags: "", notes: "" });
  const [file, setFile] = useState<File | null>(null);

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["documents", tenantId, filterEntity],
    queryFn: async () => {
      if (!tenantId) return [];
      let q = supabase.from("documents").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false });
      if (filterEntity) q = q.eq("entity_type", filterEntity);
      const { data } = await q;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const filtered = docs.filter((d: any) => !searchTerm || d.name.toLowerCase().includes(searchTerm.toLowerCase()));

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId || !file) throw new Error("Missing data");
      const filePath = `${tenantId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from("tenant-documents").upload(filePath, file);
      if (uploadError) throw uploadError;
      const tagsArr = form.tags ? form.tags.split(",").map(t => t.trim()).filter(Boolean) : [];
      await supabase.from("documents").insert({
        tenant_id: tenantId,
        name: form.name || file.name,
        file_path: filePath,
        file_type: file.type,
        file_size: file.size,
        entity_type: form.entity_type || null,
        entity_id: form.entity_id || null,
        uploaded_by: user?.id || null,
        tags: tagsArr,
        notes: form.notes || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      setOpen(false);
      setFile(null);
      toast({ title: t("success") });
    },
    onError: (e: any) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (doc: any) => {
      await supabase.storage.from("tenant-documents").remove([doc.file_path]);
      await supabase.from("documents").delete().eq("id", doc.id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["documents"] }),
  });

  const handleDownload = async (doc: any) => {
    const { data } = await supabase.storage.from("tenant-documents").download(doc.file_path);
    if (data) {
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url; a.download = doc.name; a.click();
      URL.revokeObjectURL(url);
    }
  };

  const formatSize = (bytes: number) => {
    if (!bytes) return "-";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1048576).toFixed(1) + " MB";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("documents")}</h1>
        <Button onClick={() => { setForm({ name: "", entity_type: "", entity_id: "", tags: "", notes: "" }); setFile(null); setOpen(true); }}><Plus className="h-4 w-4 mr-2" />{t("upload")}</Button>
      </div>
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder={t("search")} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
        <Select value={filterEntity} onValueChange={setFilterEntity}>
          <SelectTrigger className="w-48"><SelectValue placeholder={t("allTypes")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">{t("allTypes")}</SelectItem>
            {ENTITY_TYPES.map(et => <SelectItem key={et} value={et}>{et}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("name")}</TableHead>
            <TableHead>{t("type")}</TableHead>
            <TableHead>{t("entityType")}</TableHead>
            <TableHead>{t("fileSize")}</TableHead>
            <TableHead>{t("createdAt")}</TableHead>
            <TableHead>{t("actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow><TableCell colSpan={6}>{t("loading")}</TableCell></TableRow>
          ) : filtered.map((doc: any) => (
            <TableRow key={doc.id}>
              <TableCell className="font-medium">{doc.name}</TableCell>
              <TableCell>{doc.file_type || "-"}</TableCell>
              <TableCell>{doc.entity_type ? <Badge variant="outline">{doc.entity_type}</Badge> : "-"}</TableCell>
              <TableCell>{formatSize(doc.file_size)}</TableCell>
              <TableCell>{new Date(doc.created_at).toLocaleDateString()}</TableCell>
              <TableCell className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => handleDownload(doc)}><Download className="h-3 w-3" /></Button>
                <Button size="sm" variant="destructive" onClick={() => deleteMutation.mutate(doc)}><Trash2 className="h-3 w-3" /></Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("upload")} {t("documents")}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>{t("file")}</Label><Input type="file" onChange={e => { const f = e.target.files?.[0]; if (f) { setFile(f); if (!form.name) setForm(prev => ({ ...prev, name: f.name })); } }} /></div>
            <div><Label>{t("name")}</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div>
              <Label>{t("entityType")} ({t("optional")})</Label>
              <Select value={form.entity_type} onValueChange={v => setForm({ ...form, entity_type: v })}>
                <SelectTrigger><SelectValue placeholder={t("selectProduct")} /></SelectTrigger>
                <SelectContent>{ENTITY_TYPES.map(et => <SelectItem key={et} value={et}>{et}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Tags ({t("optional")})</Label><Input value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} placeholder="tag1, tag2" /></div>
            <div><Label>{t("notes")}</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={() => uploadMutation.mutate()} disabled={!file}>{t("upload")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
