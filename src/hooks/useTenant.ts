import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface TenantMembership {
  tenantId: string;
  tenantName: string;
  role: string;
}

interface TenantContextType {
  tenants: TenantMembership[];
  tenantId: string | null;
  tenantName: string | null;
  role: string | null;
  switchTenant: (id: string) => void;
  isLoading: boolean;
}

const STORAGE_KEY = "selectedTenantId";

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const { user, isSuperAdmin } = useAuth();
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(
    () => localStorage.getItem(STORAGE_KEY)
  );

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

  useEffect(() => {
    if (isLoading || tenants.length === 0) return;
    const isValid = tenants.some(t => t.tenantId === selectedId);
    if (!isValid) {
      const fallback = tenants[0].tenantId;
      localStorage.setItem(STORAGE_KEY, fallback);
      setSelectedId(fallback);
    }
  }, [tenants, selectedId, isLoading]);

  const activeTenant = tenants.find(t => t.tenantId === selectedId) || tenants[0] || null;

  const switchTenant = useCallback((id: string) => {
    localStorage.setItem(STORAGE_KEY, id);
    setSelectedId(id);
    qc.invalidateQueries();
  }, [qc]);

  const value: TenantContextType = {
    tenants,
    tenantId: activeTenant?.tenantId ?? null,
    tenantName: activeTenant?.tenantName ?? null,
    role: activeTenant?.role ?? null,
    switchTenant,
    isLoading,
  };

  return React.createElement(TenantContext.Provider, { value }, children);
}

export function useTenant() {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error("useTenant must be used within TenantProvider");
  return ctx;
}
