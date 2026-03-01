import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNavigate, useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

interface OrderForm {
  partner_id: string;
  amount: string;
  currency: string;
  sender_account: string;
  recipient_account: string;
  recipient_name: string;
  reference_number: string;
  payment_code: string;
  model: string;
  description: string;
  payment_date: string;
}

const emptyForm: OrderForm = {
  partner_id: "", amount: "", currency: "RSD", sender_account: "", recipient_account: "",
  recipient_name: "", reference_number: "", payment_code: "289", model: "97",
  description: "", payment_date: format(new Date(), "yyyy-MM-dd"),
};

export default function PaymentOrderForm() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const qc = useQueryClient();
  const [form, setForm] = useState<OrderForm>(emptyForm);

  const { data: existing } = useQuery({
    queryKey: ["payment-order", id],
    queryFn: async () => {
      const { data } = await (supabase.from("payment_orders" as any) as any).select("*").eq("id", id!).single();
      return data;
    },
    enabled: !!id,
  });

  useEffect(() => {
    if (existing) {
      setForm({
        partner_id: existing.partner_id || "", amount: String(existing.amount), currency: existing.currency,
        sender_account: existing.sender_account, recipient_account: existing.recipient_account,
        recipient_name: existing.recipient_name || "", reference_number: existing.reference_number || "",
        payment_code: existing.payment_code || "", model: existing.model || "",
        description: existing.description || "", payment_date: existing.payment_date,
      });
    }
  }, [existing]);

  const { data: partners = [] } = useQuery({
    queryKey: ["partners-list", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("partners").select("id, name").eq("tenant_id", tenantId!).eq("is_active", true).order("name");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: bankAccounts = [] } = useQuery({
    queryKey: ["bank-accounts", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("bank_accounts").select("id, account_number, bank_name").eq("tenant_id", tenantId!).eq("is_active", true);
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Duplicate detection
  const { data: duplicates = [] } = useQuery({
    queryKey: ["payment-order-duplicates", form.partner_id, form.amount, form.payment_date],
    queryFn: async () => {
      if (!form.partner_id || !form.amount) return [];
      const { data } = await (supabase.from("payment_orders" as any) as any)
        .select("id, amount, payment_date, status")
        .eq("tenant_id", tenantId!)
        .eq("partner_id", form.partner_id)
        .eq("amount", +form.amount)
        .eq("payment_date", form.payment_date)
        .neq("id", id || "00000000-0000-0000-0000-000000000000")
        .limit(5);
      return data || [];
    },
    enabled: !!tenantId && !!form.partner_id && !!form.amount,
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload = {
        tenant_id: tenantId, partner_id: form.partner_id || null, amount: +form.amount,
        currency: form.currency, sender_account: form.sender_account, recipient_account: form.recipient_account,
        recipient_name: form.recipient_name, reference_number: form.reference_number, payment_code: form.payment_code,
        model: form.model, description: form.description, payment_date: form.payment_date,
        created_by: user?.id,
      };
      if (id) {
        const { error } = await (supabase.from("payment_orders" as any) as any).update(payload).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await (supabase.from("payment_orders" as any) as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payment-orders"] });
      toast.success("Sačuvano");
      navigate("/accounting/payment-orders");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const onPartnerChange = (partnerId: string) => {
    setForm({ ...form, partner_id: partnerId });
    // Auto-fill partner name
    const p = partners.find((p: any) => p.id === partnerId);
    if (p) setForm(f => ({ ...f, partner_id: partnerId, recipient_name: p.name }));
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/accounting/payment-orders")}><ArrowLeft className="h-5 w-5" /></Button>
        <h1 className="text-2xl font-bold">{id ? "Izmeni nalog" : "Novi nalog za plaćanje"}</h1>
      </div>

      {duplicates.length > 0 && (
        <div className="flex items-center gap-2 p-3 bg-accent/20 border border-accent rounded-lg text-sm">
          <AlertTriangle className="h-4 w-4 text-accent-foreground" />
          <span>Pronađen potencijalni duplikat ({duplicates.length}) sa istim iznosom, partnerom i datumom.</span>
        </div>
      )}

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Partner</Label>
              <Select value={form.partner_id} onValueChange={onPartnerChange}>
                <SelectTrigger><SelectValue placeholder="Izaberite..." /></SelectTrigger>
                <SelectContent>
                  {partners.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Datum plaćanja *</Label>
              <Input type="date" value={form.payment_date} onChange={e => setForm({ ...form, payment_date: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="grid gap-2"><Label>Iznos *</Label><Input type="number" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></div>
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
            <div className="grid gap-2">
              <Label>Račun platioca *</Label>
              <Select value={form.sender_account} onValueChange={v => setForm({ ...form, sender_account: v })}>
                <SelectTrigger><SelectValue placeholder="Izaberite..." /></SelectTrigger>
                <SelectContent>
                  {bankAccounts.map((ba: any) => <SelectItem key={ba.id} value={ba.account_number}>{ba.account_number} ({ba.bank_name})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2"><Label>Račun primaoca *</Label><Input value={form.recipient_account} onChange={e => setForm({ ...form, recipient_account: e.target.value })} placeholder="840-..." /></div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2"><Label>Model</Label><Input value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} placeholder="97" /></div>
            <div className="grid gap-2"><Label>Poziv na broj</Label><Input value={form.reference_number} onChange={e => setForm({ ...form, reference_number: e.target.value })} /></div>
          </div>

          <div className="grid gap-2"><Label>Opis</Label><Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => navigate("/accounting/payment-orders")}>Otkaži</Button>
            <Button onClick={() => saveMut.mutate()} disabled={!form.amount || !form.sender_account || !form.recipient_account || saveMut.isPending}>
              {saveMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sačuvaj"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
