import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Search } from "lucide-react";
import CreateTenantWizard from "@/components/super-admin/CreateTenantWizard";
import TenantDetailDialog from "@/components/super-admin/TenantDetailDialog";
import EditTenantDialog from "@/components/super-admin/EditTenantDialog";

export default function TenantManagement() {
  const { t } = useLanguage();
  const [tenants, setTenants] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);

  const fetchTenants = () => {
    supabase.from("tenants").select("*").order("created_at", { ascending: false }).then(({ data }) => {
      if (data) setTenants(data);
    });
  };

  useEffect(() => { fetchTenants(); }, []);

  const filtered = tenants.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  const statusColor = (s: string) => {
    switch (s) {
      case "active": return "default";
      case "suspended": return "destructive";
      case "trial": return "secondary";
      default: return "secondary";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t("tenantManagement")}</h1>
        <Button className="gap-2" onClick={() => setWizardOpen(true)}><Plus className="h-4 w-4" />{t("createTenant")}</Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input placeholder={t("search")} value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("tenantName")}</TableHead>
                <TableHead>{t("plan")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead>{t("createdAt")}</TableHead>
                <TableHead>{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">{t("noResults")}</TableCell></TableRow>
              ) : (
                filtered.map((tenant) => (
                  <TableRow key={tenant.id}>
                    <TableCell className="font-medium">{tenant.name}</TableCell>
                    <TableCell><Badge variant="outline">{tenant.plan}</Badge></TableCell>
                    <TableCell><Badge variant={statusColor(tenant.status)}>{t(tenant.status as any)}</Badge></TableCell>
                    <TableCell>{new Date(tenant.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="space-x-1">
                      <Button variant="ghost" size="sm" onClick={() => setDetailId(tenant.id)}>{t("view")}</Button>
                      <Button variant="ghost" size="sm" onClick={() => setEditId(tenant.id)}>{t("edit")}</Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <CreateTenantWizard open={wizardOpen} onOpenChange={setWizardOpen} onCreated={fetchTenants} />
      <TenantDetailDialog tenantId={detailId} open={!!detailId} onOpenChange={(o) => !o && setDetailId(null)} />
      <EditTenantDialog tenantId={editId} open={!!editId} onOpenChange={(o) => !o && setEditId(null)} onUpdated={fetchTenants} />
    </div>
  );
}
