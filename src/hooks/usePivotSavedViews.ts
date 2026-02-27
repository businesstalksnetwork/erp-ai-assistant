import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import type { PivotConfig } from "./usePivotConfig";

export interface SavedView {
  id: string;
  name: string;
  description: string | null;
  cube: string;
  config_json: Partial<PivotConfig>;
  is_shared: boolean;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
  user_id: string;
}

export function usePivotSavedViews() {
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const qc = useQueryClient();
  const qKey = ["pivot-saved-views", tenantId];

  const { data: views = [], isLoading } = useQuery({
    queryKey: qKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pivot_saved_views" as any)
        .select("*")
        .order("is_pinned", { ascending: false })
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as SavedView[];
    },
    enabled: !!tenantId,
  });

  const saveView = useMutation({
    mutationFn: async (params: { name: string; description?: string; cube: string; config: Partial<PivotConfig> }) => {
      const { error } = await supabase.from("pivot_saved_views" as any).insert({
        tenant_id: tenantId!,
        user_id: user!.id,
        name: params.name,
        description: params.description || null,
        cube: params.cube,
        config_json: params.config,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: qKey }); toast.success("Prikaz sačuvan"); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteView = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pivot_saved_views" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: qKey }); toast.success("Prikaz obrisan"); },
  });

  const toggleShare = useMutation({
    mutationFn: async ({ id, shared }: { id: string; shared: boolean }) => {
      const { error } = await supabase.from("pivot_saved_views" as any).update({ is_shared: shared } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qKey }),
  });

  const togglePin = useMutation({
    mutationFn: async ({ id, pinned }: { id: string; pinned: boolean }) => {
      const { error } = await supabase.from("pivot_saved_views" as any).update({ is_pinned: pinned } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qKey }),
  });

  return { views, isLoading, saveView, deleteView, toggleShare, togglePin };
}
