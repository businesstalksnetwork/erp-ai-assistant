import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, FileText, Edit, Trash2, Copy, Eye } from "lucide-react";

const TEMPLATE_CATEGORIES = [
  { value: "employment", label: "Ugovori o radu" },
  { value: "hr", label: "HR dokumenta" },
  { value: "legal", label: "Pravna akta" },
  { value: "finance", label: "Finansijska dokumenta" },
  { value: "general", label: "Opšta" },
];

const SERBIAN_PRESETS = [
  {
    name: "Ugovor o radu",
    category: "employment",
    content: `UGOVOR O RADU\n\nBr. {{broj_ugovora}}\n\nZaključen dana {{datum}} u {{mesto}}, između:\n\n1. {{naziv_firme}}, sa sedištem u {{adresa_firme}}, MB: {{maticni_broj}}, PIB: {{pib}}, koju zastupa {{zastupnik}} (u daljem tekstu: Poslodavac)\n\n2. {{ime_zaposlenog}}, JMBG: {{jmbg}}, sa prebivalištem u {{adresa_zaposlenog}} (u daljem tekstu: Zaposleni)\n\nČlan 1. - Predmet ugovora\nPoslodavac zasniva radni odnos sa Zaposlenim na radnom mestu {{radno_mesto}} u {{organizaciona_jedinica}}.\n\nČlan 2. - Trajanje\nRadni odnos se zasniva na {{vrsta_radnog_odnosa}} vreme, počev od {{datum_pocetka}}.\n\nČlan 3. - Zarada\nZaposleni ima pravo na zaradu u iznosu od {{bruto_zarada}} RSD bruto mesečno.\n\nČlan 4. - Radno vreme\nPuno radno vreme iznosi {{radno_vreme}} časova nedeljno.\n\nU {{mesto}}, dana {{datum}}\n\nPoslodavac: _______________\nZaposleni: _______________`,
    variables: ["broj_ugovora", "datum", "mesto", "naziv_firme", "adresa_firme", "maticni_broj", "pib", "zastupnik", "ime_zaposlenog", "jmbg", "adresa_zaposlenog", "radno_mesto", "organizaciona_jedinica", "vrsta_radnog_odnosa", "datum_pocetka", "bruto_zarada", "radno_vreme"],
  },
  {
    name: "Potvrda o zaposlenju",
    category: "hr",
    content: `POTVRDA O ZAPOSLENJU\n\nBr. {{broj_potvrde}}\n\nPotvrđuje se da je {{ime_zaposlenog}}, JMBG: {{jmbg}}, zaposlen/a kod {{naziv_firme}} na radnom mestu {{radno_mesto}} od {{datum_pocetka}} na {{vrsta_radnog_odnosa}} vreme.\n\nMesečna zarada iznosi {{neto_zarada}} RSD neto.\n\nPotvrda se izdaje na zahtev zaposlenog radi podnošenja {{svrha}}.\n\nU {{mesto}}, dana {{datum}}\n\n{{naziv_firme}}\n_______________\n{{zastupnik}}`,
    variables: ["broj_potvrde", "ime_zaposlenog", "jmbg", "naziv_firme", "radno_mesto", "datum_pocetka", "vrsta_radnog_odnosa", "neto_zarada", "svrha", "mesto", "datum", "zastupnik"],
  },
  {
    name: "Odluka o godišnjem odmoru",
    category: "hr",
    content: `ODLUKA O KORIŠĆENJU GODIŠNJEG ODMORA\n\nBr. {{broj_odluke}}\n\nNa osnovu čl. 68-75. Zakona o radu, donosi se\n\nODLUKA\n\nZaposlenom/oj {{ime_zaposlenog}}, na radnom mestu {{radno_mesto}}, odobrava se korišćenje godišnjeg odmora za {{godina}}. godinu u trajanju od {{broj_dana}} radnih dana.\n\nGodišnji odmor se koristi u periodu od {{datum_od}} do {{datum_do}}.\n\nDan povratka na rad: {{datum_povratka}}\n\nU {{mesto}}, dana {{datum}}\n\nDirektor: _______________`,
    variables: ["broj_odluke", "ime_zaposlenog", "radno_mesto", "godina", "broj_dana", "datum_od", "datum_do", "datum_povratka", "mesto", "datum"],
  },
];

