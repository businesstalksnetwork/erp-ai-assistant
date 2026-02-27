import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";

interface UseChartOfAccountsOptions {
  /** Columns to select. Default: "id, code, name, name_sr, account_type" */
  select?: string;
  /** Only active accounts. Default: true */
  activeOnly?: boolean;
  /** Filter by account_type(s) */
  accountTypes?: string[];
  /** Custom query key suffix for dedup */
  queryKeySuffix?: string;
  enabled?: boolean;
}

/**
 * Batch-fetches the full chart of accounts (>1000 rows) to avoid Supabase default limit.
 * Uses the same pagination strategy as ChartOfAccounts.tsx.
 */
export function useChartOfAccounts<T = Record<string, unknown>>(opts: UseChartOfAccountsOptions = {}) {
  const { tenantId } = useTenant();
  const {
    select = "id, code, name, name_sr, account_type",
    activeOnly = true,
    accountTypes,
    queryKeySuffix = "",
    enabled = true,
  } = opts;

  return useQuery<T[]>({
    queryKey: ["chart-of-accounts-full", tenantId, select, activeOnly, accountTypes, queryKeySuffix],
    queryFn: async () => {
      if (!tenantId) return [];
      const allData: T[] = [];
      const batchSize = 1000;
      let offset = 0;
      let hasMore = true;
      while (hasMore) {
        let q = supabase
          .from("chart_of_accounts")
          .select(select)
          .eq("tenant_id", tenantId)
          .order("code")
          .range(offset, offset + batchSize - 1);
        if (activeOnly) q = q.eq("is_active", true);
        if (accountTypes && accountTypes.length > 0) q = q.in("account_type", accountTypes);
        const { data, error } = await q;
        if (error) throw error;
        if (data && data.length > 0) {
          allData.push(...(data as T[]));
          offset += batchSize;
          hasMore = data.length === batchSize;
        } else {
          hasMore = false;
        }
      }
      return allData;
    },
    enabled: !!tenantId && enabled,
    staleTime: 1000 * 60 * 5,
  });
}
