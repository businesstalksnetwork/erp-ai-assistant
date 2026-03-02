import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Plus, Brain, AlertTriangle, CheckCircle, Calendar } from "lucide-react";
import { format } from "date-fns";

const AI_FUNCTIONS = [
  { name: "ai-assistant", model: "gemini-2.5-flash", purpose: "General AI chat assistant for ERP queries" },
  { name: "ai-insights", model: "gemini-2.5-flash", purpose: "Generate financial insights and anomaly detection" },
  { name: "ai-analytics-narrative", model: "gemini-2.5-flash", purpose: "Generate narrative reports for financial data" },
  { name: "ai-executive-briefing", model: "gemini-2.5-flash", purpose: "Daily executive AI briefing" },
  { name: "ai-invoice-anomaly", model: "gemini-2.5-flash", purpose: "Detect anomalies in invoice data" },
  { name: "ai-cash-flow-predict", model: "gemini-2.5-flash", purpose: "Cash flow prediction and forecasting" },
  { name: "ai-supplier-scoring", model: "gemini-2.5-flash", purpose: "AI-driven supplier evaluation scoring" },
  { name: "ai-payroll-predict", model: "gemini-2.5-flash", purpose: "Payroll cost prediction" },
  { name: "ai-ordering-prediction", model: "gemini-2.5-flash", purpose: "Supplier order prediction with seasonal decomposition" },
  { name: "ai-market-basket", model: "gemini-2.5-flash", purpose: "Market basket analysis for POS cross-selling" },
  { name: "ai-weekly-email", model: "gemini-2.5-flash", purpose: "Weekly AI email digest" },
  { name: "ai-daily-digest", model: "gemini-2.5-flash", purpose: "Daily AI digest generation" },
  { name: "proactive-ai-agent", model: "gemini-2.5-flash", purpose: "Proactive AI agent for background analysis" },
  { name: "invoice-ocr", model: "gemini-2.5-flash", purpose: "OCR processing for scanned invoices" },
  { name: "document-ocr", model: "gemini-2.5-flash", purpose: "General document OCR processing" },
  { name: "production-ai-planning", model: "gemini-2.5-flash", purpose: "AI production scheduling and planning" },
  { name: "inventory-classification", model: "N/A (algorithmic)", purpose: "ABC/XYZ inventory classification" },
];

