import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useLanguage } from "@/i18n/LanguageContext";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";
import { format } from "date-fns";
import { fmtNum } from "@/lib/utils";
import { ResponsiveTable, type ResponsiveColumn } from "@/components/shared/ResponsiveTable";

const MOVEMENT_TYPES = ["in", "out", "adjustment", "transfer"];

export default function InventoryMovements() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("__all__");

  const { data: movements = [] } = useQuery({
    queryKey: ["inventory-movements", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_movements")
        .select("*, products(name, sku), warehouses(name)")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const filtered = movements.filter((m) => {
    const productName = (m.products as any)?.name || "";
    if (!productName.toLowerCase().includes(search.toLowerCase())) return false;
    if (typeFilter !== "__all__" && m.movement_type !== typeFilter) return false;
    return true;
  });

  const typeColor = (type: string) => {
    switch (type) {
      case "in": return "default";
      case "out": return "destructive";
      case "adjustment": return "secondary";
      case "transfer": return "outline";
      default: return "secondary";
    }
  };

  const columns: ResponsiveColumn<any>[] = [
    { key: "date", label: t("date"), sortable: true, sortValue: (m) => m.created_at, render: (m) => format(new Date(m.created_at), "dd.MM.yyyy HH:mm") },
    { key: "product", label: t("product"), primary: true, sortable: true, sortValue: (m) => (m.products as any)?.name || "", render: (m) => <span className="font-medium">{(m.products as any)?.name}</span> },
    { key: "warehouse", label: t("warehouse"), hideOnMobile: true, sortable: true, sortValue: (m) => (m.warehouses as any)?.name || "", render: (m) => (m.warehouses as any)?.name },
    { key: "type", label: t("type"), sortable: true, sortValue: (m) => m.movement_type, render: (m) => <Badge variant={typeColor(m.movement_type) as any}>{m.movement_type}</Badge> },
    { key: "quantity", label: t("quantity"), align: "right" as const, sortable: true, sortValue: (m) => Number(m.quantity), render: (m) => <span className="font-mono">{fmtNum(Number(m.quantity))}</span> },
    { key: "reference", label: t("reference"), hideOnMobile: true, render: (m) => m.reference || "—" },
    { key: "notes", label: t("notes"), hideOnMobile: true, render: (m) => <span className="max-w-[200px] truncate block">{m.notes || "—"}</span> },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("movementHistory")}</h1>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder={t("search")} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <div className="w-48">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">{t("allTypes")}</SelectItem>
                  {MOVEMENT_TYPES.map((mt) => <SelectItem key={mt} value={mt}>{t(mt as any)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveTable
            data={filtered}
            columns={columns}
            keyExtractor={(m) => m.id}
            emptyMessage={t("noResults")}
            enableExport
            exportFilename="inventory-movements"
            enableColumnToggle
          />
        </CardContent>
      </Card>
    </div>
  );
}
