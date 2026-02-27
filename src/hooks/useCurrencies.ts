import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";

export function useCurrencies() {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ["currencies", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("currencies")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("code");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!tenantId,
    staleTime: 1000 * 60 * 5,
  });
}
