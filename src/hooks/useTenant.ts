import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface TenantMembership {
  tenantId: string;
  tenantName: string;
  role: string;
}

const STORAGE_KEY = "selectedTenantId";

export function useTenant() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(
    () => localStorage.getItem(STORAGE_KEY)
  );

  const { data: tenants = [], isLoading } = useQuery({
    queryKey: ["tenant-memberships", user?.id],
    queryFn: async (): Promise<TenantMembership[]> => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("tenant_members")
        .select("tenant_id, role, tenants(name)")
        .eq("user_id", user.id)
        .eq("status", "active");
      if (error) throw error;
      return (data || []).map((m: any) => ({
        tenantId: m.tenant_id,
        tenantName: (m.tenants as any)?.name || m.tenant_id,
        role: m.role,
      }));
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 10,
  });

  // Determine active tenant
  const activeTenant = tenants.find(t => t.tenantId === selectedId) || tenants[0] || null;

  const switchTenant = useCallback((id: string) => {
    localStorage.setItem(STORAGE_KEY, id);
    setSelectedId(id);
    // Invalidate all tenant-scoped queries
    qc.invalidateQueries();
  }, [qc]);

  return {
    tenants,
    tenantId: activeTenant?.tenantId ?? null,
    tenantName: activeTenant?.tenantName ?? null,
    role: activeTenant?.role ?? null,
    switchTenant,
    isLoading,
  };
}
