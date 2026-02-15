import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useLanguage } from "@/i18n/LanguageContext";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";
import { format } from "date-fns";
import { fmtNum } from "@/lib/utils";

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

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{t("movementHistory")}</h1>

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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("date")}</TableHead>
                <TableHead>{t("product")}</TableHead>
                <TableHead>{t("warehouse")}</TableHead>
                <TableHead>{t("type")}</TableHead>
                <TableHead className="text-right">{t("quantity")}</TableHead>
                <TableHead>{t("reference")}</TableHead>
                <TableHead>{t("notes")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>{format(new Date(m.created_at), "dd.MM.yyyy HH:mm")}</TableCell>
                  <TableCell className="font-medium">{(m.products as any)?.name}</TableCell>
                  <TableCell>{(m.warehouses as any)?.name}</TableCell>
                  <TableCell>
                    <Badge variant={typeColor(m.movement_type) as any}>{m.movement_type}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono">{fmtNum(Number(m.quantity))}</TableCell>
                  <TableCell>{m.reference || "—"}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{m.notes || "—"}</TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">{t("noResults")}</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
