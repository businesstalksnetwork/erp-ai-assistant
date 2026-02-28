import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, Save } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export default function LoyaltyPrograms() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);

  const [form, setForm] = useState({
    name: "",
    points_per_unit_currency: "1",
    bronze: "0",
    silver: "1000",
    gold: "5000",
    platinum: "20000",
    expiry_months: "",
  });

  const { data: programs = [] } = useQuery({
    queryKey: ["loyalty_programs", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("loyalty_programs")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!tenantId,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const thresholds = {
        bronze: parseInt(form.bronze) || 0,
        silver: parseInt(form.silver) || 1000,
        gold: parseInt(form.gold) || 5000,
        platinum: parseInt(form.platinum) || 20000,
      };
      const { error } = await supabase.from("loyalty_programs").insert({
        tenant_id: tenantId!,
        name: form.name,
        points_per_unit_currency: parseFloat(form.points_per_unit_currency) || 1,
        tier_thresholds: thresholds,
        expiry_months: form.expiry_months ? parseInt(form.expiry_months) : null,
        is_active: true,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loyalty_programs"] });
      setDialogOpen(false);
      toast({ title: t("success") });
    },
    onError: (e: any) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("loyalty_programs").update({ is_active: active } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["loyalty_programs"] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("loyaltyPrograms" as any)}</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" />{t("addNew" as any)}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{t("loyaltyPrograms" as any)}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>{t("name")}</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div><Label>{t("pointsPerCurrency" as any)}</Label><Input type="number" value={form.points_per_unit_currency} onChange={e => setForm(f => ({ ...f, points_per_unit_currency: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>{t("tierBronze" as any)}</Label><Input type="number" value={form.bronze} onChange={e => setForm(f => ({ ...f, bronze: e.target.value }))} /></div>
                <div><Label>{t("tierSilver" as any)}</Label><Input type="number" value={form.silver} onChange={e => setForm(f => ({ ...f, silver: e.target.value }))} /></div>
                <div><Label>{t("tierGold" as any)}</Label><Input type="number" value={form.gold} onChange={e => setForm(f => ({ ...f, gold: e.target.value }))} /></div>
                <div><Label>{t("tierPlatinum" as any)}</Label><Input type="number" value={form.platinum} onChange={e => setForm(f => ({ ...f, platinum: e.target.value }))} /></div>
              </div>
              <Button onClick={() => saveMutation.mutate()} disabled={!form.name || saveMutation.isPending}>
                <Save className="h-4 w-4 mr-1" />{t("save")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {programs.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">{t("noActiveProgram" as any)}</CardContent></Card>
      ) : (
        <div className="space-y-4">
          {programs.map((p: any) => {
            const thresholds = (typeof p.tier_thresholds === 'object' ? p.tier_thresholds : {}) as Record<string, number>;
            return (
              <Card key={p.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{p.name}</CardTitle>
                    <Switch checked={p.is_active} onCheckedChange={(v) => toggleActive.mutate({ id: p.id, active: v })} />
                  </div>
                </CardHeader>
                <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div><span className="text-muted-foreground">{t("pointsPerCurrency" as any)}:</span> {p.points_per_unit_currency}</div>
                  <div><span className="text-muted-foreground">{t("tierBronze" as any)}:</span> {thresholds.bronze ?? 0}</div>
                  <div><span className="text-muted-foreground">{t("tierSilver" as any)}:</span> {thresholds.silver ?? 1000}</div>
                  <div><span className="text-muted-foreground">{t("tierGold" as any)}:</span> {thresholds.gold ?? 5000}</div>
                  <div><span className="text-muted-foreground">{t("tierPlatinum" as any)}:</span> {thresholds.platinum ?? 20000}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
