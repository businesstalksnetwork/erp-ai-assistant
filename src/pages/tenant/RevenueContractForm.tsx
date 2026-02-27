import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import { ArrowLeft, Save, Plus, Trash2 } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

interface Obligation {
  description: string;
  standalone_selling_price: string;
  recognition_method: string;
  satisfaction_date: string;
  start_date: string;
  end_date: string;
  total_cost_estimate: string;
  gl_revenue_account: string;
  gl_deferred_revenue_account: string;
}

const emptyObligation = (): Obligation => ({
  description: "", standalone_selling_price: "", recognition_method: "point_in_time",
  satisfaction_date: "", start_date: "", end_date: "", total_cost_estimate: "",
  gl_revenue_account: "6010", gl_deferred_revenue_account: "4600",
});

export default function RevenueContractForm() {
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const { locale } = useLanguage();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const sr = locale === "sr";

  const [form, setForm] = useState({
    contract_number: "", customer_name: "", description: "",
    contract_date: new Date().toISOString().slice(0, 10),
    start_date: new Date().toISOString().slice(0, 10),
    end_date: "",
    total_transaction_price: "",
    step1_identification: "", step2_obligations: "", step3_price_notes: "",
    step4_allocation_method: "standalone",
    step5_recognition_method: "point_in_time",
    notes: "",
  });

  const [obligations, setObligations] = useState<Obligation[]>([emptyObligation()]);

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const totalSSP = obligations.reduce((s, o) => s + (parseFloat(o.standalone_selling_price) || 0), 0);
  const txPrice = parseFloat(form.total_transaction_price) || 0;

  // Allocate transaction price based on relative SSP
  const getAllocated = (ssp: number) => totalSSP > 0 ? (ssp / totalSSP) * txPrice : 0;

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error("No tenant");
      if (!form.contract_number || !form.total_transaction_price) throw new Error(sr ? "Popunite obavezna polja" : "Fill required fields");

      const { data: contract, error } = await supabase.from("revenue_contracts").insert({
        tenant_id: tenantId,
        contract_number: form.contract_number,
        customer_name: form.customer_name || null,
        description: form.description || null,
        contract_date: form.contract_date,
        start_date: form.start_date,
        end_date: form.end_date || null,
        total_transaction_price: txPrice,
        step1_identification: form.step1_identification || null,
        step2_obligations: form.step2_obligations || null,
        step3_price_notes: form.step3_price_notes || null,
        step4_allocation_method: form.step4_allocation_method,
        step5_recognition_method: form.step5_recognition_method,
        notes: form.notes || null,
        created_by: user?.id,
        status: "draft",
      }).select("id").single();
      if (error) throw error;

      const oblRows = obligations.filter(o => o.description).map((o, i) => {
        const ssp = parseFloat(o.standalone_selling_price) || 0;
        const allocated = getAllocated(ssp);
        return {
          tenant_id: tenantId,
          contract_id: contract.id,
          obligation_number: i + 1,
          description: o.description,
          standalone_selling_price: ssp,
          allocated_price: Math.round(allocated * 100) / 100,
          recognition_method: o.recognition_method,
          satisfaction_date: o.recognition_method === "point_in_time" && o.satisfaction_date ? o.satisfaction_date : null,
          start_date: o.recognition_method !== "point_in_time" && o.start_date ? o.start_date : null,
          end_date: o.recognition_method !== "point_in_time" && o.end_date ? o.end_date : null,
          total_cost_estimate: o.recognition_method === "over_time_cost" ? (parseFloat(o.total_cost_estimate) || 0) : 0,
          deferred_revenue: Math.round(allocated * 100) / 100,
          gl_revenue_account: o.gl_revenue_account,
          gl_deferred_revenue_account: o.gl_deferred_revenue_account,
          status: "unsatisfied",
        };
      });

      if (oblRows.length > 0) {
        const { error: oe } = await supabase.from("revenue_performance_obligations").insert(oblRows);
        if (oe) throw oe;
      }

      return contract.id;
    },
    onSuccess: (id) => {
      toast.success(sr ? "Ugovor kreiran" : "Contract created");
      qc.invalidateQueries({ queryKey: ["revenue-contracts"] });
      navigate(`/accounting/revenue-contracts/${id}`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4 p-1">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5" /></Button>
        <h1 className="text-2xl font-bold">{sr ? "Novi ugovor — IFRS 15" : "New Contract — IFRS 15"}</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>{sr ? "Osnovni podaci" : "Contract Details"}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>{sr ? "Broj ugovora" : "Contract #"} *</Label><Input value={form.contract_number} onChange={e => set("contract_number", e.target.value)} placeholder="REV-2026-001" /></div>
              <div><Label>{sr ? "Kupac" : "Customer"}</Label><Input value={form.customer_name} onChange={e => set("customer_name", e.target.value)} /></div>
            </div>
            <div><Label>{sr ? "Opis" : "Description"}</Label><Input value={form.description} onChange={e => set("description", e.target.value)} /></div>
            <div className="grid grid-cols-3 gap-4">
              <div><Label>{sr ? "Datum ugovora" : "Contract Date"}</Label><Input type="date" value={form.contract_date} onChange={e => set("contract_date", e.target.value)} /></div>
              <div><Label>{sr ? "Početak" : "Start"}</Label><Input type="date" value={form.start_date} onChange={e => set("start_date", e.target.value)} /></div>
              <div><Label>{sr ? "Kraj" : "End"}</Label><Input type="date" value={form.end_date} onChange={e => set("end_date", e.target.value)} /></div>
            </div>
            <div><Label>{sr ? "Ukupna cena transakcije (RSD)" : "Total Transaction Price (RSD)"} *</Label><Input type="number" step="0.01" value={form.total_transaction_price} onChange={e => set("total_transaction_price", e.target.value)} /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{sr ? "IFRS 15 — 5-step model" : "IFRS 15 — 5-Step Model"}</CardTitle></CardHeader>
          <CardContent>
            <Accordion type="multiple" defaultValue={["step1"]}>
              <AccordionItem value="step1">
                <AccordionTrigger className="text-sm">{sr ? "Korak 1: Identifikacija ugovora" : "Step 1: Identify the Contract"}</AccordionTrigger>
                <AccordionContent><Textarea rows={2} placeholder={sr ? "Napomene o identifikaciji ugovora..." : "Notes on contract identification..."} value={form.step1_identification} onChange={e => set("step1_identification", e.target.value)} /></AccordionContent>
              </AccordionItem>
              <AccordionItem value="step2">
                <AccordionTrigger className="text-sm">{sr ? "Korak 2: Identifikacija obaveza" : "Step 2: Identify Performance Obligations"}</AccordionTrigger>
                <AccordionContent><Textarea rows={2} placeholder={sr ? "Napomene o obavezama ispunjenja..." : "Notes on performance obligations..."} value={form.step2_obligations} onChange={e => set("step2_obligations", e.target.value)} /></AccordionContent>
              </AccordionItem>
              <AccordionItem value="step3">
                <AccordionTrigger className="text-sm">{sr ? "Korak 3: Određivanje cene" : "Step 3: Determine Transaction Price"}</AccordionTrigger>
                <AccordionContent><Textarea rows={2} placeholder={sr ? "Varijabilna naknada, ograničenja..." : "Variable consideration, constraints..."} value={form.step3_price_notes} onChange={e => set("step3_price_notes", e.target.value)} /></AccordionContent>
              </AccordionItem>
              <AccordionItem value="step4">
                <AccordionTrigger className="text-sm">{sr ? "Korak 4: Alokacija cene" : "Step 4: Allocate Transaction Price"}</AccordionTrigger>
                <AccordionContent>
                  <Select value={form.step4_allocation_method} onValueChange={v => set("step4_allocation_method", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standalone">{sr ? "Relativna samostalna prodajna cena" : "Relative standalone selling price"}</SelectItem>
                      <SelectItem value="residual">{sr ? "Rezidualni pristup" : "Residual approach"}</SelectItem>
                      <SelectItem value="adjusted_market">{sr ? "Prilagođena tržišna cena" : "Adjusted market assessment"}</SelectItem>
                    </SelectContent>
                  </Select>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="step5">
                <AccordionTrigger className="text-sm">{sr ? "Korak 5: Priznavanje prihoda" : "Step 5: Recognize Revenue"}</AccordionTrigger>
                <AccordionContent>
                  <Select value={form.step5_recognition_method} onValueChange={v => set("step5_recognition_method", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="point_in_time">{sr ? "U određenom trenutku" : "At a point in time"}</SelectItem>
                      <SelectItem value="over_time_output">{sr ? "Tokom vremena (output)" : "Over time (output method)"}</SelectItem>
                      <SelectItem value="over_time_input">{sr ? "Tokom vremena (input)" : "Over time (input method)"}</SelectItem>
                      <SelectItem value="over_time_cost">{sr ? "Tokom vremena (trošak)" : "Over time (cost-to-cost)"}</SelectItem>
                    </SelectContent>
                  </Select>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>
      </div>

      {/* Performance Obligations */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{sr ? "Obaveze ispunjenja" : "Performance Obligations"}</CardTitle>
            <Button size="sm" variant="outline" onClick={() => setObligations(p => [...p, emptyObligation()])}>
              <Plus className="h-4 w-4 mr-1" /> {sr ? "Dodaj" : "Add"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {obligations.map((o, i) => (
            <div key={i} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">{sr ? `Obaveza #${i + 1}` : `Obligation #${i + 1}`}</span>
                {obligations.length > 1 && (
                  <Button size="icon" variant="ghost" onClick={() => setObligations(p => p.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>{sr ? "Opis" : "Description"} *</Label><Input value={o.description} onChange={e => { const v = [...obligations]; v[i].description = e.target.value; setObligations(v); }} /></div>
                <div><Label>{sr ? "Samostalna prodajna cena" : "Standalone Selling Price"}</Label><Input type="number" step="0.01" value={o.standalone_selling_price} onChange={e => { const v = [...obligations]; v[i].standalone_selling_price = e.target.value; setObligations(v); }} /></div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>{sr ? "Metod priznavanja" : "Recognition Method"}</Label>
                  <Select value={o.recognition_method} onValueChange={v => { const arr = [...obligations]; arr[i].recognition_method = v; setObligations(arr); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="point_in_time">{sr ? "U trenutku" : "Point in time"}</SelectItem>
                      <SelectItem value="over_time_output">{sr ? "Tokom vr. (output)" : "Over time (output)"}</SelectItem>
                      <SelectItem value="over_time_input">{sr ? "Tokom vr. (input)" : "Over time (input)"}</SelectItem>
                      <SelectItem value="over_time_cost">{sr ? "Tokom vr. (trošak)" : "Over time (cost-to-cost)"}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {o.recognition_method === "point_in_time" ? (
                  <div><Label>{sr ? "Datum ispunjenja" : "Satisfaction Date"}</Label><Input type="date" value={o.satisfaction_date} onChange={e => { const v = [...obligations]; v[i].satisfaction_date = e.target.value; setObligations(v); }} /></div>
                ) : (
                  <>
                    <div><Label>{sr ? "Početak" : "Start"}</Label><Input type="date" value={o.start_date} onChange={e => { const v = [...obligations]; v[i].start_date = e.target.value; setObligations(v); }} /></div>
                    <div><Label>{sr ? "Kraj" : "End"}</Label><Input type="date" value={o.end_date} onChange={e => { const v = [...obligations]; v[i].end_date = e.target.value; setObligations(v); }} /></div>
                  </>
                )}
                {o.recognition_method !== "point_in_time" && <div />}
              </div>
              {o.recognition_method === "over_time_cost" && (
                <div className="max-w-xs"><Label>{sr ? "Procena ukupnih troškova" : "Total Cost Estimate"}</Label><Input type="number" step="0.01" value={o.total_cost_estimate} onChange={e => { const v = [...obligations]; v[i].total_cost_estimate = e.target.value; setObligations(v); }} /></div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div><Label>{sr ? "Konto prihoda" : "Revenue GL"}</Label><Input value={o.gl_revenue_account} onChange={e => { const v = [...obligations]; v[i].gl_revenue_account = e.target.value; setObligations(v); }} /></div>
                <div><Label>{sr ? "Konto razgraničenja" : "Deferred Revenue GL"}</Label><Input value={o.gl_deferred_revenue_account} onChange={e => { const v = [...obligations]; v[i].gl_deferred_revenue_account = e.target.value; setObligations(v); }} /></div>
              </div>
              {txPrice > 0 && totalSSP > 0 && (
                <div className="text-sm text-muted-foreground">
                  {sr ? "Alocirana cena" : "Allocated price"}: <strong>{getAllocated(parseFloat(o.standalone_selling_price) || 0).toLocaleString("sr", { minimumFractionDigits: 2 })} RSD</strong>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <div><Label>{sr ? "Napomene" : "Notes"}</Label><Textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2} /></div>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => navigate(-1)}>{sr ? "Otkaži" : "Cancel"}</Button>
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          <Save className="h-4 w-4 mr-2" /> {saveMutation.isPending ? (sr ? "Čuvanje..." : "Saving...") : (sr ? "Kreiraj ugovor" : "Create Contract")}
        </Button>
      </div>
    </div>
  );
}
