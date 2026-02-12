import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";

export function useLegalEntities() {
  const { tenantId } = useTenant();

  const { data: entities = [], isLoading } = useQuery({
    queryKey: ["legal_entities", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("legal_entities")
        .select("id, name, pib")
        .eq("tenant_id", tenantId)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
    staleTime: 1000 * 60 * 10,
  });

  return { entities, isLoading };
}
