import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";

export interface OpportunityStage {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  name_sr: string | null;
  color: string | null;
  sort_order: number;
  is_won: boolean;
  is_lost: boolean;
  is_system: boolean;
  is_partial: boolean;
  created_at: string;
}

export function useOpportunityStages() {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ["opportunity-stages", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("opportunity_stages" as any)
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("sort_order");
      if (error) throw error;
      return (data || []) as unknown as OpportunityStage[];
    },
    enabled: !!tenantId,
  });
}
