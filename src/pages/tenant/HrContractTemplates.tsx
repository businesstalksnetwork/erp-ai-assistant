import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Plus, Copy, Pencil, Trash2, Search } from "lucide-react";

const TEMPLATE_TYPES = [
  { value: "permanent", label: "Ugovor o radu na neodređeno" },
  { value: "fixed_term", label: "Ugovor o radu na određeno" },
  { value: "amendment", label: "Aneks ugovora o radu" },
  { value: "service", label: "Ugovor o delu" },
  { value: "copyright", label: "Autorski ugovor" },
  { value: "internship", label: "Ugovor o stručnom osposobljavanju" },
  { value: "probation", label: "Ugovor sa probnim radom" },
  { value: "part_time", label: "Ugovor o radu sa nepunim radnim vremenom" },
  { value: "seasonal", label: "Ugovor o sezonskom radu" },
  { value: "remote", label: "Ugovor o radu na daljinu" },
  { value: "temporary_agency", label: "Ugovor o ustupanju zaposlenih" },
  { value: "director", label: "Ugovor o pravima i obavezama direktora" },
  { value: "non_compete", label: "Klauzula zabrane konkurencije" },
  { value: "confidentiality", label: "Ugovor o poverljivosti" },
];

const DEFAULT_TEMPLATES = [
  {
    name: "Ugovor o radu na neodređeno vreme",
    template_type: "permanent",
    legal_references: ["Čl. 30 ZoR", "Čl. 31 ZoR", "Čl. 33 ZoR"],
    variables: ["ime_prezime", "jmbg", "adresa", "radno_mesto", "bruto_zarada", "datum_pocetka", "radno_vreme", "godisnji_odmor"],
    content: `UGOVOR O RADU NA NEODREĐENO VREME

Zaključen dana {{datum_pocetka}} između:

POSLODAVAC: {{naziv_firme}}, sa sedištem u {{sediste_firme}}, PIB: {{pib_firme}}, MB: {{mb_firme}}, koga zastupa {{zastupnik}}

ZAPOSLENI: {{ime_prezime}}, JMBG: {{jmbg}}, sa prebivalištem u {{adresa}}

Član 1. ZASNIVANJE RADNOG ODNOSA
Zaposleni zasniva radni odnos na neodređeno vreme počev od {{datum_pocetka}}.

Član 2. RADNO MESTO I OPIS POSLOVA
Zaposleni se raspoređuje na radno mesto: {{radno_mesto}}.

Član 3. RADNO VREME
Puno radno vreme iznosi {{radno_vreme}} časova nedeljno.

Član 4. ZARADA
Bruto zarada zaposlenog iznosi {{bruto_zarada}} RSD mesečno.
Zarada se isplaćuje najkasnije do kraja tekućeg meseca za prethodni mesec.

Član 5. GODIŠNJI ODMOR
Zaposleni ima pravo na godišnji odmor u trajanju od {{godisnji_odmor}} radnih dana.

Član 6. OSTALA PRAVA I OBAVEZE
Na prava i obaveze koje nisu regulisane ovim ugovorom primenjuju se odredbe Zakona o radu, kolektivnog ugovora i opšteg akta poslodavca.

Član 7. PRESTANAK RADNOG ODNOSA
Radni odnos prestaje u skladu sa zakonom, uz otkazni rok od 15 dana (zaposleni) odnosno 30 dana (poslodavac).

U ____________________, dana {{datum_pocetka}}

POSLODAVAC:                    ZAPOSLENI:
_________________              _________________`,
  },
  {
    name: "Ugovor o radu na određeno vreme",
    template_type: "fixed_term",
    legal_references: ["Čl. 37 ZoR", "Čl. 37a ZoR"],
    variables: ["ime_prezime", "jmbg", "adresa", "radno_mesto", "bruto_zarada", "datum_pocetka", "datum_zavrsetka", "razlog_odredjeno"],
    content: `UGOVOR O RADU NA ODREĐENO VREME

Zaključen dana {{datum_pocetka}} između:

POSLODAVAC: {{naziv_firme}}, PIB: {{pib_firme}}
ZAPOSLENI: {{ime_prezime}}, JMBG: {{jmbg}}, adresa: {{adresa}}

Član 1. Zaposleni zasniva radni odnos na ODREĐENO vreme od {{datum_pocetka}} do {{datum_zavrsetka}}.
Razlog zasnivanja radnog odnosa na određeno: {{razlog_odredjeno}}.

Član 2. Radno mesto: {{radno_mesto}}.
Član 3. Bruto zarada: {{bruto_zarada}} RSD mesečno.

Član 4. Po isteku roka na koji je zasnovan radni odnos, isti prestaje, osim ako se ugovorom ne produži ili pretvori u radni odnos na neodređeno vreme.

POSLODAVAC:                    ZAPOSLENI:
_________________              _________________`,
  },
  {
    name: "Aneks ugovora o radu",
    template_type: "amendment",
    legal_references: ["Čl. 171-174 ZoR"],
    variables: ["ime_prezime", "broj_osnovnog_ugovora", "datum_osnovnog_ugovora", "predmet_izmene", "nova_vrednost", "datum_primene"],
    content: `ANEKS BR. ___ UGOVORA O RADU

Zaključen dana {{datum_primene}} uz saglasnost obe strane.

Na osnovu čl. 171-174 Zakona o radu, menja se Ugovor o radu br. {{broj_osnovnog_ugovora}} od {{datum_osnovnog_ugovora}} zaključen sa zaposlenim {{ime_prezime}}.

Predmet izmene: {{predmet_izmene}}
Nova vrednost: {{nova_vrednost}}
Primenjuje se od: {{datum_primene}}

Ostale odredbe osnovnog ugovora ostaju na snazi.

POSLODAVAC:                    ZAPOSLENI:
_________________              _________________`,
  },
  {
    name: "Ugovor o delu",
    template_type: "service",
    legal_references: ["Čl. 199 ZoR", "Čl. 600 ZOO"],
    variables: ["ime_prezime", "jmbg", "opis_posla", "rok_zavrsetka", "naknada", "datum_ugovora"],
    content: `UGOVOR O DELU

Zaključen dana {{datum_ugovora}} između:

NARUČILAC: {{naziv_firme}}, PIB: {{pib_firme}}
IZVRŠILAC: {{ime_prezime}}, JMBG: {{jmbg}}

Član 1. Izvršilac se obavezuje da za naručioca obavi sledeći posao: {{opis_posla}}.
Član 2. Rok za završetak posla: {{rok_zavrsetka}}.
Član 3. Naknada za izvršeni posao iznosi {{naknada}} RSD (bruto).
Član 4. Naručilac je u obavezi da obračuna i uplati porez i doprinose u skladu sa zakonom.

NARUČILAC:                     IZVRŠILAC:
_________________              _________________`,
  },
  {
    name: "Autorski ugovor",
    template_type: "copyright",
    legal_references: ["Čl. 199 ZoR", "ZASP"],
    variables: ["ime_prezime", "jmbg", "opis_dela", "naknada", "rok_predaje", "datum_ugovora"],
    content: `AUTORSKI UGOVOR

Zaključen dana {{datum_ugovora}} između:

NARUČILAC: {{naziv_firme}}, PIB: {{pib_firme}}
AUTOR: {{ime_prezime}}, JMBG: {{jmbg}}

Član 1. Autor se obavezuje da za naručioca izradi autorsko delo: {{opis_dela}}.
Član 2. Rok za predaju: {{rok_predaje}}.
Član 3. Autorska naknada iznosi {{naknada}} RSD (bruto).
Član 4. Naručilac stiče pravo korišćenja dela u skladu sa ugovorom.

NARUČILAC:                     AUTOR:
_________________              _________________`,
  },
];

