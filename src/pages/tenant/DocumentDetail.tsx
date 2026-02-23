import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Download, Save, Eye, RotateCcw } from "lucide-react";

export default function DocumentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>({});
  const [changeSummary, setChangeSummary] = useState("");

  const { data: doc, isLoading } = useQuery({
    queryKey: ["document", id],
    queryFn: async () => {
      const { data } = await supabase.from("documents")
        .select("*, document_categories(code, name_sr, group_name_sr), confidentiality_levels(name_sr, color)")
        .eq("id", id).single();
      return data;
    },
    enabled: !!id,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["document_categories", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase.from("document_categories").select("*").eq("tenant_id", tenantId).order("sort_order");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: confLevels = [] } = useQuery({
    queryKey: ["confidentiality_levels", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase.from("confidentiality_levels").select("*").eq("tenant_id", tenantId).order("sort_order");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: versions = [] } = useQuery({
    queryKey: ["document_versions", id],
    queryFn: async () => {
      const { data } = await supabase.from("document_versions")
        .select("*").eq("document_id", id).order("version_number", { ascending: false });
      return data || [];
    },
    enabled: !!id,
  });

  const { data: activityLog = [] } = useQuery({
    queryKey: ["dms_activity", id],
    queryFn: async () => {
      const { data } = await supabase.from("dms_activity_log")
        .select("*").eq("entity_id", id).order("created_at", { ascending: false }).limit(50);
      return data || [];
    },
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!doc || !tenantId) return;
      // Create version snapshot before updating
      await supabase.from("document_versions").insert({
        tenant_id: tenantId,
        document_id: doc.id,
        version_number: doc.current_version,
        subject: doc.subject,
        sender: doc.sender,
        recipient: doc.recipient,
        category_id: doc.category_id,
        confidentiality_level_id: doc.confidentiality_level_id,
        date_received: doc.date_received,
        valid_until: doc.valid_until,
        status: doc.status,
        notes: doc.notes,
        tags: doc.tags,
        file_path: doc.file_path,
        file_type: doc.file_type,
        file_size: doc.file_size,
        change_summary: changeSummary || "Update",
        created_by: user?.id,
      });

      await supabase.from("documents").update({
        subject: form.subject,
        sender: form.sender,
        recipient: form.recipient,
        category_id: form.category_id || null,
        confidentiality_level_id: form.confidentiality_level_id || null,
        date_received: form.date_received || null,
        valid_until: form.valid_until || null,
        status: form.status,
        notes: form.notes,
        current_version: (doc.current_version || 1) + 1,
      }).eq("id", doc.id);

      // Log activity
      await supabase.from("dms_activity_log").insert({
        tenant_id: tenantId,
        user_id: user?.id,
        action: "document_update",
        entity_type: "document",
        entity_id: doc.id,
        details: { protocol_number: doc.protocol_number, change_summary: changeSummary },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document", id] });
      queryClient.invalidateQueries({ queryKey: ["document_versions", id] });
      queryClient.invalidateQueries({ queryKey: ["dms_activity", id] });
      setEditing(false);
      setChangeSummary("");
      toast({ title: t("success") });
    },
    onError: (e: any) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const handleDownload = async () => {
    if (!doc) return;
    const { data } = await supabase.storage.from("tenant-documents").download(doc.file_path);
    if (data) {
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url; a.download = doc.name; a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handlePreview = async () => {
    if (!doc) return;
    const { data } = await supabase.storage.from("tenant-documents").createSignedUrl(doc.file_path, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const startEditing = () => {
    if (!doc) return;
    setForm({
      subject: doc.subject || "",
      sender: doc.sender || "",
      recipient: doc.recipient || "",
      category_id: doc.category_id || "",
      confidentiality_level_id: doc.confidentiality_level_id || "",
      date_received: doc.date_received || "",
      valid_until: doc.valid_until || "",
      status: doc.status || "aktivan",
      notes: doc.notes || "",
    });
    setEditing(true);
  };

  const revertToVersion = async (version: any) => {
    if (!doc || !tenantId) return;
    // Create snapshot of current state
    await supabase.from("document_versions").insert({
      tenant_id: tenantId, document_id: doc.id, version_number: doc.current_version,
      subject: doc.subject, sender: doc.sender, recipient: doc.recipient,
      category_id: doc.category_id, confidentiality_level_id: doc.confidentiality_level_id,
      date_received: doc.date_received, valid_until: doc.valid_until, status: doc.status,
      notes: doc.notes, tags: doc.tags, file_path: doc.file_path, file_type: doc.file_type,
      file_size: doc.file_size, change_summary: `Revert to v${version.version_number}`,
      created_by: user?.id,
    });
    // Apply version data
    await supabase.from("documents").update({
      subject: version.subject, sender: version.sender, recipient: version.recipient,
      category_id: version.category_id, confidentiality_level_id: version.confidentiality_level_id,
      date_received: version.date_received, valid_until: version.valid_until,
      status: version.status, notes: version.notes, current_version: (doc.current_version || 1) + 1,
    }).eq("id", doc.id);
    queryClient.invalidateQueries({ queryKey: ["document", id] });
    queryClient.invalidateQueries({ queryKey: ["document_versions", id] });
    toast({ title: t("success") });
  };

  if (isLoading) return <div className="p-6">{t("loading")}</div>;
  if (!doc) return <div className="p-6">{t("noResults")}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/documents")}>
          <ArrowLeft className="h-4 w-4 mr-1" />{t("back")}
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold font-mono">{doc.protocol_number}</h1>
          <p className="text-muted-foreground">{doc.subject || doc.name}</p>
        </div>
        <div className="flex gap-2">
          {doc.file_path && (
            <>
              <Button variant="outline" size="sm" onClick={handlePreview}><Eye className="h-4 w-4 mr-1" />{t("view")}</Button>
              <Button variant="outline" size="sm" onClick={handleDownload}><Download className="h-4 w-4 mr-1" />{t("dmsDownload")}</Button>
            </>
          )}
          {!editing && <Button size="sm" onClick={startEditing}>{t("edit")}</Button>}
        </div>
      </div>

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">{t("dmsDetails")}</TabsTrigger>
          <TabsTrigger value="versions">{t("dmsVersions")} ({versions.length})</TabsTrigger>
          <TabsTrigger value="activity">{t("dmsActivityLog")}</TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          <Card>
            <CardContent className="pt-6 space-y-4">
              {editing ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>{t("dmsSubject")}</Label><Input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} /></div>
                    <div><Label>{t("status")}</Label>
                      <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="aktivan">Aktivan</SelectItem>
                          <SelectItem value="arhiviran">Arhiviran</SelectItem>
                          <SelectItem value="za_izlucivanje">Za izlučivanje</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div><Label>{t("sender")}</Label><Input value={form.sender} onChange={e => setForm({ ...form, sender: e.target.value })} /></div>
                    <div><Label>{t("recipient")}</Label><Input value={form.recipient} onChange={e => setForm({ ...form, recipient: e.target.value })} /></div>
                    <div><Label>{t("dmsCategory")}</Label>
                      <Select value={form.category_id} onValueChange={v => setForm({ ...form, category_id: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{categories.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.code} - {c.name_sr}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label>{t("dmsConfidentiality")}</Label>
                      <Select value={form.confidentiality_level_id} onValueChange={v => setForm({ ...form, confidentiality_level_id: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{confLevels.map((l: any) => <SelectItem key={l.id} value={l.id}>{l.name_sr}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label>{t("dmsDateReceived")}</Label><Input type="date" value={form.date_received} onChange={e => setForm({ ...form, date_received: e.target.value })} /></div>
                    <div><Label>{t("validUntil")}</Label><Input type="date" value={form.valid_until} onChange={e => setForm({ ...form, valid_until: e.target.value })} /></div>
                  </div>
                  <div><Label>{t("notes")}</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
                  <div><Label>{t("dmsChangeSummary")}</Label><Input value={changeSummary} onChange={e => setChangeSummary(e.target.value)} placeholder={t("dmsChangeSummaryPlaceholder")} /></div>
                  <div className="flex gap-2">
                    <Button onClick={() => updateMutation.mutate()}><Save className="h-4 w-4 mr-1" />{t("save")}</Button>
                    <Button variant="outline" onClick={() => setEditing(false)}>{t("cancel")}</Button>
                  </div>
                </>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div><Label className="text-muted-foreground">{t("dmsProtocolNumber")}</Label><p className="font-mono">{doc.protocol_number}</p></div>
                  <div><Label className="text-muted-foreground">{t("status")}</Label><Badge variant={doc.status === "aktivan" ? "default" : "secondary"}>{doc.status}</Badge></div>
                  <div><Label className="text-muted-foreground">{t("dmsSubject")}</Label><p>{doc.subject || "-"}</p></div>
                  <div><Label className="text-muted-foreground">{t("dmsCategory")}</Label><p>{doc.document_categories ? `${doc.document_categories.code} - ${doc.document_categories.name_sr}` : "-"}</p></div>
                  <div><Label className="text-muted-foreground">{t("sender")}</Label><p>{doc.sender || "-"}</p></div>
                  <div><Label className="text-muted-foreground">{t("recipient")}</Label><p>{doc.recipient || "-"}</p></div>
                  <div><Label className="text-muted-foreground">{t("dmsConfidentiality")}</Label>
                    {doc.confidentiality_levels ? <Badge style={{ backgroundColor: doc.confidentiality_levels.color, color: "#fff" }}>{doc.confidentiality_levels.name_sr}</Badge> : <p>-</p>}
                  </div>
                  <div><Label className="text-muted-foreground">{t("dmsDateReceived")}</Label><p>{doc.date_received ? new Date(doc.date_received).toLocaleDateString() : "-"}</p></div>
                  <div><Label className="text-muted-foreground">{t("validUntil")}</Label><p>{doc.valid_until ? new Date(doc.valid_until).toLocaleDateString() : "-"}</p></div>
                  <div><Label className="text-muted-foreground">{t("dmsVersion")}</Label><p>v{doc.current_version}</p></div>
                  <div><Label className="text-muted-foreground">{t("fileSize")}</Label><p>{doc.file_size ? `${(doc.file_size / 1024).toFixed(1)} KB` : "-"}</p></div>
                  <div><Label className="text-muted-foreground">{t("createdAt")}</Label><p>{new Date(doc.created_at).toLocaleDateString()}</p></div>
                  {doc.notes && <div className="col-span-2"><Label className="text-muted-foreground">{t("notes")}</Label><p>{doc.notes}</p></div>}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="versions">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("dmsVersion")}</TableHead>
                    <TableHead>{t("dmsChangeSummary")}</TableHead>
                    <TableHead>{t("date")}</TableHead>
                    <TableHead>{t("actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {versions.map((v: any) => (
                    <TableRow key={v.id}>
                      <TableCell>v{v.version_number}</TableCell>
                      <TableCell>{v.change_summary || "-"}</TableCell>
                      <TableCell>{new Date(v.created_at).toLocaleString()}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" onClick={() => revertToVersion(v)}>
                          <RotateCcw className="h-3 w-3 mr-1" />{t("dmsRevert")}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {versions.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">{t("dmsNoVersions")}</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity">
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-3">
                {activityLog.map((a: any) => (
                  <div key={a.id} className="flex items-center gap-3 py-2 border-b last:border-0">
                    <Badge variant="outline">{a.action}</Badge>
                    <span className="text-sm text-muted-foreground">{a.details?.change_summary || a.details?.protocol_number || ""}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</span>
                  </div>
                ))}
                {activityLog.length === 0 && <p className="text-center text-muted-foreground">{t("dmsNoActivity")}</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
