import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PageHeader } from "@/components/shared/PageHeader";
import { useToast } from "@/hooks/use-toast";
import { Check, X, Clock, ShieldCheck } from "lucide-react";

export default function PosManagerOverride() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [reviewDialog, setReviewDialog] = useState<any>(null);
  const [reviewComment, setReviewComment] = useState("");

  const { data: overrides = [], isLoading } = useQuery({
    queryKey: ["pos_discount_overrides", tenantId, filter],
    queryFn: async () => {
      if (!tenantId) return [];
      let q = supabase
        .from("pos_discount_overrides")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      if (filter !== "all") q = q.eq("status", filter);
      const { data, error } = await q.limit(100);
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "approved" | "rejected" }) => {
      const { error } = await supabase
        .from("pos_discount_overrides")
        .update({ status: action, approved_by: user?.id, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, { action }) => {
      qc.invalidateQueries({ queryKey: ["pos_discount_overrides"] });
      toast({ title: action === "approved" ? t("approved" as any) || "Odobreno" : t("rejected" as any) || "Odbijeno" });
      setReviewDialog(null);
      setReviewComment("");
    },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const statusBadge = (status: string) => {
    switch (status) {
      case "pending": return <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" />{t("pending" as any) || "Na čekanju"}</Badge>;
      case "approved": return <Badge variant="default" className="gap-1 bg-success text-success-foreground"><Check className="h-3 w-3" />{t("approved" as any) || "Odobreno"}</Badge>;
      case "rejected": return <Badge variant="destructive" className="gap-1"><X className="h-3 w-3" />{t("rejected" as any) || "Odbijeno"}</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const pendingCount = overrides.filter(o => (o as any).status === "pending").length;

  return (
    <div className="space-y-6">
      <PageHeader title={t("managerOverrides" as any) || "Menadžerska odobrenja popusta"} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="h-8 w-8 text-warning" />
            <div>
              <p className="text-2xl font-bold">{pendingCount}</p>
              <p className="text-xs text-muted-foreground">{t("pending" as any) || "Na čekanju"}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Check className="h-8 w-8 text-success" />
            <div>
              <p className="text-2xl font-bold">{overrides.filter(o => (o as any).status === "approved").length}</p>
              <p className="text-xs text-muted-foreground">{t("approved" as any) || "Odobreno"}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <X className="h-8 w-8 text-destructive" />
            <div>
              <p className="text-2xl font-bold">{overrides.filter(o => (o as any).status === "rejected").length}</p>
              <p className="text-xs text-muted-foreground">{t("rejected" as any) || "Odbijeno"}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-2">
        {(["pending", "approved", "rejected", "all"] as const).map(f => (
          <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)}>
            {f === "all" ? t("all") : f === "pending" ? t("pending" as any) || "Na čekanju" : f === "approved" ? t("approved" as any) || "Odobreno" : t("rejected" as any) || "Odbijeno"}
          </Button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("product" as any) || "Proizvod"}</TableHead>
                <TableHead className="text-right">{t("originalPrice" as any) || "Orig. cena"}</TableHead>
                <TableHead className="text-right">{t("overridePrice" as any) || "Nova cena"}</TableHead>
                <TableHead className="text-right">{t("discount" as any) || "Popust %"}</TableHead>
                <TableHead>{t("reason" as any) || "Razlog"}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead>{t("date" as any) || "Datum"}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">{t("loading")}</TableCell></TableRow>
              ) : overrides.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">{t("noResults" as any) || "Nema rezultata"}</TableCell></TableRow>
              ) : overrides.map((o: any) => (
                <TableRow key={o.id}>
                  <TableCell className="font-medium">{o.product_name || "—"}</TableCell>
                  <TableCell className="text-right">{Number(o.original_price).toFixed(2)}</TableCell>
                  <TableCell className="text-right">{Number(o.override_price).toFixed(2)}</TableCell>
                  <TableCell className="text-right">{Number(o.discount_pct).toFixed(1)}%</TableCell>
                  <TableCell className="max-w-[200px] truncate">{o.reason || "—"}</TableCell>
                  <TableCell>{statusBadge(o.status)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    {o.status === "pending" && (
                      <div className="flex gap-1">
                        <Button size="icon-sm" variant="ghost" className="text-success" onClick={() => reviewMutation.mutate({ id: o.id, action: "approved" })}>
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button size="icon-sm" variant="ghost" className="text-destructive" onClick={() => reviewMutation.mutate({ id: o.id, action: "rejected" })}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
