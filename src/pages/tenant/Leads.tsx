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
import { Plus, Loader2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

interface LeadForm {
  name: string;
  email: string;
  phone: string;
  company: string;
  source: string;
  status: string;
  notes: string;
}

const emptyForm: LeadForm = {
  name: "", email: "", phone: "", company: "", source: "manual", status: "new", notes: "",
};

const STATUSES = ["new", "contacted", "qualified", "converted", "lost"] as const;
const SOURCES = ["manual", "website", "referral", "social", "advertisement", "other"] as const;

export default function Leads() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<LeadForm>(emptyForm);

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["leads", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("leads")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!tenantId,
  });

  const mutation = useMutation({
    mutationFn: async (f: LeadForm) => {
      const payload = { ...f, tenant_id: tenantId! };
      if (editId) {
        const { error } = await supabase.from("leads").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("leads").insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["leads"] }); setOpen(false); toast.success(t("success")); },
    onError: (e: Error) => toast.error(e.message),
  });

  const convertMutation = useMutation({
    mutationFn: async (lead: any) => {
      // Create opportunity from lead
      const { error: oppError } = await supabase.from("opportunities").insert([{
        tenant_id: tenantId!,
        title: lead.name,
        lead_id: lead.id,
        value: 0,
        currency: "RSD",
        probability: 50,
        stage: "prospecting",
        notes: lead.notes || "",
      }]);
      if (oppError) throw oppError;
      // Mark lead as converted
      const { error: leadError } = await supabase.from("leads").update({ status: "converted" }).eq("id", lead.id);
      if (leadError) throw leadError;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["opportunities"] });
      toast.success(t("conversionSuccess"));
      navigate("/crm/opportunities");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openAdd = () => { setEditId(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (l: any) => {
    setEditId(l.id);
    setForm({ name: l.name, email: l.email || "", phone: l.phone || "", company: l.company || "", source: l.source || "manual", status: l.status, notes: l.notes || "" });
    setOpen(true);
  };

  const statusColor = (s: string) => {
    switch (s) {
      case "new": return "default";
      case "contacted": return "secondary";
      case "qualified": return "outline";
      case "converted": return "default";
      case "lost": return "destructive";
      default: return "secondary";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t("leads")}</h1>
        <Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" />{t("addLead")}</Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("name")}</TableHead>
                <TableHead>{t("company")}</TableHead>
                <TableHead>{t("email")}</TableHead>
                <TableHead>{t("phone")}</TableHead>
                <TableHead>{t("leadSource")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead>{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
              ) : leads.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">{t("noResults")}</TableCell></TableRow>
              ) : leads.map((l: any) => (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">{l.name}</TableCell>
                  <TableCell>{l.company || "—"}</TableCell>
                  <TableCell>{l.email || "—"}</TableCell>
                  <TableCell>{l.phone || "—"}</TableCell>
                  <TableCell>{l.source === "manual" ? t("manualSource" as any) : (t(l.source as any) || l.source)}</TableCell>
                  <TableCell><Badge variant={statusColor(l.status) as any}>{t(l.status as any) || l.status}</Badge></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(l)}>{t("edit")}</Button>
                      {l.status !== "converted" && l.status !== "lost" && (
                        <Button size="sm" variant="outline" onClick={() => convertMutation.mutate(l)} disabled={convertMutation.isPending}>
                          <ArrowRight className="h-3 w-3 mr-1" />{t("convertToOpportunity")}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editId ? t("editLead") : t("addLead")}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2"><Label>{t("name")} *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>{t("email")}</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div className="grid gap-2"><Label>{t("phone")}</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            </div>
            <div className="grid gap-2"><Label>{t("company")}</Label><Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{t("leadSource")}</Label>
                <Select value={form.source} onValueChange={(v) => setForm({ ...form, source: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SOURCES.map(s => <SelectItem key={s} value={s}>{s === "manual" ? t("manualSource" as any) : (t(s as any) || s)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>{t("status")}</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map(s => <SelectItem key={s} value={s}>{t(s as any) || s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2"><Label>{t("notes")}</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => mutation.mutate(form)} disabled={!form.name || mutation.isPending}>
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
