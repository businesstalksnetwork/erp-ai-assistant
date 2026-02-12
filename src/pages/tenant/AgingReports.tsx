import { useLanguage } from "@/i18n/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

function AgingTable({ data, loading, t }: { data: any[]; loading: boolean; t: (k: any) => string }) {
  if (loading) return <p className="text-muted-foreground">{t("loading")}</p>;
  if (data.length === 0) return <p className="text-muted-foreground">{t("noResults")}</p>;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("date")}</TableHead>
          <TableHead>{t("partner")}</TableHead>
          <TableHead>{t("current")}</TableHead>
          <TableHead>30</TableHead>
          <TableHead>60</TableHead>
          <TableHead>90</TableHead>
          <TableHead>90+</TableHead>
          <TableHead>{t("total")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((r: any) => (
          <TableRow key={r.id}>
            <TableCell>{r.snapshot_date}</TableCell>
            <TableCell>{r.partner_id || "—"}</TableCell>
            <TableCell>{Number(r.bucket_current).toLocaleString()}</TableCell>
            <TableCell>{Number(r.bucket_30).toLocaleString()}</TableCell>
            <TableCell>{Number(r.bucket_60).toLocaleString()}</TableCell>
            <TableCell>{Number(r.bucket_90).toLocaleString()}</TableCell>
            <TableCell>{Number(r.bucket_over90).toLocaleString()}</TableCell>
            <TableCell className="font-medium">{Number(r.total_outstanding).toLocaleString()}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default function AgingReports() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();

  const { data: arData = [], isLoading: arLoading } = useQuery({
    queryKey: ["ar_aging", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase.from("ar_aging_snapshots").select("*").eq("tenant_id", tenantId).order("snapshot_date", { ascending: false }).limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const { data: apData = [], isLoading: apLoading } = useQuery({
    queryKey: ["ap_aging", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase.from("ap_aging_snapshots").select("*").eq("tenant_id", tenantId).order("snapshot_date", { ascending: false }).limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("agingReports")}</h1>
      <Tabs defaultValue="ar">
        <TabsList>
          <TabsTrigger value="ar">{t("accountsReceivable")}</TabsTrigger>
          <TabsTrigger value="ap">{t("accountsPayable")}</TabsTrigger>
        </TabsList>
        <TabsContent value="ar">
          <Card>
            <CardHeader><CardTitle>{t("accountsReceivable")}</CardTitle></CardHeader>
            <CardContent><AgingTable data={arData} loading={arLoading} t={t} /></CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="ap">
          <Card>
            <CardHeader><CardTitle>{t("accountsPayable")}</CardTitle></CardHeader>
            <CardContent><AgingTable data={apData} loading={apLoading} t={t} /></CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
