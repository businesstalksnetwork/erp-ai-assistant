import { useState, useCallback, useEffect } from "react";
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
  const { user, isSuperAdmin } = useAuth();
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(
    () => localStorage.getItem(STORAGE_KEY)
  );

  // Regular users: fetch tenant memberships
  const { data: memberTenants = [], isLoading: isLoadingMembers } = useQuery({
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
    enabled: !!user && !isSuperAdmin,
    staleTime: 1000 * 60 * 10,
  });

  // Super admins: fetch ALL tenants
  const { data: allTenants = [], isLoading: isLoadingAll } = useQuery({
    queryKey: ["all-tenants-superadmin"],
    queryFn: async (): Promise<TenantMembership[]> => {
      const { data, error } = await supabase
        .from("tenants")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return (data || []).map((t: any) => ({
        tenantId: t.id,
        tenantName: t.name,
        role: "admin",
      }));
    },
    enabled: !!user && isSuperAdmin,
    staleTime: 1000 * 60 * 10,
  });

  const tenants = isSuperAdmin ? allTenants : memberTenants;
  const isLoading = isSuperAdmin ? isLoadingAll : isLoadingMembers;

  // Validate selectedId against tenant list — reset if stale/invalid
  useEffect(() => {
    if (isLoading || tenants.length === 0) return;
    const isValid = tenants.some(t => t.tenantId === selectedId);
    if (!isValid) {
      const fallback = tenants[0].tenantId;
      localStorage.setItem(STORAGE_KEY, fallback);
      setSelectedId(fallback);
    }
  }, [tenants, selectedId, isLoading]);

  // Determine active tenant
  const activeTenant = tenants.find(t => t.tenantId === selectedId) || tenants[0] || null;

  const switchTenant = useCallback((id: string) => {
    localStorage.setItem(STORAGE_KEY, id);
    setSelectedId(id);
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
