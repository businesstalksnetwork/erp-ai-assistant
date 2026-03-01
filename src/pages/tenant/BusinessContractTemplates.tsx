import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Briefcase, Plus, Copy, Pencil, Trash2, Search, Scale } from "lucide-react";

const TEMPLATE_TYPES = [
  { value: "sales", label: "Ugovor o prodaji" },
  { value: "purchase", label: "Ugovor o kupovini" },
  { value: "lease", label: "Ugovor o zakupu" },
  { value: "nda", label: "Ugovor o poverljivosti (NDA)" },
  { value: "cesija", label: "Ugovor o cesiji" },
  { value: "loan", label: "Ugovor o zajmu" },
  { value: "franchise", label: "Ugovor o franšizi" },
  { value: "agency", label: "Ugovor o zastupanju" },
  { value: "commission", label: "Komisioni ugovor" },
  { value: "distribution", label: "Ugovor o distribuciji" },
  { value: "cooperation", label: "Ugovor o poslovnoj saradnji" },
  { value: "maintenance", label: "Ugovor o održavanju" },
  { value: "consulting", label: "Ugovor o konsaltingu" },
  { value: "transport", label: "Ugovor o prevozu" },
  { value: "insurance", label: "Ugovor o osiguranju" },
  { value: "guarantee", label: "Ugovor o garanciji" },
  { value: "asignacija", label: "Ugovor o asignaciji" },
  { value: "kompenzacija", label: "Ugovor o kompenzaciji" },
  { value: "storage", label: "Ugovor o skladištenju" },
  { value: "license", label: "Ugovor o licenci" },
];

const LEGAL_CLAUSES = {
  merodavno_pravo: "Na ovaj ugovor primenjuje se pravo Republike Srbije. Za sve sporove nadležan je stvarno nadležan sud u __________________.",
  pdv: "Svi iznosi u ovom ugovoru su izraženi bez PDV-a, osim ako je drugačije naznačeno. PDV se obračunava i plaća u skladu sa Zakonom o porezu na dodatu vrednost.",
  zzpl: "Ugovorne strane se obavezuju da će podatke o ličnosti obrađivati isključivo u skladu sa Zakonom o zaštiti podataka o ličnosti (ZZPL).",
  visa_sila: "Nijedna ugovorna strana neće biti odgovorna za neispunjenje ili kašnjenje u ispunjenju svojih obaveza, ukoliko je to posledica više sile (ratovi, prirodne katastrofe, pandemije, vladine odluke).",
  raskid: "Svaka ugovorna strana može raskinuti ovaj ugovor uz pisano obaveštenje od najmanje 30 dana.",
  arbitraza: "Sve sporove nastale iz ovog ugovora ugovorne strane će nastojati da reše mirnim putem. U slučaju nemogućnosti, spor se iznosi pred Spoljnotrgovinsku arbitražu pri Privrednoj komori Srbije.",
};

