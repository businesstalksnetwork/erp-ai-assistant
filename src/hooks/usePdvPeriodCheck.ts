import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const MONTH_NAMES_SR = [
  "januar", "februar", "mart", "april", "maj", "jun",
  "jul", "avgust", "septembar", "oktobar", "novembar", "decembar",
];

export function usePdvPeriodCheck(tenantId: string | null, vatDate: string) {
  const periodMonth = vatDate ? new Date(vatDate).getMonth() + 1 : null;
  const periodYear = vatDate ? new Date(vatDate).getFullYear() : null;
  const periodName = periodMonth && periodYear
    ? `${MONTH_NAMES_SR[periodMonth - 1]} ${periodYear}`
    : "";

  const { data: isLocked } = useQuery({
    queryKey: ["pdv-period-check", tenantId, periodYear, periodMonth],
    queryFn: async () => {
      const { data } = await supabase
        .from("pdv_periods" as any)
        .select("is_locked")
        .eq("tenant_id", tenantId!)
        .eq("year", periodYear!)
        .eq("month", periodMonth!)
        .maybeSingle();
      return !!(data as any)?.is_locked;
    },
    enabled: !!tenantId && !!periodMonth && !!periodYear,
    staleTime: 60_000,
  });

  return { isLocked: isLocked ?? false, periodName };
}
