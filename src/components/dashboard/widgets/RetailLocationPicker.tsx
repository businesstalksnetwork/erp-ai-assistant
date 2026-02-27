import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useLanguage } from "@/i18n/LanguageContext";
import { MapPin } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { WidgetConfig } from "@/hooks/useDashboardLayout";

interface Props {
  widgetConfig: WidgetConfig;
  onUpdateConfig: (id: string, configJson: Record<string, any>) => void;
}

export function RetailLocationPicker({ widgetConfig, onUpdateConfig }: Props) {
  const { t } = useLanguage();
  const { tenantId } = useTenant();

  const { data: locations = [] } = useQuery({
    queryKey: ["locations_shops", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("locations")
        .select("id, name")
        .eq("tenant_id", tenantId!)
        .in("type", ["shop", "branch"])
        .order("name");
      return data || [];
    },
    enabled: !!tenantId,
    staleTime: 1000 * 60 * 10,
  });

  if (locations.length === 0) return null;

  const currentLocationId = widgetConfig.configJson?.locationId || "all";

  return (
    <div className="absolute top-1 left-10 z-10">
      <Select
        value={currentLocationId}
        onValueChange={(val) =>
          onUpdateConfig(widgetConfig.id, {
            ...widgetConfig.configJson,
            locationId: val === "all" ? undefined : val,
          })
        }
      >
        <SelectTrigger className="h-6 w-auto min-w-[100px] max-w-[160px] text-[10px] bg-muted/90 border-0 gap-1 px-1.5">
          <MapPin className="h-3 w-3 shrink-0 text-muted-foreground" />
          <SelectValue placeholder={t("allLocations") || "Sve lokacije"} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t("allLocations") || "Sve lokacije"}</SelectItem>
          {locations.map((loc) => (
            <SelectItem key={loc.id} value={loc.id}>
              {loc.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
