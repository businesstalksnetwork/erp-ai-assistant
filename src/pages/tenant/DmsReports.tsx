import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { exportToCsv } from "@/lib/exportCsv";
import { Download } from "lucide-react";
import { BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

const COLORS = ["hsl(var(--primary))", "hsl(var(--secondary))", "#f59e0b", "#ef4444", "#10b981", "#8b5cf6", "#ec4899"];

export default function DmsReports() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const [dateFrom, setDateFrom] = useState(() => { const d = new Date(); d.setFullYear(d.getFullYear() - 1); return d.toISOString().split("T")[0]; });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split("T")[0]);

  const { data: docs = [] } = useQuery({
    queryKey: ["dms_reports_docs", tenantId, dateFrom, dateTo],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase.from("documents")
        .select("*, document_categories(code, name_sr, group_name_sr)")
        .eq("tenant_id", tenantId)
        .gte("created_at", dateFrom).lte("created_at", dateTo + "T23:59:59")
        .order("created_at");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: archiveEntries = [] } = useQuery({
    queryKey: ["dms_reports_archive", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase.from("archive_book").select("*").eq("tenant_id", tenantId);
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Stats
  const totalDocs = docs.length;
  const activeDocs = docs.filter((d: any) => d.status === "aktivan").length;
  const archivedDocs = docs.filter((d: any) => d.status === "arhiviran").length;
  const permanentArchive = archiveEntries.filter((e: any) => e.retention_period === "trajno").length;

  // Trend data (docs per month)
  const trendData = docs.reduce((acc: any, d: any) => {
    const month = d.created_at.substring(0, 7);
    const existing = acc.find((a: any) => a.month === month);
    if (existing) existing.count++;
    else acc.push({ month, count: 1 });
    return acc;
  }, [] as { month: string; count: number }[]);

  // Category distribution
  const categoryData = docs.reduce((acc: any, d: any) => {
    const cat = d.document_categories?.name_sr || "Ostalo";
    const existing = acc.find((a: any) => a.name === cat);
    if (existing) existing.value++;
    else acc.push({ name: cat, value: 1 });
    return acc;
  }, [] as { name: string; value: number }[]).sort((a: any, b: any) => b.value - a.value).slice(0, 10);

  // Status distribution
  const statusData = [
    { name: "Aktivan", value: activeDocs },
    { name: "Arhiviran", value: archivedDocs },
    { name: "Za izlučivanje", value: docs.filter((d: any) => d.status === "za_izlucivanje").length },
  ].filter(s => s.value > 0);

  // Retention distribution
  const retentionData = ["trajno", "10", "5", "3", "2"].map(r => ({
    name: r === "trajno" ? "Trajno" : `${r} god.`,
    value: archiveEntries.filter((e: any) => e.retention_period === r).length,
  })).filter(r => r.value > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("dmsReports")}</h1>
          <p className="text-muted-foreground text-sm">{t("dmsReportsDesc")}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => {
          if (docs.length === 0) return;
          exportToCsv(docs, [
            { key: "protocol_number", label: "Protocol" },
            { key: "subject", label: "Subject" },
            { key: "sender", label: "Sender" },
            { key: "status", label: "Status" },
            { key: "created_at", label: "Date" },
          ], "dms-report");
        }}><Download className="h-4 w-4 mr-2" />{t("exportCsv")}</Button>
      </div>

      {/* Date range */}
      <div className="flex gap-4 items-end">
        <div><Label>{t("startDate")}</Label><Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} /></div>
        <div><Label>{t("endDate")}</Label><Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} /></div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card><CardContent className="pt-4"><div className="text-2xl font-bold">{totalDocs}</div><p className="text-sm text-muted-foreground">{t("dmsTotal")} {t("documents").toLowerCase()}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-2xl font-bold">{activeDocs}</div><p className="text-sm text-muted-foreground">{t("active")}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-2xl font-bold">{archiveEntries.length}</div><p className="text-sm text-muted-foreground">{t("dmsArchiveBook")}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-2xl font-bold">{permanentArchive}</div><p className="text-sm text-muted-foreground">{t("dmsPermanent")}</p></CardContent></Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>{t("dmsTrend")}</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={trendData}>
                <XAxis dataKey="month" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t("dmsCategoryDistribution")}</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={categoryData}>
                <XAxis dataKey="name" fontSize={10} angle={-45} textAnchor="end" height={80} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Bar dataKey="value" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t("dmsStatusDistribution")}</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={statusData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                  {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t("dmsRetentionDistribution")}</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={retentionData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                  {retentionData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