export default function DocumentTemplates() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [previewTemplate, setPreviewTemplate] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: "", description: "", category: "general", content: "",
  });
  const [filterCategory, setFilterCategory] = useState<string>("all");

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["document_templates", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase
        .from("document_templates" as any)
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .order("category")
        .order("name");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const filteredTemplates = filterCategory === "all"
    ? templates
    : templates.filter((t: any) => t.category === filterCategory);

  const extractVariables = (content: string): string[] => {
    const matches = content.match(/\{\{(\w+)\}\}/g) || [];
    return [...new Set(matches.map(m => m.replace(/[{}]/g, "")))];
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const variables = extractVariables(formData.content);
      const payload = {
        tenant_id: tenantId!,
        name: formData.name,
        description: formData.description,
        category: formData.category,
        content: formData.content,
        variables: variables,
        created_by: user?.id || null,
      };

      if (editingTemplate) {
        const { error } = await supabase.from("document_templates" as any)
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq("id", editingTemplate.id);
        if (error) throw error;

        // Save version
        await supabase.from("document_template_versions" as any).insert({
          template_id: editingTemplate.id,
          tenant_id: tenantId!,
          version_number: (editingTemplate.version_number || 1) + 1,
          content: formData.content,
          variables: variables,
          created_by: user?.id || null,
        });
      } else {
        const { error } = await supabase.from("document_templates" as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document_templates"] });
      setDialogOpen(false);
      setEditingTemplate(null);
      toast({ title: editingTemplate ? "Šablon ažuriran" : "Šablon kreiran" });
    },
    onError: (e: any) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("document_templates" as any).update({ is_active: false }).eq("id", id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document_templates"] });
      toast({ title: t("deleted") });
    },
  });

  const seedPresets = useMutation({
    mutationFn: async () => {
      const inserts = SERBIAN_PRESETS.map(p => ({
        tenant_id: tenantId!,
        name: p.name,
        category: p.category,
        content: p.content,
        variables: p.variables,
        is_system: true,
        created_by: user?.id || null,
      }));
      const { error } = await supabase.from("document_templates" as any).insert(inserts);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document_templates"] });
      toast({ title: "Šabloni uvezeni" });
    },
  });

  const openEdit = (tmpl: any) => {
    setEditingTemplate(tmpl);
    setFormData({ name: tmpl.name, description: tmpl.description || "", category: tmpl.category, content: tmpl.content });
    setDialogOpen(true);
  };

  const openNew = () => {
    setEditingTemplate(null);
    setFormData({ name: "", description: "", category: "general", content: "" });
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("documentTemplates" as any) || "Šabloni dokumenata"}</h1>
          <p className="text-muted-foreground text-sm">{t("documentTemplatesDesc" as any) || "Upravljajte šablonima sa promenljivim vrednostima"}</p>
        </div>
        <div className="flex gap-2">
          {templates.length === 0 && (
            <Button variant="outline" onClick={() => seedPresets.mutate()} disabled={seedPresets.isPending}>
              <Copy className="h-4 w-4 mr-2" />
              {t("importPresets" as any) || "Uvezi srpske šablone"}
            </Button>
          )}
          <Button onClick={openNew}>
            <Plus className="h-4 w-4 mr-2" />
            {t("newTemplate" as any) || "Novi šablon"}
          </Button>
        </div>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 flex-wrap">
        <Button size="sm" variant={filterCategory === "all" ? "default" : "outline"} onClick={() => setFilterCategory("all")}>
          {t("all")}
        </Button>
        {TEMPLATE_CATEGORIES.map(c => (
          <Button key={c.value} size="sm" variant={filterCategory === c.value ? "default" : "outline"} onClick={() => setFilterCategory(c.value)}>
            {c.label}
          </Button>
        ))}
      </div>

      {isLoading && <p className="text-muted-foreground">{t("loading")}</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTemplates.map((tmpl: any) => (
          <Card key={tmpl.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <CardTitle className="text-base truncate">{tmpl.name}</CardTitle>
                  {tmpl.description && <p className="text-xs text-muted-foreground mt-1">{tmpl.description}</p>}
                </div>
                <Badge variant="outline" className="text-xs shrink-0 ml-2">
                  {TEMPLATE_CATEGORIES.find(c => c.value === tmpl.category)?.label || tmpl.category}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1 mb-3">
                {((tmpl.variables as string[]) || []).slice(0, 5).map((v: string) => (
                  <Badge key={v} variant="secondary" className="text-xs font-mono">
                    {`{{${v}}}`}
                  </Badge>
                ))}
                {((tmpl.variables as string[]) || []).length > 5 && (
                  <Badge variant="secondary" className="text-xs">+{(tmpl.variables as string[]).length - 5}</Badge>
                )}
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => setPreviewTemplate(tmpl)}>
                  <Eye className="h-3 w-3" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => openEdit(tmpl)}>
                  <Edit className="h-3 w-3" />
                </Button>
                {!tmpl.is_system && (
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteMutation.mutate(tmpl.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? t("editTemplate" as any) || "Izmeni šablon" : t("newTemplate" as any) || "Novi šablon"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input placeholder={t("name")} value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} />
            <Input placeholder={t("description")} value={formData.description} onChange={e => setFormData(p => ({ ...p, description: e.target.value }))} />
            <Select value={formData.category} onValueChange={v => setFormData(p => ({ ...p, category: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TEMPLATE_CATEGORIES.map(c => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div>
              <p className="text-xs text-muted-foreground mb-1">
                {t("templateHint" as any) || "Koristite {{naziv_promenljive}} za promenljive vrednosti"}
              </p>
              <textarea
                className="w-full h-64 p-3 rounded-md border bg-background text-sm font-mono resize-y"
                value={formData.content}
                onChange={e => setFormData(p => ({ ...p, content: e.target.value }))}
                placeholder="Unesite sadržaj šablona..."
              />
            </div>
            {formData.content && (
              <div className="flex flex-wrap gap-1">
                <span className="text-xs text-muted-foreground mr-1">{t("detectedVariables" as any) || "Pronađene promenljive"}:</span>
                {extractVariables(formData.content).map(v => (
                  <Badge key={v} variant="secondary" className="text-xs font-mono">{v}</Badge>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("cancel")}</Button>
            <Button disabled={!formData.name || !formData.content || saveMutation.isPending} onClick={() => saveMutation.mutate()}>
              {t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewTemplate} onOpenChange={() => setPreviewTemplate(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{previewTemplate?.name}</DialogTitle>
          </DialogHeader>
          <pre className="whitespace-pre-wrap text-sm font-mono p-4 rounded-md bg-muted/50 border">
            {previewTemplate?.content}
          </pre>
        </DialogContent>
      </Dialog>
    </div>
  );
}
