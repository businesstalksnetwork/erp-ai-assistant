import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";

const RETENTION_INFO = [
  { period: "Trajno (Permanent)", description: "Dokumenti trajne vrednosti koji se čuvaju zauvek" },
  { period: "10 godina", description: "Finansijski dokumenti, ugovori, kadrovska evidencija" },
  { period: "5 godina", description: "Poslovni izveštaji, zapisnici, korespondencija" },
  { period: "3 godine", description: "Dnevna korespondencija, interne beleške" },
  { period: "2 godine", description: "Pomoćna dokumentacija, privremeni dokumenti" },
];

export default function DmsSettings() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();

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

  // Group categories by group_name_sr
  const grouped = categories.reduce((acc: any, c: any) => {
    if (!acc[c.group_name_sr]) acc[c.group_name_sr] = [];
    acc[c.group_name_sr].push(c);
    return acc;
  }, {});

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

        <TabsContent value="categories" className="space-y-3">
          {Object.entries(grouped).map(([group, cats]: [string, any]) => (
            <Collapsible key={group}>
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
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          ))}
          {categories.length === 0 && <p className="text-center text-muted-foreground py-8">{t("dmsCategoriesEmpty")}</p>}
        </TabsContent>

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

        <TabsContent value="confidentiality">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("name")}</TableHead>
                    <TableHead>{t("dmsColor")}</TableHead>
                    <TableHead>{t("dmsOrder")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {confLevels.map((l: any) => (
                    <TableRow key={l.id}>
                      <TableCell>{l.name_sr}</TableCell>
                      <TableCell><div className="w-6 h-6 rounded" style={{ backgroundColor: l.color }} /></TableCell>
                      <TableCell>{l.sort_order}</TableCell>
                    </TableRow>
                  ))}
                  {confLevels.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">{t("dmsCategoriesEmpty")}</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="access">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("dmsRole")}</TableHead>
                    <TableHead>{t("dmsConfidentiality")}</TableHead>
                    <TableHead>{t("dmsCanRead")}</TableHead>
                    <TableHead>{t("dmsCanEdit")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accessMatrix.map((a: any) => (
                    <TableRow key={a.id}>
                      <TableCell><Badge variant="outline">{a.role}</Badge></TableCell>
                      <TableCell>{a.confidentiality_levels?.name_sr || "-"}</TableCell>
                      <TableCell>{a.can_read ? "✓" : "✗"}</TableCell>
                      <TableCell>{a.can_edit ? "✓" : "✗"}</TableCell>
                    </TableRow>
                  ))}
                  {accessMatrix.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">{t("dmsAccessMatrixEmpty")}</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
