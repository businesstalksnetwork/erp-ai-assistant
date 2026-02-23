import { useLanguage } from "@/i18n/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { RefreshCw } from "lucide-react";
import { DownloadPdfButton } from "@/components/DownloadPdfButton";

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

interface BucketData {
  partner_id: string | null;
  bucket_current: number;
  bucket_30: number;
  bucket_60: number;
  bucket_90: number;
  bucket_over90: number;
  total_outstanding: number;
}

function bucketForDays(days: number): keyof Omit<BucketData, "partner_id" | "total_outstanding"> {
  if (days <= 0) return "bucket_current";
  if (days <= 30) return "bucket_30";
  if (days <= 60) return "bucket_60";
  if (days <= 90) return "bucket_90";
  return "bucket_over90";
}

export default function AgingReports() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const qc = useQueryClient();

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

  const generateSnapshotMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId) return;
      const today = new Date().toISOString().split("T")[0];
      const todayMs = new Date(today).getTime();

      // AR: Fetch unpaid invoices
      const { data: arInvoices } = await supabase
        .from("invoices")
        .select("partner_id, total, due_date")
        .eq("tenant_id", tenantId)
        .in("status", ["sent", "overdue"]);

      // Group AR by partner
      const arMap: Record<string, BucketData> = {};
      (arInvoices || []).forEach((inv: any) => {
        const key = inv.partner_id || "__none__";
        if (!arMap[key]) {
          arMap[key] = { partner_id: inv.partner_id, bucket_current: 0, bucket_30: 0, bucket_60: 0, bucket_90: 0, bucket_over90: 0, total_outstanding: 0 };
        }
        const days = inv.due_date ? Math.floor((todayMs - new Date(inv.due_date).getTime()) / 86400000) : 0;
        const bucket = bucketForDays(days);
        arMap[key][bucket] += Number(inv.total);
        arMap[key].total_outstanding += Number(inv.total);
      });

      // Insert AR snapshots
      const arRows = Object.values(arMap).map((b) => ({
        tenant_id: tenantId,
        snapshot_date: today,
        partner_id: b.partner_id,
        bucket_current: b.bucket_current,
        bucket_30: b.bucket_30,
        bucket_60: b.bucket_60,
        bucket_90: b.bucket_90,
        bucket_over90: b.bucket_over90,
        total_outstanding: b.total_outstanding,
      }));
      if (arRows.length > 0) {
        const { error } = await supabase.from("ar_aging_snapshots").insert(arRows);
        if (error) throw error;
      }

      // AP: Fetch unpaid supplier invoices
      const { data: apInvoices } = await supabase
        .from("supplier_invoices")
        .select("supplier_id, total, due_date")
        .eq("tenant_id", tenantId)
        .in("status", ["received", "approved"]);

      // Group AP by supplier
      const apMap: Record<string, BucketData> = {};
      (apInvoices || []).forEach((inv: any) => {
        const key = inv.supplier_id || "__none__";
        if (!apMap[key]) {
          apMap[key] = { partner_id: inv.supplier_id, bucket_current: 0, bucket_30: 0, bucket_60: 0, bucket_90: 0, bucket_over90: 0, total_outstanding: 0 };
        }
        const days = inv.due_date ? Math.floor((todayMs - new Date(inv.due_date).getTime()) / 86400000) : 0;
        const bucket = bucketForDays(days);
        apMap[key][bucket] += Number(inv.total);
        apMap[key].total_outstanding += Number(inv.total);
      });

      // Insert AP snapshots
      const apRows = Object.values(apMap).map((b) => ({
        tenant_id: tenantId,
        snapshot_date: today,
        partner_id: b.partner_id,
        bucket_current: b.bucket_current,
        bucket_30: b.bucket_30,
        bucket_60: b.bucket_60,
        bucket_90: b.bucket_90,
        bucket_over90: b.bucket_over90,
        total_outstanding: b.total_outstanding,
      }));
      if (apRows.length > 0) {
        const { error } = await supabase.from("ap_aging_snapshots").insert(apRows);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ar_aging", tenantId] });
      qc.invalidateQueries({ queryKey: ["ap_aging", tenantId] });
      toast({ title: t("snapshotGenerated") });
    },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("agingReports")}</h1>
        <div className="flex gap-2">
          <DownloadPdfButton type="aging_report" params={{ tenant_id: tenantId, report_type: "ar" }} />
          <Button
            size="sm"
            onClick={() => generateSnapshotMutation.mutate()}
            disabled={generateSnapshotMutation.isPending}
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            {t("generateSnapshot")}
          </Button>
        </div>
      </div>
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
