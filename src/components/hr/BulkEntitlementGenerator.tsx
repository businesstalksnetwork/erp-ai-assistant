import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Users, Zap } from "lucide-react";
import { toast } from "sonner";

export function BulkEntitlementGenerator() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(String(currentYear));
  const [defaultDays, setDefaultDays] = useState("20");

  const mutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("bulk_generate_entitlements", {
        p_tenant_id: tenantId!,
        p_year: Number(year),
        p_default_days: Number(defaultDays),
      });
      if (error) throw error;
      return data as number;
    },
    onSuccess: (count) => {
      toast.success(`Generisano ${count} novih balansa za ${year}. godinu`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-5 w-5" />
          {t("bulkEntitlement") || "Masovno generisanje balansa"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">
          {t("bulkEntitlementDesc") || "Generiše godišnje balanse za sve aktivne zaposlene kojima nedostaje balans za izabranu godinu. Koristi politiku odsustva za određivanje dana i prenosa."}
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="grid gap-1">
            <Label className="text-xs">{t("year")}</Label>
            <Input type="number" className="w-24" value={year} onChange={(e) => setYear(e.target.value)} />
          </div>
          <div className="grid gap-1">
            <Label className="text-xs">{t("defaultDays") || "Default dani"}</Label>
            <Input type="number" className="w-24" value={defaultDays} onChange={(e) => setDefaultDays(e.target.value)} />
          </div>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending} size="sm">
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Zap className="h-4 w-4 mr-1" />}
            {t("generate") || "Generiši"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
