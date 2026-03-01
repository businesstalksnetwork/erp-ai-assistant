import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Sparkles, Download, Loader2, Copy } from "lucide-react";

export default function HrContractGenerator() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { toast } = useToast();
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [generatedContent, setGeneratedContent] = useState<string>("");
  const [generating, setGenerating] = useState(false);

  const { data: templates = [] } = useQuery({
    queryKey: ["hr-contract-templates", tenantId],
    queryFn: async () => {
      const { data } = await (supabase.from("hr_contract_templates" as any) as any)
        .select("*")
        .or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
        .eq("is_active", true)
        .order("name");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["employees-for-contract", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("employees")
        .select("id, first_name, last_name, jmbg, address, position")
        .eq("tenant_id", tenantId!)
        .eq("status", "active")
        .order("last_name");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: tenantInfo } = useQuery({
    queryKey: ["tenant-info-contract", tenantId],
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

  const currentTemplate = (templates as any[]).find((t: any) => t.id === selectedTemplate);
  const currentEmployee = employees.find(e => e.id === selectedEmployee);

  const autoFillFromEmployee = () => {
    if (!currentEmployee || !currentTemplate) return;
    const vals: Record<string, string> = { ...variableValues };
    vals.ime_prezime = `${currentEmployee.first_name} ${currentEmployee.last_name}`;
    if (currentEmployee.jmbg) vals.jmbg = currentEmployee.jmbg;
    if (currentEmployee.address) vals.adresa = currentEmployee.address;
    if (currentEmployee.position) vals.radno_mesto = currentEmployee.position;
    if (tenantInfo) {
      vals.naziv_firme = tenantInfo.name || "";
      if (tenantInfo.pib) vals.pib_firme = tenantInfo.pib;
      if (tenantInfo.maticni_broj) vals.mb_firme = tenantInfo.maticni_broj;
      if (tenantInfo.address) vals.sediste_firme = tenantInfo.address;
    }
    vals.datum_pocetka = vals.datum_pocetka || new Date().toISOString().split("T")[0];
    setVariableValues(vals);
  };

  const generateContract = () => {
    if (!currentTemplate) return;
    let content = currentTemplate.content;
    Object.entries(variableValues).forEach(([key, value]) => {
      content = content.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value || `[${key}]`);
    });
    // Replace remaining unfilled variables with placeholders
    content = content.replace(/\{\{(\w+)\}\}/g, "[_____]");
    setGeneratedContent(content);
  };

  const aiEnhanceMut = useMutation({
    mutationFn: async () => {
      if (!currentTemplate) throw new Error("Nema šablona");
      setGenerating(true);
      const { data, error } = await supabase.functions.invoke("ai-chat", {
        body: {
          messages: [{
            role: "user",
            content: `Na osnovu sledećeg šablona ugovora, popuni sve varijable sa podacima zaposlenog i proveri da li su uključene sve obavezne klauzule po Zakonu o radu Srbije. Vrati samo popunjen tekst ugovora, bez dodatnih objašnjenja.\n\nŠablon:\n${currentTemplate.content}\n\nPodaci:\n${JSON.stringify(variableValues)}\n\nPravni osnov: ${(currentTemplate.legal_references || []).join(", ")}`,
          }],
          tenant_id: tenantId,
          context: "hr_contracts",
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      const text = data?.choices?.[0]?.message?.content || data?.response || "";
      if (text) setGeneratedContent(text);
      else toast({ title: "AI nije vratio sadržaj", variant: "destructive" });
    },
    onError: (e: any) => toast({ title: "AI greška", description: e.message, variant: "destructive" }),
    onSettled: () => setGenerating(false),
  });

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedContent);
    toast({ title: "Kopirano u clipboard" });
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Generator ugovora" description="AI-potpomognuto generisanje HR ugovora sa automatskim popunjavanjem" icon={Sparkles} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Config */}
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Izbor šablona i zaposlenog</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label>Šablon ugovora</Label>
                <Select value={selectedTemplate} onValueChange={v => { setSelectedTemplate(v); setVariableValues({}); setGeneratedContent(""); }}>
                  <SelectTrigger><SelectValue placeholder="Izaberite šablon..." /></SelectTrigger>
                  <SelectContent>
                    {(templates as any[]).map((t: any) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Zaposleni</Label>
                <Select value={selectedEmployee} onValueChange={v => { setSelectedEmployee(v); }}>
                  <SelectTrigger><SelectValue placeholder="Izaberite zaposlenog..." /></SelectTrigger>
                  <SelectContent>
                    {employees.map(e => (
                      <SelectItem key={e.id} value={e.id}>{e.first_name} {e.last_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedEmployee && currentTemplate && (
                <Button variant="outline" onClick={autoFillFromEmployee} className="w-full">
                  <FileText className="h-4 w-4 mr-1" /> Auto-popuni iz podataka zaposlenog
                </Button>
              )}
            </CardContent>
          </Card>

          {currentTemplate && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Varijable</CardTitle>
                <div className="flex flex-wrap gap-1 mt-1">
                  {(currentTemplate.legal_references || []).map((r: string) => <Badge key={r} variant="outline" className="text-xs">{r}</Badge>)}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {((currentTemplate.variables as string[]) || []).map((v: string) => (
                  <div key={v} className="grid gap-1">
                    <Label className="text-sm">{v.replace(/_/g, " ")}</Label>
                    <Input
                      value={variableValues[v] || ""}
                      onChange={e => setVariableValues(prev => ({ ...prev, [v]: e.target.value }))}
                      placeholder={v}
                    />
                  </div>
                ))}
                <div className="flex gap-2 pt-2">
                  <Button onClick={generateContract} className="flex-1">
                    <FileText className="h-4 w-4 mr-1" /> Generiši
                  </Button>
                  <Button variant="secondary" onClick={() => aiEnhanceMut.mutate()} disabled={generating} className="flex-1">
                    {generating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />}
                    AI dopuna
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Preview */}
        <Card className="h-fit">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Pregled ugovora</CardTitle>
              {generatedContent && (
                <Button size="sm" variant="outline" onClick={copyToClipboard}>
                  <Copy className="h-4 w-4 mr-1" /> Kopiraj
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {generatedContent ? (
              <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-lg border max-h-[600px] overflow-y-auto font-mono">{generatedContent}</pre>
            ) : (
              <div className="text-center text-muted-foreground py-12">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Izaberite šablon i popunite varijable za pregled</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}