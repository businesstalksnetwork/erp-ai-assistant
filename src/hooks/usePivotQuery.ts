import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import type { MeasureConfig } from "./usePivotConfig";

export interface PivotQueryParams {
  cube: string;
  rows: string[];
  columns?: string[];
  measures: MeasureConfig[];
  filters: Record<string, string[]>;
  sortBy?: string | null;
  sortDir?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

export interface PivotQueryResult {
  rows: Record<string, any>[];
  total_count: number;
  cube: string;
  dimensions: string[];
  offset: number;
  limit: number;
}

export function usePivotQuery(params: PivotQueryParams | null) {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ["pivot-query", tenantId, params],
    queryFn: async (): Promise<PivotQueryResult> => {
      const { data, error } = await supabase.rpc("pivot_query" as any, {
        p_tenant_id: tenantId!,
        p_cube: params!.cube,
        p_rows: params!.rows,
        p_columns: params!.columns || [],
        p_measures: params!.measures,
        p_filters: params!.filters,
        p_sort_by: params!.sortBy || null,
        p_sort_dir: params!.sortDir || "desc",
        p_limit: params!.limit || 100,
        p_offset: params!.offset || 0,
      });

      if (error) throw error;
      return data as PivotQueryResult;
    },
    enabled: !!tenantId && !!params && params.rows.length > 0 && params.measures.length > 0,
    staleTime: 1000 * 60,
  });
}

export function useCubeMetadata(cube: string) {
  return useQuery({
    queryKey: ["cube-metadata", cube],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_cube_metadata" as any, { p_cube: cube });
      if (error) throw error;
      return data as {
        dimensions: string[];
        measures: { col: string; label: string; aggs: string[] }[];
        default_rows: string[];
        default_measure: { col: string; agg: string; alias: string };
      };
    },
    staleTime: 1000 * 60 * 60,
  });
}
