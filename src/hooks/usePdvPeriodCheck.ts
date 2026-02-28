import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const MONTH_NAMES_SR = [
  "januar", "februar", "mart", "april", "maj", "jun",
  "jul", "avgust", "septembar", "oktobar", "novembar", "decembar",
];

export function usePdvPeriodCheck(tenantId: string | null, vatDate: string) {
  // Guard against invalid dates
  const parsedDate = vatDate ? new Date(vatDate) : null;
  const isValidDate = parsedDate && !isNaN(parsedDate.getTime());
  const periodMonth = isValidDate ? parsedDate.getMonth() + 1 : null;
  const periodYear = isValidDate ? parsedDate.getFullYear() : null;
  const periodName = periodMonth && periodYear
    ? `${MONTH_NAMES_SR[periodMonth - 1]} ${periodYear}`
    : "";

  const { data: isLocked } = useQuery({
    queryKey: ["pdv-period-check", tenantId, periodYear, periodMonth],
    queryFn: async () => {
      // pdv_periods uses start_date/end_date — check both monthly and quarterly periods
      const { data } = await supabase
        .from("pdv_periods")
        .select("is_locked")
        .eq("tenant_id", tenantId!)
        .lte("start_date", vatDate)
        .gte("end_date", vatDate)
        .order("start_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      return !!data?.is_locked;
    },
    enabled: !!tenantId && isValidDate && !!periodMonth && !!periodYear,
    staleTime: 60_000,
  });

  return { isLocked: isLocked ?? false, periodName };
}
