import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Sun, CloudSun, Moon, RefreshCw, ChevronDown } from "lucide-react";
import { SimpleMarkdown } from "@/components/ai/SimpleMarkdown";

type TimeOfDay = "morning" | "midday" | "evening";

function getTimeOfDay(): TimeOfDay {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "midday";
  return "evening";
}

const ICONS: Record<TimeOfDay, typeof Sun> = { morning: Sun, midday: CloudSun, evening: Moon };
const ICON_COLORS: Record<TimeOfDay, string> = {
  morning: "text-amber-500",
  midday: "text-orange-400",
  evening: "text-indigo-400",
};

interface Props {
  tenantId: string;
}

export function AiBriefingWidget({ tenantId }: Props) {
  const { t, locale } = useLanguage();
  const [open, setOpen] = useState(true);
  const timeOfDay = useMemo(getTimeOfDay, []);
  const Icon = ICONS[timeOfDay];

  const titleMap: Record<TimeOfDay, Record<string, string>> = {
    morning: { sr: "Jutarnji pregled", en: "Morning Briefing" },
    midday: { sr: "Podnevni pregled", en: "Midday Briefing" },
    evening: { sr: "Večernji pregled", en: "Evening Briefing" },
  };

  const title = titleMap[timeOfDay][locale === "sr" ? "sr" : "en"];

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["ai-briefing", tenantId, timeOfDay],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const { data, error } = await supabase.functions.invoke("ai-daily-digest", {
        body: { tenant_id: tenantId, language: locale, time_of_day: timeOfDay },
      });
      if (error) throw error;
      return data as { digest: string; date: string; sections_count: number; time_of_day: string };
    },
    enabled: !!tenantId,
    staleTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
  });

  if (isLoading) return <Skeleton className="h-32 w-full" />;
  if (!data) return null;

  return (
    <Card className="bg-gradient-to-br from-primary/5 via-accent/5 to-background border-primary/20 h-full">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CollapsibleTrigger className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <Icon className={`h-4 w-4 ${ICON_COLORS[timeOfDay]}`} />
              <CardTitle className="text-sm">{title}</CardTitle>
              <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
            </CollapsibleTrigger>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="text-xs">
            <SimpleMarkdown content={data.digest} />
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
