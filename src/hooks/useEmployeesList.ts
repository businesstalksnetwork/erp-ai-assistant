import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";

export function useEmployeesList(activeOnly = true) {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ["employees-list", tenantId, activeOnly],
    queryFn: async () => {
      if (!tenantId) return [];
      let q = supabase
        .from("employees")
        .select("id, first_name, last_name, status, department_id")
        .eq("tenant_id", tenantId);
      if (activeOnly) q = q.eq("status", "active");
      q = q.order("last_name");
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!tenantId,
    staleTime: 1000 * 60 * 5,
  });
}
