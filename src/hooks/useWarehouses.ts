import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";

export function useWarehouses() {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ["warehouses", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("warehouses")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!tenantId,
    staleTime: 1000 * 60 * 5,
  });
}
