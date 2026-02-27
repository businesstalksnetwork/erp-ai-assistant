import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, MapPin, Plane } from "lucide-react";
import { format } from "date-fns";

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
  const tl = (key: string) => (t as any)(key) || key;

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Plane className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold">{tl("travelOrders")}</h1>
        </div>
        <Button onClick={() => navigate("/hr/travel-orders/new")}>
          <Plus className="h-4 w-4 mr-2" /> {tl("newTravelOrder")}
        </Button>
      </div>

      <div className="flex gap-2">
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
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tl("orderNumber")}</TableHead>
                <TableHead>{t("employee")}</TableHead>
                <TableHead>{tl("destination")}</TableHead>
                <TableHead>{tl("departureDate")}</TableHead>
                <TableHead>{tl("returnDate")}</TableHead>
                <TableHead>{tl("totalExpenses")}</TableHead>
                <TableHead>{t("status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8">{t("loading")}...</TableCell></TableRow>
              ) : orders.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">{t("noDataToExport")}</TableCell></TableRow>
              ) : orders.map((o: any) => (
                <TableRow key={o.id} className="cursor-pointer" onClick={() => navigate(`/hr/travel-orders/${o.id}`)}>
                  <TableCell className="font-mono font-medium">{o.order_number}</TableCell>
                  <TableCell>{o.employees ? `${o.employees.first_name} ${o.employees.last_name}` : "—"}</TableCell>
                  <TableCell className="flex items-center gap-1"><MapPin className="h-3 w-3" />{o.destination}</TableCell>
                  <TableCell>{format(new Date(o.departure_date), "dd.MM.yyyy")}</TableCell>
                  <TableCell>{format(new Date(o.return_date), "dd.MM.yyyy")}</TableCell>
                  <TableCell className="font-mono">{Number(o.total_expenses).toLocaleString("sr-RS", { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell><Badge className={statusColors[o.status] || ""}>{tl(o.status)}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
