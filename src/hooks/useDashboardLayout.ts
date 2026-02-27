import { useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { usePermissions } from "@/hooks/usePermissions";
import { widgetRegistry, type WidgetDefinition } from "@/config/widgetRegistry";

export interface WidgetConfig {
  id: string;
  widgetId: string;
  positionIndex: number;
  width: number;
  height: number;
  isVisible: boolean;
  configJson: Record<string, any>;
}

const QUERY_KEY = "dashboard-widget-configs";

export function useDashboardLayout() {
  const { user } = useAuth();
  const { tenantId, role } = useTenant();
  const { canAccess } = usePermissions();
  const qc = useQueryClient();

  const userId = user?.id;
  const enabled = !!userId && !!tenantId;

  // Fetch configs + auto-seed if empty
  const { data: widgets = [], isLoading } = useQuery({
    queryKey: [QUERY_KEY, userId, tenantId],
    queryFn: async () => {
      // Try fetching existing configs
      let { data, error } = await supabase
        .from("dashboard_widget_configs")
        .select("*")
        .eq("user_id", userId!)
        .eq("tenant_id", tenantId!)
        .order("position_index");

      if (error) throw error;

      // Auto-seed if no configs exist
      if (!data || data.length === 0) {
        await supabase.rpc("seed_default_dashboard", {
          p_user_id: userId!,
          p_tenant_id: tenantId!,
          p_role: role || "user",
        });

        const res = await supabase
          .from("dashboard_widget_configs")
          .select("*")
          .eq("user_id", userId!)
          .eq("tenant_id", tenantId!)
          .order("position_index");
        data = res.data;
      }

      return (data || []).map((row: any): WidgetConfig => ({
        id: row.id,
        widgetId: row.widget_id,
        positionIndex: row.position_index,
        width: row.width,
        height: row.height,
        isVisible: row.is_visible,
        configJson: row.config_json || {},
      }));
    },
    enabled,
    staleTime: 1000 * 60 * 5,
  });

  // Filter to only accessible widgets
  const visibleWidgets = useMemo(
    () =>
      widgets.filter((w) => {
        const def = widgetRegistry[w.widgetId];
        if (!def) return false;
        if (!w.isVisible) return false;
        return canAccess(def.requiredModule);
      }),
    [widgets, canAccess],
  );

  // Available widgets not yet added
  const availableWidgets = useMemo((): WidgetDefinition[] => {
    const currentIds = new Set(widgets.map((w) => w.widgetId));
    return Object.values(widgetRegistry).filter(
      (def) => !currentIds.has(def.id) && canAccess(def.requiredModule),
    );
  }, [widgets, canAccess]);

  const invalidate = () => qc.invalidateQueries({ queryKey: [QUERY_KEY, userId, tenantId] });

  // Add widget
  const addWidgetMut = useMutation({
    mutationFn: async (widgetId: string) => {
      const def = widgetRegistry[widgetId];
      if (!def) throw new Error("Unknown widget");
      const maxPos = widgets.reduce((m, w) => Math.max(m, w.positionIndex), -1);
      await supabase.from("dashboard_widget_configs").insert({
        user_id: userId!,
        tenant_id: tenantId!,
        widget_id: widgetId,
        position_index: maxPos + 1,
        width: def.defaultWidth,
        height: def.defaultHeight,
      });
    },
    onSuccess: invalidate,
  });

  // Remove widget
  const removeWidgetMut = useMutation({
    mutationFn: async (configId: string) => {
      await supabase.from("dashboard_widget_configs").delete().eq("id", configId);
    },
    onSuccess: invalidate,
  });

  // Update layout (reorder / resize)
  const updateLayoutMut = useMutation({
    mutationFn: async (updates: { id: string; positionIndex: number; width?: number; height?: number }[]) => {
      await Promise.all(
        updates.map((u) =>
          supabase
            .from("dashboard_widget_configs")
            .update({
              position_index: u.positionIndex,
              ...(u.width !== undefined && { width: u.width }),
              ...(u.height !== undefined && { height: u.height }),
            })
            .eq("id", u.id),
        ),
      );
    },
    onSuccess: invalidate,
  });

  // Update widget config_json
  const updateConfigMut = useMutation({
    mutationFn: async ({ id, configJson }: { id: string; configJson: Record<string, any> }) => {
      await supabase
        .from("dashboard_widget_configs")
        .update({ config_json: configJson })
        .eq("id", id);
    },
    onSuccess: invalidate,
  });

  return {
    widgets: visibleWidgets,
    allWidgets: widgets,
    availableWidgets,
    isLoading,
    addWidget: useCallback((widgetId: string) => addWidgetMut.mutate(widgetId), [addWidgetMut]),
    removeWidget: useCallback((configId: string) => removeWidgetMut.mutate(configId), [removeWidgetMut]),
    updateLayout: useCallback(
      (updates: { id: string; positionIndex: number; width?: number; height?: number }[]) =>
        updateLayoutMut.mutate(updates),
      [updateLayoutMut],
    ),
    updateConfig: useCallback(
      (id: string, configJson: Record<string, any>) => updateConfigMut.mutate({ id, configJson }),
      [updateConfigMut],
    ),
  };
}