const DEFAULT_TEMPLATES = [
  {
    name: "Ugovor o prodaji robe",
    template_type: "sales",
    legal_clauses: ["merodavno_pravo", "pdv", "visa_sila"],
    variables: ["kupac_naziv", "kupac_pib", "predmet_prodaje", "kolicina", "cena", "rok_isporuke", "nacin_placanja"],
    content: `UGOVOR O PRODAJI ROBE

Zaključen dana __________ između:

PRODAVAC: {{naziv_firme}}, PIB: {{pib_firme}}, sa sedištem u {{sediste_firme}}
KUPAC: {{kupac_naziv}}, PIB: {{kupac_pib}}

Član 1. PREDMET UGOVORA
Prodavac se obavezuje da isporuči kupcu: {{predmet_prodaje}}, u količini od {{kolicina}}.

Član 2. CENA
Ukupna cena iznosi {{cena}} RSD (bez PDV-a).

Član 3. ROK ISPORUKE
Isporuka će biti izvršena najkasnije do {{rok_isporuke}}.

Član 4. NAČIN PLAĆANJA
{{nacin_placanja}}

Član 5. GARANCIJA
Prodavac garantuje kvalitet robe u skladu sa ugovorenim specifikacijama.`,
  },
  {
    name: "Ugovor o zakupu poslovnog prostora",
    template_type: "lease",
    legal_clauses: ["merodavno_pravo", "pdv", "raskid"],
    variables: ["zakupac_naziv", "zakupac_pib", "adresa_prostora", "povrsina_m2", "mesecna_zakupnina", "period_zakupa", "datum_pocetka"],
    content: `UGOVOR O ZAKUPU POSLOVNOG PROSTORA

Zaključen dana __________ između:

ZAKUPODAVAC: {{naziv_firme}}, PIB: {{pib_firme}}
ZAKUPAC: {{zakupac_naziv}}, PIB: {{zakupac_pib}}

Član 1. Zakupodavac daje, a zakupac prima u zakup poslovni prostor na adresi: {{adresa_prostora}}, površine {{povrsina_m2}} m².

Član 2. Mesečna zakupnina iznosi {{mesecna_zakupnina}} RSD.

Član 3. Zakup se zaključuje na period od {{period_zakupa}}, počev od {{datum_pocetka}}.

Član 4. Zakupac se obavezuje da prostor koristi isključivo za poslovne svrhe i da ga održava u ispravnom stanju.`,
  },
  {
    name: "Ugovor o poverljivosti (NDA)",
    template_type: "nda",
    legal_clauses: ["merodavno_pravo", "zzpl", "arbitraza"],
    variables: ["druga_strana_naziv", "druga_strana_pib", "predmet_poverljivosti", "trajanje_obaveze"],
    content: `UGOVOR O POVERLJIVOSTI (NDA)

Zaključen dana __________ između:

STRANA 1: {{naziv_firme}}, PIB: {{pib_firme}}
STRANA 2: {{druga_strana_naziv}}, PIB: {{druga_strana_pib}}

Član 1. Ugovorne strane se obavezuju da čuvaju poverljivost svih informacija razmenjenih u vezi sa: {{predmet_poverljivosti}}.

Član 2. Obaveza čuvanja poverljivosti traje {{trajanje_obaveze}} od datuma potpisivanja.

Član 3. Poverljivim informacijama se smatraju: poslovne tajne, finansijski podaci, tehnička dokumentacija, liste klijenata i svi drugi podaci označeni kao poverljivi.

Član 4. U slučaju kršenja obaveze poverljivosti, odgovorna strana snosi punu materijalnu odgovornost.`,
  },
  {
    name: "Ugovor o cesiji",
    template_type: "cesija",
    legal_clauses: ["merodavno_pravo", "pdv"],
    variables: ["cedent_naziv", "cedent_pib", "cesionar_naziv", "cesionar_pib", "iznos_potrazivanja", "duznik_naziv", "osnov_potrazivanja"],
    content: `UGOVOR O CESIJI (USTUPANJU POTRAŽIVANJA)

Na osnovu čl. 436-445 Zakona o obligacionim odnosima.

CEDENT (ustupilac): {{cedent_naziv}}, PIB: {{cedent_pib}}
CESIONAR (prijemnik): {{cesionar_naziv}}, PIB: {{cesionar_pib}}

Član 1. Cedent ustupa cesionaru potraživanje u iznosu od {{iznos_potrazivanja}} RSD prema dužniku {{duznik_naziv}}.

Član 2. Osnov potraživanja: {{osnov_potrazivanja}}.

Član 3. Cedent garantuje da potraživanje postoji i da nije opterećeno pravima trećih lica.

Član 4. Cedent je dužan da obavesti dužnika o izvršenoj cesiji.`,
  },
];

