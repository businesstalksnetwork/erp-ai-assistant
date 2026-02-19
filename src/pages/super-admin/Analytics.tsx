import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useLanguage } from "@/i18n/LanguageContext";
import { Building2, Users, Puzzle, FileText, BookOpen, UserCheck } from "lucide-react";

export default function SuperAdminAnalytics() {
  const { t } = useLanguage();

  const { data: tenantCount = 0 } = useQuery({
    queryKey: ["sa-tenant-count"],
    queryFn: async () => {
      const { count } = await supabase.from("tenants").select("id", { count: "exact", head: true });
      return count || 0;
    },
  });

  const { data: userCount = 0 } = useQuery({
    queryKey: ["sa-user-count"],
    queryFn: async () => {
      const { count } = await supabase.from("tenant_members").select("id", { count: "exact", head: true }).eq("status", "active");
      return count || 0;
    },
  });

  const { data: moduleEnabledCount = 0 } = useQuery({
    queryKey: ["sa-module-count"],
    queryFn: async () => {
      const { count } = await supabase.from("tenant_modules").select("id", { count: "exact", head: true }).eq("is_enabled", true);
      return count || 0;
    },
  });

  const { data: invoiceCount = 0 } = useQuery({
    queryKey: ["sa-invoice-count"],
    queryFn: async () => {
      const { count } = await supabase.from("invoices").select("id", { count: "exact", head: true });
      return count || 0;
    },
  });

  const { data: journalCount = 0 } = useQuery({
    queryKey: ["sa-journal-count"],
    queryFn: async () => {
      const { count } = await supabase.from("journal_entries").select("id", { count: "exact", head: true });
      return count || 0;
    },
  });

  const { data: employeeCount = 0 } = useQuery({
    queryKey: ["sa-employee-count"],
    queryFn: async () => {
      const { count } = await supabase.from("employees").select("id", { count: "exact", head: true }).eq("status", "active");
      return count || 0;
    },
  });

  const { data: moduleAdoption = [] } = useQuery({
    queryKey: ["sa-module-adoption"],
    queryFn: async () => {
      const { data: defs } = await supabase.from("module_definitions").select("id, key, name");
      const { data: enabled } = await supabase.from("tenant_modules").select("module_id").eq("is_enabled", true);
      if (!defs || !enabled) return [];
      const countMap: Record<string, number> = {};
      for (const row of enabled) {
        countMap[row.module_id] = (countMap[row.module_id] || 0) + 1;
      }
      return defs
        .map((d) => ({ name: d.key, label: d.name || d.key, count: countMap[d.id] || 0 }))
        .sort((a, b) => b.count - a.count);
    },
  });

  const { data: tenantActivity = [] } = useQuery({
    queryKey: ["sa-tenant-activity"],
    queryFn: async () => {
      const { data: tenants } = await supabase.from("tenants").select("id, name").order("name");
      if (!tenants) return [];

      const results = await Promise.all(
        tenants.map(async (tenant) => {
          const { count: inv } = await supabase
            .from("invoices")
            .select("id", { count: "exact", head: true })
            .eq("tenant_id", tenant.id);
          const { count: je } = await supabase
            .from("journal_entries")
            .select("id", { count: "exact", head: true })
            .eq("tenant_id", tenant.id);
          const { data: lastAudit } = await supabase
            .from("audit_log")
            .select("created_at")
            .eq("tenant_id", tenant.id)
            .order("created_at", { ascending: false })
            .limit(1);
          return {
            name: tenant.name,
            invoices: inv || 0,
            journal_entries: je || 0,
            last_activity: lastAudit?.[0]?.created_at || null,
          };
        })
      );
      return results.sort((a, b) => b.invoices - a.invoices);
    },
  });

  const kpiCards = [
    { label: t("tenants"), value: tenantCount, icon: Building2 },
    { label: t("activeUsers"), value: userCount, icon: Users },
    { label: t("modules"), value: moduleEnabledCount, icon: Puzzle },
    { label: t("invoices"), value: invoiceCount, icon: FileText },
    { label: t("journalEntries"), value: journalCount, icon: BookOpen },
    { label: t("employees"), value: employeeCount, icon: UserCheck },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{t("analytics")}</h1>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        {kpiCards.map((c) => (
          <Card key={c.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground flex items-center gap-1.5">
                <c.icon className="h-3.5 w-3.5" />
                {c.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{c.value.toLocaleString()}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Module Adoption Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("modules")} — Adoption per Tenant</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={moduleAdoption} margin={{ top: 4, right: 8, left: -16, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
                formatter={(v: number) => [v, "Tenants"]}
              />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Tenant Activity Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top {t("tenants")} by Volume</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("tenants")}</TableHead>
                <TableHead className="text-right">{t("invoices")}</TableHead>
                <TableHead className="text-right">{t("journalEntries")}</TableHead>
                <TableHead>Last Activity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tenantActivity.map((row) => (
                <TableRow key={row.name}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell className="text-right">{row.invoices.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{row.journal_entries.toLocaleString()}</TableCell>
                  <TableCell>
                    {row.last_activity ? (
                      <Badge variant="secondary" className="text-xs">
                        {new Date(row.last_activity).toLocaleDateString()}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {tenantActivity.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    No data available.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
