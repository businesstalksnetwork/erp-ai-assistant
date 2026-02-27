import { useLanguage } from "@/i18n/LanguageContext";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, Package, ShieldCheck, CreditCard, ClipboardCheck } from "lucide-react";
import { addDays } from "date-fns";

export function PendingActionsWidget() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const navigate = useNavigate();

  const { data: draftCount = 0 } = useQuery({
    queryKey: ["dashboard-drafts", tenantId],
    queryFn: async () => {
      const { count } = await supabase.from("journal_entries").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId!).eq("status", "draft");
      return count || 0;
    },
    enabled: !!tenantId, staleTime: 1000 * 60 * 2,
  });

  const { data: overdueCount = 0 } = useQuery({
    queryKey: ["dashboard-overdue", tenantId],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const { count } = await supabase.from("invoices").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId!).in("status", ["draft", "sent"]).lt("due_date", today);
      return count || 0;
    },
    enabled: !!tenantId, staleTime: 1000 * 60 * 2,
  });

  const { data: lowStockCount = 0 } = useQuery({
    queryKey: ["dashboard-low-stock", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("inventory_stock").select("id, quantity_on_hand, min_stock_level").eq("tenant_id", tenantId!).gt("min_stock_level", 0);
      if (!data) return 0;
      return data.filter((s) => Number(s.quantity_on_hand) < Number(s.min_stock_level)).length;
    },
    enabled: !!tenantId, staleTime: 1000 * 60 * 2,
  });

  const { data: pendingApprovalCount = 0 } = useQuery({
    queryKey: ["dashboard-pending-approvals", tenantId],
    queryFn: async () => {
      const { count } = await supabase.from("approval_requests").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId!).eq("status", "pending");
      return count || 0;
    },
    enabled: !!tenantId, staleTime: 1000 * 60 * 2,
  });

  const items = [
    draftCount > 0 && { icon: AlertCircle, color: "text-warning", text: `${draftCount} ${t("draftJournalEntries")}`, route: "/accounting/journal" },
    overdueCount > 0 && { icon: AlertCircle, color: "text-destructive", text: `${overdueCount} ${t("overdueInvoices")}`, route: "/accounting/invoices" },
    lowStockCount > 0 && { icon: Package, color: "text-warning", text: `${lowStockCount} ${t("lowStockAlert")}`, route: "/inventory/stock" },
    pendingApprovalCount > 0 && { icon: ShieldCheck, color: "text-primary", text: `${pendingApprovalCount} ${t("pendingApprovals")}`, route: "/settings/pending-approvals" },
  ].filter(Boolean) as { icon: any; color: string; text: string; route: string }[];

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4 text-muted-foreground" />{t("pendingActions")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {items.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("noResults") || "No pending actions"}</p>
        ) : (
          items.map((item, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <item.icon className={`h-4 w-4 ${item.color}`} /><span>{item.text}</span>
              </div>
              <Button size="sm" variant="ghost" onClick={() => navigate(item.route)}>{t("view")}</Button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
