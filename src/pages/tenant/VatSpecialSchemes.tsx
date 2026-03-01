import { useState, useEffect } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tractor, Plane, Package, Info } from "lucide-react";

interface SpecialScheme {
  key: string;
  name: string;
  article: string;
  description: string;
  icon: React.ReactNode;
  popdvFields: { field: string; description: string }[];
}

const SCHEMES: SpecialScheme[] = [
  {
    key: "agricultural_compensation",
    name: "Poljoprivredni kompenzacioni dodatak",
    article: "Čl. 34 ZPDV",
    description: "Poseban postupak oporezivanja za poljoprivrednike. PDV nadoknada od 8% na otkup od registrovanih poljoprivrednih gazdinstava.",
    icon: <Tractor className="h-5 w-5" />,
    popdvFields: [
      { field: "3a.2", description: "Nabavke od poljoprivrednika — osnovica" },
      { field: "3a.3", description: "PDV nadoknada (8%)" },
      { field: "8v.2", description: "Prethodni porez — kompenzacija" },
    ],
  },
  {
    key: "travel_agency",
    name: "Turistička agencija — poseban postupak",
    article: "Čl. 35 ZPDV",
    description: "Oporezivanje po posebnom postupku za turističke agencije. Osnovica je razlika između ukupne naknade i stvarnih troškova.",
    icon: <Plane className="h-5 w-5" />,
    popdvFields: [
      { field: "2.3", description: "Promet turističke agencije — marža" },
      { field: "2.4", description: "PDV na maržu (20%)" },
    ],
  },
  {
    key: "used_goods",
    name: "Polovna dobra — oporezivanje marže",
    article: "Čl. 36 ZPDV",
    description: "Poseban postupak za promet polovnih dobara, umetničkih dela, kolekcionarskih predmeta i antikviteta. PDV se obračunava na razliku (maržu).",
    icon: <Package className="h-5 w-5" />,
    popdvFields: [
      { field: "2.5", description: "Promet polovnih dobara — marža" },
      { field: "2.6", description: "PDV na maržu (20%)" },
    ],
  },
];

export default function VatSpecialSchemes() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [enabledSchemes, setEnabledSchemes] = useState<Record<string, boolean>>({});

  // CR5-05: Load persisted scheme config from tenant_settings
  const { data: settingsRow } = useQuery({
    queryKey: ["tenant-settings", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("tenant_settings")
        .select("settings")
        .eq("tenant_id", tenantId!)
        .maybeSingle();
      return data;
    },
    enabled: !!tenantId,
  });

  useEffect(() => {
    if (settingsRow?.settings) {
      const s = settingsRow.settings as Record<string, any>;
      if (s.vat_special_schemes) {
        setEnabledSchemes(s.vat_special_schemes);
      }
    }
  }, [settingsRow]);

  const saveMut = useMutation({
    mutationFn: async (schemes: Record<string, boolean>) => {
      const existing = settingsRow?.settings as Record<string, any> || {};
      const updated = { ...existing, vat_special_schemes: schemes };
      if (settingsRow) {
        const { error } = await supabase
          .from("tenant_settings")
          .update({ settings: updated as any })
          .eq("tenant_id", tenantId!);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("tenant_settings")
          .insert([{ tenant_id: tenantId!, settings: updated as any }]);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tenant-settings", tenantId] }),
  });

  const toggleScheme = (key: string) => {
    const next = { ...enabledSchemes, [key]: !enabledSchemes[key] };
    setEnabledSchemes(next);
    saveMut.mutate(next);
    toast({
      title: next[key] ? "Šema aktivirana" : "Šema deaktivirana",
      description: `${SCHEMES.find(s => s.key === key)?.name} je ${next[key] ? "uključena" : "isključena"}.`,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Posebni PDV postupci</h1>
        <p className="text-muted-foreground">
          Konfigurišite posebne postupke oporezivanja PDV-om u skladu sa čl. 34-36 Zakona o PDV-u
        </p>
      </div>

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex items-start gap-3 pt-4">
          <Info className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <p className="text-sm text-muted-foreground">
            Aktiviranjem posebnog postupka, odgovarajuća POPDV polja postaju dostupna pri unosu PDV evidencije.
            Proverite sa vašim poreskim savetnikom pre aktiviranja.
          </p>
        </CardContent>
      </Card>

      {SCHEMES.map((scheme) => (
        <Card key={scheme.key}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted">{scheme.icon}</div>
                <div>
                  <CardTitle className="text-lg">{scheme.name}</CardTitle>
                  <Badge variant="outline" className="mt-1">{scheme.article}</Badge>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor={scheme.key} className="text-sm text-muted-foreground">
                  {enabledSchemes[scheme.key] ? "Aktivno" : "Neaktivno"}
                </Label>
                <Switch
                  id={scheme.key}
                  checked={!!enabledSchemes[scheme.key]}
                  onCheckedChange={() => toggleScheme(scheme.key)}
                />
              </div>
            </div>
            <CardDescription className="mt-2">{scheme.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <Separator className="mb-4" />
            <h4 className="text-sm font-medium mb-2">POPDV mapiranje polja</h4>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Polje</TableHead>
                  <TableHead>Opis</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scheme.popdvFields.map((f) => (
                  <TableRow key={f.field}>
                    <TableCell className="font-mono font-semibold">{f.field}</TableCell>
                    <TableCell>{f.description}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
