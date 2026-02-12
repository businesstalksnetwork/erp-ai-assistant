import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

const STAGES = ["prospecting", "qualification", "proposal", "negotiation", "closed_won", "closed_lost"] as const;

interface OpportunityForm {
  title: string;
  partner_id: string | null;
  lead_id: string | null;
  value: number;
  currency: string;
  probability: number;
  stage: string;
  expected_close_date: string;
  notes: string;
}

const emptyForm: OpportunityForm = {
  title: "", partner_id: null, lead_id: null, value: 0, currency: "RSD",
  probability: 50, stage: "prospecting", expected_close_date: "", notes: "",
};

export default function Opportunities() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<OpportunityForm>(emptyForm);

  const { data: opps = [], isLoading } = useQuery({
    queryKey: ["opportunities", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("opportunities")
        .select("*, partners(name), leads(name)")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: partners = [] } = useQuery({
    queryKey: ["partners-list", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("partners").select("id, name").eq("tenant_id", tenantId!).eq("is_active", true).order("name");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: leads = [] } = useQuery({
    queryKey: ["leads-list", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("leads").select("id, name").eq("tenant_id", tenantId!).order("name");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const mutation = useMutation({
    mutationFn: async (f: OpportunityForm) => {
      const payload = {
        ...f, tenant_id: tenantId!,
        partner_id: f.partner_id || null,
        lead_id: f.lead_id || null,
        expected_close_date: f.expected_close_date || null,
      };
      if (editId) {
        const { error } = await supabase.from("opportunities").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("opportunities").insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["opportunities"] }); setOpen(false); toast.success(t("success")); },
    onError: (e: Error) => toast.error(e.message),
  });

  const openAdd = () => { setEditId(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (o: any) => {
    setEditId(o.id);
    setForm({
      title: o.title, partner_id: o.partner_id, lead_id: o.lead_id, value: o.value,
      currency: o.currency, probability: o.probability, stage: o.stage,
      expected_close_date: o.expected_close_date || "", notes: o.notes || "",
    });
    setOpen(true);
  };

  const stageColor = (s: string) => {
    if (s === "closed_won") return "default";
    if (s === "closed_lost") return "destructive";
    return "secondary";
  };

  const fmt = (n: number, cur: string) =>
    new Intl.NumberFormat("sr-RS", { style: "currency", currency: cur }).format(n);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t("opportunities")}</h1>
        <Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" />{t("addOpportunity")}</Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("title")}</TableHead>
                <TableHead>{t("partner")}</TableHead>
                <TableHead className="text-right">{t("value")}</TableHead>
                <TableHead>{t("probability")}</TableHead>
                <TableHead>{t("stage")}</TableHead>
                <TableHead>{t("expectedCloseDate")}</TableHead>
                <TableHead>{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
              ) : opps.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">{t("noResults")}</TableCell></TableRow>
              ) : opps.map((o: any) => (
                <TableRow key={o.id}>
                  <TableCell className="font-medium">{o.title}</TableCell>
                  <TableCell>{o.partners?.name || o.leads?.name || "—"}</TableCell>
                  <TableCell className="text-right">{fmt(o.value, o.currency)}</TableCell>
                  <TableCell>{o.probability}%</TableCell>
                  <TableCell><Badge variant={stageColor(o.stage) as any}>{t(o.stage as any) || o.stage}</Badge></TableCell>
                  <TableCell>{o.expected_close_date || "—"}</TableCell>
                  <TableCell><Button size="sm" variant="ghost" onClick={() => openEdit(o)}>{t("edit")}</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? t("editOpportunity") : t("addOpportunity")}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2"><Label>{t("title")} *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{t("partner")}</Label>
                <Select value={form.partner_id || "__none"} onValueChange={(v) => setForm({ ...form, partner_id: v === "__none" ? null : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">—</SelectItem>
                    {partners.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>{t("lead")}</Label>
                <Select value={form.lead_id || "__none"} onValueChange={(v) => setForm({ ...form, lead_id: v === "__none" ? null : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">—</SelectItem>
                    {leads.map((l: any) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2"><Label>{t("value")} *</Label><Input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: Number(e.target.value) })} /></div>
              <div className="grid gap-2">
                <Label>{t("currency")}</Label>
                <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RSD">RSD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2"><Label>{t("probability")} (%)</Label><Input type="number" min={0} max={100} value={form.probability} onChange={(e) => setForm({ ...form, probability: Number(e.target.value) })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{t("stage")}</Label>
                <Select value={form.stage} onValueChange={(v) => setForm({ ...form, stage: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STAGES.map(s => <SelectItem key={s} value={s}>{t(s as any) || s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2"><Label>{t("expectedCloseDate")}</Label><Input type="date" value={form.expected_close_date} onChange={(e) => setForm({ ...form, expected_close_date: e.target.value })} /></div>
            </div>
            <div className="grid gap-2"><Label>{t("notes")}</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => mutation.mutate(form)} disabled={!form.title || mutation.isPending}>
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
