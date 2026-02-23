import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

interface Props {
  tenantId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function TenantDetailDialog({ tenantId, open, onOpenChange }: Props) {
  const { t } = useLanguage();
  const [tenant, setTenant] = useState<any>(null);
  const [legalEntities, setLegalEntities] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [modules, setModules] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!tenantId || !open) return;
    setLoading(true);
    Promise.all([
      supabase.from("tenants").select("*").eq("id", tenantId).single(),
      supabase.from("legal_entities").select("*").eq("tenant_id", tenantId),
      supabase.from("tenant_members").select("*, profiles(full_name)").eq("tenant_id", tenantId),
      supabase.from("tenant_modules").select("*, module_definitions(name, key)").eq("tenant_id", tenantId).eq("is_enabled", true),
    ]).then(([t, le, mem, mod]) => {
      setTenant(t.data);
      setLegalEntities(le.data || []);
      setMembers(mem.data || []);
      setModules(mod.data || []);
      setLoading(false);
    });
  }, [tenantId, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Tenant Details</DialogTitle>
          <DialogDescription>{tenant?.name || ""}</DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : tenant ? (
          <div className="space-y-4 text-sm">
            <div className="rounded border p-3 space-y-1">
              <p><span className="text-muted-foreground">{t("plan")}:</span> <Badge variant="outline">{tenant.plan}</Badge></p>
              <p><span className="text-muted-foreground">{t("status")}:</span> <Badge>{tenant.status}</Badge></p>
              <p><span className="text-muted-foreground">Slug:</span> {tenant.slug}</p>
              <p><span className="text-muted-foreground">{t("createdAt")}:</span> {new Date(tenant.created_at).toLocaleDateString()}</p>
            </div>

            <div>
              <h4 className="font-semibold mb-2">{t("legalEntities")} ({legalEntities.length})</h4>
              {legalEntities.map((le) => (
                <div key={le.id} className="rounded border p-2 mb-1">
                  <p className="font-medium">{le.name}</p>
                  {le.pib && <p className="text-muted-foreground text-xs">PIB: {le.pib}</p>}
                </div>
              ))}
              {legalEntities.length === 0 && <p className="text-muted-foreground">None</p>}
            </div>

            <div>
              <h4 className="font-semibold mb-2">{t("users")} ({members.length})</h4>
              {members.map((m) => (
                <div key={m.id} className="flex items-center justify-between rounded border p-2 mb-1">
                  <span>{(m.profiles as any)?.full_name || "Unknown"}</span>
                  <Badge variant="secondary">{m.role}</Badge>
                </div>
              ))}
              {members.length === 0 && <p className="text-muted-foreground">None</p>}
            </div>

            <div>
              <h4 className="font-semibold mb-2">{t("modules")} ({modules.length})</h4>
              <div className="flex flex-wrap gap-1">
                {modules.map((m) => (
                  <Badge key={m.id} variant="outline">{(m.module_definitions as any)?.name || m.module_id}</Badge>
                ))}
              </div>
              {modules.length === 0 && <p className="text-muted-foreground">None</p>}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
