import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { ChevronDown, Plus, Pencil, Trash2 } from "lucide-react";

const RETENTION_INFO = [
  { period: "Trajno (Permanent)", description: "Dokumenti trajne vrednosti koji se čuvaju zauvek" },
  { period: "10 godina", description: "Finansijski dokumenti, ugovori, kadrovska evidencija" },
  { period: "5 godina", description: "Poslovni izveštaji, zapisnici, korespondencija" },
  { period: "3 godine", description: "Dnevna korespondencija, interne beleške" },
  { period: "2 godine", description: "Pomoćna dokumentacija, privremeni dokumenti" },
];

const ROLES = ["admin", "manager", "user", "accountant", "hr_manager"];

type CategoryForm = { code: string; name: string; name_sr: string; group_name: string; group_name_sr: string; sort_order: number };
type ConfLevelForm = { name: string; name_sr: string; color: string; sort_order: number };
type AccessRuleForm = { role: string; confidentiality_level_id: string; can_read: boolean; can_edit: boolean };

const emptyCat: CategoryForm = { code: "", name: "", name_sr: "", group_name: "", group_name_sr: "", sort_order: 0 };
const emptyConf: ConfLevelForm = { name: "", name_sr: "", color: "#3b82f6", sort_order: 0 };
const emptyAccess: AccessRuleForm = { role: "", confidentiality_level_id: "", can_read: true, can_edit: false };

