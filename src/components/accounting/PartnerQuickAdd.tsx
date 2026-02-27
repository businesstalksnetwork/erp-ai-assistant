import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save } from "lucide-react";

interface PartnerQuickAddProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  onPartnerCreated: (partner: { id: string; name: string; pib?: string; address?: string; city?: string }) => void;
}

export function PartnerQuickAdd({ open, onOpenChange, tenantId, onPartnerCreated }: PartnerQuickAddProps) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "", pib: "", mb: "", address: "", city: "", country: "Srbija", email: "", phone: "",
  });

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ title: t("error"), description: "Naziv partnera je obavezan", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.from("partners").insert({
        tenant_id: tenantId,
        name: form.name.trim(),
        pib: form.pib || null,
        mb: form.mb || null,
        address: form.address || null,
        city: form.city || null,
        country: form.country || null,
        email: form.email || null,
        phone: form.phone || null,
        is_active: true,
      }).select("id, name, pib, address, city").single();
      if (error) throw error;
      toast({ title: t("success"), description: `Partner "${data.name}" kreiran` });
      onPartnerCreated(data);
      onOpenChange(false);
      setForm({ name: "", pib: "", mb: "", address: "", city: "", country: "Srbija", email: "", phone: "" });
    } catch (err: any) {
      toast({ title: t("error"), description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{t("addPartner") || "Novi partner"}</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 mt-6">
          <div className="space-y-1">
            <Label>{t("partnerName")} *</Label>
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Naziv firme" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>PIB</Label>
              <Input value={form.pib} onChange={e => setForm(f => ({ ...f, pib: e.target.value }))} placeholder="123456789" maxLength={13} />
            </div>
            <div className="space-y-1">
              <Label>MB</Label>
              <Input value={form.mb} onChange={e => setForm(f => ({ ...f, mb: e.target.value }))} placeholder="12345678" maxLength={8} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>{t("address")}</Label>
            <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Ulica i broj" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>{t("city") || "Grad"}</Label>
              <Input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} placeholder="Beograd" />
            </div>
            <div className="space-y-1">
              <Label>{t("country") || "Država"}</Label>
              <Input value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="info@firma.rs" />
            </div>
            <div className="space-y-1">
              <Label>{t("phone") || "Telefon"}</Label>
              <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+381..." />
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving} className="w-full">
            <Save className="h-4 w-4 mr-2" /> {saving ? "..." : (t("save") || "Sačuvaj")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
