import { useTenant } from "@/hooks/useTenant";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, FileText } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface TemplateForm {
  name: string;
  recipient_name: string;
  recipient_account: string;
  amount: string;
  currency: string;
  payment_code: string;
  model: string;
  reference_pattern: string;
  description: string;
  partner_id: string;
}

const emptyForm: TemplateForm = {
  name: "", recipient_name: "", recipient_account: "", amount: "",
  currency: "RSD", payment_code: "289", model: "97",
  reference_pattern: "", description: "", partner_id: "",
};

export default function PaymentTemplates() {
  const { tenantId } = useTenant();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<TemplateForm>(emptyForm);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["payment-templates", tenantId],
    queryFn: async () => {
      const { data } = await (supabase.from("payment_templates" as any) as any)
        .select("*, partners(name)")
        .eq("tenant_id", tenantId!)
        .eq("is_active", true)
        .order("name");
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

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload: any = {
        tenant_id: tenantId, name: form.name, recipient_name: form.recipient_name,
        recipient_account: form.recipient_account, amount: form.amount ? +form.amount : null,
        currency: form.currency, payment_code: form.payment_code, model: form.model,
        reference_pattern: form.reference_pattern, description: form.description,
        partner_id: form.partner_id || null,
      };
      if (editId) {
        const { error } = await (supabase.from("payment_templates" as any) as any).update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await (supabase.from("payment_templates" as any) as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payment-templates"] });
      toast.success("Šablon sačuvan");
      setDialogOpen(false);
      setEditId(null);
      setForm(emptyForm);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("payment_templates" as any) as any).update({ is_active: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payment-templates"] });
      toast.success("Šablon obrisan");
    },
  });

  const openEdit = (t: any) => {
    setEditId(t.id);
    setForm({
      name: t.name, recipient_name: t.recipient_name || "", recipient_account: t.recipient_account,
      amount: t.amount ? String(t.amount) : "", currency: t.currency, payment_code: t.payment_code || "",
      model: t.model || "", reference_pattern: t.reference_pattern || "",
      description: t.description || "", partner_id: t.partner_id || "",
    });
    setDialogOpen(true);
  };

  const useTemplate = (t: any) => {
    navigate(`/accounting/payment-orders/new?template=${t.id}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Šabloni za plaćanje</h1>
        <Button onClick={() => { setEditId(null); setForm(emptyForm); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Novi šablon
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Naziv</TableHead>
                <TableHead>Partner</TableHead>
                <TableHead>Račun primaoca</TableHead>
                <TableHead>Iznos</TableHead>
                <TableHead>Valuta</TableHead>
                <TableHead className="w-[140px]">Akcije</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((t: any) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell>{t.partners?.name || "-"}</TableCell>
                  <TableCell>{t.recipient_account}</TableCell>
                  <TableCell>{t.amount ? Number(t.amount).toLocaleString("sr-RS") : "-"}</TableCell>
                  <TableCell>{t.currency}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => useTemplate(t)} title="Koristi"><FileText className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(t)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteMut.mutate(t.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!isLoading && templates.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nema šablona</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editId ? "Izmeni šablon" : "Novi šablon"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2"><Label>Naziv *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid gap-2">
              <Label>Partner</Label>
              <Select value={form.partner_id} onValueChange={v => { setForm({ ...form, partner_id: v, recipient_name: partners.find((p: any) => p.id === v)?.name || form.recipient_name }); }}>
                <SelectTrigger><SelectValue placeholder="Izaberite..." /></SelectTrigger>
                <SelectContent>{partners.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>Primalac</Label><Input value={form.recipient_name} onChange={e => setForm({ ...form, recipient_name: e.target.value })} /></div>
              <div className="grid gap-2"><Label>Račun primaoca *</Label><Input value={form.recipient_account} onChange={e => setForm({ ...form, recipient_account: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2"><Label>Iznos</Label><Input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></div>
              <div className="grid gap-2">
                <Label>Valuta</Label>
                <Select value={form.currency} onValueChange={v => setForm({ ...form, currency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="RSD">RSD</SelectItem><SelectItem value="EUR">EUR</SelectItem><SelectItem value="USD">USD</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="grid gap-2"><Label>Šifra plaćanja</Label><Input value={form.payment_code} onChange={e => setForm({ ...form, payment_code: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>Model</Label><Input value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} /></div>
              <div className="grid gap-2"><Label>Poziv na broj (šablon)</Label><Input value={form.reference_pattern} onChange={e => setForm({ ...form, reference_pattern: e.target.value })} placeholder="npr. {MM}-{YYYY}" /></div>
            </div>
            <div className="grid gap-2"><Label>Opis</Label><Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Otkaži</Button>
            <Button onClick={() => saveMut.mutate()} disabled={!form.name || !form.recipient_account || saveMut.isPending}>Sačuvaj</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
