import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";

export default function ModuleManagement() {
  const { t } = useLanguage();
  const [modules, setModules] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<string>("");
  const [tenantModules, setTenantModules] = useState<Record<string, string>>({}); // module_id -> tenant_module_id
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      supabase.from("module_definitions").select("*").order("sort_order"),
      supabase.from("tenants").select("id, name").order("name"),
    ]).then(([mods, tens]) => {
      if (mods.data) setModules(mods.data);
      if (tens.data) setTenants(tens.data);
    });
  }, []);

  useEffect(() => {
    if (!selectedTenant) { setTenantModules({}); return; }
    supabase.from("tenant_modules").select("id, module_id").eq("tenant_id", selectedTenant).eq("is_enabled", true)
      .then(({ data }) => {
        const map: Record<string, string> = {};
        data?.forEach((tm) => { map[tm.module_id] = tm.id; });
        setTenantModules(map);
      });
  }, [selectedTenant]);

  const toggleModule = async (moduleId: string, enabled: boolean) => {
    if (!selectedTenant) return;
    setLoading(true);
    if (enabled) {
      const { error } = await supabase.from("tenant_modules").insert({ tenant_id: selectedTenant, module_id: moduleId, is_enabled: true });
      if (error && error.code === "23505") {
        // Already exists, update
        await supabase.from("tenant_modules").update({ is_enabled: true }).eq("tenant_id", selectedTenant).eq("module_id", moduleId);
      } else if (error) {
        toast({ title: t("error"), description: error.message, variant: "destructive" });
      }
    } else {
      await supabase.from("tenant_modules").update({ is_enabled: false }).eq("tenant_id", selectedTenant).eq("module_id", moduleId);
    }
    // Refresh
    const { data } = await supabase.from("tenant_modules").select("id, module_id").eq("tenant_id", selectedTenant).eq("is_enabled", true);
    const map: Record<string, string> = {};
    data?.forEach((tm) => { map[tm.module_id] = tm.id; });
    setTenantModules(map);
    setLoading(false);
  };

  const applyPreset = async (preset: string) => {
    if (!selectedTenant) return;
    const presetKeys: Record<string, string[]> = {
      basic: ["accounting", "sales"],
      professional: ["accounting", "sales", "inventory", "hr", "crm"],
      enterprise: modules.map((m) => m.key),
    };
    const keys = presetKeys[preset] || [];
    setLoading(true);
    // Disable all first
    await supabase.from("tenant_modules").update({ is_enabled: false }).eq("tenant_id", selectedTenant);
    // Enable selected
    for (const mod of modules) {
      if (keys.includes(mod.key)) {
        const { error } = await supabase.from("tenant_modules").upsert(
          { tenant_id: selectedTenant, module_id: mod.id, is_enabled: true },
          { onConflict: "tenant_id,module_id" as any }
        );
        if (error) {
          // Fallback: try insert then update
          await supabase.from("tenant_modules").insert({ tenant_id: selectedTenant, module_id: mod.id, is_enabled: true })
            .then(({ error: e2 }) => {
              if (e2) supabase.from("tenant_modules").update({ is_enabled: true }).eq("tenant_id", selectedTenant).eq("module_id", mod.id);
            });
        }
      }
    }
    // Refresh
    const { data } = await supabase.from("tenant_modules").select("id, module_id").eq("tenant_id", selectedTenant).eq("is_enabled", true);
    const map: Record<string, string> = {};
    data?.forEach((tm) => { map[tm.module_id] = tm.id; });
    setTenantModules(map);
    setLoading(false);
    toast({ title: t("success"), description: `Applied ${preset} preset` });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{t("moduleManagement")}</h1>

      <Card>
        <CardHeader>
          <CardTitle>Select Tenant</CardTitle>
          <Select value={selectedTenant} onValueChange={setSelectedTenant}>
            <SelectTrigger className="max-w-sm"><SelectValue placeholder="Choose a tenant..." /></SelectTrigger>
            <SelectContent>
              {tenants.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardHeader>
      </Card>

      {selectedTenant && (
        <>
          <div className="flex gap-2">
            <span className="text-sm text-muted-foreground pt-2">Quick presets:</span>
            <Button variant="outline" size="sm" onClick={() => applyPreset("basic")}>Basic</Button>
            <Button variant="outline" size="sm" onClick={() => applyPreset("professional")}>Professional</Button>
            <Button variant="outline" size="sm" onClick={() => applyPreset("enterprise")}>Enterprise</Button>
          </div>

          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("name")}</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Key</TableHead>
                    <TableHead>{t("status")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {modules.map((mod) => (
                    <TableRow key={mod.id}>
                      <TableCell className="font-medium">{mod.name}</TableCell>
                      <TableCell className="text-muted-foreground">{mod.description}</TableCell>
                      <TableCell><code className="text-xs bg-muted px-2 py-1 rounded">{mod.key}</code></TableCell>
                      <TableCell>
                        <Switch
                          checked={!!tenantModules[mod.id]}
                          onCheckedChange={(checked) => toggleModule(mod.id, checked)}
                          disabled={loading}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      {!selectedTenant && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-sm text-center py-8">Select a tenant above to manage their modules.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
