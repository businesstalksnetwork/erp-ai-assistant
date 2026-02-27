import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Clock, Play, CheckCircle } from "lucide-react";

export default function ServiceWorkOrders() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Get employee id for current user
  const { data: employeeId } = useQuery({
    queryKey: ["my-employee-id", tenantId, user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("employees").select("id").eq("tenant_id", tenantId!).eq("user_id", user!.id).maybeSingle();
      return data?.id || null;
    },
    enabled: !!tenantId && !!user?.id,
  });

  const { data: workOrders = [], isLoading } = useQuery({
    queryKey: ["my-work-orders", tenantId, employeeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("service_work_orders")
        .select("*, service_orders(order_number, service_devices(brand, model), partners(name))")
        .eq("tenant_id", tenantId!)
        .eq("assigned_to", employeeId!)
        .in("status", ["pending", "in_progress"])
        .order("sort_order");
      return data || [];
    },
    enabled: !!tenantId && !!employeeId,
  });

  const inProgress = workOrders.filter((wo: any) => wo.status === "in_progress");
  const pending = workOrders.filter((wo: any) => wo.status === "pending");

  const WOCard = ({ wo }: { wo: any }) => {
    const so = wo.service_orders as any;
    return (
      <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(`/service/orders/${wo.service_order_id}`)}>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="font-medium text-sm">{wo.work_order_number} — {wo.title}</p>
            <Badge variant="outline" className="text-xs">{wo.status === "in_progress" ? "🔄 U toku" : "⏳ Na čekanju"}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">{so?.order_number} | {so?.service_devices?.brand} {so?.service_devices?.model} | {so?.partners?.name || ""}</p>
          {wo.description && <p className="text-xs text-muted-foreground line-clamp-2">{wo.description}</p>}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {wo.estimated_hours && <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {wo.estimated_hours}h</span>}
          </div>
        </CardContent>
      </Card>
    );
  };

  if (!employeeId && !isLoading) {
    return <div className="p-6 text-center text-muted-foreground">No employee profile linked to your account.</div>;
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <h1 className="text-2xl font-bold">{(t as any)("myWorkOrders")}</h1>

      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : workOrders.length === 0 ? (
        <p className="text-muted-foreground">{t("noResults")}</p>
      ) : (
        <>
          {inProgress.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">🔄 In Progress ({inProgress.length})</h2>
              <div className="grid gap-3">{inProgress.map((wo: any) => <WOCard key={wo.id} wo={wo} />)}</div>
            </div>
          )}
          {pending.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">⏳ Pending ({pending.length})</h2>
              <div className="grid gap-3">{pending.map((wo: any) => <WOCard key={wo.id} wo={wo} />)}</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
