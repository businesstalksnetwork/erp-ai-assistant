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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Plus, Download, Trash2, Search, Eye, FileText, Filter, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { exportToCsv } from "@/lib/exportCsv";

const STATUS_OPTIONS = ["aktivan", "arhiviran", "za_izlucivanje"];

export default function Documents() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterConfidentiality, setFilterConfidentiality] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [filterSender, setFilterSender] = useState("");
  const [filterRecipient, setFilterRecipient] = useState("");
  const [form, setForm] = useState({
    subject: "", sender: "", recipient: "", category_id: "", confidentiality_level_id: "",
    date_received: "", valid_until: "", notes: "", tags: "",
  });
  const [file, setFile] = useState<File | null>(null);

  // Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ["document_categories", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase.from("document_categories").select("*").eq("tenant_id", tenantId).order("sort_order");
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Fetch confidentiality levels
  const { data: confLevels = [] } = useQuery({
    queryKey: ["confidentiality_levels", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase.from("confidentiality_levels").select("*").eq("tenant_id", tenantId).order("sort_order");
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Fetch documents
  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["documents", tenantId, filterCategory, filterStatus, filterConfidentiality],
    queryFn: async () => {
      if (!tenantId) return [];
      let q = supabase.from("documents").select("*, document_categories(code, name_sr), confidentiality_levels(name_sr, color)")
        .eq("tenant_id", tenantId).order("created_at", { ascending: false });
      if (filterCategory) q = q.eq("category_id", filterCategory);
      if (filterStatus) q = q.eq("status", filterStatus);
      if (filterConfidentiality) q = q.eq("confidentiality_level_id", filterConfidentiality);
      const { data } = await q;
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Filter locally for search, sender, recipient
  const filtered = docs.filter((d: any) => {
    const terms = searchTerm.toLowerCase().split(/[,\s]+/).filter(Boolean);
    const searchable = `${d.protocol_number || ""} ${d.subject || ""} ${d.name || ""} ${d.sender || ""} ${d.recipient || ""}`.toLowerCase();
    const matchesSearch = terms.length === 0 || terms.every(term => searchable.includes(term));
    const matchesSender = !filterSender || (d.sender || "").toLowerCase().includes(filterSender.toLowerCase());
    const matchesRecipient = !filterRecipient || (d.recipient || "").toLowerCase().includes(filterRecipient.toLowerCase());
    return matchesSearch && matchesSender && matchesRecipient;
  });

  // Upload mutation with protocol number generation
  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId || !file) throw new Error("Missing data");

      // Get category code for protocol number
      const category = categories.find((c: any) => c.id === form.category_id);
      const categoryCode = category?.code || "00";

      // Generate protocol number
      const { data: protocolData } = await supabase.rpc("generate_protocol_number", {
        p_tenant_id: tenantId,
        p_category_code: categoryCode,
      });
      const protocolNumber = protocolData || `001-${categoryCode}/${new Date().getFullYear()}`;

      // Get next seq number
      const year = new Date().getFullYear();
      const { data: seqData } = await supabase.from("documents")
        .select("seq_number").eq("tenant_id", tenantId)
        .gte("created_at", `${year}-01-01`).order("seq_number", { ascending: false }).limit(1);
      const nextSeq = (seqData?.[0]?.seq_number || 0) + 1;

      // Standardized file path
      const ext = file.name.split(".").pop() || "bin";
      const filePath = `${tenantId}/${year}/${categoryCode}/${protocolNumber.replace(/\//g, "_")}_${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage.from("tenant-documents").upload(filePath, file);
      if (uploadError) throw uploadError;

      const tagsArr = form.tags ? form.tags.split(",").map(t => t.trim()).filter(Boolean) : [];

      await supabase.from("documents").insert({
        tenant_id: tenantId,
        name: form.subject || file.name,
        protocol_number: protocolNumber,
        seq_number: nextSeq,
        subject: form.subject || null,
        sender: form.sender || null,
        recipient: form.recipient || null,
        category_id: form.category_id || null,
        confidentiality_level_id: form.confidentiality_level_id || null,
        date_received: form.date_received || null,
        valid_until: form.valid_until || null,
        file_path: filePath,
        file_type: file.type,
        file_size: file.size,
        uploaded_by: user?.id || null,
        created_by: user?.id || null,
        tags: tagsArr,
        notes: form.notes || null,
        status: "aktivan",
        current_version: 1,
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

  const statusColor = (s: string) => {
    if (s === "aktivan") return "default";
    if (s === "arhiviran") return "secondary";
    return "destructive";
  };

  const groupedCategories = categories.reduce((acc: any, c: any) => {
    if (!acc[c.group_name_sr]) acc[c.group_name_sr] = [];
    acc[c.group_name_sr].push(c);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("dmsRegistry")}</h1>
          <p className="text-muted-foreground text-sm">{t("dmsRegistryDesc")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => {
            if (filtered.length === 0) return;
            exportToCsv(filtered, [
              { key: "protocol_number", label: "Protocol" },
              { key: "subject", label: "Subject" },
              { key: "sender", label: "Sender" },
              { key: "status", label: "Status" },
              { key: "created_at", label: "Date" },
            ], "delovodnik");
          }}><Download className="h-4 w-4 mr-2" />{t("exportCsv")}</Button>
          <Button onClick={() => {
            setForm({ subject: "", sender: "", recipient: "", category_id: "", confidentiality_level_id: "", date_received: "", valid_until: "", notes: "", tags: "" });
            setFile(null);
            setOpen(true);
          }}>
            <Plus className="h-4 w-4 mr-2" />{t("dmsNewDocument")}
          </Button>
        </div>
      </div>

      {/* Search & Filters */}
      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder={t("dmsSearchPlaceholder")} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
            <Select value={filterStatus || "__all__"} onValueChange={v => setFilterStatus(v === "__all__" ? "" : v)}>
              <SelectTrigger className="w-40"><SelectValue placeholder={t("allStatuses")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">{t("allStatuses")}</SelectItem>
                {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterCategory || "__all__"} onValueChange={v => setFilterCategory(v === "__all__" ? "" : v)}>
              <SelectTrigger className="w-48"><SelectValue placeholder={t("dmsAllCategories")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">{t("dmsAllCategories")}</SelectItem>
                {categories.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.code} - {c.name_sr}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterConfidentiality || "__all__"} onValueChange={v => setFilterConfidentiality(v === "__all__" ? "" : v)}>
              <SelectTrigger className="w-40"><SelectValue placeholder={t("dmsAllLevels")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">{t("dmsAllLevels")}</SelectItem>
                {confLevels.map((l: any) => <SelectItem key={l.id} value={l.id}>{l.name_sr}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={() => setShowAdvanced(!showAdvanced)}>
              <Filter className="h-4 w-4" />
            </Button>
          </div>
          {showAdvanced && (
            <div className="flex gap-3">
              <Input placeholder={t("sender")} value={filterSender} onChange={e => setFilterSender(e.target.value)} />
              <Input placeholder={t("recipient")} value={filterRecipient} onChange={e => setFilterRecipient(e.target.value)} />
              <Button variant="ghost" size="sm" onClick={() => { setFilterSender(""); setFilterRecipient(""); setSearchTerm(""); setFilterCategory(""); setFilterStatus(""); setFilterConfidentiality(""); }}>
                <X className="h-4 w-4 mr-1" />{t("dmsResetFilters")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="flex gap-2 text-sm text-muted-foreground">
        <span>{filtered.length} {t("documents").toLowerCase()}</span>
      </div>

      {/* Documents Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("dmsProtocolNumber")}</TableHead>
            <TableHead>{t("dmsSubject")}</TableHead>
            <TableHead>{t("sender")}</TableHead>
            <TableHead>{t("dmsCategory")}</TableHead>
            <TableHead>{t("dmsConfidentiality")}</TableHead>
            <TableHead>{t("status")}</TableHead>
            <TableHead>{t("date")}</TableHead>
            <TableHead>{t("actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow><TableCell colSpan={8}>{t("loading")}</TableCell></TableRow>
          ) : filtered.length === 0 ? (
            <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">{t("noResults")}</TableCell></TableRow>
          ) : filtered.map((doc: any) => (
            <TableRow key={doc.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/documents/${doc.id}`)}>
              <TableCell className="font-mono font-medium">{doc.protocol_number || "-"}</TableCell>
              <TableCell>{doc.subject || doc.name}</TableCell>
              <TableCell>{doc.sender || "-"}</TableCell>
              <TableCell>
                {doc.document_categories ? (
                  <Badge variant="outline">{doc.document_categories.code}</Badge>
                ) : "-"}
              </TableCell>
              <TableCell>
                {doc.confidentiality_levels ? (
                  <Badge style={{ backgroundColor: doc.confidentiality_levels.color, color: "#fff" }}>
                    {doc.confidentiality_levels.name_sr}
                  </Badge>
                ) : "-"}
              </TableCell>
              <TableCell><Badge variant={statusColor(doc.status)}>{doc.status}</Badge></TableCell>
              <TableCell>{doc.date_received ? new Date(doc.date_received).toLocaleDateString() : new Date(doc.created_at).toLocaleDateString()}</TableCell>
              <TableCell>
                <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                  <Button size="sm" variant="ghost" onClick={() => navigate(`/documents/${doc.id}`)}><Eye className="h-3 w-3" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDownload(doc)}><Download className="h-3 w-3" /></Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteMutation.mutate(doc)}><Trash2 className="h-3 w-3" /></Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Upload Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{t("dmsNewDocument")}</DialogTitle></DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <div>
              <Label>{t("file")}</Label>
              <Input type="file" onChange={e => { const f = e.target.files?.[0]; if (f) setFile(f); }} />
            </div>
            <div>
              <Label>{t("dmsSubject")} *</Label>
              <Input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("sender")}</Label>
                <Input value={form.sender} onChange={e => setForm({ ...form, sender: e.target.value })} />
              </div>
              <div>
                <Label>{t("recipient")}</Label>
                <Input value={form.recipient} onChange={e => setForm({ ...form, recipient: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>{t("dmsCategory")}</Label>
              <Select value={form.category_id} onValueChange={v => setForm({ ...form, category_id: v })}>
                <SelectTrigger><SelectValue placeholder={t("dmsSelectCategory")} /></SelectTrigger>
                <SelectContent>
                  {Object.entries(groupedCategories).map(([group, cats]: [string, any]) => (
                    <div key={group}>
                      <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">{group}</div>
                      {cats.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.code} - {c.name_sr}</SelectItem>)}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("dmsConfidentiality")}</Label>
              <Select value={form.confidentiality_level_id} onValueChange={v => setForm({ ...form, confidentiality_level_id: v })}>
                <SelectTrigger><SelectValue placeholder={t("dmsSelectLevel")} /></SelectTrigger>
                <SelectContent>
                  {confLevels.map((l: any) => <SelectItem key={l.id} value={l.id}>{l.name_sr}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("dmsDateReceived")}</Label>
                <Input type="date" value={form.date_received} onChange={e => setForm({ ...form, date_received: e.target.value })} />
              </div>
              <div>
                <Label>{t("validUntil")} ({t("optional")})</Label>
                <Input type="date" value={form.valid_until} onChange={e => setForm({ ...form, valid_until: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Tags ({t("optional")})</Label>
              <Input value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} placeholder="tag1, tag2" />
            </div>
            <div>
              <Label>{t("notes")}</Label>
              <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => uploadMutation.mutate()} disabled={!file || !form.subject}>
              {t("dmsRegisterDocument")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
