import React, { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useLanguage } from "@/i18n/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import { RefreshCw, Save, RotateCcw } from "lucide-react";
import type { TenantRole } from "@/config/rolePermissions";

const ROLES: TenantRole[] = [
  "admin", "manager", "finance_director", "accountant",
  "hr_manager", "hr_staff", "sales_manager", "sales_rep", "sales", "hr",
  "store_manager", "store", "cashier",
  "warehouse_manager", "warehouse_worker",
  "production_manager", "production_worker",
  "user", "viewer",
];
const MODULES = [
  "dashboard", "crm", "sales", "web", "purchasing", "inventory",
  "accounting", "analytics", "hr", "production", "documents",
  "pos", "returns", "assets", "settings",
];
const ACTIONS = ["view", "create", "edit", "delete", "approve", "export"] as const;

type PermKey = string; // "module:action"
type PermMap = Record<string, Record<PermKey, boolean>>; // role -> permKey -> allowed

export default function RolePermissions() {
  const { tenantId } = useTenant();
  const { t } = useLanguage();
  const qc = useQueryClient();
  const [selectedRole, setSelectedRole] = useState<TenantRole>("manager");
  const [local, setLocal] = useState<Record<PermKey, boolean>>({});
  const [dirty, setDirty] = useState(false);

  const { data: permsData, isLoading } = useQuery({
    queryKey: ["role-permissions-admin", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_role_permissions")
        .select("role, module, action, allowed")
        .eq("tenant_id", tenantId!);
      if (error) throw error;
      const map: PermMap = {};
      (data || []).forEach((r: any) => {
        if (!map[r.role]) map[r.role] = {};
        map[r.role][`${r.module}:${r.action}`] = r.allowed;
      });
      return map;
    },
    enabled: !!tenantId,
  });

  // Initialize local state when role or data changes
  React.useEffect(() => {
    if (permsData && permsData[selectedRole]) {
      setLocal(permsData[selectedRole]);
      setDirty(false);
    } else {
      setLocal({});
      setDirty(false);
    }
  }, [selectedRole, permsData]);

  const toggle = useCallback((module: string, action: string) => {
    const key = `${module}:${action}`;
    setLocal((prev) => ({ ...prev, [key]: !prev[key] }));
    setDirty(true);
  }, []);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const rows = Object.entries(local).map(([key, allowed]) => {
        const [module, action] = key.split(":");
        return { tenant_id: tenantId!, role: selectedRole, module, action, allowed };
      });
      const { error } = await supabase
        .from("tenant_role_permissions")
        .upsert(rows, { onConflict: "tenant_id,role,module,action" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("saved") || "Saved");
      qc.invalidateQueries({ queryKey: ["role-permissions-admin", tenantId] });
      qc.invalidateQueries({ queryKey: ["tenant-role-permissions"] });
      setDirty(false);
    },
    onError: () => toast.error("Failed to save permissions"),
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      // Delete all custom permissions for this tenant+role, then re-seed defaults
      const { error: delErr } = await supabase
        .from("tenant_role_permissions")
        .delete()
        .eq("tenant_id", tenantId!)
        .eq("role", selectedRole);
      if (delErr) throw delErr;

      // Re-insert defaults via RPC or inline
      const defaultModules = getDefaultModules(selectedRole);
      const rows: any[] = [];
      defaultModules.forEach((mod) => {
        ["view", "create", "edit", "delete"].forEach((act) => {
          rows.push({ tenant_id: tenantId!, role: selectedRole, module: mod, action: act, allowed: true });
        });
      });
      if (rows.length) {
        const { error } = await supabase
          .from("tenant_role_permissions")
          .upsert(rows, { onConflict: "tenant_id,role,module,action" });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Reset to defaults");
      qc.invalidateQueries({ queryKey: ["role-permissions-admin", tenantId] });
      qc.invalidateQueries({ queryKey: ["tenant-role-permissions"] });
    },
    onError: () => toast.error("Failed to reset"),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("rolePermissions") || "Role Permissions"}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {t("rolePermissionsDesc") || "Customize which actions each role can perform within your organization."}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Role:</span>
              <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as TenantRole)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" size="sm" onClick={() => resetMutation.mutate()} disabled={resetMutation.isPending}>
                <RotateCcw className="h-4 w-4 mr-1" /> {t("resetToDefaults") || "Reset to Defaults"}
              </Button>
              <Button size="sm" onClick={() => saveMutation.mutate()} disabled={!dirty || saveMutation.isPending}>
                <Save className="h-4 w-4 mr-1" /> {t("save") || "Save"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 pr-4 font-medium text-muted-foreground">{t("module") || "Module"}</th>
                  {ACTIONS.map((a) => (
                    <th key={a} className="px-3 py-2 text-center font-medium text-muted-foreground capitalize">{a}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MODULES.map((mod) => (
                  <tr key={mod} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="py-2 pr-4 font-medium capitalize">{t(mod as any) || mod}</td>
                    {ACTIONS.map((act) => {
                      const key = `${mod}:${act}`;
                      const checked = !!local[key];
                      return (
                        <td key={act} className="px-3 py-2 text-center">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => toggle(mod, act)}
                            disabled={selectedRole === "admin" && act === "view"}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function getDefaultModules(role: TenantRole): string[] {
  const map: Record<string, string[]> = {
    admin: MODULES,
    manager: ["dashboard", "crm", "sales", "web", "purchasing", "inventory", "returns", "production", "documents", "pos", "analytics", "assets", "settings"],
    finance_director: ["dashboard", "accounting", "analytics", "assets", "settings"],
    accountant: ["dashboard", "accounting", "analytics", "assets", "settings"],
    hr_manager: ["dashboard", "hr", "documents", "analytics", "settings"],
    hr_staff: ["dashboard", "hr", "documents"],
    sales_manager: ["dashboard", "crm", "sales", "web", "inventory", "documents", "analytics"],
    sales_rep: ["dashboard", "crm", "sales", "web", "inventory", "documents"],
    sales: ["dashboard", "crm", "sales", "web", "inventory", "documents"],
    hr: ["dashboard", "hr", "documents"],
    store_manager: ["dashboard", "crm", "sales", "inventory", "pos", "returns", "assets", "analytics"],
    store: ["dashboard", "crm", "sales", "inventory", "pos", "returns", "assets"],
    cashier: ["dashboard", "pos"],
    warehouse_manager: ["dashboard", "inventory", "purchasing", "returns", "assets"],
    warehouse_worker: ["dashboard", "inventory", "returns"],
    production_manager: ["dashboard", "production", "inventory", "documents", "analytics"],
    production_worker: ["dashboard", "production", "inventory"],
    user: ["dashboard", "documents", "pos"],
    viewer: ["dashboard"],
  };
  return map[role] || ["dashboard"];
}
