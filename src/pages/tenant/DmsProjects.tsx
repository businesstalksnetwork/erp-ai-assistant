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
import { useNavigate } from "react-router-dom";
import { Plus, Eye } from "lucide-react";

export default function DmsProjects() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", code: "", description: "", status: "active" });

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["dms_projects", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase.from("dms_projects").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!tenantId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId) return;
      const { data: project } = await supabase.from("dms_projects").insert({
        tenant_id: tenantId,
        name: form.name,
        code: form.code || null,
        description: form.description || null,
        status: form.status,
        created_by: user?.id,
      }).select().single();

      // Add creator as owner
      if (project && user?.id) {
        await supabase.from("dms_project_members").insert({
          tenant_id: tenantId,
          project_id: project.id,
          user_id: user.id,
          role: "owner",
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dms_projects"] });
      setOpen(false);
      toast({ title: t("success") });
    },
    onError: (e: any) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("dmsProjects")}</h1>
          <p className="text-muted-foreground text-sm">{t("dmsProjectsDesc")}</p>
        </div>
        <Button onClick={() => { setForm({ name: "", code: "", description: "", status: "active" }); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />{t("dmsNewProject")}
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("name")}</TableHead>
            <TableHead>{t("code")}</TableHead>
            <TableHead>{t("description")}</TableHead>
            <TableHead>{t("status")}</TableHead>
            <TableHead>{t("createdAt")}</TableHead>
            <TableHead>{t("actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow><TableCell colSpan={6}>{t("loading")}</TableCell></TableRow>
          ) : projects.map((p: any) => (
            <TableRow key={p.id}>
              <TableCell className="font-medium">{p.name}</TableCell>
              <TableCell className="font-mono">{p.code || "-"}</TableCell>
              <TableCell className="max-w-xs truncate">{p.description || "-"}</TableCell>
              <TableCell><Badge variant={p.status === "active" ? "default" : "secondary"}>{p.status}</Badge></TableCell>
              <TableCell>{new Date(p.created_at).toLocaleDateString()}</TableCell>
              <TableCell>
                <Button size="sm" variant="ghost" onClick={() => navigate(`/documents/projects/${p.id}`)}>
                  <Eye className="h-3 w-3 mr-1" />{t("view")}
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {!isLoading && projects.length === 0 && (
            <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">{t("noResults")}</TableCell></TableRow>
          )}
        </TableBody>
      </Table>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("dmsNewProject")}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>{t("name")} *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>{t("code")}</Label><Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} /></div>
            <div><Label>{t("description")}</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
            <div>
              <Label>{t("status")}</Label>
              <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">{t("active")}</SelectItem>
                  <SelectItem value="completed">{t("completed")}</SelectItem>
                  <SelectItem value="archived">{t("dmsArchived")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button onClick={() => createMutation.mutate()} disabled={!form.name}>{t("save")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
