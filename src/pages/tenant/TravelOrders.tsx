import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Plane, MapPin } from "lucide-react";
import { format } from "date-fns";
import { PageHeader } from "@/components/shared/PageHeader";
import { MobileFilterBar } from "@/components/shared/MobileFilterBar";
import { ResponsiveTable, type ResponsiveColumn } from "@/components/shared/ResponsiveTable";

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  approved: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  completed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  settled: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
};

export default function TravelOrders() {
  const { tenantId } = useTenant();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const tl = (key: string) => t(key) || key;

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["travel_orders", tenantId, statusFilter],
    queryFn: async () => {
      if (!tenantId) return [];
      let q = (supabase as any)
        .from("travel_orders")
        .select("*, employees(first_name, last_name)")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!tenantId,
  });

  const columns: ResponsiveColumn<any>[] = [
    {
      key: "order_number", label: tl("orderNumber"), primary: true, sortable: true,
      sortValue: (o) => o.order_number || "",
      render: (o) => <span className="font-mono font-medium">{o.order_number}</span>,
    },
    {
      key: "employee", label: t("employee"), sortable: true,
      sortValue: (o) => o.employees ? `${o.employees.last_name} ${o.employees.first_name}` : "",
      render: (o) => o.employees ? `${o.employees.first_name} ${o.employees.last_name}` : "—",
    },
    {
      key: "destination", label: tl("destination"), sortable: true,
      sortValue: (o) => o.destination || "",
      render: (o) => <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{o.destination}</span>,
    },
    {
      key: "departure_date", label: tl("departureDate"), hideOnMobile: true, sortable: true,
      sortValue: (o) => o.departure_date || "",
      render: (o) => format(new Date(o.departure_date), "dd.MM.yyyy"),
    },
    {
      key: "return_date", label: tl("returnDate"), hideOnMobile: true, sortable: true,
      sortValue: (o) => o.return_date || "",
      render: (o) => format(new Date(o.return_date), "dd.MM.yyyy"),
    },
    {
      key: "total_expenses", label: tl("totalExpenses"), align: "right", sortable: true,
      sortValue: (o) => Number(o.total_expenses) || 0,
      render: (o) => <span className="font-mono">{Number(o.total_expenses).toLocaleString("sr-RS", { minimumFractionDigits: 2 })}</span>,
    },
    {
      key: "status", label: t("status"), sortable: true,
      sortValue: (o) => o.status || "",
      render: (o) => <Badge className={statusColors[o.status] || ""}>{tl(o.status)}</Badge>,
    },
  ];

  if (isLoading) return <p>{t("loading")}</p>;

  return (
    <div className="space-y-6">
      <PageHeader
        title={tl("travelOrders")}
        icon={Plane}
        actions={
          <Button onClick={() => navigate("/hr/travel-orders/new")}>
            <Plus className="h-4 w-4 mr-2" /> {tl("newTravelOrder")}
          </Button>
        }
      />

      <MobileFilterBar
        filters={
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={t("status")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("all")}</SelectItem>
              <SelectItem value="draft">{t("draft")}</SelectItem>
              <SelectItem value="approved">{t("approved")}</SelectItem>
              <SelectItem value="completed">{t("completed")}</SelectItem>
              <SelectItem value="settled">{tl("settled")}</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      <ResponsiveTable
        data={orders}
        columns={columns}
        keyExtractor={(o) => o.id}
        onRowClick={(o) => navigate(`/hr/travel-orders/${o.id}`)}
        emptyMessage={t("noDataToExport")}
        enableExport
        exportFilename="travel_orders"
        enableColumnToggle
      />
    </div>
  );
}