export default function AiModelCards() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState<any>(null);
  const [biasForm, setBiasForm] = useState({ test_type: "", test_description: "", result: "", passed: true });

  const { data: cards = [] } = useQuery({
    queryKey: ["ai_model_cards"],
    queryFn: async () => {
      const { data } = await supabase.from("ai_model_cards").select("*").order("function_name");
      return data || [];
    },
  });

  const { data: biasTests = [] } = useQuery({
    queryKey: ["ai_bias_tests", selectedCard?.id],
    queryFn: async () => {
      const { data } = await supabase.from("ai_bias_test_log").select("*").eq("model_card_id", selectedCard.id).order("test_date", { ascending: false });
      return data || [];
    },
    enabled: !!selectedCard?.id,
  });

  const seedCards = useMutation({
    mutationFn: async () => {
      const existing = cards.map((c: any) => c.function_name);
      const toInsert = AI_FUNCTIONS.filter(f => !existing.includes(f.name)).map(f => ({
        function_name: f.name, model_name: f.model, purpose: f.purpose,
        bias_risk_level: "low", is_active: true,
        next_review_date: new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10),
      }));
      if (toInsert.length === 0) { toast({ title: "All cards already exist" }); return; }
      const { error } = await supabase.from("ai_model_cards").insert(toInsert as any);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ai_model_cards"] }); toast({ title: `Seeded ${AI_FUNCTIONS.length} model cards` }); },
    onError: (e: any) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const addBiasTest = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("ai_bias_test_log").insert({
        model_card_id: selectedCard.id, ...biasForm,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ai_bias_tests"] }); setBiasForm({ test_type: "", test_description: "", result: "", passed: true }); toast({ title: t("success") }); },
    onError: (e: any) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const dueForReview = cards.filter((c: any) => c.next_review_date && new Date(c.next_review_date) <= new Date()).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">AI Model Cards & Bias Testing (ISO 42001 / AI-05)</h1>
        <Button onClick={() => seedCards.mutate()} variant="outline" disabled={seedCards.isPending}>
          <Brain className="h-4 w-4 mr-1" />Seed All Model Cards
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4"><div className="text-2xl font-bold">{cards.length}</div><p className="text-sm text-muted-foreground">Model Cards</p></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-2xl font-bold">{cards.filter((c: any) => c.is_active).length}</div><p className="text-sm text-muted-foreground">Active</p></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-2xl font-bold text-destructive">{dueForReview}</div><p className="text-sm text-muted-foreground">Due for Review</p></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-2xl font-bold">{cards.filter((c: any) => c.bias_risk_level === "high").length}</div><p className="text-sm text-muted-foreground">High Bias Risk</p></CardContent></Card>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Function</TableHead>
              <TableHead>Model</TableHead>
              <TableHead>Purpose</TableHead>
              <TableHead>Bias Risk</TableHead>
              <TableHead>Next Review</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cards.map((card: any) => (
              <TableRow key={card.id} className="cursor-pointer" onClick={() => setSelectedCard(card)}>
                <TableCell className="font-mono text-sm">{card.function_name}</TableCell>
                <TableCell>{card.model_name}</TableCell>
                <TableCell className="max-w-[200px] truncate">{card.purpose}</TableCell>
                <TableCell><Badge variant={card.bias_risk_level === "high" ? "destructive" : card.bias_risk_level === "medium" ? "default" : "secondary"}>{card.bias_risk_level}</Badge></TableCell>
                <TableCell>{card.next_review_date || "—"}</TableCell>
                <TableCell><Badge variant={card.is_active ? "default" : "outline"}>{card.is_active ? "Active" : "Inactive"}</Badge></TableCell>
              </TableRow>
            ))}
            {cards.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No model cards. Click "Seed All Model Cards" to populate.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!selectedCard} onOpenChange={v => !v && setSelectedCard(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{selectedCard?.function_name} — Model Card</DialogTitle></DialogHeader>
          {selectedCard && (
            <Tabs defaultValue="details">
              <TabsList><TabsTrigger value="details">Details</TabsTrigger><TabsTrigger value="bias">Bias Tests</TabsTrigger></TabsList>
              <TabsContent value="details" className="space-y-3">
                <div><Label>Purpose</Label><p className="text-sm">{selectedCard.purpose}</p></div>
                <div><Label>Model</Label><p className="text-sm">{selectedCard.model_name}</p></div>
                <div><Label>Limitations</Label><p className="text-sm">{selectedCard.limitations || "Not documented"}</p></div>
                <div><Label>Ethical Considerations</Label><p className="text-sm">{selectedCard.ethical_considerations || "Not documented"}</p></div>
                <div><Label>Bias Risk Level</Label><Badge variant={selectedCard.bias_risk_level === "high" ? "destructive" : "secondary"}>{selectedCard.bias_risk_level}</Badge></div>
              </TabsContent>
              <TabsContent value="bias" className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>Test Type</Label><Input value={biasForm.test_type} onChange={e => setBiasForm(p => ({ ...p, test_type: e.target.value }))} placeholder="e.g., demographic parity" /></div>
                  <div><Label>Result</Label><Input value={biasForm.result} onChange={e => setBiasForm(p => ({ ...p, result: e.target.value }))} placeholder="Pass/Fail details" /></div>
                </div>
                <div><Label>Description</Label><Textarea value={biasForm.test_description} onChange={e => setBiasForm(p => ({ ...p, test_description: e.target.value }))} /></div>
                <Button size="sm" onClick={() => addBiasTest.mutate()} disabled={!biasForm.test_type || !biasForm.result || addBiasTest.isPending}>Log Bias Test</Button>
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {biasTests.map((bt: any) => (
                    <div key={bt.id} className="flex justify-between items-center text-sm border-b pb-1">
                      <div><span className="font-medium">{bt.test_type}</span> — {bt.result}</div>
                      <Badge variant={bt.passed ? "default" : "destructive"}>{bt.passed ? "Pass" : "Fail"}</Badge>
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
