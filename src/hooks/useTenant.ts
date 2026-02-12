import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function useTenant() {
  const { user } = useAuth();

  const { data: tenantId, isLoading } = useQuery({
    queryKey: ["tenant-membership", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("tenant_members")
        .select("tenant_id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();
      if (error) throw error;
      return data?.tenant_id ?? null;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 10,
  });

  return { tenantId: tenantId ?? null, isLoading };
}
