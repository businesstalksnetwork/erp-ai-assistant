import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";

export function useTaxRates(activeOnly = true) {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ["tax-rates", tenantId, activeOnly],
    queryFn: async () => {
      if (!tenantId) return [];
      let q = supabase.from("tax_rates").select("*").eq("tenant_id", tenantId);
      if (activeOnly) q = q.eq("is_active", true);
      q = q.order("rate", { ascending: false });
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!tenantId,
    staleTime: 1000 * 60 * 5,
  });
}
