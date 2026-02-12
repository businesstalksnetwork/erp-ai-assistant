import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface TenantMembership {
  tenantId: string | null;
  role: string | null;
}

export function useTenant() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["tenant-membership", user?.id],
    queryFn: async (): Promise<TenantMembership> => {
      if (!user) return { tenantId: null, role: null };
      const { data, error } = await supabase
        .from("tenant_members")
        .select("tenant_id, role")
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();
      if (error) throw error;
      return {
        tenantId: data?.tenant_id ?? null,
        role: data?.role ?? null,
      };
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 10,
  });

  return {
    tenantId: data?.tenantId ?? null,
    role: data?.role ?? null,
    isLoading,
  };
}