export default function DmsSettings() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { toast } = useToast();
  const qc = useQueryClient();

  // Category dialog state
  const [catOpen, setCatOpen] = useState(false);
  const [catForm, setCatForm] = useState<CategoryForm>(emptyCat);
  const [catEditId, setCatEditId] = useState<string | null>(null);

  // Conf level dialog state
  const [confOpen, setConfOpen] = useState(false);
  const [confForm, setConfForm] = useState<ConfLevelForm>(emptyConf);
  const [confEditId, setConfEditId] = useState<string | null>(null);

  // Access rule dialog state
  const [accessOpen, setAccessOpen] = useState(false);
  const [accessForm, setAccessForm] = useState<AccessRuleForm>(emptyAccess);

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

  const { data: accessMatrix = [] } = useQuery({
    queryKey: ["role_confidentiality_access", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase.from("role_confidentiality_access")
        .select("*, confidentiality_levels(name_sr)").eq("tenant_id", tenantId);
      return data || [];
    },
    enabled: !!tenantId,
  });

  // --- Category mutations ---
  const saveCatMutation = useMutation({
    mutationFn: async () => {
      if (catEditId) {
        const { error } = await supabase.from("document_categories").update(catForm).eq("id", catEditId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("document_categories").insert({ ...catForm, tenant_id: tenantId! });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["document_categories"] });
      setCatOpen(false);
      setCatForm(emptyCat);
      setCatEditId(null);
      toast({ title: t("success") });
    },
    onError: (e: any) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const deleteCatMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("document_categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["document_categories"] });
      toast({ title: t("success") });
    },
    onError: (e: any) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  // --- Conf level mutations ---
  const saveConfMutation = useMutation({
    mutationFn: async () => {
      if (confEditId) {
        const { error } = await supabase.from("confidentiality_levels").update(confForm).eq("id", confEditId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("confidentiality_levels").insert({ ...confForm, tenant_id: tenantId! });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["confidentiality_levels"] });
      setConfOpen(false);
      setConfForm(emptyConf);
      setConfEditId(null);
      toast({ title: t("success") });
    },
    onError: (e: any) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const deleteConfMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("confidentiality_levels").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["confidentiality_levels"] });
      toast({ title: t("success") });
    },
    onError: (e: any) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  // --- Access rule mutations ---
  const saveAccessMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("role_confidentiality_access").insert({
        ...accessForm,
        tenant_id: tenantId!,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["role_confidentiality_access"] });
      setAccessOpen(false);
      setAccessForm(emptyAccess);
      toast({ title: t("success") });
    },
    onError: (e: any) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const deleteAccessMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("role_confidentiality_access").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["role_confidentiality_access"] });
      toast({ title: t("success") });
    },
    onError: (e: any) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  // Group categories by group_name_sr
  const grouped = categories.reduce((acc: any, c: any) => {
    if (!acc[c.group_name_sr]) acc[c.group_name_sr] = [];
    acc[c.group_name_sr].push(c);
    return acc;
  }, {});

  const openEditCat = (c: any) => {
    setCatEditId(c.id);
    setCatForm({ code: c.code, name: c.name, name_sr: c.name_sr, group_name: c.group_name, group_name_sr: c.group_name_sr, sort_order: c.sort_order });
    setCatOpen(true);
  };

  const openEditConf = (l: any) => {
    setConfEditId(l.id);
    setConfForm({ name: l.name, name_sr: l.name_sr, color: l.color, sort_order: l.sort_order });
    setConfOpen(true);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("dmsSettings")}</h1>
        <p className="text-muted-foreground text-sm">{t("dmsSettingsDesc")}</p>
      </div>

      <Tabs defaultValue="categories">
        <TabsList>
          <TabsTrigger value="categories">{t("categories")}</TabsTrigger>
          <TabsTrigger value="retention">{t("dmsRetentionPeriod")}</TabsTrigger>
          <TabsTrigger value="confidentiality">{t("dmsConfidentiality")}</TabsTrigger>
          <TabsTrigger value="access">{t("dmsAccessMatrix")}</TabsTrigger>
        </TabsList>

        {/* ===== CATEGORIES TAB ===== */}
        <TabsContent value="categories" className="space-y-3">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => { setCatForm(emptyCat); setCatEditId(null); setCatOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" />{t("addCategory")}
            </Button>
          </div>
          {Object.entries(grouped).map(([group, cats]: [string, any]) => (
            <Collapsible key={group} defaultOpen>
              <CollapsibleTrigger className="flex w-full items-center justify-between p-3 bg-muted rounded-lg hover:bg-muted/80 group">
                <span className="font-medium">{group} ({cats.length})</span>
                <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="ml-4 mt-2 space-y-1">
                  {cats.map((c: any) => (
                    <div key={c.id} className="flex items-center gap-3 py-1 px-2 rounded hover:bg-muted/30">
                      <Badge variant="outline" className="font-mono">{c.code}</Badge>
                      <span className="text-sm">{c.name_sr}</span>
                      <span className="text-xs text-muted-foreground ml-auto">{c.name}</span>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditCat(c)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { if (confirm(t("confirmDelete"))) deleteCatMutation.mutate(c.id); }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          ))}
          {categories.length === 0 && <p className="text-center text-muted-foreground py-8">{t("dmsCategoriesEmpty")}</p>}
        </TabsContent>

        {/* ===== RETENTION TAB ===== */}
        <TabsContent value="retention">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("dmsRetentionPeriod")}</TableHead>
                    <TableHead>{t("description")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {RETENTION_INFO.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell><Badge variant="outline">{r.period}</Badge></TableCell>
                      <TableCell>{r.description}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== CONFIDENTIALITY TAB ===== */}
        <TabsContent value="confidentiality">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">{t("dmsConfidentiality")}</CardTitle>
              <Button size="sm" onClick={() => { setConfForm(emptyConf); setConfEditId(null); setConfOpen(true); }}>
                <Plus className="h-4 w-4 mr-1" />{t("addConfLevel")}
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("name")}</TableHead>
                    <TableHead>{t("colorCode")}</TableHead>
                    <TableHead>{t("dmsOrder")}</TableHead>
                    <TableHead>{t("actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {confLevels.map((l: any) => (
                    <TableRow key={l.id}>
                      <TableCell>{l.name_sr}</TableCell>
                      <TableCell><div className="w-6 h-6 rounded" style={{ backgroundColor: l.color }} /></TableCell>
                      <TableCell>{l.sort_order}</TableCell>
                      <TableCell className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditConf(l)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { if (confirm(t("confirmDelete"))) deleteConfMutation.mutate(l.id); }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {confLevels.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">{t("dmsCategoriesEmpty")}</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== ACCESS MATRIX TAB ===== */}
        <TabsContent value="access">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">{t("dmsAccessMatrix")}</CardTitle>
              <Button size="sm" onClick={() => { setAccessForm(emptyAccess); setAccessOpen(true); }}>
                <Plus className="h-4 w-4 mr-1" />{t("addAccessRule")}
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("dmsRole")}</TableHead>
                    <TableHead>{t("dmsConfidentiality")}</TableHead>
                    <TableHead>{t("dmsCanRead")}</TableHead>
                    <TableHead>{t("dmsCanEdit")}</TableHead>
                    <TableHead>{t("actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accessMatrix.map((a: any) => (
                    <TableRow key={a.id}>
                      <TableCell><Badge variant="outline">{a.role}</Badge></TableCell>
                      <TableCell>{a.confidentiality_levels?.name_sr || "-"}</TableCell>
                      <TableCell>{a.can_read ? "✓" : "✗"}</TableCell>
                      <TableCell>{a.can_edit ? "✓" : "✗"}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { if (confirm(t("confirmDelete"))) deleteAccessMutation.mutate(a.id); }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {accessMatrix.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">{t("dmsAccessMatrixEmpty")}</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ===== CATEGORY DIALOG ===== */}
      <Dialog open={catOpen} onOpenChange={setCatOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{catEditId ? t("editCategory") : t("addCategory")}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>{t("dmsCategoryCode")}</Label><Input value={catForm.code} onChange={e => setCatForm(p => ({ ...p, code: e.target.value }))} /></div>
              <div><Label>{t("sortOrder")}</Label><Input type="number" value={catForm.sort_order} onChange={e => setCatForm(p => ({ ...p, sort_order: Number(e.target.value) }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>{t("categoryNameSr")}</Label><Input value={catForm.name_sr} onChange={e => setCatForm(p => ({ ...p, name_sr: e.target.value }))} /></div>
              <div><Label>{t("categoryNameEn")}</Label><Input value={catForm.name} onChange={e => setCatForm(p => ({ ...p, name: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>{t("groupNameSr")}</Label><Input value={catForm.group_name_sr} onChange={e => setCatForm(p => ({ ...p, group_name_sr: e.target.value }))} /></div>
              <div><Label>{t("groupName")}</Label><Input value={catForm.group_name} onChange={e => setCatForm(p => ({ ...p, group_name: e.target.value }))} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => saveCatMutation.mutate()} disabled={saveCatMutation.isPending || !catForm.code || !catForm.name_sr}>
              {t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== CONFIDENTIALITY LEVEL DIALOG ===== */}
      <Dialog open={confOpen} onOpenChange={setConfOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{confEditId ? t("editLevel") : t("addConfLevel")}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>{t("categoryNameSr")}</Label><Input value={confForm.name_sr} onChange={e => setConfForm(p => ({ ...p, name_sr: e.target.value }))} /></div>
              <div><Label>{t("categoryNameEn")}</Label><Input value={confForm.name} onChange={e => setConfForm(p => ({ ...p, name: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>{t("colorCode")}</Label><Input type="color" value={confForm.color} onChange={e => setConfForm(p => ({ ...p, color: e.target.value }))} className="h-11 p-1" /></div>
              <div><Label>{t("sortOrder")}</Label><Input type="number" value={confForm.sort_order} onChange={e => setConfForm(p => ({ ...p, sort_order: Number(e.target.value) }))} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => saveConfMutation.mutate()} disabled={saveConfMutation.isPending || !confForm.name_sr}>
              {t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== ACCESS RULE DIALOG ===== */}
      <Dialog open={accessOpen} onOpenChange={setAccessOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("addAccessRule")}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label>{t("dmsRole")}</Label>
              <Select value={accessForm.role} onValueChange={v => setAccessForm(p => ({ ...p, role: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("dmsConfidentiality")}</Label>
              <Select value={accessForm.confidentiality_level_id} onValueChange={v => setAccessForm(p => ({ ...p, confidentiality_level_id: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {confLevels.map((l: any) => <SelectItem key={l.id} value={l.id}>{l.name_sr}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Checkbox checked={accessForm.can_read} onCheckedChange={v => setAccessForm(p => ({ ...p, can_read: !!v }))} />
                <Label>{t("dmsCanRead")}</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox checked={accessForm.can_edit} onCheckedChange={v => setAccessForm(p => ({ ...p, can_edit: !!v }))} />
                <Label>{t("dmsCanEdit")}</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => saveAccessMutation.mutate()} disabled={saveAccessMutation.isPending || !accessForm.role || !accessForm.confidentiality_level_id}>
              {t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