export default function HrContractTemplates() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [editDialog, setEditDialog] = useState<any | null>(null);
  const [previewDialog, setPreviewDialog] = useState<any | null>(null);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["hr-contract-templates", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hr_contract_templates" as any)
        .select("*")
        .or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
        .eq("is_active", true)
        .order("template_type");
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const seedMut = useMutation({
    mutationFn: async () => {
      const inserts = DEFAULT_TEMPLATES.map(t => ({
        tenant_id: tenantId,
        name: t.name,
        template_type: t.template_type,
        content: t.content,
        variables: t.variables,
        legal_references: t.legal_references,
        is_system: false,
      }));
      const { error } = await (supabase.from("hr_contract_templates" as any) as any).insert(inserts);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hr-contract-templates"] });
      toast({ title: "Šabloni učitani", description: `${DEFAULT_TEMPLATES.length} šablona dodato.` });
    },
    onError: (e: any) => toast({ title: "Greška", description: e.message, variant: "destructive" }),
  });

  const saveMut = useMutation({
    mutationFn: async (tmpl: any) => {
      if (tmpl.id) {
        const { error } = await (supabase.from("hr_contract_templates" as any) as any)
          .update({ name: tmpl.name, template_type: tmpl.template_type, content: tmpl.content, variables: tmpl.variables, legal_references: tmpl.legal_references })
          .eq("id", tmpl.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase.from("hr_contract_templates" as any) as any)
          .insert([{ tenant_id: tenantId, name: tmpl.name, template_type: tmpl.template_type, content: tmpl.content, variables: tmpl.variables || [], legal_references: tmpl.legal_references || [] }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hr-contract-templates"] });
      setEditDialog(null);
      toast({ title: "Šablon sačuvan" });
    },
    onError: (e: any) => toast({ title: "Greška", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("hr_contract_templates" as any) as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hr-contract-templates"] });
      toast({ title: "Šablon obrisan" });
    },
  });

  const filtered = (templates as any[]).filter((t: any) => {
    if (typeFilter !== "all" && t.template_type !== typeFilter) return false;
    if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const getTypeLabel = (type: string) => TEMPLATE_TYPES.find(t => t.value === type)?.label || type;

  return (
    <div className="space-y-6">
      <PageHeader title="Šabloni ugovora o radu" description="Upravljajte šablonima za HR ugovore u skladu sa Zakonom o radu" icon={FileText} />

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Pretraži šablone..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[240px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Svi tipovi</SelectItem>
            {TEMPLATE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={() => seedMut.mutate()} disabled={seedMut.isPending}>
          <Copy className="h-4 w-4 mr-1" /> Učitaj podrazumevane
        </Button>
        <Button onClick={() => setEditDialog({ name: "", template_type: "permanent", content: "", variables: [], legal_references: [] })}>
          <Plus className="h-4 w-4 mr-1" /> Novi šablon
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Naziv</TableHead>
                <TableHead>Tip</TableHead>
                <TableHead>Pravni osnov</TableHead>
                <TableHead>Varijable</TableHead>
                <TableHead className="w-[120px]">Akcije</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8">{t("loading")}</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nema šablona. Kliknite "Učitaj podrazumevane" za početak.</TableCell></TableRow>
              ) : filtered.map((tmpl: any) => (
                <TableRow key={tmpl.id} className="cursor-pointer" onClick={() => setPreviewDialog(tmpl)}>
                  <TableCell className="font-medium">{tmpl.name}</TableCell>
                  <TableCell><Badge variant="outline">{getTypeLabel(tmpl.template_type)}</Badge></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{(tmpl.legal_references || []).join(", ") || "—"}</TableCell>
                  <TableCell><Badge variant="secondary">{(tmpl.variables as any[])?.length || 0}</Badge></TableCell>
                  <TableCell>
                    <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                      <Button size="icon" variant="ghost" onClick={() => setEditDialog(tmpl)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => deleteMut.mutate(tmpl.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editDialog} onOpenChange={() => setEditDialog(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editDialog?.id ? "Izmeni šablon" : "Novi šablon"}</DialogTitle></DialogHeader>
          {editDialog && (
            <div className="space-y-4">
              <div className="grid gap-2">
                <Label>Naziv</Label>
                <Input value={editDialog.name} onChange={e => setEditDialog({ ...editDialog, name: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Tip ugovora</Label>
                <Select value={editDialog.template_type} onValueChange={v => setEditDialog({ ...editDialog, template_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TEMPLATE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Pravni osnov (razdvojeno zarezom)</Label>
                <Input value={(editDialog.legal_references || []).join(", ")} onChange={e => setEditDialog({ ...editDialog, legal_references: e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean) })} placeholder="Čl. 30 ZoR, Čl. 31 ZoR" />
              </div>
              <div className="grid gap-2">
                <Label>Varijable (razdvojeno zarezom, koristite u tekstu kao {"{{naziv}}"})</Label>
                <Input value={(editDialog.variables || []).join(", ")} onChange={e => setEditDialog({ ...editDialog, variables: e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean) })} placeholder="ime_prezime, jmbg, radno_mesto" />
              </div>
              <div className="grid gap-2">
                <Label>Sadržaj šablona</Label>
                <Textarea value={editDialog.content} onChange={e => setEditDialog({ ...editDialog, content: e.target.value })} rows={16} className="font-mono text-sm" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(null)}>Otkaži</Button>
            <Button onClick={() => saveMut.mutate(editDialog)} disabled={saveMut.isPending}>Sačuvaj</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewDialog} onOpenChange={() => setPreviewDialog(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{previewDialog?.name}</DialogTitle>
            <CardDescription>{getTypeLabel(previewDialog?.template_type || "")}</CardDescription>
          </DialogHeader>
          {previewDialog && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-1">
                {(previewDialog.legal_references || []).map((r: string) => <Badge key={r} variant="outline">{r}</Badge>)}
              </div>
              <div className="flex flex-wrap gap-1">
                {(previewDialog.variables as string[] || []).map((v: string) => <Badge key={v} variant="secondary">{`{{${v}}}`}</Badge>)}
              </div>
              <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-lg border max-h-[400px] overflow-y-auto font-mono">{previewDialog.content}</pre>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}