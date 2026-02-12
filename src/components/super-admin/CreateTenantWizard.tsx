import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

const steps = ["companyInfo", "legalEntity", "adminUser", "confirmation"] as const;

export default function CreateTenantWizard({ open, onOpenChange, onCreated }: Props) {
  const { t } = useLanguage();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  const [tenant, setTenant] = useState({ name: "", slug: "", plan: "basic" });
  const [legal, setLegal] = useState({ name: "", pib: "", maticni_broj: "", address: "", city: "", country: "RS" });
  const [admin, setAdmin] = useState({ email: "", full_name: "", password: "" });

  const generateSlug = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  const handleTenantName = (name: string) => {
    setTenant({ ...tenant, name, slug: generateSlug(name) });
    if (!legal.name) setLegal({ ...legal, name });
  };

  const canNext = () => {
    if (step === 0) return tenant.name && tenant.slug && tenant.plan;
    if (step === 1) return legal.name;
    if (step === 2) return admin.email && admin.full_name && admin.password.length >= 6;
    return true;
  };

  const handleCreate = async () => {
    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;

      const res = await fetch(
        `https://hfvoehsrsimvgyyxirwj.supabase.co/functions/v1/create-tenant`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            tenant_name: tenant.name,
            slug: tenant.slug,
            plan: tenant.plan,
            legal_entity: legal,
            admin_user: admin,
          }),
        }
      );

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to create tenant");

      toast({ title: t("success"), description: `Tenant "${tenant.name}" created successfully` });
      onCreated();
      onOpenChange(false);
      // Reset
      setStep(0);
      setTenant({ name: "", slug: "", plan: "basic" });
      setLegal({ name: "", pib: "", maticni_broj: "", address: "", city: "", country: "RS" });
      setAdmin({ email: "", full_name: "", password: "" });
    } catch (err: any) {
      toast({ title: t("error"), description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("createTenant")}</DialogTitle>
          <DialogDescription>Step {step + 1} of 4</DialogDescription>
        </DialogHeader>

        {step === 0 && (
          <div className="space-y-4">
            <div><Label>{t("tenantName")}</Label><Input value={tenant.name} onChange={(e) => handleTenantName(e.target.value)} /></div>
            <div><Label>Slug</Label><Input value={tenant.slug} onChange={(e) => setTenant({ ...tenant, slug: e.target.value })} /></div>
            <div>
              <Label>{t("plan")}</Label>
              <Select value={tenant.plan} onValueChange={(v) => setTenant({ ...tenant, plan: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="basic">Basic</SelectItem>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div><Label>{t("companyName")}</Label><Input value={legal.name} onChange={(e) => setLegal({ ...legal, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>PIB</Label><Input value={legal.pib} onChange={(e) => setLegal({ ...legal, pib: e.target.value })} /></div>
              <div><Label>Matični broj</Label><Input value={legal.maticni_broj} onChange={(e) => setLegal({ ...legal, maticni_broj: e.target.value })} /></div>
            </div>
            <div><Label>{t("address")}</Label><Input value={legal.address} onChange={(e) => setLegal({ ...legal, address: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>{t("city")}</Label><Input value={legal.city} onChange={(e) => setLegal({ ...legal, city: e.target.value })} /></div>
              <div><Label>{t("country")}</Label><Input value={legal.country} onChange={(e) => setLegal({ ...legal, country: e.target.value })} /></div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div><Label>{t("email")}</Label><Input type="email" value={admin.email} onChange={(e) => setAdmin({ ...admin, email: e.target.value })} /></div>
            <div><Label>{t("fullName")}</Label><Input value={admin.full_name} onChange={(e) => setAdmin({ ...admin, full_name: e.target.value })} /></div>
            <div><Label>{t("password")}</Label><Input type="password" value={admin.password} onChange={(e) => setAdmin({ ...admin, password: e.target.value })} placeholder="Min 6 characters" /></div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3 text-sm">
            <h4 className="font-semibold">Summary</h4>
            <div className="rounded border p-3 space-y-1">
              <p><span className="text-muted-foreground">Tenant:</span> {tenant.name} ({tenant.plan})</p>
              <p><span className="text-muted-foreground">Slug:</span> {tenant.slug}</p>
            </div>
            <div className="rounded border p-3 space-y-1">
              <p><span className="text-muted-foreground">Legal Entity:</span> {legal.name}</p>
              {legal.pib && <p><span className="text-muted-foreground">PIB:</span> {legal.pib}</p>}
              {legal.city && <p><span className="text-muted-foreground">Location:</span> {legal.city}, {legal.country}</p>}
            </div>
            <div className="rounded border p-3 space-y-1">
              <p><span className="text-muted-foreground">Admin:</span> {admin.full_name}</p>
              <p><span className="text-muted-foreground">Email:</span> {admin.email}</p>
            </div>
          </div>
        )}

        <div className="flex justify-between pt-4">
          <Button variant="outline" onClick={() => step > 0 ? setStep(step - 1) : onOpenChange(false)}>
            {step > 0 ? "Back" : t("cancel")}
          </Button>
          {step < 3 ? (
            <Button onClick={() => setStep(step + 1)} disabled={!canNext()}>Next</Button>
          ) : (
            <Button onClick={handleCreate} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {t("confirm")}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