export default function BusinessContractTemplates() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [editDialog, setEditDialog] = useState<any | null>(null);
  const [previewDialog, setPreviewDialog] = useState<any | null>(null);
  const [generateDialog, setGenerateDialog] = useState<any | null>(null);
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [generatedContent, setGeneratedContent] = useState("");

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["business-contract-templates", tenantId],
    queryFn: async () => {
      const { data, error } = await (supabase.from("business_contract_templates" as any) as any)
        .select("*")
        .or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
        .eq("is_active", true)
        .order("template_type");
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: partners = [] } = useQuery({
    queryKey: ["partners-for-contract", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("partners")
        .select("id, name, pib, address")
        .eq("tenant_id", tenantId!)
        .order("name");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: tenantInfo } = useQuery({
    queryKey: ["tenant-info-biz-contract", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("legal_entities")
        .select("name, pib, maticni_broj, address")
        .eq("tenant_id", tenantId!)
        .limit(1)
        .maybeSingle();
      return data;
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
        legal_clauses: t.legal_clauses,
        is_system: false,
      }));
      const { error } = await (supabase.from("business_contract_templates" as any) as any).insert(inserts);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["business-contract-templates"] });
      toast({ title: "Šabloni učitani", description: `${DEFAULT_TEMPLATES.length} poslovnih šablona dodato.` });
    },
    onError: (e: any) => toast({ title: "Greška", description: e.message, variant: "destructive" }),
  });

  const saveMut = useMutation({
    mutationFn: async (tmpl: any) => {
      if (tmpl.id) {
        const { error } = await (supabase.from("business_contract_templates" as any) as any)
          .update({ name: tmpl.name, template_type: tmpl.template_type, content: tmpl.content, variables: tmpl.variables, legal_clauses: tmpl.legal_clauses })
          .eq("id", tmpl.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase.from("business_contract_templates" as any) as any)
          .insert([{ tenant_id: tenantId, name: tmpl.name, template_type: tmpl.template_type, content: tmpl.content, variables: tmpl.variables || [], legal_clauses: tmpl.legal_clauses || [] }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["business-contract-templates"] });
      setEditDialog(null);
      toast({ title: "Šablon sačuvan" });
    },
    onError: (e: any) => toast({ title: "Greška", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("business_contract_templates" as any) as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["business-contract-templates"] });
      toast({ title: "Šablon obrisan" });
    },
  });

  const openGenerate = (tmpl: any) => {
    setGenerateDialog(tmpl);
    const vals: Record<string, string> = {};
    if (tenantInfo) {
      vals.naziv_firme = tenantInfo.name || "";
      vals.pib_firme = tenantInfo.pib || "";
      vals.sediste_firme = tenantInfo.address || "";
    }
    setVariableValues(vals);
    setGeneratedContent("");
  };

  const autoFillPartner = (partnerId: string) => {
    const partner = partners.find(p => p.id === partnerId);
    if (!partner) return;
    const vals = { ...variableValues };
    // Try to fill common partner variables
    const partnerKeys = ["kupac_naziv", "zakupac_naziv", "druga_strana_naziv", "cesionar_naziv", "cedent_naziv"];
    for (const k of partnerKeys) {
      if ((generateDialog?.variables as string[] || []).includes(k)) {
        vals[k] = partner.name;
      }
    }
    const pibKeys = ["kupac_pib", "zakupac_pib", "druga_strana_pib", "cesionar_pib", "cedent_pib"];
    for (const k of pibKeys) {
      if ((generateDialog?.variables as string[] || []).includes(k) && partner.pib) {
        vals[k] = partner.pib;
      }
    }
    setVariableValues(vals);
  };

  const generateContract = () => {
    if (!generateDialog) return;
    let content = generateDialog.content;
    Object.entries(variableValues).forEach(([key, value]) => {
      content = content.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value || `[${key}]`);
    });
    content = content.replace(/\{\{(\w+)\}\}/g, "[_____]");

    // Append legal clauses
    const clauses = (generateDialog.legal_clauses || []) as string[];
    if (clauses.length > 0) {
      content += "\n\n--- PRAVNE KLAUZULE ---\n";
      clauses.forEach((key: string) => {
        const clause = LEGAL_CLAUSES[key as keyof typeof LEGAL_CLAUSES];
        if (clause) content += `\n${clause}\n`;
      });
    }

    setGeneratedContent(content);
  };

  const filtered = (templates as any[]).filter((t: any) => {
    if (typeFilter !== "all" && t.template_type !== typeFilter) return false;
    if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const getTypeLabel = (type: string) => TEMPLATE_TYPES.find(t => t.value === type)?.label || type;

  return (
    <div className="space-y-6">
      <PageHeader title="Poslovni ugovori — šabloni" description="Šabloni za poslovne ugovore sa srpskim pravnim klauzulama" icon={Briefcase} />

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
        <Button onClick={() => setEditDialog({ name: "", template_type: "sales", content: "", variables: [], legal_clauses: [] })}>
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
                <TableHead>Pravne klauzule</TableHead>
                <TableHead>Varijable</TableHead>
                <TableHead className="w-[160px]">Akcije</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8">{t("loading")}</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nema šablona. Kliknite "Učitaj podrazumevane" za početak.</TableCell></TableRow>
              ) : filtered.map((tmpl: any) => (
                <TableRow key={tmpl.id}>
                  <TableCell className="font-medium">{tmpl.name}</TableCell>
                  <TableCell><Badge variant="outline">{getTypeLabel(tmpl.template_type)}</Badge></TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(tmpl.legal_clauses || []).map((c: string) => <Badge key={c} variant="secondary" className="text-xs">{c.replace(/_/g, " ")}</Badge>)}
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="secondary">{(tmpl.variables as any[])?.length || 0}</Badge></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openGenerate(tmpl)} title="Generiši"><Scale className="h-4 w-4" /></Button>
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
              <div className="grid gap-2"><Label>Naziv</Label><Input value={editDialog.name} onChange={e => setEditDialog({ ...editDialog, name: e.target.value })} /></div>
              <div className="grid gap-2">
                <Label>Tip ugovora</Label>
                <Select value={editDialog.template_type} onValueChange={v => setEditDialog({ ...editDialog, template_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TEMPLATE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Pravne klauzule (razdvojeno zarezom)</Label>
                <Input value={(editDialog.legal_clauses || []).join(", ")} onChange={e => setEditDialog({ ...editDialog, legal_clauses: e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean) })} placeholder="merodavno_pravo, pdv, visa_sila" />
                <p className="text-xs text-muted-foreground">Dostupne: {Object.keys(LEGAL_CLAUSES).join(", ")}</p>
              </div>
              <div className="grid gap-2">
                <Label>Varijable (razdvojeno zarezom)</Label>
                <Input value={(editDialog.variables || []).join(", ")} onChange={e => setEditDialog({ ...editDialog, variables: e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean) })} />
              </div>
              <div className="grid gap-2"><Label>Sadržaj</Label><Textarea value={editDialog.content} onChange={e => setEditDialog({ ...editDialog, content: e.target.value })} rows={14} className="font-mono text-sm" /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(null)}>Otkaži</Button>
            <Button onClick={() => saveMut.mutate(editDialog)} disabled={saveMut.isPending}>Sačuvaj</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generate Dialog */}
      <Dialog open={!!generateDialog} onOpenChange={() => setGenerateDialog(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Generiši: {generateDialog?.name}</DialogTitle></DialogHeader>
          {generateDialog && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="grid gap-2">
                  <Label>Partner (auto-popuna)</Label>
                  <Select onValueChange={autoFillPartner}>
                    <SelectTrigger><SelectValue placeholder="Izaberite partnera..." /></SelectTrigger>
                    <SelectContent>
                      {partners.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {((generateDialog.variables as string[]) || []).map((v: string) => (
                  <div key={v} className="grid gap-1">
                    <Label className="text-sm">{v.replace(/_/g, " ")}</Label>
                    <Input value={variableValues[v] || ""} onChange={e => setVariableValues(prev => ({ ...prev, [v]: e.target.value }))} placeholder={v} />
                  </div>
                ))}
                <Button onClick={generateContract} className="w-full"><Scale className="h-4 w-4 mr-1" /> Generiši ugovor</Button>
              </div>
              <div>
                {generatedContent ? (
                  <pre className="whitespace-pre-wrap text-xs bg-muted p-3 rounded-lg border max-h-[500px] overflow-y-auto font-mono">{generatedContent}</pre>
                ) : (
                  <div className="text-center text-muted-foreground py-12 bg-muted rounded-lg">
                    <Briefcase className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Popunite varijable i kliknite "Generiši"</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}